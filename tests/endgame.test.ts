import { describe, expect, it } from 'vitest';
import { createSim, endlessBreakdown, resolveConfig, scoreOf, type SimEvent, type SimState } from '@pixel-horde/sim';
import { BALANCE_PASS_2026_09E, DEFAULT_CONFIG, withOverrides } from '@pixel-horde/config';
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

describe('Endless Run from the title (mode endless)', () => {
  it('starts in Greenvale, then random Realms with no route choice and no Umbra; no main Score', () => {
    const sim = createSim(botOptions(5, { mode: 'endless', debug: { god: true }, events: quiet }));
    const s = sim.view() as SimState;
    expect(s.endless).toBe(true);
    expect(s.realm).toBe('greenvale');
    s.kills = 400;
    expect(scoreOf(s)).toBe(0);
    for (let ch = 1; ch <= s.cfg.stage.chapters; ch++) {
      s.phase = 'clear'; s.lastEnd = 'clear'; s.stage = ch;
      sim.step({ mx: 0, my: 0 }, [{ type: 'next' }]);
      expect(s.stage).toBe(ch + 1);
      expect(s.phase).not.toBe('route');
      expect(s.realm).not.toBe('crater');
      expect(s.realm).not.toBe('greenvale');
      // Endless points count only beyond the last Chapter, as after Umbra
      if (ch < s.cfg.stage.chapters) expect(endlessBreakdown(s).total).toBe(0);
    }
    expect(s.endlessFrom).toEqual({ kills: 400, combos: s.combos, escapes: 0 });
    s.kills += 50;
    expect(endlessBreakdown(s).total).toBe(50);
    expect(scoreOf(s)).toBe(0);
  });

  it('never draws the previous Chapter\'s Realm twice in a row, and the draws are the same for the same seed', () => {
    const realms = (seed: number): string[] => {
      const sim = createSim(botOptions(seed, { mode: 'endless', debug: { god: true }, events: quiet }));
      const s = sim.view() as SimState;
      const out: string[] = [];
      for (let ch = 1; ch <= 40; ch++) {
        s.phase = 'clear'; s.lastEnd = 'clear'; s.stage = ch;
        sim.step({ mx: 0, my: 0 }, [{ type: 'next' }]);
        out.push(s.realm);
      }
      return out;
    };
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = realms(seed);
      for (let i = 1; i < r.length; i++) expect(r[i], `seed ${seed}, Chapter ${i + 2}`).not.toBe(r[i - 1]);
      expect(realms(seed)).toEqual(r);
    }
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

  it('the ramp (pass 2026-09e) takes back part of the base difficulty per tier, up to maxTier, and adds a Score bonus', () => {
    const cfg = resolveConfig(withOverrides(DEFAULT_CONFIG, BALANCE_PASS_2026_09E.patch));
    const at = (crack: number): SimState => createSim(botOptions(1, { crack, config: cfg })).view() as SimState;
    const t0 = at(0), t5 = at(5), t10 = at(10);
    expect(at(12).crack).toBe(10);
    const k = cfg.difficulty, mid = (v: number): number => v + (1 - v) * 0.5;
    // tier 5 = half of the help gone (player HP, warnings); tier 10 = the numbers as written
    expect(t5.cfg.player.hp).toBe(Math.round(cfg.player.hp * mid(k.hp) / k.hp));
    expect(t10.cfg.player.hp).toBe(DEFAULT_CONFIG.shared.player.hp);
    expect(t10.cfg.kings.sandLine.warn).toBeCloseTo(DEFAULT_CONFIG.shared.kings.sandLine.warn, 5);
    expect(t10.cfg.loot.coinChance).toBeCloseTo(cfg.loot.coinChance, 9); // Gold is never taken back
    const a = spawnEnemy(t0, 'slime', 0, 0, false), b = spawnEnemy(t10, 'slime', 0, 0, false);
    expect(b.maxHp / a.maxHp).toBeCloseTo((1 + 10 * cfg.heartCrack.hpPer) / k.mobHp, 5);
    // Score: +crack × tier on top of the Run's points
    t5.chaptersCleared = [1, 2]; t5.kills = 100;
    expect(scoreOf(t5)).toBe(Math.round((3000 + 100) * (1 + 5 * cfg.score.crack)));
  });
});
