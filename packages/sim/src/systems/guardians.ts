// Guardians and Companions (ticket 28). Three Guardian dragons appear in Blood Moons (favoured
// by the Realm's element); a defeated Guardian becomes a Companion that levels 1–5, unlocks a
// second move at level 3 and grows at level 5. All three in one Run can fuse into the
// Three-headed Dragon. Companion hits count as the owner's Skills (Statuses and Combos).
import { TAU, atan2, cos, hypot, ipow, sin } from '../core/fmath';
import type { EnemyId } from '../data/enemies';
import { PET_DIVE, PET_FIRE, type HitTag } from '../data/skills';
import type { CompanionKind, Enemy, GuardianKind, Pet, SimState } from '../types';
import { hit } from './combat';
import { chillTick } from './combos';
import { addHz, tagSince } from './events';
import { banner, burst, flash, sfx, shake } from './fx';
import { nearest, visibleEnemies } from './query';
import { edgePos, spawnEnemy } from './spawner';

export const GUARDIANS: GuardianKind[] = ['inferno', 'frost', 'storm'];
export const GUARDIAN_TYPE: Record<GuardianKind, EnemyId> = { inferno: 'dragon', frost: 'frostDragon', storm: 'stormDragon' };
const ELEMENT_GUARDIAN: Record<string, GuardianKind> = { fire: 'inferno', ice: 'frost', lightning: 'storm' };

const FROST_BREATH: HitTag = { el: 'ice' };
const STORM_HIT: HitTag = { el: 'lightning', applies: 'shocked' };

const owned = (s: SimState): Pet[] => [s.P.pet, ...s.P.petStore].filter((p): p is Pet => !!p);
const missing = (s: SimState): GuardianKind[] => GUARDIANS.filter((g) => !s.P.guardiansBeaten.includes(g));

/** True when the Realm's element matches a Guardian still missing after the first one. */
export function guardianPity(s: SimState): boolean {
  const el = s.realm && realmElement(s);
  const g = el ? ELEMENT_GUARDIAN[el] : undefined;
  return s.P.guardiansBeaten.length > 0 && !!g && missing(s).includes(g);
}
function realmElement(s: SimState): string | null {
  // imported lazily to keep this module free of Realm data cycles
  return REALM_ELEMENT[s.realm] ?? null;
}
const REALM_ELEMENT: Record<string, string | null> = {
  greenvale: null, sunscar: null, deepdark: 'dark', frostpeak: 'ice', emberforge: 'fire', mirefen: 'poison',
  skyreach: 'lightning', tidehollow: 'ice', gearspire: 'lightning', duskhold: 'dark', crater: null,
};

/** The Guardian a Blood Moon here would bring: the Realm's element first, else a random (missing first) one. */
export function pickGuardian(s: SimState): GuardianKind {
  const el = realmElement(s), g = el ? ELEMENT_GUARDIAN[el] : undefined;
  if (g) return g;
  const pool = missing(s).length && s.P.guardiansBeaten.length ? missing(s) : GUARDIANS;
  return pool[s.rng.events.int(pool.length)];
}

export function spawnGuardian(s: SimState): void {
  const [x, y] = edgePos(s), k = s.dragonKind;
  const e = spawnEnemy(s, GUARDIAN_TYPE[k], x, y, false);
  const C = k === 'inferno' ? s.cfg.dragon : s.cfg.guardians[k];
  e.hp = e.maxHp = C.hp * ipow(C.hpGrowth, s.stage - 1);
  e.cd = C.firstCd; e.lock = 0; e.dashT = 0;
  s.dragonE = e;
  banner(s, 'dragonAppears', 2.4, true, { kind: k });
  shake(s, 8); flash(s, 0.3, k === 'frost' ? '#9fd8ff' : k === 'storm' ? '#fff35c' : '#ff4b3a'); sfx(s, 'ult');
}

function approach(e: Enemy, dt: number, tx: number, ty: number, damp: number, slow: boolean): void {
  const dx = tx - e.x, dy = ty - e.y, l = hypot(dx, dy) || 1, sp = e.spd * (slow ? 0.6 : 1);
  e.x += (dx / l) * sp * dt + e.kx * dt;
  e.y += (dy / l) * sp * dt + e.ky * dt;
  e.kx *= damp; e.ky *= damp;
}

/** Frost Dragon: ice breath (chills), ice pillar ring, blizzard (standing still freezes you). */
export function frostDragonAI(s: SimState, e: Enemy, dt: number, tx: number, ty: number, damp: number): void {
  const R = s.rng.ai, F = s.cfg.guardians.frost;
  if (e.lock! > 0) { e.lock! -= dt; return; }
  approach(e, dt, tx, ty, damp, e.slowT > 0);
  e.cd! -= dt;
  if (e.cd! > 0) return;
  e.cd = R.range(F.cdMin, F.cdMax);
  const pick = R.int(3), a = atan2(ty - e.y, tx - e.x), n0 = s.hz.length;
  if (pick === 0) {
    addHz(s, { k: 'cone', x: e.x, y: e.y, a, r: F.breathR, sp: F.breathArc, te: F.breathWarn, du: F.breathDur, d: e.dmg * F.breathDmg, chill: F.chill });
    e.lock = F.breathWarn + F.breathDur;
  } else if (pick === 1) {
    addHz(s, { k: 'ring', x: e.x, y: e.y, r: F.ringR, du: F.ringDur, d: e.dmg * F.ringDmg, c: 5 });
    e.lock = 0.4;
  } else if (!s.hz.some((h) => h.k === 'bliz')) {
    addHz(s, { k: 'bliz', x: tx, y: ty, te: F.blizWarn, du: F.blizDur, sp: F.blizFreeze, d: e.dmg * F.blizDmg });
    banner(s, 'blizzard', 1.6);
  }
  tagSince(s, n0, pick === 0 ? 'fBreath' : pick === 1 ? 'fRing' : 'fBliz');
}

/** Storm Dragon: lightning rows, bouncing orbs, dash across the screen. */
export function stormDragonAI(s: SimState, e: Enemy, dt: number, tx: number, ty: number, damp: number): void {
  const R = s.rng.ai, S = s.cfg.guardians.storm;
  if (e.dashT! > 0) {
    e.dashT! -= dt;
    e.x += cos(e.dashA!) * S.dashSpeed * dt;
    e.y += sin(e.dashA!) * S.dashSpeed * dt;
    e.dmgMul = S.dashDmg;
    burst(s, e.x, e.y, '#fff35c', 2, 40, 0.3, 0.8);
    return;
  }
  e.dmgMul = 1;
  if (e.lock! > 0) {
    e.lock! -= dt;
    if (e.lock! <= 0 && e.pend === 'dash') { e.dashT = S.dashTime; e.pend = null; }
    return;
  }
  approach(e, dt, tx, ty, damp, e.slowT > 0);
  e.cd! -= dt;
  if (e.cd! > 0) return;
  e.cd = R.range(S.cdMin, S.cdMax);
  const pick = R.int(3), a = atan2(ty - e.y, tx - e.x), n0 = s.hz.length;
  if (pick === 0) {
    // parallel rows of lightning across the player's area
    const horiz = R.next() < 0.5, w = s.viewport.w, h = s.viewport.h;
    for (let i = 0; i < S.rows; i++) {
      const off = (i - (S.rows - 1) / 2) * S.rowGap + R.range(-6, 6);
      if (horiz) addHz(s, { k: 'beam', x: tx - w, y: ty + off, a: 0, r: w * 2, w: 6, te: S.rowWarn, d: e.dmg * S.rowDmg, c: 2 });
      else addHz(s, { k: 'beam', x: tx + off, y: ty - h, a: TAU / 4, r: h * 2, w: 6, te: S.rowWarn, d: e.dmg * S.rowDmg, c: 2 });
    }
    e.lock = S.rowWarn;
  } else if (pick === 1) {
    for (let i = 0; i < S.balls; i++) {
      const aa = a + (i - (S.balls - 1) / 2) * 0.6;
      addHz(s, { k: 'proj', x: e.x, y: e.y, vx: cos(aa) * S.ballSpeed, vy: sin(aa) * S.ballSpeed, r: 5, d: e.dmg * S.ballDmg, life: S.ballLife, c: 2, bounce: true });
    }
    e.lock = 0.3;
  } else {
    addHz(s, { k: 'line', x: e.x, y: e.y, a, r: S.dashLen, te: S.dashWarn, c: 2 });
    e.lock = S.dashWarn; e.pend = 'dash'; e.dashA = a;
  }
  tagSince(s, n0, pick === 0 ? 'sRows' : pick === 1 ? 'sBalls' : 'sDash');
}

/* ---------- rewards: a defeated Guardian becomes (or strengthens) a Companion ---------- */
export function grantGuardian(s: SimState, kind: GuardianKind): void {
  const P = s.P, C = s.cfg.companion;
  if (!P.guardiansBeaten.includes(kind)) P.guardiansBeaten.push(kind);
  const mine = owned(s).find((p) => p.kind === kind);
  if (mine) {
    mine.lv = Math.min(C.maxLv, mine.lv + C.again);
    banner(s, 'dragonPowerUp', 2, false, { lv: mine.lv, kind });
  } else {
    const pet: Pet = { kind, lv: 1, cd: 0.5, dive: 3, x: P.x, y: P.y };
    if (!P.pet) P.pet = pet;
    else if (P.petStore.length < C.stored) P.petStore.push(pet);
    banner(s, 'dragonTamed', 2.6, true, { kind });
  }
  flash(s, 0.35, '#ffd23f');
  sfx(s, 'clear');
}

/** +1 level to the active Companion (level-up card or Skill Points). */
export function levelCompanion(s: SimState): boolean {
  const pt = s.P.pet;
  if (!pt || pt.lv >= s.cfg.companion.maxLv) return false;
  pt.lv++;
  return true;
}

/** Clear screen: a stored Companion becomes the active one. */
export function swapCompanion(s: SimState, index: number): void {
  const P = s.P, o = P.petStore[index];
  if (s.phase !== 'clear' || !o) return;
  if (P.pet) P.petStore[index] = P.pet; else P.petStore.splice(index, 1);
  P.pet = o;
  o.x = P.x; o.y = P.y;
}

export const canFuse = (s: SimState): boolean =>
  GUARDIANS.every((g) => s.P.guardiansBeaten.includes(g) && owned(s).some((p) => p.kind === g)) && !owned(s).some((p) => p.kind === 'tri');

/** Fuse the three Guardians: level = average rounded up, at least 3; Tri-Breath included. */
export function answerFuse(s: SimState, accept: boolean): void {
  const P = s.P;
  if (s.phase !== 'clear' || !s.fuseOffer) return;
  s.fuseOffer = false;
  if (!accept || !canFuse(s)) return;
  const three = owned(s).filter((p) => p.kind !== 'tri');
  const lv = Math.max(3, Math.ceil(three.reduce((a, p) => a + p.lv, 0) / three.length));
  P.petStore = owned(s).filter((p) => !GUARDIANS.includes(p.kind as GuardianKind));
  P.pet = { kind: 'tri', lv: Math.min(s.cfg.companion.maxLv, lv), cd: 0.5, dive: 2, x: P.x, y: P.y };
  banner(s, 'fused', 2.8, true);
  flash(s, 0.5, '#ffd23f');
  shake(s, 6);
  sfx(s, 'ult');
}

/* ---------- Companion moves ---------- */
const grown = (s: SimState, pt: Pet): number => (pt.lv >= s.cfg.companion.growAt ? s.cfg.companion.growMul : 1);
const second = (s: SimState, pt: Pet): boolean => pt.kind === 'tri' || pt.lv >= s.cfg.companion.secondAt;
const lvMul = (s: SimState, pt: Pet): number => 1 + s.cfg.pet.perPetLv * (pt.lv - 1);

function breath(s: SimState, pt: Pet, range: number, r: number, dmg: number, tag: HitTag, chill?: number): boolean {
  const t = nearest(s, pt.x, pt.y, range);
  if (!t) return false;
  const a = atan2(t.y - pt.y, t.x - pt.x);
  s.effects.push({ type: 'pbreath', x: pt.x, y: pt.y, a, r, sp: 0.45, t: 0, dur: 0.4, hit: new Set(), dmg, tag, n: chill, el: tag.el === 'ice' ? 'ice' : tag.el === 'fire' ? 'fire' : undefined });
  return true;
}

function strike(s: SimState, pt: Pet, dmg: number, r: number): boolean {
  const vis = visibleEnemies(s);
  const t = vis.length ? vis.reduce((b, e) => (hypot(e.x - pt.x, e.y - pt.y) < hypot(b.x - pt.x, b.y - pt.y) ? e : b)) : null;
  if (!t) return false;
  for (const e of s.enemies) if (!e.dead && hypot(e.x - t.x, e.y - t.y) < r + e.r) hit(s, e, dmg, '#fff35c', 10, STORM_HIT);
  s.effects.push({ type: 'chain', pts: [[t.x + 6, t.y - 70], [t.x, t.y]], t: 0, dur: 0.2, x: t.x, y: t.y, dmg: 0 });
  return true;
}

function chainFrom(s: SimState, pt: Pet, dmg: number, jumps: number): void {
  const first = nearest(s, pt.x, pt.y, 150);
  if (!first) return;
  const set = new Set<Enemy>([first]), pts: [number, number][] = [[pt.x, pt.y], [first.x, first.y]];
  let cur = first;
  for (let j = 0; j < jumps; j++) {
    const n = nearest(s, cur.x, cur.y, 80, set);
    if (!n) break;
    set.add(n); pts.push([n.x, n.y]); cur = n;
  }
  for (const e of set) hit(s, e, dmg, '#fff35c', 15, STORM_HIT);
  s.effects.push({ type: 'chain', pts, t: 0, dur: 0.2, x: pt.x, y: pt.y, dmg: 0 });
}

function iceWall(s: SimState, dmg: number): void {
  const P = s.P, W = s.cfg.companion.frost, a = atan2(P.dy, P.dx);
  const cx = P.x + cos(a) * 26, cy = P.y + sin(a) * 26;
  s.effects.push({ type: 'icewall', x: cx, y: cy, a: a + TAU / 4, len: W.wallLen, t: 0, dur: W.wallDur, dmg, hit: new Set(), tick: 0 });
}

function dive(s: SimState, dmg: number, r: number): void {
  const vis = visibleEnemies(s);
  if (!vis.length) return;
  const e = vis[s.rng.skills.int(vis.length)];
  s.effects.push({ type: 'meteor', tag: PET_DIVE, x: e.x, y: e.y, t: 0, dur: 0, delay: 0.45, r, dmg, boomed: false, bt: 0 });
}

export function petStep(s: SimState, dt: number): void {
  const P = s.P, pt = P.pet, Q = s.cfg.pet, C = s.cfg.companion;
  if (!pt || P.down) return;
  const tx = P.x + cos(s.clock * 1.3) * 22, ty = P.y - 14 + sin(s.clock * 2.6) * 4;
  pt.x += (tx - pt.x) * Math.min(1, dt * 6);
  pt.y += (ty - pt.y) * Math.min(1, dt * 6);
  pt.cd -= dt;
  pt.dive -= dt;
  const g = grown(s, pt), m = lvMul(s, pt);
  if (pt.cd <= 0) {
    let ok: boolean;
    if (pt.kind === 'inferno') {
      ok = breath(s, pt, Q.breathRange, (Q.breathR + Q.breathRPerLv * pt.lv) * g, (Q.breathDmg + Q.breathDmgPerLv * P.lv) * m, PET_FIRE);
      if (ok) pt.cd = Math.max(Q.breathCdMin, Q.breathCd - Q.breathCdPerLv * pt.lv);
    } else if (pt.kind === 'frost') {
      const F = C.frost;
      ok = breath(s, pt, Q.breathRange, F.breathR * g, (F.breathDmg + F.breathDmgPerLv * P.lv) * m, FROST_BREATH, F.chill);
      if (ok) pt.cd = F.breathCd;
    } else if (pt.kind === 'storm') {
      const S = C.storm;
      ok = strike(s, pt, (S.strikeDmg + S.strikeDmgPerLv * P.lv) * m, S.strikeR * g);
      if (ok) pt.cd = S.strikeCd;
    } else {
      // Tri-Breath: lightning, then fire (Overload in itself), then ice
      const T = C.tri, d = (T.breathDmg + T.breathDmgPerLv * P.lv) * m, r = T.breathR * g;
      ok = breath(s, pt, Q.breathRange, r, d, STORM_HIT) && breath(s, pt, Q.breathRange, r, d, PET_FIRE) && breath(s, pt, Q.breathRange, r, d, FROST_BREATH, 1);
      if (ok) pt.cd = T.breathCd;
    }
    if (!ok) pt.cd = 0.2;
  }
  if (pt.dive <= 0 && second(s, pt)) {
    const diveDmg = (Q.diveDmg + Q.diveDmgPerLv * P.lv) * m;
    if (pt.kind === 'inferno') { dive(s, diveDmg, Q.diveR * g); pt.dive = Math.max(Q.diveMin, Q.dive - Q.divePerLv * pt.lv); }
    else if (pt.kind === 'frost') { iceWall(s, C.frost.wallDmg * m); pt.dive = C.frost.wallCd; }
    else if (pt.kind === 'storm') { chainFrom(s, pt, C.storm.chainDmg * m, C.storm.jumps); pt.dive = C.storm.chainCd; }
    else {
      dive(s, diveDmg, Q.diveR * g);
      iceWall(s, C.frost.wallDmg * m);
      chainFrom(s, pt, C.storm.chainDmg * m, C.storm.jumps);
      pt.dive = Math.max(Q.diveMin, C.storm.chainCd);
    }
  }
}

/** Ice wall effect: monsters touching it are hit and chilled (once each per wall). */
export function stepIceWall(s: SimState, f: import('../types').Effect): void {
  const half = f.len! / 2, ux = cos(f.a!), uy = sin(f.a!);
  for (const e of s.enemies) {
    if (e.dead || f.hit!.has(e)) continue;
    const px = e.x - f.x, py = e.y - f.y, along = px * ux + py * uy;
    if (Math.abs(along) > half) continue;
    const across = Math.abs(-px * uy + py * ux);
    if (across < e.r + 4) {
      f.hit!.add(e);
      hit(s, e, f.dmg, '#9fd8ff', 60, FROST_BREATH);
      if (!e.dead) { chillTick(s, e); chillTick(s, e); }
    }
  }
}

export type { CompanionKind };
