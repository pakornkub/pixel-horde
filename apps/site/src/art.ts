// Pixel art for the website, built from the game's own sprite data and tile painter so every
// picture matches the game. Sprites are drawn at 1× and scaled up with CSS (pixelated).
import type { EnemyId, HeroId, PassiveId, ShopId, SkillId } from '@pixel-horde/sim';
import { ENEMY_SPR, HELD_SPR, HERO_SPR, PET_SPR } from '../../game/src/render/sprites';
import { THEME_VIS, tileAtT } from '../../game/src/render/tiles';
import { PASSIVE_ICON, SHOP_ICON, SKILL_ICON, type Icon } from '../../game/src/ui/text';

export const INK = '#1e1b33';
type C = HTMLCanvasElement;

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function blank(w: number, h: number): C {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** A copy of `src` shown `scale`× bigger with crisp pixels. */
export function pix(src: C, scale: number, cls = ''): C {
  const c = blank(src.width, src.height);
  c.getContext('2d')!.drawImage(src, 0, 0);
  sizeUp(c, scale, cls);
  return c;
}

function sizeUp(c: C, scale: number, cls: string): void {
  c.className = ('px ' + cls).trim();
  c.style.width = c.width * scale + 'px';
  c.style.height = c.height * scale + 'px';
  c.setAttribute('aria-hidden', 'true');
}

// One shared ticker swaps animation frames for every animated sprite on the page.
const anims: { el: C; frames: C[]; fps: number; off: number }[] = [];
let ticking = false;
function tick(now: number): void {
  if (!document.hidden) {
    for (const a of anims) {
      if (!a.el.isConnected) continue;
      const f = a.frames[Math.floor((now / 1000) * a.fps + a.off) % a.frames.length];
      const x = a.el.getContext('2d')!;
      x.clearRect(0, 0, a.el.width, a.el.height);
      x.drawImage(f, 0, 0);
    }
  }
  requestAnimationFrame(tick);
}

/** An animated sprite (frame flipbook). Reduced motion shows the first frame only. */
export function anim(frames: C[], scale: number, fps = 4, cls = ''): C {
  const c = pix(frames[0], scale, cls);
  if (reduced || frames.length < 2) return c;
  anims.push({ el: c, frames, fps, off: Math.random() * frames.length });
  if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  return c;
}

export const enemyFrames = (id: EnemyId | string): C[] => (ENEMY_SPR[id] ?? ENEMY_SPR.slime).map((s) => s.n);
export const enemy = (id: EnemyId | string, scale: number, cls = ''): C => anim(enemyFrames(id), scale, 3, cls);

export type Facing = 'down' | 'up' | 'r' | 'l';
export const heroFrames = (id: HeroId, dir: Facing = 'down'): C[] => HERO_SPR[id][dir];
export const hero = (id: HeroId, scale: number, dir: Facing = 'down', cls = ''): C => anim(heroFrames(id, dir), scale, 4, cls);

/** Hero holding a Weapon (the held sprite sits in the right hand, like in the game). */
export function heroWithWeapon(id: HeroId, weapon: string, scale: number): C {
  const frames = HERO_SPR[id].r.map((f) => {
    const c = blank(22, 16);
    const x = c.getContext('2d')!;
    x.drawImage(f, 0, 0);
    const held = HELD_SPR[weapon as keyof typeof HELD_SPR];
    if (held) x.drawImage(held[0], 12, 6);
    return c;
  });
  return anim(frames, scale, 4);
}

export const weaponIcon = (weapon: string, scale: number): C => {
  const held = HELD_SPR[weapon as keyof typeof HELD_SPR];
  return pix(held ? held[0] : blank(6, 8), scale, 'wpn');
};

export const pet = (kind: 'inferno' | 'frost' | 'storm', scale: number): C => pix(PET_SPR[kind][0], scale);

/** A patch of a Realm's ground, painted with the game's tile code. */
const groundCache = new Map<string, string>();
export function ground(theme: number, wTiles: number, hTiles: number, seed = 0): C {
  const c = blank(wTiles * 16, hTiles * 16);
  const x = c.getContext('2d')!;
  for (let ty = 0; ty < hTiles; ty++) for (let tx = 0; tx < wTiles; tx++) x.drawImage(tileAtT(theme, tx + seed, ty + seed * 3), tx * 16, ty * 16);
  return c;
}
/** Data URL of a ground patch for CSS backgrounds (cached). */
export function groundURL(theme: number, wTiles = 12, hTiles = 8, seed = 0): string {
  const k = `${theme}:${wTiles}:${hTiles}:${seed}`;
  let u = groundCache.get(k);
  if (!u) { u = ground(theme, wTiles, hTiles, seed).toDataURL(); groundCache.set(k, u); }
  return u;
}
/** Main ground colour of a theme (for small swatches). */
export const themeColor = (theme: number): string => (THEME_VIS[theme]?.g?.[0] as string) ?? '#5fae4b';

/** The game's square skill icon (colour + glyph). */
function iconEl(ic: Icon, cls: string): HTMLElement {
  const d = document.createElement('span');
  d.className = 'ico ' + cls;
  d.style.setProperty('--c', ic.col);
  d.textContent = ic.g;
  d.setAttribute('aria-hidden', 'true');
  return d;
}
export const skillIcon = (id: SkillId, cls = ''): HTMLElement => iconEl(SKILL_ICON[id], cls);
export const passiveIcon = (id: PassiveId, cls = ''): HTMLElement => iconEl(PASSIVE_ICON[id], cls);
export const shopIcon = (id: ShopId, cls = ''): HTMLElement => iconEl(SHOP_ICON[id], cls);
export const skillColor = (id: SkillId): string => SKILL_ICON[id].col;

// Pickups, drawn exactly like draw.ts does in the game (centre at 8,8 on a 16×16 canvas).
type Pickup = 'gem' | 'gemBig' | 'coin' | 'heart' | 'shield' | 'chest';
export function pickup(kind: Pickup, scale: number): C {
  const c = blank(16, 16), b = c.getContext('2d')!, x = 8, y = 8;
  const r = (col: string, px: number, py: number, w: number, h: number): void => { b.fillStyle = col; b.fillRect(px, py, w, h); };
  if (kind === 'gem' || kind === 'gemBig') {
    const col = kind === 'gem' ? '#4fc3ff' : '#ff5cf4';
    r(INK, x - 2, y - 3, 4, 6); r(INK, x - 3, y - 2, 6, 4); r(col, x - 1, y - 2, 2, 4); r(col, x - 2, y - 1, 4, 2); r('#fff', x - 1, y - 2, 1, 1);
  } else if (kind === 'coin') {
    r(INK, x - 2, y - 3, 4, 6); r(INK, x - 3, y - 2, 6, 4); r('#ffd23f', x - 2, y - 2, 4, 4); r('#fff8c0', x - 1, y - 2, 1, 2);
  } else if (kind === 'chest') {
    r(INK, x - 7, y - 6, 14, 11); r('#9a5a2a', x - 6, y - 5, 12, 9); r('#c77d3a', x - 6, y - 5, 12, 3); r('#ffd23f', x - 6, y - 2, 12, 1); r('#ffd23f', x - 1, y - 3, 2, 3);
  } else if (kind === 'shield') {
    r(INK, x - 4, y - 4, 8, 7); r(INK, x - 3, y + 3, 6, 1); r(INK, x - 1, y + 4, 2, 1);
    r('#4fb4ff', x - 3, y - 3, 6, 6); r('#4fb4ff', x - 2, y + 3, 4, 1); r('#bfe8ff', x - 2, y - 2, 2, 3); r('#fff', x - 2, y - 2, 1, 1);
  } else {
    r(INK, x - 4, y - 3, 8, 6); r('#ff4b5c', x - 3, y - 3, 2, 1); r('#ff4b5c', x + 1, y - 3, 2, 1); r('#ff4b5c', x - 3, y - 2, 6, 2); r('#ff4b5c', x - 2, y, 4, 1); r('#ff4b5c', x - 1, y + 1, 2, 1);
  }
  sizeUp(c, scale, '');
  return c;
}

/** Tiny DOM helper: el('div.card', {title: 'x'}, child, 'text'). */
type TagName<S extends string> = S extends `${infer T}.${string}` ? T : S;
type ElOf<S extends string> = TagName<S> extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[TagName<S>] : HTMLElement;
export function el<S extends string>(spec: S, attrs: Record<string, string> | null = null, ...kids: (Node | string | null | undefined | false)[]): ElOf<S> {
  const [tag, ...classes] = spec.split('.');
  const e = document.createElement(tag) as ElOf<S>;
  if (classes.length) e.className = classes.join(' ');
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  }
  for (const k of kids) if (k !== null && k !== undefined && k !== false) e.append(k);
  return e;
}
