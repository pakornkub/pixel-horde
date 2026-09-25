import { describe, expect, it } from 'vitest';
import { createSim, type HazardKind, type RealmId, type Sim, type SimEvent, type SimState } from '@pixel-horde/sim';
import { botOptions, botStep } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };

/** A god-mode sim in `realm`, run until its King has arrived. */
function withKing(realm: RealmId, seed = 7): { sim: Sim; s: SimState; t: number; events: SimEvent[] } {
  const sim = createSim(botOptions(seed, { debug: { god: true }, events: quiet }));
  const s = sim.view() as SimState;
  s.realm = realm;
  const events: SimEvent[] = [];
  let t = 0;
  for (; t < 60 * 60 && !s.boss; t++) { botStep(sim, t); }
  expect(s.boss).not.toBeNull();
  return { sim, s, t, events };
}

/** Step `secs` seconds; `each` runs before every step. Returns hazard kinds and events seen. */
function run(sim: Sim, t0: number, secs: number, each?: (s: SimState) => void) {
  const s = sim.view() as SimState;
  const kinds = new Set<HazardKind>(), events: SimEvent[] = [];
  let t = t0;
  for (; t < t0 + secs * 60; t++) {
    each?.(s);
    const ev = sim.step({ mx: 0, my: 0 }, s.phase === 'levelup' ? [{ type: 'pick', index: 0 }] : s.phase === 'chest' ? [{ type: 'chestStop' }] : []);
    events.push(...ev);
    for (const h of s.hz) kinds.add(h.k);
  }
  return { kinds, events, t };
}

describe('King framework', () => {
  it('a King enters phase 2 below 50% HP and says so; the ultimate only comes in phase 2', () => {
    const { sim, s, t } = withKing('greenvale');
    expect(s.boss!.kg!.phase).toBe(1);
    const says = (ev: SimEvent[]) => ev.filter((e) => e.t === 'say').map((e) => (e as { beat: string }).beat);
    // phase 1 for 20 s at full HP: no Royal Splash (the only ring in Greenvale)
    const p1 = run(sim, t, 20, (st) => { if (st.boss) st.boss.hp = st.boss.maxHp; st.stageTime = Math.min(st.stageTime, 5); });
    expect(p1.kinds.has('ring')).toBe(false);
    expect(p1.kinds.has('circ')).toBe(true);
    const p2 = run(sim, p1.t, 20, (st) => { if (st.boss) st.boss.hp = st.boss.maxHp * 0.4; st.stageTime = Math.min(st.stageTime, 5); });
    expect(s.boss!.kg!.phase).toBe(2);
    expect(says(p2.events)).toContain('half');
    expect(p2.kinds.has('ring')).toBe(true);
  });

  it('overtime enrages the King and unlocks the ultimate even in phase 1', () => {
    const { sim, s, t } = withKing('greenvale');
    const spd = s.boss!.spd, dmg = s.boss!.dmg;
    s.stageTime = s.stageDur - 0.05;
    const r = run(sim, t, 12, (st) => { if (st.boss) st.boss.hp = st.boss.maxHp; });
    expect(s.overtime).toBe(true);
    expect(s.boss!.spd).toBeCloseTo(spd * s.cfg.stage.enrageSpd);
    expect(s.boss!.dmg).toBeCloseTo(dmg * s.cfg.stage.enrageDmg);
    expect(s.boss!.kg!.phase).toBe(1);
    expect(r.kinds.has('ring')).toBe(true);
  });

  it.each([
    ['sunscar', ['beam', 'pull']],
    ['deepdark', ['line', 'proj']],
    ['frostpeak', ['ice', 'safe']],
  ] as [RealmId, HazardKind[]][])('%s King uses its own moves and ultimate', (realm, want) => {
    const { sim, t } = withKing(realm);
    const r = run(sim, t, 30, (st) => { if (st.boss) st.boss.hp = st.boss.maxHp * 0.4; st.stageTime = Math.min(st.stageTime, 5); });
    for (const k of want) expect(r.kinds, k).toContain(k);
  });

  it('Bone King raises skeletons and the crypt leaves a way out', () => {
    const { sim, s, t } = withKing('deepdark', 7);
    let skel = 0, cryptSeen = false;
    run(sim, t, 60, (st) => {
      if (st.boss) st.boss.hp = st.boss.maxHp * 0.4;
      st.stageTime = Math.min(st.stageTime, 5);
      skel = Math.max(skel, st.enemies.filter((e) => e.type === 'skel').length);
      const pillars = st.hz.filter((h) => h.k === 'circ' && h.c === 4 && h.r === st.cfg.kings.crypt.spotR && h.t < 0.02);
      if (pillars.length) { cryptSeen = true; expect(pillars.length).toBe(st.cfg.kings.crypt.n - st.cfg.kings.crypt.gap); }
    });
    expect(skel).toBeGreaterThan(0);
    expect(cryptSeen).toBe(true);
    expect(s.boss).not.toBeNull();
  });

  it('the spawn banner names the direction and the King speaks on arrival and escape', () => {
    const sim = createSim(botOptions(7, { debug: { god: true }, events: quiet }));
    const all: SimEvent[] = [];
    for (let t = 0; t < 3 * 60 * 60 && (sim.view().escapes === 0); t++) {
      const s = sim.view() as SimState;
      if (s.boss) s.boss.hp = s.boss.maxHp;
      const cmds = s.phase === 'levelup' ? [{ type: 'pick' as const, index: 0 }] : s.phase === 'chest' ? [{ type: 'chestStop' as const }] : [];
      all.push(...sim.step({ mx: 0, my: 0 }, cmds));
    }
    const inc = all.find((e) => e.t === 'banner' && e.key === 'bossIncoming') as unknown as { args: { dir: string } };
    expect(['left', 'right', 'up', 'down']).toContain(inc.args.dir);
    const beats = all.filter((e) => e.t === 'say').map((e) => `${(e as { who: string }).who}:${(e as { beat: string }).beat}`);
    expect(beats).toContain('boss:arrive');
    expect(beats).toContain('boss:escape');
    expect(beats).toContain('umbra:absorb');
  });

  it('Umbra borrows the ultimate of a King that escaped', () => {
    const { sim, s, t } = withKing('crater');
    s.escapedKings = ['frostpeak'];
    const r = run(sim, t, 25, (st) => { if (st.boss) st.boss.hp = st.boss.maxHp * 0.4; st.stageTime = Math.min(st.stageTime, 5); });
    expect(s.boss!.type).toBe('umbra');
    expect(r.kinds).toContain('safe');
  });
});

describe('Royal Splash', () => {
  it('the slime wave starts where the King lands', () => {
    const { sim, s, t } = withKing('greenvale');
    let checked = false;
    run(sim, t, 25, (st) => {
      if (st.boss) st.boss.hp = st.boss.maxHp * 0.4;
      st.stageTime = Math.min(st.stageTime, 5);
      const ring = st.hz.find((h) => h.k === 'ring' && h.t < 0.02);
      if (ring && st.boss) { expect(ring.x).toBe(st.boss.x); expect(ring.y).toBe(st.boss.y); checked = true; }
    });
    expect(checked).toBe(true);
    expect(s.boss).not.toBeNull();
  });
});

describe('King move warnings', () => {
  it('every hazard a King creates is tagged with its move (red telegraph + on-screen warning)', async () => {
    const { KING_KITS } = await import('@pixel-horde/sim');
    const { sim, t } = withKing('greenvale');
    const tags = new Set<string>();
    run(sim, t, 20, (st) => { for (const h of st.hz) if (h.bm) tags.add(h.bm); });
    const kit = KING_KITS.boss!;
    expect(tags.size).toBeGreaterThan(0);
    for (const k of tags) expect([...kit.moves, kit.ult]).toContain(k);
  });
});
