import { TAU, clamp, cos, hypot, ipow, sin } from '../core/fmath';
import { ET, type EnemyId } from '../data/enemies';
import { THEMES, themeIndex } from '../data/themes';
import type { BannerKey, Enemy, SimState } from '../types';
import { banner } from './fx';
import { aliveTargets } from './query';

export const prog = (s: SimState): number => clamp(s.stageTime / s.stageDur, 0, 1);
export const theme = (s: SimState) => THEMES[themeIndex(s.stage)];

export function typePool(s: SimState): EnemyId[] {
  const p = theme(s).pool, st = s.stage, a: EnemyId[] = [p[0], p[0], p[1], p[1]];
  if (st >= 2) a.push(p[2], 'charger');
  if (st >= 3) a.push('caster');
  if (st >= 4) a.push('splitter');
  if (st >= 6) a.push('charger', 'caster');
  if (st >= 3) a.push(p[1]);
  if (st >= 5) a.push(p[2], p[1]);
  return a;
}

/** Flat damage reduction of armored enemies. */
export const armorVal = (s: SimState): number => Math.round(10 * ipow(1.4, s.stage - 1) * (1 + 0.05 * (s.P.lv - 1)));

const INTRO_TYPES = new Set(['caster', 'charger', 'splitter', 'armor']);

function introType(s: SimState, type: EnemyId, armored: boolean): void {
  const k = armored ? 'armor' : type;
  if (!INTRO_TYPES.has(k) || s.seen.has(k)) return;
  s.seen.add(k);
  banner(s, ('intro.' + k) as BannerKey, 2.6);
}

export function spawnEnemy(s: SimState, type: EnemyId, x: number, y: number, elite: boolean): Enemy {
  const t = ET[type], P = s.P, R = s.rng.spawn;
  const lvS = 1 + 0.08 * (P.lv - 1);
  const hm = ipow(1.5, s.stage - 1) * (1 + 0.7 * prog(s)) * lvS * (0.85 + 0.15 * s.dir.v);
  const dm = ipow(1.18, s.stage - 1) * (1 + 0.5 * prog(s)) * (1 + 0.015 * (P.lv - 1));
  const e: Enemy = {
    id: s.eid++ & 262143, type, x, y,
    hp: t.hp * hm * (elite ? 7 : 1), maxHp: 0,
    spd: t.spd * (1 + 0.04 * (s.stage - 1)) * (elite ? 0.85 : 1) * R.range(0.9, 1.1),
    dmg: t.dmg * dm * (elite ? 1.6 : 1),
    xp: t.xp * (elite ? 6 : 1), r: t.r * (elite ? 2 : 1), sc: t.sc || (t.boss ? 3 : elite ? 2 : 1),
    elite, boss: !!t.boss, dmgMul: 1,
    kx: 0, ky: 0, flash: 0, slowT: 0, frz: 0, oc: 0, wob: R.range(-0.5, 0.5), ph: R.next() * TAU, dead: false, armor: 0, born: s.clock,
  };
  if (s.stage >= 3 && !t.boss && type !== 'mini' && R.next() < (0.03 + 0.015 * s.stage) * s.dir.v) e.armor = armorVal(s);
  e.maxHp = e.hp;
  s.enemies.push(e);
  introType(s, type, e.armor > 0);
  return e;
}

/** A point just outside the view around a random living player. */
export function edgePos(s: SimState): [number, number] {
  const R = s.rng.spawn;
  let cx = s.P.x, cy = s.P.y;
  const al = aliveTargets(s);
  if (al.length) { const t = al[R.int(al.length)]; cx = t.x; cy = t.y; }
  const a = R.next() * TAU, d = hypot(s.viewport.w, s.viewport.h) / 2 + 14;
  return [cx + cos(a) * d, cy + sin(a) * d];
}

/** Director: watches how easily the player is winning and pushes back (0.7–2.4). */
export function directorStep(s: SimState, dt: number): void {
  const P = s.P, hpf = P.hp / P.maxHp, calm = s.clock - s.dir.lastHurt;
  if (hpf > 0.75 && calm > 6) s.dir.v += dt * 0.06;
  else if (hpf < 0.4) s.dir.v -= dt * 0.2;
  else if (calm < 2) s.dir.v -= dt * 0.03;
  s.dir.v = clamp(s.dir.v, 0.7, 2.4);
}

export function spawnStep(s: SimState, dt: number): void {
  const R = s.rng.spawn, mates = 0;
  directorStep(s, dt);
  const rate = (1.4 + 3.4 * prog(s)) * (1 + 0.35 * (s.stage - 1)) * (1 + 0.6 * mates) * (s.specialStage ? 2.3 : 1) * s.dir.v;
  s.spawnAcc += rate * dt;
  const pool = typePool(s);
  while (s.spawnAcc >= 1) {
    s.spawnAcc--;
    if (s.enemies.length < 320) {
      const [x, y] = edgePos(s);
      spawnEnemy(s, pool[R.int(pool.length)], x, y, R.next() < 0.012 * s.stage * s.dir.v);
    }
  }
  s.waveT -= dt;
  if (s.waveT <= 0) {
    s.waveT = s.specialStage ? 10 : 18;
    const n = 16 + s.stage * 6, type = pool[R.int(pool.length)], d = hypot(s.viewport.w, s.viewport.h) / 2 + 10;
    const al = aliveTargets(s), c = al.length ? al[R.int(al.length)] : s.P;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      if (s.enemies.length < 340) spawnEnemy(s, type, c.x + cos(a) * d, c.y + sin(a) * d, false);
    }
    banner(s, 'swarm', 1.4);
  }
}
