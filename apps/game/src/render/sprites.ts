// Builds sprite canvases once at boot from the per-Realm sprite files (apps/game/src/sprites).
// Recoloured variants (hit flash, elite, frozen, armored, shadow) are generated here.
import { ENEMY_IDS, WEAPONS, type WeaponId } from '@pixel-horde/sim';
import { WEAPON_HELD } from '../sprites/lumora/heroes';
import { SPRITES } from '../sprites/lumora';
import { OUTLINE, TRANSPARENT, type SpriteDef } from '../sprites/types';

type C = HTMLCanvasElement;
export const INK = OUTLINE;

export function spr(rows: string[], pal: Record<string, string>): C {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  for (let y = 0; y < h; y++) for (let i = 0; i < rows[y].length; i++) {
    const ch = rows[y][i];
    if (ch === TRANSPARENT || !pal[ch]) continue;
    x.fillStyle = pal[ch];
    x.fillRect(i, y, 1, 1);
  }
  return c;
}

export function recolor(c: C, col: string, a: number): C {
  const o = document.createElement('canvas');
  o.width = c.width; o.height = c.height;
  const x = o.getContext('2d')!;
  x.drawImage(c, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.globalAlpha = a;
  x.fillStyle = col;
  x.fillRect(0, 0, o.width, o.height);
  return o;
}

export function flip(c: C): C {
  const o = document.createElement('canvas');
  o.width = c.width; o.height = c.height;
  const x = o.getContext('2d')!;
  x.translate(c.width, 0);
  x.scale(-1, 1);
  x.drawImage(c, 0, 0);
  return o;
}

/** n normal, w hit flash, e elite, i frozen, a armored. */
export type Sheet = { n: C; w: C; e: C; i: C; a: C };
/** r/l side view, down/up facing; w hit flash; dk/dkl Shadow Clone. */
export type HeroSheet = { r: C[]; l: C[]; down: C[]; up: C[]; w: C; dk: C[]; dkl: C[] };

const sheet = (n: C): Sheet => ({ n, w: recolor(n, '#ffffff', 1), e: recolor(n, '#ff2a3a', 0.45), i: recolor(n, '#9fd8ff', 0.6), a: recolor(n, '#8a94a8', 0.55) });
const frames = (d: SpriteDef): C[] => d.frames.map((rows) => spr(rows, d.pal));

export const HERO_SPR: Record<string, HeroSheet> = {};
for (const k of ['mage', 'knight', 'ranger', 'alchemist']) {
  const r = frames(SPRITES[k]);
  const dk = r.map((f) => recolor(f, '#2a1f3d', 0.55));
  HERO_SPR[k] = { r, l: r.map(flip), down: frames(SPRITES[k + '_down']), up: frames(SPRITES[k + '_up']), w: recolor(r[0], '#ffffff', 1), dk, dkl: dk.map(flip) };
}

/** Held Weapon in the Weapon's colour: [right hand, mirrored]. */
export const HELD_SPR: Partial<Record<WeaponId, [C, C]>> = {};
for (const [id, shape] of Object.entries(WEAPON_HELD) as [WeaponId, string][]) {
  const d = SPRITES['held_' + shape];
  if (!d) continue;
  const c = spr(d.frames[0], { ...d.pal, Y: WEAPONS[id].col });
  HELD_SPR[id] = [c, flip(c)];
}

export const ENEMY_SPR: Record<string, Sheet[]> = {};
for (const id of ENEMY_IDS) if (SPRITES[id]) ENEMY_SPR[id] = frames(SPRITES[id]).map(sheet);
ENEMY_SPR.mini = ENEMY_SPR.splitter;

export const PET_R: C = frames(SPRITES.pet)[0];
export const PET_LEFT: C = flip(PET_R);
/** Companion sprites by kind (right-facing, left-facing). The Three-headed Dragon draws all three. */
export const PET_SPR: Record<string, [C, C]> = {
  inferno: [PET_R, PET_LEFT],
  frost: [frames(SPRITES.petFrost)[0], flip(frames(SPRITES.petFrost)[0])],
  storm: [frames(SPRITES.petStorm)[0], flip(frames(SPRITES.petStorm)[0])],
};
