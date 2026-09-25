import { describe, expect, it } from 'vitest';
import { createFpsWatch } from './fpswatch';

describe('low-FPS watch', () => {
  it('fires once after sustained low FPS only', () => {
    const w = createFpsWatch();
    let fired = 0;
    for (let i = 0; i < 60 * 20; i++) if (w.feed(1 / 60, 45, 8)) fired++;
    expect(fired).toBe(0);
    for (let i = 0; i < 30 * 5; i++) if (w.feed(1 / 30, 45, 8)) fired++;
    expect(fired).toBe(0); // 5 s is not enough
    for (let i = 0; i < 30 * 5; i++) if (w.feed(1 / 30, 45, 8)) fired++;
    expect(fired).toBe(1);
    for (let i = 0; i < 30 * 20; i++) if (w.feed(1 / 30, 45, 8)) fired++;
    expect(fired).toBe(1); // once per session
  });
  it('a short dip resets', () => {
    const w = createFpsWatch();
    let fired = 0;
    for (let k = 0; k < 10; k++) {
      for (let i = 0; i < 30 * 4; i++) if (w.feed(1 / 30, 45, 8)) fired++;
      for (let i = 0; i < 60 * 3; i++) if (w.feed(1 / 60, 45, 8)) fired++;
    }
    expect(fired).toBe(0);
  });
});
