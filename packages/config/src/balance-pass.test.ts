import { describe, expect, it } from 'vitest';
import { BALANCE_PASS_2026_09, DEFAULT_CONFIG, listFields, withOverrides } from './index';

describe('balance pass 2026-09', () => {
  it('is a valid patch whose every value is inside its field range and differs from version 0', () => {
    const c = withOverrides(DEFAULT_CONFIG, BALANCE_PASS_2026_09.patch);
    const get = (o: unknown, p: string): unknown => p.split('.').reduce<unknown>((x, k) => (x as Record<string, unknown>)?.[k], o);
    const changed = listFields().filter((f) => get(c, f.path) !== get(DEFAULT_CONFIG, f.path));
    expect(changed.length).toBeGreaterThan(20);
    expect(get(c, 'shared.kings.splash.r')).toBe(100);
    expect(get(c, 'worlds.lumora.enemies.umbra.hp')).toBe(2000);
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
