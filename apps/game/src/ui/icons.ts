// Picture icons for Skills, Passives and companions: one 32×32 atlas (built by scripts/build-icon-atlas.mjs).
// Until the atlas has loaded (or for an id without a picture) callers fall back to the coloured letter icon.
import atlasUrl from '../assets/icons.png';
import atlas from '../assets/icons.json';
import type { Icon } from './text';

const index = new Map<string, number>(atlas.ids.map((id, i) => [id, i]));
const rows = Math.ceil(atlas.ids.length / atlas.cols);

export const iconAtlas = new Image();
let ready = false;
iconAtlas.onload = () => { ready = true; };
iconAtlas.src = atlasUrl;
document.documentElement.style.setProperty('--icons', `url("${atlasUrl}")`);

/** Source rectangle [sx, sy, size] of an icon in the atlas, or null (not loaded / no picture). */
export function iconRect(id: string): [number, number, number] | null {
  const i = index.get(id);
  if (!ready || i === undefined) return null;
  return [(i % atlas.cols) * atlas.size, Math.floor(i / atlas.cols) * atlas.size, atlas.size];
}

/** A `.ico` span: the picture when there is one, else the coloured letter. `style` is appended. */
export function iconHtml(id: string, fallback: Icon, style = ''): string {
  const i = index.get(id);
  if (i === undefined) return `<span class="ico" style="background:${fallback.col}${style}">${fallback.g}</span>`;
  const x = i % atlas.cols, y = Math.floor(i / atlas.cols);
  return `<span class="ico pic" style="--x:${x};--y:${y};--c:${atlas.cols};--r:${rows}${style}"></span>`;
}
