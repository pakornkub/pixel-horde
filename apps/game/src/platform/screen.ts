// Canvas setup: low-res world buffer (≈190 px on the short side, integer scale) + hi-res canvas for text/HUD.
const $ = (id: string) => document.getElementById(id)!;

export const cv = $('c') as HTMLCanvasElement;
export const ctx = cv.getContext('2d')!;
export const buf = document.createElement('canvas');
export const b = buf.getContext('2d')!;

export const screen = {
  DPR: 1, CS: 3, S: 3, LW: 320, LH: 180, VW: 0, VH: 0,
  /** HUD scale: grows with the screen's short side like the world does (phones 1, big screens up to 2.5). */
  UI: 1,
  /** One HUD pixel in canvas pixels (DPR × UI). */
  HD: 1,
  SAFE: { t: 0, b: 0, l: 0, r: 0 },
};

const listeners: (() => void)[] = [];
export const onResize = (fn: () => void): void => { listeners.push(fn); };

export function resize(): void {
  const s = screen;
  s.DPR = Math.min(window.devicePixelRatio || 1, 2);
  s.VW = innerWidth;
  s.VH = innerHeight;
  cv.width = Math.round(s.VW * s.DPR);
  cv.height = Math.round(s.VH * s.DPR);
  s.CS = Math.max(2, Math.round(Math.min(s.VW, s.VH) / 190));
  s.LW = Math.ceil(s.VW / s.CS);
  s.LH = Math.ceil(s.VH / s.CS);
  s.S = s.CS * s.DPR;
  s.UI = Math.max(1, Math.min(2.5, Math.min(s.VW, s.VH) / 420));
  s.HD = s.DPR * s.UI;
  // DOM buttons follow the HUD; menus grow as far as a tall one still fits the screen
  const root = document.documentElement.style;
  root.setProperty('--ui', String(s.UI));
  root.setProperty('--menu', String(Math.max(1, Math.min(s.UI, s.VH / 760, s.VW / 500))));
  buf.width = s.LW;
  buf.height = s.LH;
  const cs = getComputedStyle($('probe'));
  s.SAFE = { t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 };
  for (const fn of listeners) fn();
}
addEventListener('resize', resize);
resize();
