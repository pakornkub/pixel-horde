import { describe, expect, it } from 'vitest';
import { BALANCE_PASS_2026_09, BALANCE_PASS_2026_09B, CHANGE_CATS, groupItems, stackNotes, stackReport } from './index';

describe('stacking passes onto one draft (Admin → Balance)', () => {
  it('the first pass keeps its own report and notes', () => {
    expect(stackReport(null, BALANCE_PASS_2026_09B)).toBe(BALANCE_PASS_2026_09B.report);
    expect(stackNotes(null, BALANCE_PASS_2026_09B)).toBe(BALANCE_PASS_2026_09B.changelog);
  });

  it('a second pass adds its reasons, metrics and notes instead of replacing them', () => {
    const a = BALANCE_PASS_2026_09, b = BALANCE_PASS_2026_09B;
    const r = stackReport(a.report, b);
    expect(Object.keys(r.reasons!).sort()).toEqual([...Object.keys(a.report.reasons!), ...Object.keys(b.report.reasons!)].sort());
    expect(r.metrics!.length).toBe(a.report.metrics!.length + b.report.metrics!.length);
    expect(r.title).toContain(a.report.title);
    expect(r.title).toContain(b.report.title);
    const n = stackNotes(a.changelog, b);
    expect(n.items.length).toBe(a.changelog.items.length + b.changelog.items.length);
    expect(groupItems(n.items).map(([c]) => c)).toEqual(CHANGE_CATS.filter((c) => n.items.some((i) => i.cat === c)));
    expect(groupItems(n.items).flatMap(([, l]) => l)).toEqual(n.items); // already in category order
  });
});
