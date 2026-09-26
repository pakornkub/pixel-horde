// Small building blocks for the inner pages. Text nodes carry data-t / data-g so the language
// switch re-translates them in place (widgets keep their state).
import { el, groundURL } from './art';
import { g, s } from './lang';
import type { TextKey } from './text';

type Args = Record<string, string | number>;
type Tag = keyof HTMLElementTagNameMap;

/** Site text element (may hold <b> markup). */
export function T(key: TextKey, args?: Args, tag: Tag = 'span', cls = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.dataset.t = key;
  if (args) e.dataset.args = JSON.stringify(args);
  e.innerHTML = s(key, args);
  return e;
}

/** Game text element (skill / hero / Realm names…). */
export function G(key: string, args?: Args, tag: Tag = 'span', cls = ''): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  e.dataset.g = key;
  if (args) e.dataset.args = JSON.stringify(args);
  e.textContent = g(key, args);
  return e;
}

/** Inner page header on a strip of a Realm's ground. */
export function pageHead(h: TextKey, p: TextKey, theme: number, actors: Node[] = [], extra?: Node): HTMLElement {
  const head = el('header.page-head', null, el('div.wrap', null, T(h, undefined, 'h1'), T(p, undefined, 'p', 'lead'), actors.length ? el('div.actors', null, ...actors) : null, extra ?? null));
  head.style.backgroundImage = `url(${groundURL(theme, 20, 8, 4)})`;
  return head;
}

/** Sets a Realm-ground background on an element. */
export function groundBg<E extends HTMLElement>(e: E, theme: number, w = 8, h = 6, seed = 0): E {
  e.style.backgroundImage = `url(${groundURL(theme, w, h, seed)})`;
  return e;
}

export const ELEMENT_OF_SKILL_TAG = (el?: string): string => (el ? `chip el-${el}` : 'chip');
