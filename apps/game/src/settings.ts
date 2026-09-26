// Device-only settings (never sent to the server), stored under `pixelhorde-settings`.
import { detectLang, setLang, type Lang } from '@pixel-horde/i18n';

export type Level3 = 'off' | 'some' | 'all';
export const VIEWS = ['near', 'far', 'farthest'] as const;
export type View = (typeof VIEWS)[number];
/** Camera zoom-out factor for a camera distance. */
export const viewZoom = (v: View): number => (v === 'farthest' ? 1.5 : v === 'far' ? 1.25 : 1);
export interface Settings {
  lang: Lang;
  /** 0..1 */
  music: number;
  /** 0..1 */
  sfx: number;
  shake: 'off' | 'light' | 'full';
  vibrate: boolean;
  ultFlash: boolean;
  effects: Level3;
  numbers: Level3;
  /** Camera distance: zooms the view out (visual only — the rules keep the normal view). */
  view: View;
  tips: boolean;
  /** Tip ids already shown (ticket 44). */
  tipsSeen: string[];
  /** Send anonymous play statistics / error reports (PDPA opt-out). */
  stats: boolean;
}

const KEY = 'pixelhorde-settings';
const pick = <T extends string>(v: unknown, ok: readonly T[], def: T): T => (ok.includes(v as T) ? (v as T) : def);
const vol = (v: unknown, def: number): number => (typeof v === 'number' && v >= 0 && v <= 1 ? v : def);

export function parseSettings(raw: unknown, browserLangs: readonly string[]): Settings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    lang: pick(s.lang, ['th', 'en'] as const, detectLang(browserLangs)),
    music: vol(s.music, 0.6),
    sfx: vol(s.sfx, 0.8),
    shake: pick(s.shake, ['off', 'light', 'full'] as const, 'full'),
    vibrate: typeof s.vibrate === 'boolean' ? s.vibrate : true,
    ultFlash: typeof s.ultFlash === 'boolean' ? s.ultFlash : true,
    effects: pick(s.effects, ['off', 'some', 'all'] as const, 'all'),
    numbers: pick(s.numbers, ['off', 'some', 'all'] as const, 'all'),
    view: pick(s.view, VIEWS, 'near'),
    tips: typeof s.tips === 'boolean' ? s.tips : true,
    tipsSeen: Array.isArray(s.tipsSeen) ? s.tipsSeen.filter((x): x is string => typeof x === 'string') : [],
    stats: typeof s.stats === 'boolean' ? s.stats : true,
  };
}

function load(): Settings {
  let raw: unknown = null;
  try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* ignore */ }
  return parseSettings(raw, navigator.languages || [navigator.language]);
}

export const settings: Settings = load();
const listeners = new Set<() => void>();
export const onSettingsChange = (fn: () => void): void => { listeners.add(fn); };

export function saveSettings(): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  for (const fn of listeners) fn();
}

export function applyLang(l: Lang): void {
  settings.lang = l;
  document.documentElement.lang = l;
  setLang(l);
  saveSettings();
}

export const canVibrate = (): boolean => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function vibrate(ms: number | number[]): void {
  if (settings.vibrate && canVibrate()) { try { navigator.vibrate(ms); } catch { /* ignore */ } }
}

/** Shake multiplier for the renderer. */
export const shakeScale = (): number => (settings.shake === 'off' ? 0 : settings.shake === 'light' ? 0.4 : 1);
/** Particle multiplier. */
export const effectsScale = (): number => (settings.effects === 'off' ? 0 : settings.effects === 'some' ? 0.4 : 1);
