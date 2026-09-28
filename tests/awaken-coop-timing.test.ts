// Regression (B2): a co-op guest still choosing a level-up when the host moves straight on from its clear
// screen (Next pressed at once) must still get credit for that Stage's Links once its pick resolves -- the
// guest can reach 'route' (or the next Chapter's 'play') without ever passing through 'clear' locally.
// The `linksCounted` guard (reset in startStage()) that makes this safe is also checked against double-counting.
import { describe, expect, it } from 'vitest';
import { parseBalanceConfig, resolveConfig } from '@pixel-horde/config';
import { createSim, hostSnapshot, selfWire, takeHits, type Command, type SimState, type SkillId } from '@pixel-horde/sim';
import { botOptions } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };
const rt = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** host + one mage guest (same wire rhythm as tests/coop.test.ts); the host kills its King at once; guest picks can be held. */
function room() {
  const cfg = resolveConfig(parseBalanceConfig({ shared: { stage: { durBase: 6 } } }));
  const host = createSim(botOptions(21, { events: quiet, coop: { role: 'host', self: 'H' }, debug: { god: true }, config: cfg }));
  const guest = createSim(botOptions(100, { hero: 'mage', events: quiet, coop: { role: 'guest', self: 'G0' }, debug: { god: true }, config: cfg }));
  const hs = host.view() as SimState, gs = guest.view() as SimState;
  let tick = 0, guestPicks = true;
  const hostCmds: Command[] = [], gCmds: Command[] = [];
  const step = (): void => {
    if (tick % 6 === 0) { hostCmds.push({ type: 'mates', mates: rt([selfWire(gs)]) }); const h = takeHits(gs); if (h.length) hostCmds.push({ type: 'remoteHits', hits: rt(h), from: 'G0', q: gs.coop!.seq }); }
    if (hs.phase === 'levelup') hostCmds.push({ type: 'pick', index: 0 });
    if (hs.phase === 'chest') hostCmds.push({ type: 'chestStop' });
    if (hs.boss) hostCmds.push({ type: 'remoteHits', hits: [hs.boss.id, 1e9] });
    host.step({ mx: 0, my: 0 }, hostCmds.splice(0));
    if (tick % 4 === 0) gCmds.push({ type: 'snap', snap: rt(hostSnapshot(hs)) });
    if (guestPicks && gs.phase === 'levelup') gCmds.push({ type: 'pick', index: Math.max(0, gs.levelUp!.options.findIndex((o) => o.kind === 'evo')) });
    if (guestPicks && gs.phase === 'chest') gCmds.push({ type: 'chestStop' });
    guest.step({ mx: 0, my: 0 }, gCmds.splice(0));
    tick++;
  };
  return { host, hs, gs, step, hold: (v: boolean) => { guestPicks = !v; } };
}

describe('B2: co-op guest Stage-end Link timing', () => {
  it('a guest still choosing a mid-play level-up when the host clears and presses Next at once still counts that Stage-end', () => {
    const r = room();
    const max = (id: SkillId): number => r.gs.cfg.skills[id].max;
    for (let i = 0; i < 60; i++) r.step();
    r.gs.P.skills = { sigil: max('sigil'), bolt: max('bolt'), chain: max('chain') };
    r.gs.P.evo = { sigil: true };
    let held = false, route = -1, left = -1;
    for (let i = 0; i < 60 * 60; i++) {
      // the King is up: the guest levels up and does not pick yet (well under coop.pickTime)
      if (!held && r.hs.phase === 'play' && r.hs.bossSpawned && r.gs.phase === 'play') { held = true; r.hold(true); r.gs.pendingLv = 1; }
      r.step();
      // the host reaches its clear screen and presses Next right away (host → route while the guest still chooses)
      if (held && route < 0 && r.hs.phase === 'clear') { r.host.step({ mx: 0, my: 0 }, [{ type: 'next' }]); route = i; }
      if (route >= 0 && i > route + 30) r.hold(false); // the guest finally picks
      if (route >= 0 && left < 0 && i > route + 30 && r.gs.phase !== 'levelup') left = i;
      if (left >= 0 && i > left + 40) break;
    }
    expect(route).toBeGreaterThan(0);
    expect(r.gs.phase).toBe('route'); // it went levelup → play → route without passing 'clear'
    expect(r.gs.P.awakened).toBe(true); // b74ae89: false, linkStages {}
  });
});

describe('B2: linksCounted does not double-count', () => {
  it('solo: several Stage-end rewards opened in the same clearing sequence still count that Stage only once (streak, awaken.stages=2)', () => {
    const cfg = resolveConfig(parseBalanceConfig({ shared: { awaken: { stages: 2 } } }));
    const sim = createSim(botOptions(8, { hero: 'mage', debug: { god: true }, events: quiet, config: cfg }));
    const s = sim.view() as SimState;
    const max = (id: SkillId): number => s.cfg.skills[id].max;
    s.P.skills = { sigil: max('sigil'), bolt: max('bolt'), chain: max('chain') };
    s.P.evo = { sigil: true };
    s.bossSpawned = true; s.boss = null; s.stageTime = s.stageDur;
    for (let i = 0; i < 400 && s.phase !== 'clearing'; i++) sim.step({ mx: 0, my: 0 });
    expect(s.phase).toBe('clearing');
    s.pendingLv += 2; s.chestQueue += 1; // several rewards to cycle through before 'clear'
    for (let i = 0; i < 400 && s.phase !== 'clear'; i++) {
      if (s.phase === 'levelup') sim.step({ mx: 0, my: 0 }, [{ type: 'pick', index: 0 }]);
      else if (s.phase === 'chest') sim.step({ mx: 0, my: 0 }, [{ type: 'chestStop' }]);
      else sim.step({ mx: 0, my: 0 });
    }
    expect(s.phase).toBe('clear');
    expect(s.P.linkStages.bolt).toBe(1); // not 2 or 3: counted once for this one Stage-end
    expect(s.P.linkStages.chain).toBe(1);
    expect(s.P.awakened).toBe(false); // stages=2: needs a 2nd Stage-end in a row
    sim.step({ mx: 0, my: 0 }, [{ type: 'next' }]);
    if (s.phase === 'route') sim.step({ mx: 0, my: 0 }, [{ type: 'route', index: 0 }]);
    s.bossSpawned = true; s.boss = null; s.stageTime = s.stageDur;
    for (let i = 0; i < 400 && s.phase !== 'clear'; i++) {
      const cmds = s.phase === 'levelup' ? [{ type: 'pick' as const, index: 0 }] : s.phase === 'chest' ? [{ type: 'chestStop' as const }] : [];
      sim.step({ mx: 0, my: 0 }, cmds);
    }
    expect(s.phase).toBe('clear');
    expect(s.P.awakened).toBe(true);
  });

  it('a King that escapes still counts that Stage-end exactly once (stages=1 Awakens; stages=2 counts one)', () => {
    const run = (stages: number): SimState => {
      const cfg = resolveConfig(parseBalanceConfig({ shared: { awaken: { stages } } }));
      const sim = createSim(botOptions(9, { hero: 'mage', debug: { god: true }, events: quiet, config: cfg }));
      const s = sim.view() as SimState;
      const max = (id: SkillId): number => s.cfg.skills[id].max;
      s.P.skills = { sigil: max('sigil'), bolt: max('bolt'), chain: max('chain') };
      s.P.evo = { sigil: true };
      s.stageTime = s.stageDur * 0.56;
      for (let i = 0; i < 400 && !s.boss; i++) sim.step({ mx: 0, my: 0 });
      expect(s.boss).toBeTruthy();
      s.stageTime = s.stageDur + 44.9;
      for (let i = 0; i < 400 && s.phase !== 'clear'; i++) {
        const cmds = s.phase === 'levelup' ? [{ type: 'pick' as const, index: 0 }] : s.phase === 'chest' ? [{ type: 'chestStop' as const }] : [];
        sim.step({ mx: 0, my: 0 }, cmds);
      }
      expect(s.phase).toBe('clear');
      expect(s.lastEnd).toBe('escape');
      return s;
    };
    expect(run(1).P.awakened).toBe(true);
    const s2 = run(2);
    expect(s2.P.awakened).toBe(false);
    expect(s2.P.linkStages.bolt).toBe(1);
    expect(s2.P.linkStages.chain).toBe(1);
  });
});
