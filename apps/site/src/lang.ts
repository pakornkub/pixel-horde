// Language for the website: Thai / English, remembered per browser. Site text lives in text.ts;
// game names come from packages/i18n (the same dictionary the game uses).
import { detectLang, setLang, t, type Lang } from '@pixel-horde/i18n';
import { TXT, type TextKey } from './text';

const KEY = 'pixelhorde-site-lang';
type Args = Record<string, string | number>;

function initial(): Lang {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'th' || q === 'en') return q;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'th' || saved === 'en') return saved;
  } catch { /* storage blocked: fall back to the browser language */ }
  return detectLang(navigator.languages ?? [navigator.language]);
}

let current: Lang = initial();
setLang(current);
const listeners = new Set<() => void>();

export const lang = (): Lang => current;

const fill = (str: string, args?: Args): string =>
  args ? str.replace(/\{(\w+)\}/g, (m, k: string) => (k in args ? String(args[k]) : m)) : str;

/** Website text. */
export const s = (key: TextKey, args?: Args): string => fill(TXT[key][current], args);
/** Game text (skill, hero, Realm names…), straight from the game's dictionary. */
export const g = (key: string, args?: Args): string => t(key, args);

export function onLang(fn: () => void): void {
  listeners.add(fn);
}

export function switchLang(l: Lang): void {
  if (l === current) return;
  current = l;
  setLang(l);
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  applyStatic();
  for (const fn of listeners) fn();
}

const argsOf = (el: HTMLElement): Args | undefined => (el.dataset.args ? (JSON.parse(el.dataset.args) as Args) : undefined);

/** Fills `data-t` (site text, may hold simple markup), `data-g` (game text) and their aria/placeholder forms. */
export function applyStatic(root: ParentNode = document): void {
  document.documentElement.lang = current;
  document.documentElement.dataset.lang = current;
  root.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => { el.innerHTML = s(el.dataset.t as TextKey, argsOf(el)); });
  root.querySelectorAll<HTMLElement>('[data-g]').forEach((el) => { el.textContent = g(el.dataset.g!, argsOf(el)); });
  root.querySelectorAll<HTMLElement>('[data-t-aria]').forEach((el) => el.setAttribute('aria-label', s(el.dataset.tAria as TextKey)));
  root.querySelectorAll<HTMLInputElement>('[data-t-ph]').forEach((el) => { el.placeholder = s(el.dataset.tPh as TextKey); });
  const title = document.body.dataset.title as TextKey | undefined;
  if (title) document.title = s(title);
}
