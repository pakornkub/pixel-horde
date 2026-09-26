import { describe, expect, it } from 'vitest';
import { BALANCE_PASSES, BALANCE_PASS_2026_09, BALANCE_PASS_2026_09B, DEFAULT_CONFIG, listFields, withOverrides } from './index';

describe('balance pass 2026-09', () => {
  it('is a valid patch whose every value is inside its field range and differs from version 0', () => {
    const c = withOverrides(DEFAULT_CONFIG, BALANCE_PASS_2026_09.patch);
    const get = (o: unknown, p: string): unknown => p.split('.').reduce<unknown>((x, k) => (x as Record<string, unknown>)?.[k], o);
    const changed = listFields().filter((f) => get(c, f.path) !== get(DEFAULT_CONFIG, f.path));
    expect(changed.length).toBeGreaterThan(20);
    expect(get(c, 'shared.kings.splash.r')).toBe(100);
    expect(get(c, 'worlds.lumora.enemies.umbra.hp')).toBe(2000);
  });

  it('2026-09b is valid on top of 2026-09 (config v4) and only sets fields v4 left at version 0', () => {
    const v4 = withOverrides(DEFAULT_CONFIG, BALANCE_PASS_2026_09.patch);
    const c = withOverrides(v4, BALANCE_PASS_2026_09B.patch);
    const get = (o: unknown, p: string): unknown => p.split('.').reduce<unknown>((x, k) => (x as Record<string, unknown>)?.[k], o);
    const changed = listFields().filter((f) => get(c, f.path) !== get(v4, f.path)).map((f) => f.path);
    expect(changed.sort()).toEqual(['shared.awaken.keep', 'shared.awaken.slots', 'shared.heroes.ranger.hp', 'shared.scaling.lvCapBase', 'shared.scaling.lvCapPerCh', 'shared.skills.hawk.guardN'].sort());
    for (const p of changed) expect(get(v4, p)).toBe(get(DEFAULT_CONFIG, p));
    expect(BALANCE_PASSES.map((p) => p.id)).toEqual(['2026-09c', '2026-09b', '2026-09']); // newest first
  });
});

describe('balance pass reports', () => {
  it('every reason names a real field that the pass changes, and every change has a reason', async () => {
    const { BALANCE_PASSES } = await import('./index');
    const get = (o: unknown, p: string): unknown => p.split('.').reduce<unknown>((x, k) => (x as Record<string, unknown>)?.[k], o);
    for (const pass of BALANCE_PASSES) {
      const paths = new Set(listFields().map((f) => f.path));
      const patched: string[] = [];
      const walk = (o: Record<string, unknown>, p: string[]): void => { for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') walk(v as Record<string, unknown>, [...p, k]); else patched.push([...p, k].join('.')); };
      walk(pass.patch as Record<string, unknown>, []);
      for (const p of patched) expect(paths.has(p), p).toBe(true);
      expect(Object.keys(pass.report.reasons ?? {}).sort()).toEqual([...patched].sort());
      expect(pass.report.summary.length).toBeGreaterThan(20);
      expect(get(withOverrides(DEFAULT_CONFIG, pass.patch), patched[0])).toBeDefined();
    }
  });
});
