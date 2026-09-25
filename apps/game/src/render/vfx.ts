// Presentation-only state: particles, floating numbers, shake/flash, banners.
// Uses its own fxRng so rendering never touches the sim's seeded streams.
import { DEATH_COL, REALMS, ULTS, createRng, type BossMove, type EnemyId, type KingMove, type RealmId, type SimEvent, type SimState } from '@pixel-horde/sim';
import { active } from '../config';
import { isMobile } from '../platform/device';
import { castSound, comboSound, saySound, sfx, ultSound } from '../audio/sfx';
import { WEAPONS } from '@pixel-horde/sim';
import { t } from '@pixel-horde/i18n';
import { bannerText } from '../ui/text';
import { effectsScale, settings, shakeScale, vibrate } from '../settings';

export const fxRng = createRng((Date.now() ^ (Math.random() * 4294967296)) >>> 0);
const R = fxRng.next;
export const rnd = (a: number, c: number): number => a + R() * (c - a);
export const TAU = Math.PI * 2;

/** g: gravity (px/s²) for falling bits; no damping when set. */
export interface Particle { x: number; y: number; vx: number; vy: number; t: number; life: number; col: string; sz: number; g?: number }
/** Expanding ring (King deaths). */
export interface Ring { x: number; y: number; t: number; life: number; r: number; col: string }
export interface FloatText { x: number; y: number; vx: number; vy: number; t: number; life: number; v: number | string; col: string; cr: boolean; hurt?: boolean; big?: boolean }

const COMBO_COL: Record<string, string> = { shatter: '#bfe6ff', firestorm: '#ff8a3d', overload: '#fff35c', superconduct: '#7df9ff', toxicBurst: '#b6f24a', grinder: '#d8f3e0', catalyst: '#ff5cf4' };
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
  rings: [] as Ring[],
  /** King intro card. */
  intro: null as { realm: RealmId; king: EnemyId; t: number; life: number } | null,
  /** "×50 KO!" Kill Streak popup. */
  streak: null as { n: number; t: number } | null,
  /** Centre-screen warning when a King starts a move (ultimates are louder). */
  warn: null as { k: BossMove; txt: string; ult: boolean; t: number; life: number } | null,
  /** Camera zoom moment (Evolution, Awakening, fusion): seconds elapsed / length. */
  zoom: null as { t: number; life: number; k: number } | null,
  /** Real seconds of slow motion left (King deaths); main.ts scales the tick accumulator. */
  slowmo: 0,
};

/** Presentation numbers from the Run's Balance Config (the built-in/active one outside Runs). */
let FX = active.cfg.fx;
const mobile = isMobile();
const particleCap = (): number => (mobile ? FX.particlesMobile : FX.particles);
/** Current zoom factor (1 = none). */
export function zoomK(): number {
  const z = vfx.zoom;
  if (!z) return 1;
  const k = z.t / z.life, e = k < 0.25 ? k / 0.25 : k > 0.7 ? (1 - k) / 0.3 : 1;
  return 1 + (z.k - 1) * e * e * (3 - 2 * e);
}

/** Per-family death animations (on top of the sim's colour burst). */
const FAMILY: Partial<Record<EnemyId, 'splat' | 'wisp' | 'bones' | 'feathers' | 'spores' | 'snow'>> = {
  slime: 'splat', sslime: 'splat', islime: 'splat', splitter: 'splat', mini: 'splat',
  ghost: 'wisp', umbra: 'wisp', rival: 'wisp',
  skel: 'bones', mummy: 'bones',
  bat: 'feathers', ibat: 'feathers', whelp: 'feathers',
  mush: 'spores', snowman: 'snow',
};
function deathAnim(x: number, y: number, type: EnemyId, col: string, big: boolean): void {
  const k = effectsScale();
  if (k === 0) return;
  const n = Math.max(1, Math.round((big ? 14 : 5) * k)), fx = vfx.fx;
  switch (FAMILY[type]) {
    case 'splat': for (let i = 0; i < n; i++) fx.push({ x, y: y + 2, vx: rnd(-50, 50), vy: rnd(-70, -30), t: 0, life: rnd(0.35, 0.55), col, sz: 2, g: 260 }); break;
    case 'wisp': for (let i = 0; i < n; i++) fx.push({ x: x + rnd(-4, 4), y, vx: rnd(-8, 8), vy: rnd(-40, -20), t: 0, life: rnd(0.5, 0.9), col: R() < 0.5 ? '#ffffff' : col, sz: 1 }); break;
    case 'bones': for (let i = 0; i < n; i++) fx.push({ x, y, vx: rnd(-45, 45), vy: rnd(-90, -50), t: 0, life: rnd(0.4, 0.6), col: '#f0ece0', sz: 2, g: 320 }); break;
    case 'feathers': for (let i = 0; i < n; i++) fx.push({ x, y, vx: rnd(-25, 25), vy: rnd(-20, 0), t: 0, life: rnd(0.6, 0.9), col, sz: 1, g: 40 }); break;
    case 'spores': for (let i = 0; i < n; i++) fx.push({ x: x + rnd(-5, 5), y, vx: rnd(-10, 10), vy: rnd(-25, -10), t: 0, life: rnd(0.6, 1), col: R() < 0.5 ? '#ffd9de' : '#e8434f', sz: 1 }); break;
    case 'snow': for (let i = 0; i < n; i++) fx.push({ x, y, vx: rnd(-40, 40), vy: rnd(-80, -40), t: 0, life: rnd(0.4, 0.6), col: '#ffffff', sz: 2, g: 280 }); break;
    default: break;
  }
  if (big) vfx.rings.push({ x, y, t: 0, life: 0.6, r: 60, col });
}

/** Stats meter (press I): DPS over 5 s, average time-to-kill. */
export const MET = { on: false, dmg: [] as [number, number][], ttk: [] as number[] };

export function particles(x: number, y: number, col: string, n: number, sp: number, life: number): void {
  const k = effectsScale();
  if (k < 1) n = k === 0 ? 0 : Math.ceil(n * k);
  for (let i = 0; i < n; i++) {
    const a = R() * TAU, s = rnd(sp * 0.3, sp);
    vfx.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rnd(life * 0.5, life), col, sz: R() < 0.3 ? 2 : 1 });
  }
  const cap = particleCap();
  if (vfx.fx.length > cap) vfx.fx.splice(0, vfx.fx.length - cap);
}

export function setBanner(txt: string, sub: string, t: number, big?: boolean): void {
  vfx.banner = { txt, sub, t, big };
}

export function clearVfx(): void {
  vfx.fx = []; vfx.texts = []; vfx.bubbles = []; vfx.rings = []; vfx.banner = null; vfx.shake = 0; vfx.flash = 0;
  vfx.intro = null; vfx.streak = null; vfx.zoom = null; vfx.slowmo = 0; vfx.warn = null; warned.clear();
}

/** Hazard ids already announced (host and co-op guests both see King hazards tagged with their move). */
const warned = new Set<number>();
function announceKingMoves(v: Readonly<SimState>): void {
  for (const h of v.hz) {
    if (!h.bm || warned.has(h.id)) continue;
    warned.add(h.id);
    if (vfx.warn && vfx.warn.k === h.bm && vfx.warn.t < 0.8) continue; // same move, more pieces
    const ult = ULTS.includes(h.bm as KingMove);
    vfx.warn = { k: h.bm, txt: t(`kingMove.${h.bm}`), ult, t: 0, life: ult ? 1.8 : 1.3 };
  }
  if (warned.size > 400) { const live = new Set(v.hz.map((h) => h.id)); for (const id of warned) if (!live.has(id)) warned.delete(id); }
}


export function consume(events: readonly SimEvent[], v: Readonly<SimState>): void {
  FX = v.cfg.fx;
  const juice = settings.effects !== 'off';
  for (const e of events) {
    switch (e.t) {
      case 'sfx':
        if (e.k === 'ult') { ultSound(WEAPONS[v.weapon].form); vibrate(80); } // the Weapon decides the Ultimate's sound
        else sfx(e.k);
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
        if (juice && (e.key === 'bossDown' || e.key === 'umbraDown')) vfx.slowmo = FX.kingSlowmo;
        if (juice && (e.key === 'evolved' || e.key === 'awakened' || e.key === 'fused')) vfx.zoom = { t: 0, life: FX.zoomTime, k: FX.zoom };
        break;
      }
      case 'cast': castSound(e.id); break;
      case 'say': {
        saySound();
        const txt = t(`king.${e.who}.${e.beat}`);
        vfx.bubbles = vfx.bubbles.filter((b) => b.who !== e.who);
        vfx.bubbles.push({ txt, who: e.who, x: e.x, y: e.y, t: 0, life: 2.6 + txt.length * 0.03 });
        break;
      }
      case 'combo': {
        vfx.texts.push({ x: e.x, y: e.y - 18, vx: 0, vy: -26, t: 0, life: 1.1, v: t(`combo.${e.id}`), col: COMBO_COL[e.id], cr: false, big: true });
        comboSound(e.id);
        break;
      }
      case 'dmg': if (MET.on) { MET.dmg.push([v.clock, e.d]); if (MET.dmg.length > 4000) MET.dmg.splice(0, 1000); } break;
      case 'kill':
        if (MET.on) { MET.ttk.push(e.ttk); if (MET.ttk.length > 60) MET.ttk.shift(); }
        deathAnim(e.x, e.y, e.type, DEATH_COL[e.type], e.boss);
        break;
      case 'streak': if (juice) vfx.streak = { n: e.n, t: 0 }; break;
      case 'kingIntro': vfx.intro = { realm: e.realm, king: REALMS[e.realm].king, t: 0, life: FX.introTime }; break;
      default: break;
    }
  }
}

/** Per-tick ambient particles that the original spawned inside its update loop. */
export function ambient(v: Readonly<SimState>): void {
  announceKingMoves(v);
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
  for (const e of v.enemies) { // Statuses: burning embers, poison bubbles
    if ((e.burn || 0) > 0 && R() < 0.12) fx.push({ x: e.x + rnd(-e.r, e.r), y: e.y - e.r, vx: 0, vy: -20, t: 0, life: 0.35, col: R() < 0.5 ? '#ffd23f' : '#ff8a3d', sz: 1 });
    else if ((e.pois || 0) > 0 && R() < 0.08) fx.push({ x: e.x + rnd(-e.r, e.r), y: e.y - e.r * 0.5, vx: 0, vy: -12, t: 0, life: 0.45, col: '#b6f24a', sz: 1 });
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
  if (vfx.warn) { vfx.warn.t += rdt; if (vfx.warn.t >= vfx.warn.life) vfx.warn = null; }
  const damp = Math.pow(0.05, simDt);
  for (const p of vfx.fx) {
    p.t += simDt; p.x += p.vx * simDt; p.y += p.vy * simDt;
    if (p.g) p.vy += p.g * simDt; else { p.vx *= damp; p.vy *= damp; }
  }
  for (const r of vfx.rings) r.t += simDt;
  vfx.rings = vfx.rings.filter((r) => r.t < r.life);
  vfx.slowmo = Math.max(0, vfx.slowmo - rdt);
  if (vfx.intro) { vfx.intro.t += rdt; if (vfx.intro.t >= vfx.intro.life) vfx.intro = null; }
  if (vfx.streak) { vfx.streak.t += rdt; if (vfx.streak.t >= 1.4) vfx.streak = null; }
  if (vfx.zoom) { vfx.zoom.t += rdt; if (vfx.zoom.t >= vfx.zoom.life) vfx.zoom = null; }
  vfx.fx = vfx.fx.filter((p) => p.t < p.life);
  for (const t of vfx.texts) { t.t += rdt; t.x += t.vx * rdt; t.y += t.vy * rdt; if (!t.big) t.vy += 120 * rdt; else t.vy *= 0.92; }
  vfx.texts = vfx.texts.filter((t) => t.t < t.life);
  for (const b of vfx.bubbles) b.t += rdt;
  vfx.bubbles = vfx.bubbles.filter((b) => b.t < b.life);
}
