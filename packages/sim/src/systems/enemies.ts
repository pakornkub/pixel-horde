import { atan2, cos, hypot, sin } from '../core/fmath';
import type { Enemy, SimState } from '../types';
import { hurtP } from './combat';
import { dragonAI, rivalAI, addHz } from './events';
import { burst } from './fx';
import { kingAI } from './kings';
import { stepStatuses } from './combos';
import { edgePos } from './spawner';

function casterAI(s: SimState, e: Enemy, dt: number, tx: number, ty: number, damp: number): void {
  const R = s.rng.ai, C = s.cfg.caster;
  const dx = tx - e.x, dy = ty - e.y, l = hypot(dx, dy) || 1;
  let mx: number, my: number;
  if (l > C.far) { mx = dx / l; my = dy / l; } else if (l < C.near) { mx = -dx / l; my = -dy / l; } else { mx = (-dy / l) * C.strafe; my = (dx / l) * C.strafe; }
  const sp = e.frz > 0 ? 0 : e.spd * (e.slowT > 0 ? C.slow : 1);
  e.x += mx * sp * dt + e.kx * dt;
  e.y += my * sp * dt + e.ky * dt;
  e.kx *= damp; e.ky *= damp;
  e.cd = (e.cd == null ? R.range(C.firstMin, C.firstMax) : e.cd) - dt;
  if (e.cd <= 0 && l < C.fireRange && e.frz <= 0) {
    e.cd = R.range(C.cdMin, C.cdMax);
    const a = atan2(dy, dx);
    addHz(s, { k: 'proj', x: e.x, y: e.y, vx: cos(a) * C.projSpeed, vy: sin(a) * C.projSpeed, r: 3, d: e.dmg, life: C.projLife, c: 3 });
    burst(s, e.x, e.y, '#b03ad6', 4, 30, 0.3);
  }
}

function chargerAI(s: SimState, e: Enemy, dt: number, tx: number, ty: number, damp: number): void {
  const R = s.rng.ai, C = s.cfg.charger;
  const dx = tx - e.x, dy = ty - e.y, l = hypot(dx, dy) || 1;
  e.cd = e.cd == null ? R.range(C.firstMin, C.firstMax) : e.cd;
  if (e.cst === 'tele') {
    e.ct! -= dt;
    if (e.ct! <= 0) { e.cst = 'dash'; e.ct = C.dash; }
    return;
  }
  if (e.cst === 'dash') {
    e.ct! -= dt;
    e.dmgMul = C.dmgMul;
    e.x += cos(e.ca!) * C.speed * dt;
    e.y += sin(e.ca!) * C.speed * dt;
    burst(s, e.x, e.y, '#cdb57a', 1, 20, 0.3, 0.6);
    if (e.ct! <= 0) { e.cst = 'walk'; e.cd = R.range(C.cdMin, C.cdMax); e.dmgMul = 1; }
    return;
  }
  const sp = e.frz > 0 ? 0 : e.spd * (e.slowT > 0 ? C.slow : 1);
  e.x += (dx / l) * sp * dt + e.kx * dt;
  e.y += (dy / l) * sp * dt + e.ky * dt;
  e.kx *= damp; e.ky *= damp;
  e.cd -= dt;
  if (e.cd <= 0 && l < C.range && e.frz <= 0) {
    e.cst = 'tele';
    e.ct = C.warn;
    e.ca = atan2(dy, dx);
    addHz(s, { k: 'line', x: e.x, y: e.y, a: e.ca, r: C.range, te: C.warn, c: 0 });
  }
}

/**
 * Move every enemy toward its target, run special AIs, apply contact damage and recycle
 * enemies that fell far behind. `damp` is the per-tick knockback decay (0.02^dt).
 */
export function stepEnemies(s: SimState, dt: number, damp: number, live: boolean): void {
  const P = s.P, farDist = hypot(s.viewport.w, s.viewport.h) * s.cfg.spawn.despawn, slow = s.cfg.skills.frost.slow, contact = s.cfg.player.contact;
  for (const e of s.enemies) {
    if (e.dead) continue;
    const tx = P.x, ty = P.y;
    const dx = tx - e.x, dy = ty - e.y, l = hypot(dx, dy) || 1, lp = hypot(P.x - e.x, P.y - e.y);
    if (e.type === 'dragon') dragonAI(s, e, dt, tx, ty, damp);
    else if (e.type === 'rival') rivalAI(s, e, dt, tx, ty, damp);
    else if (e.type === 'caster') casterAI(s, e, dt, tx, ty, damp);
    else if (e.type === 'charger') chargerAI(s, e, dt, tx, ty, damp);
    else if (e.kg) kingAI(s, e, dt, tx, ty, damp);
    else {
      const a = atan2(dy, dx) + e.wob * (l > 40 ? 1 : 0.2);
      const sp = e.frz > 0 && !e.boss ? 0 : e.spd * (e.slowT > 0 ? slow : 1);
      e.x += cos(a) * sp * dt + e.kx * dt;
      e.y += sin(a) * sp * dt + e.ky * dt;
      e.kx *= damp; e.ky *= damp;
    }
    if (e.dead) continue;
    e.flash -= dt; e.slowT -= dt; e.frz -= dt; e.oc -= dt; e.ph += dt * 8;
    stepStatuses(e, dt);
    if (live && !P.down && !e.hide && lp < e.r + contact && P.inv <= 0) {
      hurtP(s, e.dmg * (e.dmgMul || 1));
      if (s.phase === 'over') return;
    }
    if (!e.boss && l > farDist) { const [x, y] = edgePos(s); e.x = x; e.y = y; }
  }
  s.enemies = s.enemies.filter((e) => !e.dead);
  if (s.boss && s.boss.dead) s.boss = null;
  if (s.dragonE && s.dragonE.dead) s.dragonE = null;
  if (s.rivalE && s.rivalE.dead) s.rivalE = null;
}
