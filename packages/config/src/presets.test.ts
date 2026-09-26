import { describe, expect, it } from 'vitest';
import { DEFAULT_RESOLVED, PRESETS, PRESET_IDS, applyPreset, isPreset, parseBalanceConfig, type ResolvedConfig } from './index';

/** Back from the resolved shape to a Balance Config, to re-validate every range. */
function validate(c: ResolvedConfig): void {
  const { enemies, version, world, ...shared } = c;
  void world;
  expect(() => parseBalanceConfig({ version, shared, worlds: { lumora: { enemies } } })).not.toThrow();
}

describe('difficulty presets', () => {
  it('balanced is the published config itself and the only ranked preset', () => {
    expect(applyPreset(DEFAULT_RESOLVED, 'balanced')).toBe(DEFAULT_RESOLVED);
    expect(PRESET_IDS.filter((id) => PRESETS[id].ranked)).toEqual(['balanced']);
    expect(isPreset('hard')).toBe(true);
    expect(isPreset('nope')).toBe(false);
  });

  it('every preset stays inside the Balance Config ranges and never mutates its input', () => {
    const before = JSON.stringify(DEFAULT_RESOLVED);
    for (const id of PRESET_IDS) validate(applyPreset(DEFAULT_RESOLVED, id));
    expect(JSON.stringify(DEFAULT_RESOLVED)).toBe(before);
  });

  it('easier presets soften monsters and Kings, harder ones toughen them', () => {
    const d = DEFAULT_RESOLVED, easy = applyPreset(d, 'relaxed'), hard = applyPreset(d, 'hard');
    expect(easy.enemies.slime.hp).toBeLessThan(d.enemies.slime.hp);
    expect(easy.enemies.boss.dmg).toBeLessThan(d.enemies.boss.dmg);
    expect(easy.kings.splash.dur).toBe(d.kings.splash.dur); // durations are not warnings
    expect(easy.kings.slam.warn).toBeGreaterThan(d.kings.slam.warn);
    expect(easy.dragon.breathWarn).toBeGreaterThan(d.dragon.breathWarn);
    expect(hard.enemies.umbra.hp).toBeGreaterThan(d.enemies.umbra.hp);
    expect(hard.kings.ultWarn).toBeLessThan(d.kings.ultWarn);
    expect(hard.loot.heartChance).toBeLessThan(d.loot.heartChance);
  });

  it('blitz shortens Stages and speeds up levels', () => {
    const d = DEFAULT_RESOLVED, b = applyPreset(d, 'blitz');
    expect(b.stage.durBase).toBeLessThan(d.stage.durBase);
    expect(b.xp.perLv).toBeLessThan(d.xp.perLv);
    expect(b.spawn.base).toBeGreaterThan(d.spawn.base);
    expect(b.player.spd).toBeGreaterThan(d.player.spd);
  });
});
