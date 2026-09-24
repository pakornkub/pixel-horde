// Kings (ticket 20): two telegraphed moves, an ultimate below phaseAt HP (and in overtime),
// dialogue beats and a spawn direction. Every move goes through the hazard system, so the
// player is only ever hurt via hurtP() and always sees a warning first.
import { TAU, atan2, cos, hypot, sin } from '../core/fmath';
import type { EnemyId } from '../data/enemies';
import { REALMS, type RealmId } from '../content/lumora/realms';
import type { Enemy, KingMove, SayBeat, SimState } from '../types';
import { addHz } from './events';
import { burst, flash, sfx, shake } from './fx';

interface KingKit { moves: [KingMove, KingMove]; ult: KingMove }

export const KING_KITS: Partial<Record<EnemyId, KingKit>> = {
  boss: { moves: ['slam', 'split'], ult: 'splash' },
  bossD: { moves: ['sandLine', 'burrow'], ult: 'quicksand' },
  bossC: { moves: ['boneFan', 'raise'], ult: 'crypt' },
  bossS: { moves: ['iceSpears', 'iceFloor'], ult: 'throne' },
  // Placeholder until ticket 29: shadow moves, and the ultimates of the Kings that escaped.
  umbra: { moves: ['boneFan', 'sandLine'], ult: 'splash' },
};

export const ULTS: KingMove[] = ['splash', 'quicksand', 'crypt', 'throne'];

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

function doMove(s: SimState, e: Enemy, k: KingMove, mul: number): void {
  const K = s.cfg.kings, R = s.rng.ai, P = s.P, kg = e.kg!;
  const tx = P.x, ty = P.y, a = atan2(ty - e.y, tx - e.x), D = e.dmg * mul, W = K.ultWarn;
  switch (k) {
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
  }
}

/** Second half of a two-part move (Royal Splash: the slime wave after the landing). */
function doNext(s: SimState, e: Enemy, k: KingMove): void {
  if (k === 'splash') {
    const c = s.cfg.kings.splash;
    addHz(s, { k: 'ring', x: e.x, y: e.y, r: c.r, du: c.dur, d: e.dmg * c.dmg, c: 3 });
    shake(s, 6);
  }
}

export function kingAI(s: SimState, e: Enemy, dt: number, tx: number, ty: number, damp: number): void {
  const K = s.cfg.kings, kg = e.kg!, R = s.rng.ai, kit = KING_KITS[e.type]!;
  if (kg.phase === 1 && e.hp < e.maxHp * K.phaseAt) {
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
    if (kg.next.t <= 0) { const k = kg.next.k; kg.next = null; doNext(s, e, k); }
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
  if ((kg.phase === 2 || s.overtime) && kg.ultCd <= 0) {
    kg.ultCd = K.ultCd * (s.overtime ? K.overtimeUltMul : 1);
    const u = e.type === 'umbra' ? umbraUlt(s) : { k: kit.ult, mul: 1 };
    flash(s, 0.2, '#ffffff');
    sfx(s, 'ult');
    doMove(s, e, u.k, u.mul);
  } else doMove(s, e, kit.moves[R.int(2)], 1);
}
