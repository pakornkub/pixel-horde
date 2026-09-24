// Device-only settings (never sent to the server). Ticket 07 adds the full settings screen.
import { detectLang, setLang, type Lang } from '@pixel-horde/i18n';

export interface Settings { lang: Lang }

const KEY = 'pixelhorde-settings';

function load(): Settings {
  let s: Partial<Settings> = {};
  try { s = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* ignore */ }
  return { lang: s.lang === 'th' || s.lang === 'en' ? s.lang : detectLang(navigator.languages || [navigator.language]) };
}

export const settings: Settings = load();

export function saveSettings(): void {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

export function applyLang(l: Lang): void {
  settings.lang = l;
  document.documentElement.lang = l;
  setLang(l);
  saveSettings();
}
