// Presentation-only state: particles, floating numbers, shake/flash, banners.
// Uses its own fxRng so rendering never touches the sim's seeded streams.
import { createRng, type SimEvent, type SimState } from '@pixel-horde/sim';
import { sfx } from '../audio/sfx';
import { t } from '@pixel-horde/i18n';
import { bannerText } from '../ui/text';
import { effectsScale, settings, shakeScale, vibrate } from '../settings';

export const fxRng = createRng((Date.now() ^ (Math.random() * 4294967296)) >>> 0);
const R = fxRng.next;
export const rnd = (a: number, c: number): number => a + R() * (c - a);
export const TAU = Math.PI * 2;

export interface Particle { x: number; y: number; vx: number; vy: number; t: number; life: number; col: string; sz: number }
export interface FloatText { x: number; y: number; vx: number; vy: number; t: number; life: number; v: number | string; col: string; cr: boolean; hurt?: boolean }
export interface Banner { txt: string; sub: string; t: number; big?: boolean }
/** King dialogue: a small non-blocking bubble that follows its speaker while it lives. */
export interface Bubble { txt: string; who: string; x: number; y: number; t: number; life: number }

export const vfx = {
  fx: [] as Particle[],
  texts: [] as FloatText[],
  shake: 0,
  flash: 0,
  flashCol: '#fff',
  banner: null as Banner | null,
  bubbles: [] as Bubble[],
};

/** Stats meter (press I): DPS over 5 s, average time-to-kill. */
export const MET = { on: false, dmg: [] as [number, number][], ttk: [] as number[] };

export function particles(x: number, y: number, col: string, n: number, sp: number, life: number): void {
  const k = effectsScale();
  if (k < 1) n = k === 0 ? 0 : Math.ceil(n * k);
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, s = rnd(sp * 0.3, sp);
    vfx.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rnd(life * 0.5, life), col, sz: R() < 0.3 ? 2 : 1 });
  }
  if (vfx.fx.length > 900) vfx.fx.splice(0, vfx.fx.length - 900);
}

export function setBanner(txt: string, sub: string, t: number, big?: boolean): void {
  vfx.banner = { txt, sub, t, big };
}

export function clearVfx(): void {
  vfx.fx = []; vfx.texts = []; vfx.bubbles = []; vfx.banner = null; vfx.shake = 0; vfx.flash = 0;
}

export function consume(events: readonly SimEvent[], v: Readonly<SimState>): void {
  for (const e of events) {
    switch (e.t) {
      case 'sfx':
        sfx(e.k);
        if (e.k === 'ult') vibrate(80);
        break;
      case 'text': {
        if (e.hurt) vibrate(35);
        const isNumber = !e.hurt && typeof e.v === 'number';
        if (isNumber && (settings.numbers === 'off' || (settings.numbers === 'some' && !e.cr))) break;
        if (e.hurt || e.v === '' || typeof e.v === 'string') {
          vfx.texts.push({ x: e.x, y: e.y, vx: 0, vy: e.hurt ? -40 : e.col === '#ffd23f' ? -35 : -40, t: 0, life: e.hurt ? 0.8 : e.col === '#ffd23f' ? 0.8 : 0.9, v: e.v, col: e.col, cr: e.cr, hurt: e.hurt });
        } else {
          const x = e.jitter ? e.x + rnd(-3, 3) : e.x;
          vfx.texts.push({ x, y: e.y, vx: rnd(-18, 18), vy: e.cr ? -70 : -55, t: 0, life: e.cr ? 0.95 : 0.7, v: e.v, col: e.col, cr: e.cr });
        }
        if (vfx.texts.length > 220) vfx.texts.shift();
        break;
      }
      case 'burst': if (e.p == null || R() < e.p) particles(e.x, e.y, e.col, e.n, e.sp, e.life); break;
      case 'shake': vfx.shake = Math.max(vfx.shake, e.v * shakeScale()); break;
      case 'flash':
        if (e.ult && !settings.ultFlash) break;
        vfx.flash = e.max ? Math.max(vfx.flash, e.v) : e.v;
        if (e.col) vfx.flashCol = e.col;
        break;
      case 'banner': {
        const tx = bannerText(e.key, e.args || {}, v.realm);
        setBanner(tx.txt, tx.sub, e.dur, e.big);
        if (e.key === 'bossDown' || e.key === 'dragonTamed') vibrate([60, 40, 60]);
        break;
      }
      case 'say': {
        const txt = t(`king.${e.who}.${e.beat}`);
        vfx.bubbles = vfx.bubbles.filter((b) => b.who !== e.who);
        vfx.bubbles.push({ txt, who: e.who, x: e.x, y: e.y, t: 0, life: 2.6 + txt.length * 0.03 });
        break;
      }
      case 'dmg': if (MET.on) { MET.dmg.push([v.clock, e.d]); if (MET.dmg.length > 4000) MET.dmg.splice(0, 1000); } break;
      case 'kill': if (MET.on) { MET.ttk.push(e.ttk); if (MET.ttk.length > 60) MET.ttk.shift(); } break;
      default: break;
    }
  }
}

/** Per-tick ambient particles that the original spawned inside its update loop. */
export function ambient(v: Readonly<SimState>): void {
  const k = effectsScale();
  if (k === 0 || (k < 1 && R() > k)) return;
  const fx = vfx.fx;
  for (const bo of v.bolts) if (R() < 0.6) fx.push({ x: bo.x, y: bo.y, vx: 0, vy: 0, t: 0, life: 0.2, col: bo.col, sz: 1 });
  for (const f of v.effects) {
    if (f.type === 'pbreath') {
      for (let i = 0; i < 3; i++) {
        const a = f.a! + rnd(-f.sp!, f.sp!), d = rnd(4, f.r!);
        fx.push({ x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, t: 0, life: 0.3, col: R() < 0.5 ? '#ffd23f' : '#ff6a2a', sz: R() < 0.4 ? 2 : 1 });
      }
    } else if (f.type === 'cyclone') {
      if (R() < 0.7) { const a = R() * TAU; fx.push({ x: f.x + Math.cos(a) * f.r!, y: f.y + Math.sin(a) * f.r! * 0.5 - rnd(0, 12), vx: -Math.sin(a) * 60, vy: Math.cos(a) * 20 - 20, t: 0, life: 0.3, col: R() < 0.5 ? '#ffffff' : '#a9e38a', sz: 1 }); }
    } else if (f.type === 'toxic') {
      if (R() < 0.25) fx.push({ x: f.x + rnd(-f.r!, f.r!) * 0.8, y: f.y + rnd(-f.r!, f.r!) * 0.4, vx: 0, vy: -12, t: 0, life: 0.6, col: '#d9ff8a', sz: 1 });
    } else if (f.type === 'hole' && !f.boomed) {
      for (let i = 0; i < 3; i++) {
        const a = R() * TAU, d = f.r! * rnd(0.6, 1.2);
        fx.push({ x: f.x + Math.cos(a) * d, y: f.y + Math.sin(a) * d, vx: -Math.cos(a) * d * 2.2, vy: -Math.sin(a) * d * 2.2, t: 0, life: 0.4, col: R() < 0.5 ? '#b07cff' : '#ffffff', sz: 1 });
      }
    }
  }
  for (const h of v.hz) {
    if (h.k === 'cone' && h.t >= h.te! && h.t < h.te! + h.du! && R() < 0.9) {
      const a = h.a! + rnd(-h.sp!, h.sp!), d = rnd(10, h.r!);
      fx.push({ x: h.x + Math.cos(a) * d, y: h.y + Math.sin(a) * d, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40, t: 0, life: 0.3, col: R() < 0.5 ? '#ffd23f' : '#ff4b3a', sz: 2 });
    } else if (h.k === 'proj' && R() < 0.5) {
      fx.push({ x: h.x, y: h.y, vx: 0, vy: 0, t: 0, life: 0.25, col: h.c === 1 ? '#8a5ad6' : h.c === 3 ? '#d27bff' : '#ff8a3d', sz: 1 });
    }
  }
}

/** Advance visuals by real frame time. */
export function stepVfx(rdt: number, simDt: number): void {
  vfx.shake = Math.max(0, vfx.shake - rdt * 20);
  vfx.flash = Math.max(0, vfx.flash - rdt * 1.6);
  if (vfx.banner) { vfx.banner.t -= rdt; if (vfx.banner.t <= 0) vfx.banner = null; }
  const damp = Math.pow(0.05, simDt);
  for (const p of vfx.fx) { p.t += simDt; p.x += p.vx * simDt; p.y += p.vy * simDt; p.vx *= damp; p.vy *= damp; }
  vfx.fx = vfx.fx.filter((p) => p.t < p.life);
  for (const t of vfx.texts) { t.t += rdt; t.x += t.vx * rdt; t.y += t.vy * rdt; t.vy += 120 * rdt; }
  vfx.texts = vfx.texts.filter((t) => t.t < t.life);
  for (const b of vfx.bubbles) b.t += rdt;
  vfx.bubbles = vfx.bubbles.filter((b) => b.t < b.life);
}
