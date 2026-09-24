// Thai / English text. Every player-facing string goes through t(key, args).
import th from './th.json';
import en from './en.json';

export type Lang = 'th' | 'en';
export const LANGS: Lang[] = ['th', 'en'];
export type Key = keyof typeof th;

const DICTS: Record<Lang, Record<string, string>> = { th, en };
let current: Lang = 'th';
const listeners = new Set<(l: Lang) => void>();

export const lang = (): Lang => current;

export function setLang(l: Lang): void {
  if (!DICTS[l] || l === current) return;
  current = l;
  for (const fn of listeners) fn(l);
}

export function onLangChange(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Pick the default language from browser preferences (Thai if any preferred language is Thai). */
export function detectLang(preferred: readonly string[]): Lang {
  for (const p of preferred) {
    const code = p.toLowerCase().slice(0, 2);
    if (code === 'th') return 'th';
    if (code === 'en') return 'en';
  }
  return 'en';
}

/** Translate a key; `{name}` placeholders are replaced from args. Unknown keys return the key. */
export function t(key: Key | string, args?: Record<string, string | number>): string {
  const s = DICTS[current][key] ?? DICTS.th[key] ?? key;
  if (!args) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in args ? String(args[k]) : m));
}

export function has(key: string): boolean {
  return key in DICTS[current];
}

/** Keys missing in either language, and keys whose {placeholders} differ. */
export function checkCompleteness(dicts: Record<string, Record<string, string>> = DICTS): string[] {
  const problems: string[] = [];
  const all = new Set(Object.values(dicts).flatMap((d) => Object.keys(d)));
  const ph = (s: string): string => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const key of all) {
    const present = Object.entries(dicts).filter(([, d]) => key in d);
    for (const [l, d] of Object.entries(dicts)) if (!(key in d)) problems.push(`missing ${l}: ${key}`);
    const sets = new Set(present.map(([, d]) => ph(d[key])));
    if (sets.size > 1) problems.push(`placeholders differ: ${key}`);
  }
  return problems;
}
