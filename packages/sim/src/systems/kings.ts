// Kings (ticket 20): two telegraphed moves, an ultimate below phaseAt HP (and in overtime),
// dialogue beats and a spawn direction. Every move goes through the hazard system, so the
// player is only ever hurt via hurtP() and always sees a warning first.
import { TAU, atan2, cos, hypot, sin } from '../core/fmath';
import type { EnemyId } from '../data/enemies';
import { REALMS, type RealmId } from '../content/lumora/realms';
import type { Enemy, KingMove, SayBeat, SimState } from '../types';
import { addHz, tagSince } from './events';
import { burst, flash, sfx, shake } from './fx';

interface KingKit { moves: [KingMove, KingMove]; ult: KingMove }

export const KING_KITS: Partial<Record<EnemyId, KingKit>> = {
  boss: { moves: ['slam', 'split'], ult: 'splash' },
  bossD: { moves: ['sandLine', 'burrow'], ult: 'quicksand' },
  bossC: { moves: ['boneFan', 'raise'], ult: 'crypt' },
  bossS: { moves: ['iceSpears', 'iceFloor'], ult: 'throne' },
  bossE: { moves: ['quake', 'lavaDrops'], ult: 'eruption' },
  bossM: { moves: ['spit', 'frogs'], ult: 'gossip' },
  bossK: { moves: ['trail', 'swoop'], ult: 'grid' },
  bossT: { moves: ['tideWave', 'bubbles'], ult: 'siren' },
  bossG: { moves: ['laser', 'turrets'], ult: 'purge' },
  bossL: { moves: ['soulSpiral', 'swap'], ult: 'requiem' },
  // Umbra: shadow copies of the Hero's skills; stolen King ultimates from phase 2 (see umbraUlt).
  umbra: { moves: ['shadowBolts', 'shadowMeteors'], ult: 'splash' },
};

export const ULTS: KingMove[] = ['splash', 'quicksand', 'crypt', 'throne', 'eruption', 'gossip', 'grid', 'siren', 'purge', 'requiem'];

export function say(s: SimState, e: Enemy, beat: SayBeat): void {
  s.events.push({ t: 'say', who: e.type, beat, x: e.x, y: e.y });
}

/** Where a spawn is relative to the player, for the banner ("from the right"). */
export function directionOf(s: SimState, x: number, y: number): 'left' | 'right' | 'up' | 'down' {
  const dx = x - s.P.x, dy = y - s.P.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

export function initKing(s: SimState, e: Enemy): void {
  e.kg = { phase: 1, cd: s.cfg.kings.firstCd, ultCd: 0, lock: 0, land: null, next: null };
  say(s, e, 'arrive');
}

/** Umbra borrows the ultimates of Kings that escaped (weaker ones of defeated Kings otherwise). */
function umbraUlt(s: SimState): { k: KingMove; mul: number } {
  const R = s.rng.ai;
  const esc = s.escapedKings.map((r: RealmId) => KING_KITS[REALMS[r].king]?.ult).filter((u): u is KingMove => !!u);
  if (esc.length) return { k: esc[R.int(esc.length)], mul: 1 };
  return { k: ULTS[R.int(ULTS.length)], mul: s.cfg.kings.umbraUltDmg };
}

/** Every hazard a King move creates is tagged with the move (red telegraph + on-screen warning). */
function tagged(s: SimState, k: KingMove, f: () => void): void {
  const n = s.hz.length;
  f();
  tagSince(s, n, k);
}

function doMove(s: SimState, e: Enemy, k: KingMove, mul: number): void {
  const K = s.cfg.kings, R = s.rng.ai, P = s.P, kg = e.kg!;
  const tx = P.x, ty = P.y, a = atan2(ty - e.y, tx - e.x), D = e.dmg * mul, W = K.ultWarn;
  switch (k) {
    case 'shadowBolts': {
      const U = s.cfg.umbra;
      for (let i = 0; i < U.bolts; i++) {
        const aa = a + (i - (U.bolts - 1) / 2) * U.boltSpread;
        addHz(s, { k: 'line', x: e.x, y: e.y, a: aa, r: 90, te: 0.5, d: D * U.boltDmg, c: 1, fire: true, sp: U.boltSpeed });
      }
      kg.lock = 0.5;
      break;
    }
    case 'shadowMeteors': {
      const U = s.cfg.umbra;
      for (let i = 0; i < U.meteors; i++) addHz(s, { k: 'circ', x: tx + (i ? R.range(-50, 50) : 0), y: ty + (i ? R.range(-35, 35) : 0), r: U.meteorR, te: U.meteorWarn + i * 0.12, d: D * U.meteorDmg, c: 1 });
      kg.lock = 0.4;
      break;
    }
    case 'slam': {
      const c = K.slam;
      addHz(s, { k: 'circ', x: tx, y: ty, r: c.r, te: c.warn, d: D * c.dmg, c: 3 });
      kg.lock = c.warn; kg.land = [tx, ty]; e.hide = true;
      break;
    }
    case 'split': {
      const c = K.split;
      for (let i = 0; i < c.n; i++) {
        const aa = (i / c.n) * TAU;
        addHz(s, { k: 'circ', x: e.x + cos(aa) * c.r, y: e.y + sin(aa) * c.r, r: 8, te: c.warn, d: 0, c: 3, spawn: 'slime' });
      }
      kg.lock = c.warn * 0.5;
      break;
    }
    case 'splash': {
      const c = K.splash;
      addHz(s, { k: 'circ', x: tx, y: ty, r: c.land, te: W, d: D * c.dmg, c: 3 });
      kg.lock = W; kg.land = [tx, ty]; e.hide = true;
      kg.next = { k: 'splash', t: W };
      break;
    }
    case 'sandLine': {
      const c = K.sandLine;
      addHz(s, { k: 'beam', x: e.x, y: e.y, a, r: c.len, w: c.w, te: c.warn, d: D * c.dmg, c: 2 });
      kg.lock = c.warn;
      break;
    }
    case 'burrow': {
      const c = K.burrow;
      addHz(s, { k: 'circ', x: tx, y: ty, r: c.r, te: c.warn, d: D * c.dmg, c: 4 });
      burst(s, e.x, e.y, '#cdb57a', 16, 60, 0.5);
      kg.lock = c.warn; kg.land = [tx, ty]; e.hide = true;
      break;
    }
    case 'quicksand': {
      const c = K.quicksand;
      addHz(s, { k: 'pull', x: tx, y: ty, r: c.r, w: c.core, te: W, du: c.dur, sp: c.pull, d: D * c.dmg });
      for (let i = 0; i < c.coins; i++) {
        const aa = R.next() * TAU, dd = R.range(0.3, 0.8) * c.r;
        addHz(s, { k: 'circ', x: tx + cos(aa) * dd, y: ty + sin(aa) * dd, r: c.coinR, te: W + 0.4 + i * 0.25, d: D * c.coinDmg, c: 2 });
      }
      kg.lock = W;
      break;
    }
    case 'boneFan': {
      const c = K.boneFan;
      for (let i = 0; i < c.n; i++) addHz(s, { k: 'line', x: e.x, y: e.y, a: a + (i - (c.n - 1) / 2) * c.spread, r: c.len, te: c.warn, d: D * c.dmg, c: 4, fire: true });
      kg.lock = c.warn;
      break;
    }
    case 'raise': {
      const c = K.raise, a0 = R.next() * TAU;
      for (let i = 0; i < c.n; i++) {
        const aa = a0 + (i / c.n) * TAU;
        addHz(s, { k: 'circ', x: tx + cos(aa) * c.r, y: ty + sin(aa) * c.r, r: 8, te: c.warn, d: 0, c: 4, spawn: 'skel' });
      }
      kg.lock = 0.4;
      break;
    }
    case 'crypt': {
      const c = K.crypt, gap0 = R.int(c.n);
      for (let i = 0; i < c.n; i++) {
        if ((i - gap0 + c.n) % c.n < c.gap) continue; // the one way out
        const aa = (i / c.n) * TAU;
        addHz(s, { k: 'circ', x: tx + cos(aa) * c.r, y: ty + sin(aa) * c.r, r: c.spotR, te: W, d: D * c.dmg, c: 4 });
      }
      addHz(s, { k: 'circ', x: tx, y: ty, r: c.centerR, te: W + c.centerDelay, d: D * c.centerDmg, c: 1 });
      kg.lock = W;
      break;
    }
    case 'iceSpears': {
      const c = K.iceSpears;
      for (let i = 0; i < c.n; i++) addHz(s, { k: 'line', x: e.x, y: e.y, a: a + (i - (c.n - 1) / 2) * c.spread, r: c.len, te: c.warn, d: D * c.dmg, c: 5, fire: true });
      kg.lock = c.warn;
      break;
    }
    case 'iceFloor': {
      const c = K.iceFloor;
      addHz(s, { k: 'ice', x: tx, y: ty, r: c.r, te: c.warn, du: c.dur, sp: c.slip });
      kg.lock = 0.5;
      break;
    }
    case 'throne': {
      const c = K.throne, a0 = R.next() * TAU, pts: [number, number][] = [];
      for (let i = 0; i < c.spots; i++) {
        const aa = a0 + (i / c.spots) * TAU;
        pts.push([tx + cos(aa) * c.spread, ty + sin(aa) * c.spread]);
      }
      addHz(s, { k: 'safe', x: tx, y: ty, r: c.spotR, pts, te: W + 0.4, d: D * c.dmg });
      kg.lock = W;
      break;
    }
    /* ---------- Magma King ---------- */
    case 'quake': {
      const c = K.quake;
      addHz(s, { k: 'circ', x: e.x, y: e.y, r: 30, te: c.warn, d: 0, c: 0 });
      kg.lock = c.warn; kg.next = { k: 'quake', t: c.warn };
      break;
    }
    case 'lavaDrops': {
      const c = K.lavaDrops, a0 = R.next() * TAU;
      for (let i = 0; i < c.n; i++) {
        const aa = a0 + (i / c.n) * TAU;
        addHz(s, { k: 'circ', x: tx + cos(aa) * c.r, y: ty + sin(aa) * c.r, r: c.spot, te: c.warn + i * c.gap, d: D * c.dmg, c: 0 });
      }
      addHz(s, { k: 'circ', x: tx, y: ty, r: c.spot, te: c.warn + c.n * c.gap, d: D * c.dmg, c: 0 });
      kg.lock = 0.5;
      break;
    }
    case 'eruption': {
      const c = K.eruption, vw = s.viewport.w / 2, vh = s.viewport.h / 2;
      for (let w = 0; w < c.waves; w++) for (let i = 0; i < c.n; i++) {
        addHz(s, { k: 'circ', x: tx + R.range(-vw, vw), y: ty + R.range(-vh, vh), r: c.spot, te: W + w * c.gap + R.range(0, 0.2), d: D * c.dmg, c: 0 });
      }
      kg.lock = W;
      break;
    }
    /* ---------- Bog Queen ---------- */
    case 'spit': {
      const c = K.spit;
      addHz(s, { k: 'cone', x: e.x, y: e.y, a, r: c.r, sp: c.spread, te: c.warn, du: c.dur, d: D * c.dmg, c: 3 });
      kg.lock = c.warn + c.dur;
      break;
    }
    case 'frogs': {
      const c = K.frogs, a0 = R.next() * TAU;
      for (let i = 0; i < c.n; i++) {
        const aa = a0 + (i / c.n) * TAU;
        addHz(s, { k: 'circ', x: tx + cos(aa) * c.r, y: ty + sin(aa) * c.r, r: 8, te: c.warn, d: 0, c: 3, spawn: 'frog' });
      }
      kg.lock = 0.4;
      break;
    }
    case 'gossip': {
      const c = K.gossip, aa = R.next() * TAU;
      addHz(s, { k: 'safe', x: tx, y: ty, r: c.spotR, pts: [[tx + cos(aa) * 40, ty + sin(aa) * 40]], te: W + 0.6, d: D * c.dmg, c: 3 });
      kg.lock = W;
      break;
    }
    /* ---------- Storm King ---------- */
    case 'trail': {
      const c = K.trail;
      for (let i = 0; i < c.n; i++) {
        const ahead = c.lead * i * 0.5;
        addHz(s, { k: 'circ', x: tx + P.vx * ahead, y: ty + P.vy * ahead, r: c.r, te: c.warn + i * c.gap, d: D * c.dmg, c: 2 });
      }
      kg.lock = 0.4;
      break;
    }
    case 'swoop': {
      const c = K.swoop, ex = e.x + cos(a) * c.len, ey = e.y + sin(a) * c.len;
      addHz(s, { k: 'beam', x: e.x, y: e.y, a, r: c.len, w: c.w, te: c.warn, d: D * c.dmg, c: 2 });
      kg.lock = c.warn; kg.land = [ex, ey]; e.hide = true;
      break;
    }
    case 'grid': {
      const c = K.grid, nx = Math.ceil(s.viewport.w / c.step / 2), ny = Math.ceil(s.viewport.h / c.step / 2);
      for (let gx = -nx; gx <= nx; gx++) for (let gy = -ny; gy <= ny; gy++) {
        const odd = ((gx + gy) & 1) !== 0;
        addHz(s, { k: 'circ', x: tx + gx * c.step, y: ty + gy * c.step, r: c.r, te: W + (odd ? c.gap : 0), d: D * c.dmg, c: 2 });
      }
      kg.lock = W;
      break;
    }
    /* ---------- Tide Queen ---------- */
    case 'tideWave': {
      const c = K.tideWave;
      addHz(s, { k: 'cone', x: e.x, y: e.y, a, r: c.r, sp: c.spread, te: c.warn, du: c.dur, d: D * c.dmg, c: 5 });
      kg.lock = c.warn + c.dur;
      break;
    }
    case 'bubbles': {
      const c = K.bubbles;
      for (let i = 0; i < c.n; i++) addHz(s, { k: 'line', x: e.x, y: e.y, a: a + (i - (c.n - 1) / 2) * c.spread, r: 90, te: c.warn, d: D * c.dmg, c: 5, fire: true, sp: c.speed });
      kg.lock = c.warn;
      break;
    }
    case 'siren': {
      const c = K.siren;
      addHz(s, { k: 'pull', x: e.x, y: e.y, r: c.r, w: c.core, te: W, du: c.dur, sp: c.pull, d: D * c.dmg });
      kg.lock = W + c.dur; kg.next = { k: 'siren', t: W + c.dur };
      break;
    }
    /* ---------- Golem King ---------- */
    case 'laser': {
      const c = K.laser;
      addHz(s, { k: 'beam', x: e.x, y: e.y, a, r: c.len, w: c.w, te: c.warn, d: D * c.dmg, c: 0 });
      kg.lock = c.warn;
      break;
    }
    case 'turrets': {
      const c = K.turrets, a0 = R.next() * TAU;
      for (let i = 0; i < c.n; i++) {
        const aa = a0 + (i / c.n) * TAU;
        addHz(s, { k: 'circ', x: e.x + cos(aa) * c.r, y: e.y + sin(aa) * c.r, r: 8, te: c.warn, d: 0, c: 2, spawn: 'turret' });
      }
      kg.lock = 0.5;
      break;
    }
    case 'purge': {
      const c = K.purge, a0 = a + (R.next() < 0.5 ? 1 : -1) * 0.8, dir = R.next() < 0.5 ? 1 : -1;
      for (let i = 0; i < c.n; i++) addHz(s, { k: 'beam', x: e.x, y: e.y, a: a0 + dir * (i / c.n) * TAU, r: c.len, w: c.w, te: W + i * c.step, d: D * c.dmg, c: 0 });
      kg.lock = W + c.n * c.step;
      break;
    }
    /* ---------- Lich Queen ---------- */
    case 'soulSpiral': {
      const c = K.soulSpiral, a0 = R.next() * TAU;
      for (let i = 0; i < c.n; i++) addHz(s, { k: 'line', x: e.x, y: e.y, a: a0 + (i / c.n) * TAU, r: 60, te: c.warn + i * c.gap, d: D * c.dmg, c: 1, fire: true, sp: c.speed });
      kg.lock = c.warn;
      break;
    }
    case 'swap': {
      const c = K.swap, near = s.enemies.filter((m) => !m.dead && !m.boss && Math.abs(m.x - tx) < s.viewport.w / 2 && Math.abs(m.y - ty) < s.viewport.h / 2);
      if (!near.length) { doMove(s, e, 'soulSpiral', mul); break; }
      const m = near[R.int(near.length)];
      addHz(s, { k: 'circ', x: m.x, y: m.y, r: c.r, te: c.warn, d: D * c.dmg, c: 1 });
      kg.land = [m.x, m.y]; m.x = e.x; m.y = e.y; e.hide = true;
      burst(s, e.x, e.y, '#b07cff', 14, 60, 0.5);
      kg.lock = c.warn;
      break;
    }
    case 'requiem': {
      const c = K.requiem, a0 = R.next() * TAU;
      for (let i = 0; i < c.n; i++) {
        const aa = a0 + (i / c.n) * TAU, bx = tx + cos(aa) * c.r, by = ty + sin(aa) * c.r;
        addHz(s, { k: 'line', x: bx, y: by, a: aa + Math.PI, r: c.r, te: W + i * c.gap, d: D * c.dmg, c: 1, fire: true, sp: c.speed });
      }
      kg.lock = W;
      break;
    }
  }
}

/** Second half of a two-part move (Royal Splash: the slime wave after the landing). */
function doNext(s: SimState, e: Enemy, k: KingMove): void {
  const K = s.cfg.kings;
  if (k === 'splash') {
    addHz(s, { k: 'ring', x: e.x, y: e.y, r: K.splash.r, du: K.splash.dur, d: e.dmg * K.splash.dmg, c: 3 });
    shake(s, 6);
  } else if (k === 'quake') {
    addHz(s, { k: 'ring', x: e.x, y: e.y, r: K.quake.r, du: K.quake.dur, d: e.dmg * K.quake.dmg, c: 0 });
    shake(s, 7);
    sfx(s, 'boom');
  } else if (k === 'siren') {
    addHz(s, { k: 'ring', x: e.x, y: e.y, r: K.siren.wave, du: K.siren.waveDur, d: e.dmg * K.siren.waveDmg, c: 5 });
    shake(s, 6);
  }
}

export function kingAI(s: SimState, e: Enemy, dt: number, tx: number, ty: number, damp: number): void {
  const K = s.cfg.kings, kg = e.kg!, R = s.rng.ai, kit = KING_KITS[e.type]!, umbra = e.type === 'umbra';
  if (umbra && kg.phase === 2 && e.hp < e.maxHp * s.cfg.umbra.phase3) {
    // the darkened heart: the screen goes dark, ultimates come faster
    kg.phase = 3;
    s.darkness = true;
    kg.ultCd = Math.min(kg.ultCd, K.ultFirst);
    say(s, e, 'heart');
    flash(s, 0.5, '#1a1030');
    shake(s, 8);
  }
  if (kg.phase === 1 && e.hp < e.maxHp * (umbra ? s.cfg.umbra.phase2 : K.phaseAt)) {
    kg.phase = 2;
    kg.ultCd = Math.min(kg.ultCd, K.ultFirst);
    say(s, e, 'half');
    flash(s, 0.25, '#ff2a3a');
    shake(s, 4);
  }
  kg.ultCd -= dt;
  const locked = kg.lock > 0;
  if (locked) {
    kg.lock -= dt;
    if (kg.lock <= 0 && kg.land) {
      e.x = kg.land[0]; e.y = kg.land[1];
      kg.land = null; e.hide = false;
      burst(s, e.x, e.y, '#ffffff', 14, 70, 0.4);
      sfx(s, 'boom');
    }
  }
  // after the landing, so a follow-up starts where the King came down
  if (kg.next) {
    kg.next.t -= dt;
    if (kg.next.t <= 0) { const k = kg.next.k; kg.next = null; tagged(s, k, () => doNext(s, e, k)); }
  }
  if (locked) return;
  const dx = tx - e.x, dy = ty - e.y, l = hypot(dx, dy) || 1;
  const sp = e.spd * (e.slowT > 0 ? s.cfg.skills.frost.slow : 1);
  e.x += (dx / l) * sp * dt + e.kx * dt;
  e.y += (dy / l) * sp * dt + e.ky * dt;
  e.kx *= damp; e.ky *= damp;
  kg.cd -= dt;
  if (kg.cd > 0) return;
  kg.cd = R.range(K.cdMin, K.cdMax);
  if ((kg.phase >= 2 || s.overtime) && kg.ultCd <= 0) {
    kg.ultCd = K.ultCd * (s.overtime ? K.overtimeUltMul : 1) * (kg.phase === 3 ? s.cfg.umbra.ultCdMul3 : 1);
    const u = e.type === 'umbra' ? umbraUlt(s) : { k: kit.ult, mul: 1 };
    flash(s, 0.2, '#ffffff');
    sfx(s, 'ult');
    tagged(s, u.k, () => doMove(s, e, u.k, u.mul));
  } else { const k = kit.moves[R.int(2)]; tagged(s, k, () => doMove(s, e, k, 1)); }
}
