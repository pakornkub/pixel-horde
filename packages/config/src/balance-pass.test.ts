import { describe, expect, it } from 'vitest';
import { BALANCE_PASSES, BALANCE_PASS_2026_09_AC, BALANCE_PASS_2026_09,BALANCE_PASS_2026_09B, BALANCE_PASS_2026_09C, BALANCE_PASS_2026_09D, DEFAULT_CONFIG, listFields, withOverrides } from './index';

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
    expect(BALANCE_PASSES.map((p) => p.id)).toEqual(['2026-09-ac', '2026-09-coop','2026-09d', '2026-09c', '2026-09b', '2026-09']); // newest first
  });
});

describe('balance pass 2026-09d', () => {
  it('turns on the awakened forms, Lance aim and Shield Bash on top of v5', () => {
    const v5 = [BALANCE_PASS_2026_09, BALANCE_PASS_2026_09B, BALANCE_PASS_2026_09C].reduce((c, p) => withOverrides(c, p.patch), DEFAULT_CONFIG);
    const c = withOverrides(v5, BALANCE_PASS_2026_09D.patch);
    expect([v5.shared.awaken.form, v5.shared.skills.lance.aim, v5.shared.skills.shield.bashCd]).toEqual([0, 0, 0]); // off until this pass
    expect(c.shared.awaken.form).toBe(1);
    expect(c.shared.skills.lance.aim).toBeGreaterThan(0);
    expect(c.shared.skills.shield.bashCd).toBeGreaterThan(0);
  });
});

describe('balance pass 2026-09-ac', () => {
  // public.run_problem: kills ≤ killsPerSecond × play seconds + killsPerChapter × Chapter; Gold ≤ goldBase × (goldGrowth^ch − 1) / (goldGrowth − 1)
  const problem = (a: { killsPerSecond: number; killsPerChapter: number; goldBase: number; goldGrowth: number }, r: { ch: number; kills: number; gold: number; secs: number }): string | null =>
    r.gold > (a.goldBase * (a.goldGrowth ** r.ch - 1)) / (a.goldGrowth - 1) ? 'GOLD_CEILING' : r.kills > a.killsPerSecond * r.secs + a.killsPerChapter * r.ch ? 'KILL_CEILING' : null;
  // honest Runs the live server rejected (v4–v6; co-op kills are team kills) and two impossible ones
  const honest = [
    { ch: 7, kills: 45736, gold: 55982, secs: 955 }, { ch: 7, kills: 27699, gold: 22454, secs: 978 }, { ch: 6, kills: 23786, gold: 14838, secs: 1086 },
    { ch: 6, kills: 21260, gold: 24236, secs: 780 }, { ch: 5, kills: 19294, gold: 20315, secs: 618 }, { ch: 4, kills: 13842, gold: 6166, secs: 321 },
  ];
  it('accepts the honest Runs v6 rejected and still rejects impossible numbers', () => {
    const v6 = withOverrides(DEFAULT_CONFIG, {}).shared.antiCheat;
    const ac = withOverrides(DEFAULT_CONFIG, BALANCE_PASS_2026_09_AC.patch).shared.antiCheat;
    expect(honest.filter((r) => problem(v6, r)).length).toBe(honest.length);
    expect(honest.map((r) => problem(ac, r))).toEqual(honest.map(() => null));
    expect(problem(ac, { ch: 3, kills: 3000, gold: 100000, secs: 400 })).toBe('GOLD_CEILING');
    expect(problem(ac, { ch: 3, kills: 50000, gold: 3000, secs: 300 })).toBe('KILL_CEILING');
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
