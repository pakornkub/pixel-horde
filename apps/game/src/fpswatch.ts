// Low-FPS watch (ticket 39): after `secs` seconds of play with a smoothed frame rate under
// `threshold`, fire once per session so the game can suggest lowering the effects.
export function createFpsWatch() {
  let ema = 60, low = 0, fired = false;
  return {
    /** Feed one frame's real duration; true exactly once when the suggestion should show. */
    feed(dt: number, threshold: number, secs: number): boolean {
      if (fired || dt <= 0 || dt > 0.5) return false; // ignore tab switches and hitches from loading
      ema += (1 / dt - ema) * Math.min(1, dt * 2); // ~0.5 s smoothing
      low = ema < threshold ? low + dt : 0;
      if (low >= secs) { fired = true; return true; }
      return false;
    },
    get fps(): number { return ema; },
  };
}
