import { describe, expect, it, vi } from 'vitest';
vi.mock('../net', () => ({ backend: { latestUpdate: async () => null } }));
import { isNewUpdate, markUpdateSeen } from './update-note';

const memory = (): { get(k: string): string | null; set(k: string, v: string): void } => {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => { m.set(k, v); } };
};
const note = (id: number) => ({ id, at: '2026-09-27T10:00:00Z', titleTh: 'อัปเดต', titleEn: 'Update' });

describe('title update notice', () => {
  it('a patch note is new until seen, and a newer one is new again', () => {
    const store = memory();
    expect(isNewUpdate(note(19), store)).toBe(true);
    markUpdateSeen(note(19), store);
    expect(isNewUpdate(note(19), store)).toBe(false);
    expect(isNewUpdate(note(18), store)).toBe(false);
    expect(isNewUpdate(note(20), store)).toBe(true);
  });
});
