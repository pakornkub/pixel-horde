import { describe, expect, it, vi } from 'vitest';
import type { Backend } from './net/backend';
import type { KeyValue } from './net/offline';

vi.mock('./net', () => ({ backend: {} }));
vi.mock('./live', () => ({ BUILD: 202609250000 }));
const { createTelemetry, fpsBucket, inSample } = await import('./telemetry');

const memStore = (): KeyValue => { const m = new Map<string, string>(); return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) }; };

describe('telemetry', () => {
  it('groups repeated errors by fingerprint and keeps them until uploaded', async () => {
    let ok = false;
    const sent: unknown[] = [];
    const b = { report: async (_fn: string, p: unknown) => { sent.push(p); return ok; } } as unknown as Backend;
    const t = createTelemetry(b, memStore(), () => true);
    t.recordError('TypeError: x', 'at a\nat b\nat c');
    t.recordError('TypeError: x', 'at a\nat b\nat d');
    t.recordError('RangeError', '');
    expect(t.pending().errors.map((e) => e.count)).toEqual([2, 1]);
    await t.flush();
    expect(t.pending().errors).toHaveLength(2); // failed upload: kept
    ok = true;
    await t.flush();
    expect(t.pending().errors).toHaveLength(0);
  });

  it('sends nothing when the player opts out', async () => {
    const report = vi.fn(async () => true);
    const t = createTelemetry({ report } as unknown as Backend, memStore(), () => false);
    t.recordError('boom');
    await t.flush();
    expect(report).not.toHaveBeenCalled();
  });

  it('FPS histogram buckets and a stable ~5% sample', () => {
    expect([20, 30, 50, 60].map(fpsBucket)).toEqual([0, 1, 2, 3]);
    const n = Array.from({ length: 4000 }, (_, i) => inSample('user-' + i)).filter(Boolean).length;
    expect(n).toBeGreaterThan(120);
    expect(n).toBeLessThan(280);
    expect(inSample('abc')).toBe(inSample('abc'));
  });
});
