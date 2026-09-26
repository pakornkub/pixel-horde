import { describe, expect, it } from 'vitest';
import { parseBalanceConfig, resolveConfig } from '@pixel-horde/config';
import { createSim, type SimState } from '@pixel-horde/sim';
import { armorVal, hpScale, scaleLv, spawnEnemy } from '../packages/sim/src/systems/spawner';
import { botOptions } from './bot';

function at(stage: number, lv: number, progress: number, shared = {}) {
  const config = resolveConfig(parseBalanceConfig({ shared }));
  const s = createSim(botOptions(7, { config })).view() as SimState;
  s.stage = stage; s.P.lv = lv; s.stageTime = progress * s.stageDur; s.dir.v = 1;
  return s;
}

describe('monster scaling by player level', () => {
  it('counts every level by default (version 0)', () => {
    expect(scaleLv(at(3, 60, 0.5))).toBe(60);
    expect(hpScale(at(3, 60, 0.5)) / hpScale(at(3, 20, 0.5))).toBeCloseTo((1 + 0.08 * 59) / (1 + 0.08 * 19), 6);
  });

  it('scaling.lvCapBase/lvCapPerCh: levels above the on-curve level add no HP, damage or armor', () => {
    const cap = { scaling: { lvCapBase: 7, lvCapPerCh: 7 } };
    // Chapter 3, halfway: cap = 7 + 7 × 2.5 = 24.5
    expect(scaleLv(at(3, 60, 0.5, cap))).toBeCloseTo(24.5, 6);
    expect(scaleLv(at(3, 12, 0.5, cap))).toBe(12); // under the curve: unchanged
    expect(hpScale(at(3, 60, 0.5, cap))).toBeCloseTo(hpScale(at(3, 24.5, 0.5)), 6);
    expect(hpScale(at(3, 12, 0.5, cap))).toBeCloseTo(hpScale(at(3, 12, 0.5)), 6);
    expect(armorVal(at(3, 60, 0.5, cap))).toBe(armorVal(at(3, 24.5, 0.5)));
    const hi = at(3, 60, 0.5, cap), lo = at(3, 24.5, 0.5, cap);
    expect(spawnEnemy(hi, 'slime', 0, 0, false).dmg).toBeCloseTo(spawnEnemy(lo, 'slime', 0, 0, false).dmg, 0);
  });

  it('with the cap, extra EXP (Wisdom, Transmute) never makes monsters tougher', () => {
    const cap = { scaling: { lvCapBase: 7, lvCapPerCh: 7 } };
    const base = hpScale(at(5, 40, 0.3, cap));
    for (const lv of [41, 50, 70, 90]) expect(hpScale(at(5, lv, 0.3, cap))).toBeCloseTo(base, 6);
  });
});
