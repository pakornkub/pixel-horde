import { describe, expect, it } from 'vitest';
import { fmath } from '@pixel-horde/sim';

describe('deterministic math', () => {
  it('matches Math within 1e-12', () => {
    for (let i = 0; i < 20000; i++) {
      const x = (i / 20000 - 0.5) * 60, y = ((i * 7919) % 1000) / 500 - 1;
      expect(Math.abs(fmath.sin(x) - Math.sin(x))).toBeLessThan(1e-12);
      expect(Math.abs(fmath.cos(x) - Math.cos(x))).toBeLessThan(1e-12);
      expect(Math.abs(fmath.atan2(y, x) - Math.atan2(y, x))).toBeLessThan(1e-12);
      const e = (i / 20000 - 0.5) * 10;
      expect(Math.abs(fmath.exp(e) - Math.exp(e)) / Math.exp(e)).toBeLessThan(1e-12);
    }
    expect(fmath.ipow(1.5, 4)).toBe(5.0625);
    expect(fmath.atan2(0, -1)).toBe(Math.PI);
  });
});
