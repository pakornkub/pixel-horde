// Helpers that emit presentation events. The sim never draws; the game consumes these.
import type { BannerKey, SfxKey, SimState } from '../types';

export const sfx = (s: SimState, k: SfxKey): void => { s.events.push({ t: 'sfx', k }); };

export function burst(s: SimState, x: number, y: number, col: string, n: number, sp: number, life: number, p?: number): void {
  s.events.push({ t: 'burst', x, y, col, n, sp, life, p });
}

export function text(s: SimState, x: number, y: number, v: number | string, col: string, cr: boolean, extra?: { hurt?: boolean; jitter?: boolean }): void {
  s.events.push({ t: 'text', x, y, v, col, cr, ...extra });
}

export const shake = (s: SimState, v: number): void => { s.events.push({ t: 'shake', v }); };

/** max=true: flash = max(flash, v); otherwise flash = v. */
export function flash(s: SimState, v: number, col?: string, max = false, ult = false): void {
  s.events.push(ult ? { t: 'flash', v, col, max, ult } : { t: 'flash', v, col, max });
}

export function banner(s: SimState, key: BannerKey, dur: number, big?: boolean, args?: Record<string, string | number>): void {
  s.events.push({ t: 'banner', key, dur, big, args });
}
