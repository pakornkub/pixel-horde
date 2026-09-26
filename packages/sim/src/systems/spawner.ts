import { TAU, clamp, cos, hypot, ipow, sin } from '../core/fmath';
import { ET, RANGED, type EnemyId } from '../data/enemies';
import { REALMS } from '../content/lumora/realms';
import type { BannerKey, Enemy, SimState } from '../types';
import { banner } from './fx';
import { aliveTargets } from './query';
import { aliveMates, coopBossMul } from './coop';

export const prog = (s: SimState): number => clamp(s.stageTime / s.stageDur, 0, 1);
/** Player level as the monster formulas count it: capped at the on-curve level for this point of the Run
 *  (`scaling.lvCapBase/lvCapPerCh`), so EXP beyond the curve (Wisdom, Transmute) never makes monsters tougher. */
export const scaleLv = (s: SimState): number => {
  const c = s.cfg.scaling;
  if (!c.lvCapBase && !c.lvCapPerCh) return s.P.lv;
  return Math.min(s.P.lv, Math.max(1, c.lvCapBase + c.lvCapPerCh * (s.stage - 1 + prog(s))));
};
export const realm = (s: SimState) => REALMS[s.realm];

export function typePool(s: SimState): EnemyId[] {
  // Shooting / charging monsters only come when those skills are switched on (caster.on / charger.on);
  // a turret that cannot shoot is left out of its Realm's pool.
  const shoot = !!s.cfg.caster.on, charge = !!s.cfg.charger.on;
  const p = realm(s).pool.filter((m) => shoot || !RANGED[m]?.still), st = s.stage, a: EnemyId[] = [p[0], p[0], p[1], p[1]];
  const px = (i: number): EnemyId => p[Math.min(i, p.length - 1)];
  if (st >= 2) { a.push(px(2)); if (charge) a.push('charger'); }
  if (st >= 3 && shoot) a.push('caster');
  if (st >= 4) a.push('splitter');
  if (st >= 6) { if (charge) a.push('charger'); if (shoot) a.push('caster'); }
  if (st >= 3) a.push(p[1]);
  if (st >= 5) a.push(px(2), p[1]);
  // Realm traits bring more of the matching monsters
  const tr = realm(s).traits;
  if (tr.includes('fast')) for (const m of p) if (ET[m].trait === 'fast') a.push(m);
  if (tr.includes('ranged') && st >= 2 && shoot) a.push('caster');
  if (tr.includes('split') && st >= 2) a.push('splitter');
  if (tr.includes('charge') && charge) a.push('charger');
  return a;
}

/** Flat damage reduction of armored enemies. */
export const armorVal = (s: SimState): number => { const c = s.cfg.scaling; return Math.round(c.armorBase * ipow(c.armorGrowth, s.stage - 1) * (1 + c.armorPerLv * (scaleLv(s) - 1))); };

const INTRO_TYPES = new Set(['caster', 'charger', 'splitter', 'armor']);

function introType(s: SimState, type: EnemyId, armored: boolean): void {
  const k = armored ? 'armor' : type;
  if (!INTRO_TYPES.has(k) || s.seen.has(k)) return;
  s.seen.add(k);
  banner(s, ('intro.' + k) as BannerKey, 2.6);
}

export function spawnEnemy(s: SimState, type: EnemyId, x: number, y: number, elite: boolean): Enemy {
  const t = ET[type], b = s.cfg.enemies[type], c = s.cfg.scaling, R = s.rng.spawn;
  const hm = hpScale(s);
  const dm = ipow(c.dmgGrowth, s.stage - 1) * (1 + c.dmgProg * prog(s)) * (1 + c.dmgPerLv * (scaleLv(s) - 1));
  const e: Enemy = {
    id: s.eid++ & 262143, type, x, y,
    hp: b.hp * hm * (elite ? c.eliteHp : 1) * (t.boss ? coopBossMul(s) : 1), maxHp: 0,
    spd: b.spd * (1 + c.spdPerStage * (s.stage - 1)) * (elite ? c.eliteSpd : 1) * R.range(1 - c.spdJitter, 1 + c.spdJitter),
    dmg: b.dmg * dm * (elite ? c.eliteDmg : 1) * extraDmg(s),
    xp: b.xp * (elite ? c.eliteXp : 1), r: b.r * (elite ? c.eliteR : 1), sc: t.sc || (t.boss ? 3 : elite ? 2 : 1),
    elite, boss: !!t.boss, dmgMul: 1,
    kx: 0, ky: 0, flash: 0, slowT: 0, frz: 0, oc: 0, wob: R.range(-c.wobble, c.wobble), ph: R.next() * TAU, dead: false, armor: 0, born: s.clock,
  };
  const armored = realm(s).traits.includes('armored'), RT = s.cfg.realms;
  if (s.stage >= (armored ? Math.min(c.armorFrom, RT.armorFrom) : c.armorFrom) && !t.boss && type !== 'mini'
    && R.next() < (c.armorChance + c.armorChancePerStage * s.stage) * s.dir.v * (armored ? RT.armorMul : 1)) e.armor = armorVal(s);
  if (t.trait === 'fast' && realm(s).traits.includes('fast')) e.spd *= RT.fastSpd;
  e.maxHp = e.hp;
  s.enemies.push(e);
  introType(s, type, e.armor > 0);
  return e;
}

/** Monster HP multiplier right now (Chapter, Stage progress, player level, Director). */
export function hpScale(s: SimState): number {
  const c = s.cfg.scaling;
  return ipow(c.hpGrowth, s.stage - 1) * (1 + c.hpProg * prog(s)) * (1 + c.hpPerLv * (scaleLv(s) - 1)) * (c.hpDirBase + c.hpDirK * s.dir.v) * extraHp(s);
}

/** Heart Crack tier and Endless depth on top of the Chapter formulas. */
const crackMul = (s: SimState, k: 'hp' | 'dmg' | 'spawn'): number => {
  const H = s.cfg.heartCrack;
  return s.crack === 1 ? H[`${k}1`] : s.crack === 2 ? H[`${k}2`] : s.crack === 3 ? H[`${k}3`] : 1;
};
const beyond = (s: SimState): number => Math.max(0, s.stage - s.cfg.stage.chapters);
export const extraHp = (s: SimState): number => crackMul(s, 'hp') * ipow(s.cfg.endless.hpGrowth, beyond(s));
export const extraDmg = (s: SimState): number => crackMul(s, 'dmg') * ipow(s.cfg.endless.dmgGrowth, beyond(s));

/** HP of this Chapter's normal monster (the Realm's first mob) right now. */
export const chapterMobHp = (s: SimState): number => s.cfg.enemies[realm(s).pool[0]].hp * hpScale(s);

/** A point just outside the view around a random living player. */
export function edgePos(s: SimState): [number, number] {
  const R = s.rng.spawn;
  let cx = s.P.x, cy = s.P.y;
  const al = aliveTargets(s);
  if (al.length) { const t = al[R.int(al.length)]; cx = t.x; cy = t.y; }
  const a = R.next() * TAU, d = hypot(s.viewport.w, s.viewport.h) / 2 + s.cfg.spawn.edge;
  return [cx + cos(a) * d, cy + sin(a) * d];
}

/** Director: watches how easily the player is winning and pushes back (0.7–2.4). */
export function directorStep(s: SimState, dt: number): void {
  const P = s.P, D = s.cfg.director, hpf = P.hp / P.maxHp, calm = s.clock - s.dir.lastHurt;
  if (hpf > D.riseHp && calm > D.riseCalm) s.dir.v += dt * D.rise;
  else if (hpf < D.dropHp) s.dir.v -= dt * D.drop;
  else if (calm < D.hurtWindow) s.dir.v -= dt * D.hurtDrop;
  s.dir.v = clamp(s.dir.v, D.min, D.max);
}

export function spawnStep(s: SimState, dt: number): void {
  const R = s.rng.spawn, C = s.cfg.spawn, mates = aliveMates(s);
  directorStep(s, dt);
  const rate = (C.base + C.prog * prog(s)) * (1 + C.stageGrowth * (s.stage - 1)) * (1 + C.perMate * mates) * (s.specialStage ? s.cfg.events.bloodMoonSpawn : 1) * (s.overtime ? s.cfg.stage.overtimeSpawn : 1) * crackMul(s, 'spawn') * s.dir.v * (s.firstRun && s.stage === 1 ? s.cfg.tutorial.spawn : 1);
  s.spawnAcc += rate * dt;
  const pool = typePool(s);
  while (s.spawnAcc >= 1) {
    s.spawnAcc--;
    if (s.enemies.length < (s.mobile ? C.capMobile : C.cap)) {
      const [x, y] = edgePos(s);
      spawnEnemy(s, pool[R.int(pool.length)], x, y, R.next() < C.eliteChance * s.stage * s.dir.v);
    }
  }
  s.waveT -= dt;
  if (s.waveT <= 0) {
    s.waveT = s.specialStage ? C.swarmEveryBloodMoon : C.swarmEvery;
    const n = C.swarmBase + s.stage * C.swarmPerStage, type = pool[R.int(pool.length)], d = hypot(s.viewport.w, s.viewport.h) / 2 + C.ringEdge;
    const al = aliveTargets(s), c = al.length ? al[R.int(al.length)] : s.P;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      if (s.enemies.length < (s.mobile ? C.swarmCapMobile : C.swarmCap)) spawnEnemy(s, type, c.x + cos(a) * d, c.y + sin(a) * d, false);
    }
    banner(s, 'swarm', 1.4);
  }
}
