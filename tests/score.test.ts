import { describe, expect, it } from 'vitest';
import { createSim, scoreBreakdown, scoreOf } from '@pixel-horde/sim';
import { botOptions } from './bot';

/** A fresh state with the given Run results patched in. */
function stateWith(patch: Record<string, unknown>) {
  const s = createSim(botOptions(1)).view();
  return { ...s, ...patch } as typeof s;
}

describe('Arcade Score (decision #15)', () => {
  it('matches the blueprint example: Umbra beaten in 18 minutes ≈ 80,900', () => {
    const s = stateWith({ chaptersCleared: [1, 2, 3, 4, 5, 6, 7, 8], kingsKilled: [1, 2, 3, 4, 5, 6, 7, 8],
      kills: 2200, combos: 100, victory: true, victoryTime: 18 * 60, escapes: 0, revivesBought: 0 });
    const b = scoreBreakdown(s);
    expect(Object.fromEntries(b.lines.map((l) => [l.key, l.points]))).toEqual({
      chapters: 36000, kings: 18000, kills: 2200, combos: 500, victory: 20000, fast: 4200 });
    expect(b.total).toBe(80900);
  });

  it('matches the blueprint example: death in Chapter 6 ≈ 24,150', () => {
    const s = stateWith({ chaptersCleared: [1, 2, 3, 4, 5], kingsKilled: [1, 2, 3, 4, 5], kills: 1400, combos: 50 });
    expect(scoreOf(s)).toBe(22500 + 1400 + 250);
  });

  it('escapes cost 3,000 each and a bought revive cuts 15%, never below zero', () => {
    const s = stateWith({ chaptersCleared: [1, 2], kingsKilled: [2], kills: 300, escapes: 1, escapedKings: [0] });
    expect(scoreOf(s)).toBe(3000 + 1000 + 300 - 3000);
    const r = stateWith({ chaptersCleared: [1], kingsKilled: [1], kills: 500, revivesBought: 1 });
    expect(scoreOf(r)).toBe(2000 - 300);
    expect(scoreOf(stateWith({ escapes: 3 }))).toBe(0);
  });
});
