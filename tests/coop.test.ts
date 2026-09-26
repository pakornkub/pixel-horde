// Co-op (tickets 41/42), headless: a host sim and guest sims exchange presence, damage and
// snapshots the way the client does (JSON round-trips, 15 Hz snapshots, 10 Hz guest messages).
import { describe, expect, it } from 'vitest';
import { parseBalanceConfig, resolveConfig } from '@pixel-horde/config';
import { createSim, decHp, encHp, hostSnapshot, packEnemies, selfWire, takeHits, unpackEnemies, type Command, type HostSnap, type SimState } from '@pixel-horde/sim';
import { botOptions } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };
const rt = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function room(nGuests: number, extra: Parameters<typeof botOptions>[1] = {}) {
  const host = createSim(botOptions(21, { events: quiet, coop: { role: 'host', self: 'H' }, ...extra }));
  const guests = Array.from({ length: nGuests }, (_, i) => createSim(botOptions(100 + i, { events: quiet, coop: { role: 'guest', self: 'G' + i }, ...extra })));
  let tick = 0;
  const hostCmds: Command[] = [];
  const guestCmds: Command[][] = guests.map(() => []);
  const moves: [number, number][] = guests.map(() => [0, 0]);
  function step(n = 1, hostInput = { mx: 0, my: 0 }, auto = true): void {
    for (let k = 0; k < n; k++, tick++) {
      if (tick % 6 === 0) { // guests → host (10 Hz): presence + damage
        hostCmds.push({ type: 'mates', mates: rt(guests.map((g) => selfWire(g.view() as SimState))) });
        guests.forEach((g, i) => { const h = takeHits(g.view() as SimState); if (h.length) hostCmds.push({ type: 'remoteHits', hits: rt(h), from: 'G' + i, q: (g.view() as SimState).coop!.seq }); });
      }
      const hv = host.view();
      if (auto) {
        if (hv.phase === 'levelup') hostCmds.push({ type: 'pick', index: 0 });
        if (hv.phase === 'chest') hostCmds.push({ type: 'chestStop' });
      }
      host.step(hostInput, hostCmds.splice(0));
      if (tick % 4 === 0) { const snap = rt(hostSnapshot(host.view() as SimState)); guests.forEach((_, i) => guestCmds[i].push({ type: 'snap', snap })); }
      guests.forEach((g, i) => {
        const gv = g.view();
        if (auto && gv.phase === 'levelup') guestCmds[i].push({ type: 'pick', index: 0 });
        if (auto && gv.phase === 'chest') guestCmds[i].push({ type: 'chestStop' });
        g.step({ mx: moves[i][0], my: moves[i][1] }, guestCmds[i].splice(0));
      });
    }
  }
  return { host, guests, step, moves, hs: () => host.view() as SimState, gs: (i = 0) => guests[i].view() as SimState };
}

describe('co-op host / guest', () => {
  it('packs monsters in 11 characters each and snapshots stay under 6 KB', () => {
    const sim = createSim(botOptions(3, { events: quiet, coop: { role: 'host', self: 'H' }, debug: { god: true } }));
    const s = sim.view() as SimState;
    for (let i = 0; i < 400; i++) s.enemies.push({ ...s.enemies[0] ?? {}, id: i, type: 'slime', x: s.P.x + i - 200, y: s.P.y - i, dead: false, elite: i % 7 === 0, armor: i % 5 === 0 ? 3 : 0 } as never);
    const str = packEnemies(s.enemies, 10, -20);
    expect(str.length).toBe(230 * 11);
    const back = unpackEnemies(str, 10, -20);
    expect(back[7]).toMatchObject({ id: 7, type: 'slime', elite: true, x: Math.round(s.P.x + 7 - 200), y: Math.round(s.P.y - 7) });
    expect(back[5].armored).toBe(true);
    expect(JSON.stringify(hostSnapshot(s)).length).toBeLessThan(6144); // with monster HP (4 chars each); the relay limit is 16 KB
  });

  it('guests mirror the host world and their damage kills host monsters', () => {
    const r = room(1, { debug: { god: true } });
    r.step(20 * 60);
    const h = r.hs(), g = r.gs();
    expect(h.enemies.length).toBeGreaterThan(5);
    expect(Math.abs(g.enemies.length - h.enemies.length)).toBeLessThan(10);
    expect(g.stage).toBe(h.stage);
    // the guest killed things through its own Skills (host kills include the guest's)
    const before = h.kills;
    const target = h.enemies.find((e) => !e.boss)!;
    r.host.step({ mx: 0, my: 0 }, [{ type: 'remoteHits', hits: [target.id, 1e9] }]);
    expect(target.dead).toBe(true);
    expect(r.hs().kills).toBeGreaterThan(before);
    // guests level up from the team's pickups
    expect(g.kills).toBeGreaterThan(0);
    expect(g.P.lv).toBeGreaterThan(1);
  });

  it('monster HP travels in 3 characters, rounded up, within 0.03%', () => {
    for (const v of [0.4, 1, 7, 100, 12345.6, 987654321]) {
      const back = decHp(encHp(v), 0);
      expect(back).toBeGreaterThanOrEqual(Math.ceil(v));
      expect(back).toBeLessThanOrEqual(Math.ceil(v) * (1 + 1 / 4096) + 1e-9);
    }
    expect(decHp(encHp(0), 0)).toBe(0);
  });

  it('guests see monster HP and predict their own kills; the host confirms them and nothing comes back', () => {
    const r = room(1, { debug: { god: true } });
    r.step(4 * 60);
    const g = r.gs(), h = r.hs();
    const ge = g.enemies.find((e) => !e.boss && e.predHp)!;
    const he = h.enemies.find((e) => e.id === ge.id)!;
    expect(ge.hp).toBeGreaterThan(0); // real HP now (it used to be 1e12 on guests)
    expect(ge.hp).toBeLessThanOrEqual(he.maxHp * 1.001 + 1);
    expect(ge.maxHp).toBeGreaterThanOrEqual(ge.hp);
    // this guest's damage that the host has not seen yet already kills the monster here
    g.coop!.out[ge.id] = (g.coop!.out[ge.id] || 0) + he.maxHp * 2;
    const kills = r.guests[0].step({ mx: 0, my: 0 }, [{ type: 'snap', snap: rt(hostSnapshot(h)) }]).filter((e) => e.t === 'kill');
    expect(kills.some((e) => e.t === 'kill' && e.x === ge.x)).toBe(true); // death animation on the guest
    expect(r.gs().enemies.some((e) => e.id === ge.id)).toBe(false);
    expect(he.dead).toBe(false); // the host has not got the damage yet
    // the damage reaches the host; the monster never reappears on the guest
    for (let i = 0; i < 30; i++) { r.step(1); expect(r.gs().enemies.some((e) => e.id === ge.id)).toBe(false); }
    expect(he.dead).toBe(true);
    expect(r.gs().coop!.pend.length).toBeLessThan(3); // acknowledged batches are dropped
  });

  it("a guest's normal and Ultimate damage to one monster in the same batch both reach the host", () => {
    const r = room(1, { debug: { god: true } });
    r.step(60);
    const g = r.gs();
    g.coop!.out = { 7: 50 }; g.coop!.outU = { 7: 100 };
    expect(takeHits(g)).toEqual([7, 50, 7, -100]);
  });

  it('scales boss HP by 1 + 0.6 × extra players', () => {
    const kingHp = (n: number): number => {
      const cfg = resolveConfig(parseBalanceConfig({ shared: { stage: { bossAt: 0.02 }, director: { start: 1, min: 1, max: 1 } } }));
      const r = room(n, { debug: { god: true }, config: cfg });
      for (let i = 0; i < 60 * 30 && !r.hs().boss; i++) r.step(1);
      const b = r.hs().boss!;
      return b.maxHp / (1 + 0.08 * (r.hs().P.lv - 1));
    };
    expect(kingHp(2) / kingHp(0)).toBeCloseTo(2.2, 1);
  });

  it('the room keeps playing while a guest chooses; the chooser is shielded and a pick is made in time', () => {
    const r = room(1, { debug: { god: false } });
    r.step(60);
    const g = r.gs();
    g.P.xp = g.P.need; // next tick: level-up
    r.step(2, undefined, false);
    expect(r.gs().phase).toBe('levelup');
    const t0 = r.hs().stageTime, hp0 = r.gs().P.hp;
    // monsters on top of the choosing guest are pushed out and cannot hurt them
    const gv = r.gs();
    for (const e of gv.enemies.slice(0, 5)) { e.x = gv.P.x + 2; e.y = gv.P.y; }
    r.step(60, undefined, false);
    expect(r.hs().stageTime).toBeGreaterThan(t0 + 0.9); // not frozen for anyone
    expect(hostSnapshot(r.hs()).ph).toBe('play');
    expect(r.gs().P.hp).toBe(hp0);
    for (const e of r.gs().enemies.filter((x) => !x.boss && x.tx === undefined)) expect(Math.hypot(e.x - gv.P.x, e.y - gv.P.y)).toBeGreaterThan(20);
    // nobody picked: after pickTime (10 s) one is made
    r.step(10 * 60, undefined, false);
    expect(r.gs().P.lv).toBeGreaterThan(1);
  });

  it('the shield stays coop.shieldAfter seconds after choosing: the player moves, still takes no damage', () => {
    const r = room(1);
    r.step(60);
    r.gs().P.xp = r.gs().P.need;
    r.step(2, undefined, false);
    expect(r.gs().phase).toBe('levelup');
    r.guests[0].step({ mx: 0, my: 0 }, [{ type: 'pick', index: 0 }]);
    r.step(1, undefined, false);
    const g = r.gs();
    expect(g.phase).toBe('play');
    expect(g.coop!.shieldT).toBeGreaterThan(4.5);
    const hp0 = g.P.hp, x0 = g.P.x;
    for (const e of g.enemies.slice(0, 5)) { e.tx = g.P.x + 1; e.ty = g.P.y; e.x = g.P.x + 1; e.y = g.P.y; }
    r.moves[0][0] = 1;
    r.step(4 * 60, undefined, false);
    expect(r.gs().P.x).toBeGreaterThan(x0 + 50); // can move
    expect(r.gs().P.hp).toBe(hp0); // no damage yet
    r.step(2 * 60, undefined, false);
    expect(r.gs().coop!.shieldT).toBe(0);
  });

  it('coop.choosingSkills 0: a choosing player casts nothing until they pick (1, version 0: they keep casting)', () => {
    const casts = (choosingSkills: number): boolean => {
      const cfg = resolveConfig(parseBalanceConfig({ shared: { coop: { choosingSkills } } }));
      const sim = createSim(botOptions(21, { events: quiet, coop: { role: 'host', self: 'H' }, debug: { god: true }, config: cfg }));
      for (let i = 0; i < 60; i++) sim.step({ mx: 0, my: 0 }, []);
      const s = sim.view() as SimState;
      s.P.xp = s.P.need;
      sim.step({ mx: 0, my: 0 }, []);
      expect(sim.view().phase).toBe('levelup');
      const cds0 = JSON.stringify(s.P.cds), pet0 = JSON.stringify(s.P.pet);
      for (let i = 0; i < 120; i++) sim.step({ mx: 0, my: 0 }, []);
      expect(sim.view().phase).toBe('levelup'); // still choosing
      return JSON.stringify(s.P.cds) !== cds0 || JSON.stringify(s.P.pet) !== pet0; // skill timers moved
    };
    expect(casts(0)).toBe(false);
    expect(casts(1)).toBe(true);
  });

  it('coop.xpShareK: every player gets 1 / (1 + k × other players) of a shared EXP pickup', () => {
    const cfg = resolveConfig(parseBalanceConfig({ shared: { coop: { xpShareK: 0.4 }, spawn: { base: 0, prog: 0, swarmFirst: 600 } } }));
    const r = room(1, { debug: { god: true }, config: cfg });
    r.step(30);
    const h = r.hs(), g = r.gs();
    h.P.xp = 0; g.P.xp = 0;
    h.gems.push({ kind: 'xp', x: h.P.x + 2, y: h.P.y, v: 7, mag: false });
    r.step(20);
    expect(r.hs().P.lv).toBe(1);
    expect(r.hs().P.xp).toBeCloseTo(5, 6); // 7 / (1 + 0.4 × 1)
    expect(r.gs().P.xp).toBeCloseTo(5, 6);
  });

  it('the host choosing a level-up does not stop the world either', () => {
    const r = room(1, { debug: { god: true } });
    r.step(60);
    r.hs().P.xp = r.hs().P.need;
    r.step(2, undefined, false);
    expect(r.hs().phase).toBe('levelup');
    const t0 = r.hs().stageTime, k0 = r.hs().enemies.length + r.hs().kills;
    r.step(120, undefined, false);
    expect(r.hs().stageTime).toBeGreaterThan(t0 + 1.9);
    expect(r.hs().enemies.length + r.hs().kills).toBeGreaterThan(k0); // still spawning
    r.step(10 * 60, undefined, false);
    expect(r.hs().phase).not.toBe('levelup');
  });

  it('drops are shared: guests see them, anyone picks them up and the whole team gets EXP, Gold and chests', () => {
    const r = room(1, { debug: { god: true } });
    r.step(30);
    const h = r.hs(), g = r.gs();
    g.P.x = h.P.x + 300; g.P.y = h.P.y; // far apart
    r.step(12);
    const hx = r.hs().P.xp + r.hs().P.lv * 1000, gx = r.gs().P.xp + r.gs().P.lv * 1000, hg = r.hs().runGold, gg = r.gs().runGold;
    h.gems.push({ kind: 'xp', x: g.P.x + 3, y: g.P.y, v: 40, mag: false }, { kind: 'coin', x: g.P.x - 3, y: g.P.y, v: 10, mag: false },
      { kind: 'chest', x: h.P.x + 150, y: h.P.y + 150, v: 0, mag: false });
    r.step(4);
    expect(r.gs().coop!.drops.some((d) => d.kind === 'chest')).toBe(true); // visible on the guest
    r.step(20);
    // the guest walked over them (host side): both players got the EXP and the Gold
    expect(r.hs().gems.some((x) => x.kind === 'xp' && x.v === 40)).toBe(false);
    expect(r.hs().P.xp + r.hs().P.lv * 1000).toBeGreaterThan(hx + 30);
    expect(r.gs().P.xp + r.gs().P.lv * 1000).toBeGreaterThan(gx + 30); // (a level-up resets xp but adds 1000 here)
    expect(r.hs().runGold).toBeGreaterThanOrEqual(hg + 10);
    expect(r.gs().runGold).toBeGreaterThanOrEqual(gg + 10);
  });

  it('a heart heals the player who takes it and allies close by', () => {
    const r = room(1, { debug: { god: true } });
    r.step(30);
    const h = r.hs(), g = r.gs();
    g.P.x = h.P.x + 20; g.P.y = h.P.y;
    h.P.hp = 10; g.P.hp = 10;
    r.step(12);
    h.gems.push({ kind: 'heart', x: h.P.x, y: h.P.y, v: 0.5, mag: false });
    r.step(12);
    expect(r.hs().P.hp).toBeGreaterThan(40);
    expect(r.gs().P.hp).toBeGreaterThan(40);
  });

  it('a Shield pickup guards the player who takes it and allies close by (guests too)', () => {
    const r = room(1, { debug: { god: true } });
    r.step(30);
    const h = r.hs(), g = r.gs();
    g.P.x = h.P.x + 20; g.P.y = h.P.y;
    r.step(12);
    h.gems.push({ kind: 'shield', x: h.P.x, y: h.P.y, v: 0.3, mag: false });
    r.step(4);
    expect(r.gs().coop!.drops.some((d) => d.kind === 'shield') || r.hs().P.guard > 0).toBe(true); // guests see it (unless already taken)
    r.step(12);
    expect(r.hs().P.guard).toBe(Math.round(r.hs().P.maxHp * 0.3));
    expect(r.gs().P.guard).toBe(Math.round(r.gs().P.maxHp * r.gs().cfg.loot.shieldAbsorb));
    expect(r.gs().P.guardT).toBeGreaterThan(0);
    // a far ally gets nothing
    const r2 = room(1, { debug: { god: true } });
    r2.step(30);
    r2.gs().P.x = r2.hs().P.x + 400;
    r2.step(12);
    r2.hs().gems.push({ kind: 'shield', x: r2.hs().P.x, y: r2.hs().P.y, v: 0.3, mag: false });
    r2.step(16);
    expect(r2.hs().P.guard).toBeGreaterThan(0);
    expect(r2.gs().P.guard).toBe(0);
  });

  it('Kings aim at a player who is still standing, not at a downed host', () => {
    const cfg = resolveConfig(parseBalanceConfig({ shared: { stage: { bossAt: 0.02 } } }));
    const r = room(1, { debug: { god: true }, config: cfg });
    for (let i = 0; i < 60 * 30 && !r.hs().boss; i++) r.step(1);
    const h = r.hs(), g = r.gs();
    h.P.down = true;
    g.P.x = h.P.x + 400; g.P.y = h.P.y;
    r.step(6);
    const before = r.hs().hz.length;
    for (let i = 0; i < 60 * 12; i++) { r.hs().P.down = true; r.step(1); }
    const aimed = r.hs().hz.slice(before).filter((z) => z.k === 'circ' && z.d);
    const nearGuest = aimed.filter((z) => Math.hypot(z.x - r.gs().P.x, z.y - r.gs().P.y) < 120).length;
    const nearHost = aimed.filter((z) => Math.hypot(z.x - r.hs().P.x, z.y - r.hs().P.y) < 60).length;
    expect(nearGuest).toBeGreaterThanOrEqual(nearHost);
  });

  it('downed players get up after 3 s next to an ally; everyone down ends the Run', () => {
    const r = room(1, { debug: { god: true } });
    r.step(60);
    const g = r.gs();
    g.P.down = true; g.P.hp = 0;
    g.P.x = r.hs().P.x + 5; g.P.y = r.hs().P.y;
    r.step(4 * 60);
    expect(r.gs().P.down).toBe(false); // host stood next to them
    expect(r.gs().P.hp).toBeGreaterThan(0);
    // both down → Run over for both
    const h = r.hs(), g2 = r.gs();
    h.P.down = true; g2.P.down = true; g2.P.x += 500;
    r.step(30);
    expect(r.hs().phase).toBe('over');
    expect(r.gs().phase).toBe('over');
  });

  it('coop.goldSplit: Gold goes to a team pot split evenly at the Stage end; a dropped chest is the picker\'s alone', () => {
    const cfg = resolveConfig(parseBalanceConfig({ shared: { stage: { durBase: 6 }, coop: { goldSplit: 1 } } }));
    const r = room(1, { debug: { god: true }, config: cfg });
    r.step(30);
    const h = r.hs(), g = r.gs();
    g.P.x = h.P.x + 300; g.P.y = h.P.y; // far apart
    r.step(12);
    const hg0 = h.runGold, gg0 = g.runGold, hq0 = h.chestQueue + h.coop!.teamChests;
    h.gems.push({ kind: 'coin', x: g.P.x + 2, y: g.P.y, v: 30, mag: false }, { kind: 'coin', x: h.P.x + 2, y: h.P.y, v: 10, mag: false },
      { kind: 'chest', x: g.P.x - 2, y: g.P.y, v: 0, mag: false });
    r.step(20);
    // picked up: counted per player, nobody's Gold moves yet; the chest went to the guest only
    expect(r.hs().coop!.pot).toMatchObject({ G0: 30, H: 10 });
    expect(r.gs().coop!.pot).toMatchObject({ G0: 30, H: 10 }); // the guest sees the pot too (HUD share)
    expect(r.hs().chestQueue + r.hs().coop!.teamChests).toBe(hq0);
    expect(r.gs().runGold - gg0).toBe(cfg.loot.chestGold); // its chest's Gold only
    expect(r.hs().runGold).toBe(hg0);
    // the Stage ends (King killed): 40 G ÷ 2 each, no Greed in this test
    for (let i = 0; i < 60 * 60 && r.hs().phase !== 'clear'; i++) {
      const hh = r.hs();
      r.host.step({ mx: 0, my: 0 }, hh.boss ? [{ type: 'remoteHits', hits: [hh.boss.id, 1e9] }] : []);
      r.step(1);
    }
    r.step(8);
    const hs = r.hs().coop!.split!, gsp = r.gs().coop!.split!;
    expect(hs).toMatchObject({ st: 1, total: 40, players: 2, mine: 10, got: 20 });
    expect(gsp).toMatchObject({ st: 1, total: 40, players: 2, mine: 30, got: 20 });
    // King Gold still reaches both in full (guests through the King kill, never also through the team)
    const kingG = cfg.stage.kingGold;
    expect(r.hs().runGold - hg0).toBeGreaterThanOrEqual(20 + kingG);
    expect(r.gs().runGold - gg0).toBe(cfg.loot.chestGold + 20 + kingG);
  });

  it('guests follow the host into the next Stage', () => {
    const cfg = resolveConfig(parseBalanceConfig({ shared: { stage: { durBase: 6 } } }));
    const r = room(1, { debug: { god: true }, config: cfg });
    for (let i = 0; i < 60 * 60 && r.hs().phase !== 'clear'; i++) {
      // kill the King quickly so the Stage can end
      const h = r.hs();
      const cmds: Command[] = [];
      if (h.boss) cmds.push({ type: 'remoteHits', hits: [h.boss.id, 1e9] });
      r.host.step({ mx: 0, my: 0 }, cmds);
      r.step(1);
    }
    expect(r.hs().phase).toBe('clear');
    r.step(8);
    expect(r.gs().phase).toBe('clear');
    expect(r.gs().kingsKilled.length).toBeGreaterThan(0);
    r.host.step({ mx: 0, my: 0 }, [{ type: 'next' }]);
    r.step(2);
    if (r.hs().phase === 'route') { r.host.step({ mx: 0, my: 0 }, [{ type: 'route', index: 0 }]); }
    r.step(10);
    expect(r.hs().stage).toBe(2);
    expect(r.gs().stage).toBe(2);
    expect(r.gs().phase).toBe('play');
    expect(r.gs().realm).toBe(r.hs().realm);
    const snap: HostSnap = hostSnapshot(r.hs());
    expect(snap.pl.map((p) => p.id)).toEqual(['H', 'G0']);
  });

  it('a King escape costs guests the same Escape penalty as the host', () => {
    const cfg = resolveConfig(parseBalanceConfig({ shared: { stage: { durBase: 6, overtime: 3 } } }));
    const r = room(1, { debug: { god: true }, config: cfg });
    for (let i = 0; i < 60 * 60 && r.hs().phase !== 'clear'; i++) r.step(1);
    r.step(8);
    expect(r.hs().lastEnd).toBe('escape');
    expect(r.hs().escapes).toBe(1);
    expect(r.gs().escapes).toBe(1);
    r.step(20); // later snapshots do not count it again
    expect(r.gs().escapes).toBe(1);
  });

  it('runs 4 minutes with three guests without errors', () => {
    const r = room(3);
    for (let i = 0; i < 4 * 60 * 60; i++) {
      r.moves.forEach((m, k) => { m[0] = Math.cos(i / 90 + k); m[1] = Math.sin(i / 70 + k * 2); });
      const h = r.hs();
      if (h.phase === 'clear') r.host.step({ mx: 0, my: 0 }, [{ type: 'next' }]);
      if (h.phase === 'route') r.host.step({ mx: 0, my: 0 }, [{ type: 'route', index: 0 }]);
      r.step(1, { mx: Math.sin(i / 50), my: Math.cos(i / 80) });
      if (r.hs().phase === 'over') break;
    }
    expect(r.hs().kills).toBeGreaterThan(50);
    for (let i = 0; i < 3; i++) expect(r.gs(i).kills).toBeGreaterThan(0);
  });

  it('Endless: guests continue when the host does', () => {
    const r = room(1, { debug: { god: true } });
    r.step(60);
    const h = r.hs();
    h.phase = 'victory'; h.victory = true;
    r.step(8, undefined, false);
    expect(r.gs().phase).toBe('victory');
    r.host.step({ mx: 0, my: 0 }, [{ type: 'endless', go: true }]);
    r.step(8, undefined, false);
    expect(r.gs().endless).toBe(true);
    expect(['clear', 'route', 'play']).toContain(r.gs().phase);
  });
});
