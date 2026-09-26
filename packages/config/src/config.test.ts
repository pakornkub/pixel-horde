import { describe, expect, it } from 'vitest';
import {
  BalanceConfigError, DEFAULT_CONFIG, DEFAULT_FLAGS, FIELD_TH, FeatureFlagsSchema, GROUP_TH, listFields, parseBalanceConfig, resolveConfig, withOverrides,
} from './index';

describe('Balance Config schema', () => {
  it('defaults validate and match the original game', () => {
    const c = parseBalanceConfig({});
    expect(c).toEqual(DEFAULT_CONFIG);
    expect(c.shared.stage.durBase).toBe(60);
    expect(c.shared.skills.bolt.dmg).toMatchObject({ base: 16, perLv: 7 });
    expect(c.shared.director).toMatchObject({ min: 0.7, max: 2.4 });
    expect(c.worlds.lumora.enemies.slime).toEqual({ hp: 22, spd: 24, dmg: 7, xp: 1, r: 6 });
  });

  it('rejects out-of-range and wrong-type values with a clear path', () => {
    expect(() => parseBalanceConfig({ shared: { stage: { bossAt: 1.5 } } })).toThrow(BalanceConfigError);
    try {
      parseBalanceConfig({ shared: { director: { max: 'lots' } } });
    } catch (e) {
      expect((e as BalanceConfigError).issues[0].path).toBe('shared.director.max');
    }
    expect(() => parseBalanceConfig({ shared: { spawn: { cap: 10.5 } } })).toThrow(/shared.spawn.cap/);
  });

  it('partial configs are filled from defaults', () => {
    const c = parseBalanceConfig({ shared: { skills: { bolt: { dmg: { base: 20 } } } } });
    expect(c.shared.skills.bolt.dmg).toMatchObject({ base: 20, perLv: 7 });
    expect(c.shared.skills.orbit.max).toBe(6);
  });

  it('resolving merges shared rules with one World', () => {
    const r = resolveConfig(DEFAULT_CONFIG, 'lumora');
    expect(r.world).toBe('lumora');
    expect(r.enemies.boss.hp).toBeCloseTo(2200 * DEFAULT_CONFIG.shared.difficulty.bossHp, 6); // base difficulty applied
    expect(r.skills.nova.r.base).toBe(55);
    // no World key may shadow a shared key
    const shared = Object.keys(DEFAULT_CONFIG.shared);
    for (const k of Object.keys(DEFAULT_CONFIG.worlds.lumora)) expect(shared).not.toContain(k);
  });

  it('overrides deep-merge and re-validate', () => {
    const c = withOverrides(DEFAULT_CONFIG, { worlds: { lumora: { enemies: { bat: { hp: 20 } } } } });
    expect(c.worlds.lumora.enemies.bat).toMatchObject({ hp: 20, spd: 44 });
    expect(() => withOverrides(DEFAULT_CONFIG, { shared: { chest: { p1: 2 } } })).toThrow();
  });

  it('lists every field with range and description for Admin forms', () => {
    const f = listFields();
    expect(f.length).toBeGreaterThan(400);
    for (const x of f) {
      expect(x.desc, x.path).not.toBe('');
      expect(x.def, x.path).toBeGreaterThanOrEqual(x.min);
      expect(x.def, x.path).toBeLessThanOrEqual(x.max);
    }
  });

  it('every field has a Thai explanation for the Admin Console', () => {
    const missing = listFields().flatMap((x) => [FIELD_TH[x.desc] ? '' : 'field: ' + x.desc, !x.parent || GROUP_TH[x.parent] ? '' : 'group: ' + x.parent, !x.group || GROUP_TH[x.group] ? '' : 'group: ' + x.group]).filter(Boolean);
    expect([...new Set(missing)]).toEqual([]);
  });

  it('feature flags have defaults', () => {
    expect(DEFAULT_FLAGS.coop).toBe(true);
    expect(FeatureFlagsSchema.parse({ maintenance: true }).maintenance).toBe(true);
  });
});
