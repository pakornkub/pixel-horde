import { atan2, cos, hypot, sin } from '../core/fmath';
import type { Enemy, SimState } from '../types';
import { hurtP } from './combat';
import { dragonAI, rivalAI, addHz } from './events';
import { burst } from './fx';
import { edgePos } from './spawner';

function casterAI(s: SimState, e: Enemy, dt: number, tx: number, ty: number, damp: number): void {
  const R = s.rng.ai;
  const dx = tx - e.x, dy = ty - e.y, l = hypot(dx, dy) || 1;
  let mx: number, my: number;
  if (l > 130) { mx = dx / l; my = dy / l; } else if (l < 90) { mx = -dx / l; my = -dy / l; } else { mx = (-dy / l) * 0.6; my = (dx / l) * 0.6; }
  const sp = e.frz > 0 ? 0 : e.spd * (e.slowT > 0 ? 0.5 : 1);
  e.x += mx * sp * dt + e.kx * dt;
  e.y += my * sp * dt + e.ky * dt;
  e.kx *= damp; e.ky *= damp;
  e.cd = (e.cd == null ? R.range(1, 2.5) : e.cd) - dt;
  if (e.cd <= 0 && l < 210 && e.frz <= 0) {
    e.cd = R.range(2.3, 3);
    const a = atan2(dy, dx);
    addHz(s, { k: 'proj', x: e.x, y: e.y, vx: cos(a) * 95, vy: sin(a) * 95, r: 3, d: e.dmg, life: 2.6, c: 3 });
    burst(s, e.x, e.y, '#b03ad6', 4, 30, 0.3);
  }
}

function chargerAI(s: SimState, e: Enemy, dt: number, tx: number, ty: number, damp: number): void {
  const R = s.rng.ai;
  const dx = tx - e.x, dy = ty - e.y, l = hypot(dx, dy) || 1;
  e.cd = e.cd == null ? R.range(1.5, 3) : e.cd;
  if (e.cst === 'tele') {
    e.ct! -= dt;
    if (e.ct! <= 0) { e.cst = 'dash'; e.ct = 0.5; }
    return;
  }
  if (e.cst === 'dash') {
    e.ct! -= dt;
    e.dmgMul = 1.5;
    e.x += cos(e.ca!) * 230 * dt;
    e.y += sin(e.ca!) * 230 * dt;
    burst(s, e.x, e.y, '#cdb57a', 1, 20, 0.3, 0.6);
    if (e.ct! <= 0) { e.cst = 'walk'; e.cd = R.range(2.5, 3.5); e.dmgMul = 1; }
    return;
  }
  const sp = e.frz > 0 ? 0 : e.spd * (e.slowT > 0 ? 0.5 : 1);
  e.x += (dx / l) * sp * dt + e.kx * dt;
  e.y += (dy / l) * sp * dt + e.ky * dt;
  e.kx *= damp; e.ky *= damp;
  e.cd -= dt;
  if (e.cd <= 0 && l < 150 && e.frz <= 0) {
    e.cst = 'tele';
    e.ct = 0.6;
    e.ca = atan2(dy, dx);
    addHz(s, { k: 'line', x: e.x, y: e.y, a: e.ca, r: 150, te: 0.6, c: 0 });
  }
}

/**
 * Move every enemy toward its target, run special AIs, apply contact damage and recycle
 * enemies that fell far behind. `damp` is the per-tick knockback decay (0.02^dt).
 */
export function stepEnemies(s: SimState, dt: number, damp: number, live: boolean): void {
  const P = s.P, farDist = hypot(s.viewport.w, s.viewport.h) * 0.95;
  for (const e of s.enemies) {
    if (e.dead) continue;
    const tx = P.x, ty = P.y;
    const dx = tx - e.x, dy = ty - e.y, l = hypot(dx, dy) || 1, lp = hypot(P.x - e.x, P.y - e.y);
    if (e.type === 'dragon') dragonAI(s, e, dt, tx, ty, damp);
    else if (e.type === 'rival') rivalAI(s, e, dt, tx, ty, damp);
    else if (e.type === 'caster') casterAI(s, e, dt, tx, ty, damp);
    else if (e.type === 'charger') chargerAI(s, e, dt, tx, ty, damp);
    else {
      const a = atan2(dy, dx) + e.wob * (l > 40 ? 1 : 0.2);
      const sp = e.frz > 0 && !e.boss ? 0 : e.spd * (e.slowT > 0 ? 0.5 : 1);
      e.x += cos(a) * sp * dt + e.kx * dt;
      e.y += sin(a) * sp * dt + e.ky * dt;
      e.kx *= damp; e.ky *= damp;
    }
    if (e.dead) continue;
    e.flash -= dt; e.slowT -= dt; e.frz -= dt; e.oc -= dt; e.ph += dt * 8;
    if (live && !P.down && lp < e.r + 5 && P.inv <= 0) {
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
