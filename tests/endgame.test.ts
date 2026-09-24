import { describe, expect, it } from 'vitest';
import { createSim, endlessBreakdown, scoreOf, type SimEvent, type SimState } from '@pixel-horde/sim';
import { hurtP, killE } from '../packages/sim/src/systems/combat';
import { spawnEnemy } from '../packages/sim/src/systems/spawner';
import { botOptions } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };

/** A sim standing in the Heart Crater with Umbra spawned. */
function crater(extra: Parameters<typeof botOptions>[1] = {}, escapes = 0) {
  const sim = createSim(botOptions(12, { debug: { god: true }, events: quiet, ...extra }));
  const s = sim.view() as SimState;
  s.escapes = escapes;
  s.stage = 7; s.phase = 'clear'; s.lastEnd = 'clear';
  sim.step({ mx: 0, my: 0 }, [{ type: 'next' }]);
  const ev: SimEvent[] = [];
  const auto = (): Parameters<typeof sim.step>[1] => { const ph: string = s.phase; return ph === 'levelup' ? [{ type: 'pick', index: 0 }] : ph === 'chest' ? [{ type: 'chestStop' }] : []; };
  const step = (n = 1, cmds?: Parameters<typeof sim.step>[1]) => { for (let i = 0; i < n; i++) ev.push(...sim.step({ mx: 0, my: 0 }, i === 0 && cmds ? cmds : auto())); };
  for (let i = 0; i < 200 * 60 && !s.boss; i++) step();
  return { sim, s, step, ev };
}

describe('Umbra', () => {
  it('has +15% HP per Escape', () => {
    const a = crater({}, 0), b = crater({}, 2);
    expect(b.s.boss!.maxHp / a.s.boss!.maxHp).toBeCloseTo(1.3, 2);
  });

  it('fights in three phases: shadow skills, stolen ultimates, darkened heart', () => {
    const { s, step, ev } = crater();
    const u = s.boss!;
    expect(u.type).toBe('umbra');
    u.hp = u.maxHp * 0.7; step(2);
    expect(u.kg!.phase).toBe(1);
    u.hp = u.maxHp * 0.6; step(2);
    expect(u.kg!.phase).toBe(2);
    expect(s.darkness).toBe(false);
    u.hp = u.maxHp * 0.3; step(2);
    expect(u.kg!.phase).toBe(3);
    expect(s.darkness).toBe(true);
    const beats = ev.filter((e) => e.t === 'say').map((e) => (e as { beat: string }).beat);
    expect(beats).toEqual(expect.arrayContaining(['arrive', 'half', 'heart']));
  });

  it('never escapes', () => {
    const { s, step } = crater();
    s.stageTime = s.stageDur + s.cfg.stage.overtime + 5; s.overtime = true;
    step(10);
    expect(s.escapes).toBe(0);
    expect(s.boss).not.toBeNull();
  });
});

describe('Victory, Endless and scoring', () => {
  function win() {
    const c = crater();
    c.s.kills = 3000;
    killE(c.s, c.s.boss!);
    c.s.stageTime = c.s.stageDur; c.s.hitstop = 0;
    for (let i = 0; i < 20 * 60 && c.s.phase !== 'victory'; i++) c.step();
    return c;
  }

  it('beating Umbra freezes the main Score and offers Endless', () => {
    const { s } = win();
    expect(s.phase).toBe('victory');
    expect(s.victory).toBe(true);
    expect(s.main).not.toBeNull();
    const main = scoreOf(s);
    s.kills += 500;
    expect(scoreOf(s)).toBe(main);
  });

  it('finishing ends the Run; Endless continues in a random Realm with tougher monsters', () => {
    const a = win();
    a.step(1, [{ type: 'endless', go: false }]);
    expect(a.s.phase).toBe('over');
    const b = win();
    const main = scoreOf(b.s);
    b.step(1, [{ type: 'endless', go: true }]);
    expect(b.s.endless).toBe(true);
    expect(b.s.stage).toBe(9);
    expect(b.s.realm).not.toBe('crater');
    const m9 = spawnEnemy(b.s, 'slime', 0, 0, false);
    b.s.stage = 8;
    const m8 = spawnEnemy(b.s, 'slime', 0, 0, false);
    b.s.stage = 9;
    expect(m9.maxHp / m8.maxHp).toBeGreaterThan(b.s.cfg.scaling.hpGrowth);
    // Endless points go to their own Score
    b.s.kills += 200; b.s.chaptersCleared.push(9); b.s.kingsKilled.push(9);
    expect(endlessBreakdown(b.s).total).toBe(200 + 9000 + 4500);
    expect(scoreOf(b.s)).toBe(main);
    // dying in Endless ends the Run; the main Score is untouched
    for (let i = 0; i < 600 && b.s.phase !== 'play'; i++) b.step();
    b.s.P.inv = 0; b.s.P.revives = 0; b.s.runGold = 0; b.s.meta.wallet = 0;
    b.s.debug.god = false;
    hurtP(b.s, 1e9);
    expect(b.s.phase).toBe('over');
    expect(scoreOf(b.s)).toBe(main);
  });

  it('a revive bought in Endless cuts only the Endless Score', () => {
    const b = win();
    b.step(1, [{ type: 'endless', go: true }]);
    const main = scoreOf(b.s);
    b.s.kills += 1000;
    const before = endlessBreakdown(b.s).total;
    for (let i = 0; i < 600 && b.s.phase !== 'play'; i++) b.step();
    b.s.debug.god = false; b.s.P.inv = 0; b.s.P.revives = 0; b.s.runGold = 10000;
    hurtP(b.s, 1e9);
    b.step(1, [{ type: 'revive' }]);
    expect(b.s.reviveEndless).toBe(true);
    expect(endlessBreakdown(b.s).total).toBe(before - Math.round(before * 0.15));
    expect(scoreOf(b.s)).toBe(main);
  });
});

describe('Heart Crack', () => {
  it('tiers multiply monster HP and damage from Balance Config', () => {
    const base = createSim(botOptions(1)).view() as SimState;
    const t3 = createSim(botOptions(1, { crack: 3 })).view() as SimState;
    const a = spawnEnemy(base, 'slime', 0, 0, false), b = spawnEnemy(t3, 'slime', 0, 0, false);
    expect(b.maxHp / a.maxHp).toBeCloseTo(t3.cfg.heartCrack.hp3, 5);
    expect(b.dmg / a.dmg).toBeCloseTo(t3.cfg.heartCrack.dmg3, 5);
    expect((createSim(botOptions(1, { crack: 9 })).view() as SimState).crack).toBe(3);
  });
});
