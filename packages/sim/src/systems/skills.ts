import { PI, TAU, atan2, cos, hypot, sin } from '../core/fmath';
import { FLASK_TAGS, HOLE_BOOM, linAt, type HitTag, PET_FIRE, SKILL_TAGS as T, skillStats, type SkillId, type SkillStats } from '../data/skills';
import { chillTick } from './combos';
import { signatureOf } from '../data/heroes';
import { shieldPoints } from './shield';
import { stepIceWall } from './guardians';
import { WEAPONS } from '../data/weapons';
import { chapterMobHp } from './spawner';

const FLASKS = ['fire', 'ice', 'poison'] as const;
const FLASK_COL = { fire: '#ff8a3d', ice: '#9fd8ff', poison: '#b6f24a' } as const;
/** Smart Flask: fire where it combos (Gathered/Shocked/Poisoned), otherwise set one up. */
function smartElement(e: Enemy): 'fire' | 'ice' | 'poison' {
  if ((e.gath || 0) > 0 || (e.shock || 0) > 0 || (e.pois || 0) > 0) return 'fire';
  if ((e.burn || 0) > 0) return 'poison';
  return 'ice';
}
import type { Enemy, SimState } from '../types';
import { hit } from './combat';
import { cloneCast } from './events';
import { banner, burst, flash, sfx, shake } from './fx';
import { nearest, nearestN, visibleEnemies } from './query';

export function st(s: SimState, id: SkillId, lv: number): SkillStats {
  const t = skillStats(s.cfg, id, lv, !!s.P.evo[id]);
  if (s.P.awakened && id === signatureOf(s.P.ch)) t.dmg *= s.cfg.awaken.sigDmg; // awakened form
  return t;
}

/** The monster with the most others within r, from 8 random samples. */
function densest(vis: Enemy[], r: number, R: SimState['rng']['skills']): Enemy {
  let best = vis[0], bc = -1;
  for (let k = 0; k < 8; k++) {
    const c = vis[R.int(vis.length)];
    let n = 0;
    for (const e of vis) if ((e.x - c.x) * (e.x - c.x) + (e.y - c.y) * (e.y - c.y) < r * r) n++;
    if (n > bc) { bc = n; best = c; }
  }
  return best;
}

function wrapAngle(a: number): number {
  return atan2(sin(a), cos(a));
}

export function useUlt(s: SimState): void {
  const U = s.cfg.ult;
  if (s.phase !== 'play' || s.ult < U.max) return;
  s.ult = 0;
  const targets = visibleEnemies(s);
  const dmg = U.mobHp * chapterMobHp(s); // relative to this Chapter's monsters, never to player bonuses
  s.effects.push({ type: 'judge', col: WEAPONS[s.weapon].col, t: 0, dur: 1.0, x: s.P.x, y: s.P.y, fired: false, targets: targets.map((e) => ({ e, x: e.x, y: e.y })), dmg });
  s.slowT = U.slow;
  flash(s, 0.25, '#fff8c0', false, true);
  shake(s, 6);
  sfx(s, 'ult');
  banner(s, 'judgement', 1.1, true, { weapon: s.weapon });
}

/** One Ultimate strike in the form of the equipped Weapon. */
function ultStrike(s: SimState, e: Enemy, dmg: number, heal: { left: number }): void {
  const w = WEAPONS[s.weapon], W = s.cfg.weapons, S = s.cfg.status, P = s.P;
  if (w.form === 'reap' && !e.boss && e.hp < e.maxHp * W.execute) dmg = e.hp; // reaped outright
  const kb = s.cfg.ult.kb * (w.form === 'crash' ? W.crashKb : 1);
  hit(s, e, dmg, w.col, kb, w.form === 'burn' || w.form === 'crash' ? ULT_BURN : ULT_TAG);
  if (w.form === 'harvest' && heal.left > 0) { const h = Math.min(heal.left, P.maxHp * W.harvestHeal); heal.left -= h; P.hp = Math.min(P.maxHp, P.hp + h); }
  if (e.dead) return;
  const dx = e.x - P.x, dy = e.y - P.y, l = hypot(dx, dy) || 1;
  if (w.form === 'root') { if (e.boss) e.slowT = Math.max(e.slowT, W.root); else e.stun = W.root; }
  else if (w.form === 'freeze') { if (e.boss) e.slowT = Math.max(e.slowT, W.freeze); else e.frz = W.freeze; }
  else if (w.form === 'plague') { e.pois = S.poisoned * P.statusMul; e.poisDps = dmg * W.plagueDps; }
  else if (w.form === 'shock') e.shock = S.shocked * P.statusMul;
  else if (w.form === 'push' && !e.boss) { e.kx += (dx / l) * W.push; e.ky += (dy / l) * W.push; }
  else if (w.form === 'harvest' && !e.boss) { e.kx -= (dx / l) * W.harvestPull; e.ky -= (dy / l) * W.harvestPull; }
}
const ULT_TAG: HitTag = { raw: true };
const ULT_BURN: HitTag = { raw: true, applies: 'burning' };

/** Skills whose cooldown ran out this tick (a cast event is emitted when they actually fired). */
const castSeen: SkillId[] = [];

export function updSkills(s: SimState, dt: number): void {
  const P = s.P, sk = P.skills, R = s.rng.skills, K = s.cfg.skills;
  castSeen.length = 0;
  for (const id of Object.keys(sk) as SkillId[]) {
    const lv = sk[id]!, t = st(s, id, lv);
    if (id === 'orbit' || id === 'frost' || id === 'shield' || id === 'timeWarp' || id === 'galeStep' || id === 'transmute') continue;
    P.cds[id] = (P.cds[id] || 0) - dt;
    if (P.cds[id]! > 0) continue;
    castSeen.push(id);
    if (id === 'bolt') {
      const c = K.bolt, list = nearestN(s, t.n, c.range);
      if (!list.length) { P.cds[id] = 0.1; continue; }
      for (let i = 0; i < t.n; i++) {
        const e = list[i % list.length];
        const a = atan2(e.y - P.y, e.x - P.x) + (i >= list.length ? R.range(-0.3, 0.3) : 0);
        s.bolts.push({ kind: 'bolt', x: P.x, y: P.y - 3, vx: cos(a) * c.speed, vy: sin(a) * c.speed, life: c.life, dmg: t.dmg, pierce: t.pierce, hit: new Set(), col: '#ff5cf4', rad: 3, kb: c.kb, tag: T.bolt });
      }
      cloneCast(s, id, t);
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'chain') {
      const c = K.chain, first = nearest(s, P.x, P.y, c.range);
      if (!first) { P.cds[id] = 0.15; continue; }
      const set = new Set<Enemy>([first]), pts: [number, number][] = [[P.x, P.y - 4], [first.x, first.y]];
      let cur = first;
      for (let j = 0; j < t.jumps; j++) {
        const n = nearest(s, cur.x, cur.y, c.jumpRange, set);
        if (!n) break;
        set.add(n); pts.push([n.x, n.y]); cur = n;
      }
      for (const e of set) hit(s, e, t.dmg, '#fff35c', c.kb, T.chain);
      s.effects.push({ type: 'chain', pts, t: 0, dur: 0.2, x: P.x, y: P.y, dmg: 0 });
      flash(s, 0.05, '#fff9c4', true);
      sfx(s, 'zap');
      cloneCast(s, id, t);
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'nova') {
      if (!nearest(s, P.x, P.y, t.r + 10)) { P.cds[id] = 0.2; continue; }
      s.effects.push({ type: 'nova', x: P.x, y: P.y, R: t.r, t: 0, dur: K.nova.dur, hit: new Set(), dmg: t.dmg });
      shake(s, 2.5);
      sfx(s, 'nova');
      cloneCast(s, id, t);
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'meteor') {
      const vis = visibleEnemies(s);
      if (!vis.length) { P.cds[id] = 0.2; continue; }
      for (let i = 0; i < t.n; i++) {
        const e = vis[R.int(vis.length)];
        s.effects.push({ type: 'meteor', x: e.x + R.range(-6, 6), y: e.y + R.range(-6, 6), t: 0, dur: 0, delay: K.meteor.delay + i * K.meteor.stagger, r: t.r, dmg: t.dmg, boomed: false, bt: 0 });
      }
      cloneCast(s, id, t);
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'lance') {
      const c = K.lance;
      if (!nearest(s, P.x, P.y, c.range)) { P.cds[id] = 0.1; continue; }
      const a0 = atan2(P.dy, P.dx);
      for (let i = 0; i < t.n; i++) {
        const a = a0 + (i - (t.n - 1) / 2) * c.spread;
        s.bolts.push({ kind: 'lance', x: P.x, y: P.y - 3, vx: cos(a) * c.speed, vy: sin(a) * c.speed, a, life: c.life, dmg: t.dmg, pierce: Infinity, hit: new Set(), col: '#ffe9a8', rad: 4, kb: c.kb, tag: T.lance });
      }
      sfx(s, 'lance');
      cloneCast(s, id, t);
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'boomer') {
      const c = K.boomer, list = nearestN(s, t.n, c.target);
      if (!list.length) { P.cds[id] = 0.15; continue; }
      for (let i = 0; i < t.n; i++) {
        const e = list[i % list.length];
        const a = atan2(e.y - P.y, e.x - P.x) + (i >= list.length ? R.range(-0.5, 0.5) : 0);
        s.bolts.push({ kind: 'boom', x: P.x, y: P.y - 3, vx: cos(a) * c.speed, vy: sin(a) * c.speed, spd: c.speed, d: 0, range: t.range, ret: false, life: 3, dmg: t.dmg, pierce: Infinity, hit: new Set(), col: '#7dffb0', rad: 5, kb: c.kb, spin: 0, tag: T.boomer });
      }
      cloneCast(s, id, t);
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'cyclone') {
      if (!nearest(s, P.x, P.y, 200)) { P.cds[id] = 0.2; continue; }
      for (let i = 0; i < t.n; i++) {
        const a = R.next() * TAU;
        s.effects.push({ type: 'cyclone', x: P.x, y: P.y, vx: cos(a) * K.cyclone.speed, vy: sin(a) * K.cyclone.speed, t: 0, dur: t.dur, r: t.r, dmg: t.dmg, tick: 0 });
      }
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'toxic') {
      const vis = visibleEnemies(s);
      if (!vis.length) { P.cds[id] = 0.2; continue; }
      for (let i = 0; i < t.n; i++) {
        const e = vis[R.int(vis.length)];
        s.effects.push({ type: 'toxic', x: e.x, y: e.y, t: 0, dur: t.dur, r: t.r, dmg: t.dmg, tick: 0 });
      }
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'laser') {
      if (!nearest(s, P.x, P.y, t.len)) { P.cds[id] = 0.2; continue; }
      s.effects.push({ type: 'laser', t: 0, dur: t.dur, x: P.x, y: P.y, a0: R.next() * TAU, a: 0, len: t.len, dmg: t.dmg, hit: new Set(), hit2: new Set(), twin: t.twin });
      sfx(s, 'laser');
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'sigil') {
      if (!nearest(s, P.x, P.y, t.r + 40)) { P.cds[id] = 0.2; continue; }
      for (let i = 0; i < t.n; i++) {
        const a = R.next() * TAU, d = i ? t.r * 1.3 : 0;
        s.effects.push({ type: 'sigil', x: P.x + cos(a) * d, y: P.y + sin(a) * d, r: t.r, t: 0, dur: t.dur, dmg: t.dmg, tick: 0 });
      }
      sfx(s, 'nova');
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'hawk') {
      // hunts the biggest monsters in range; defends Kit (nearest first) once enough monsters close in
      let prey = s.enemies.filter((e) => !e.dead && !e.hide && hypot(e.x - P.x, e.y - P.y) < t.range).sort((a, b) => b.hp - a.hp || a.id - b.id);
      if (K.hawk.guardN) {
        const close = prey.filter((e) => hypot(e.x - P.x, e.y - P.y) < K.hawk.guardR);
        if (close.length >= K.hawk.guardN) prey = close.sort((a, b) => hypot(a.x - P.x, a.y - P.y) - hypot(b.x - P.x, b.y - P.y) || a.id - b.id);
      }
      if (!prey.length) { P.cds[id] = 0.2; continue; }
      for (let i = 0; i < t.n; i++) {
        const e = prey[i % prey.length];
        s.effects.push({ type: 'hawk', x: P.x, y: P.y - 10, t: 0, dur: K.hawk.flight, dmg: t.dmg, r: t.r, targets: [{ e, x: e.x, y: e.y }], fired: false, stun: t.stun });
      }
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'flask') {
      const vis = visibleEnemies(s).filter((e) => hypot(e.x - P.x, e.y - P.y) < t.range);
      if (!vis.length) { P.cds[id] = 0.2; continue; }
      // bosses first, then the thickest crowd (not a random monster); the flask follows its target in flight
      const bosses = vis.filter((e) => e.boss);
      for (let i = 0; i < t.n; i++) {
        const e = i < bosses.length ? bosses[i] : densest(vis, t.r, R);
        const el = t.smart ? smartElement(e) : FLASKS[R.int(3)];
        s.effects.push({ type: 'flask', x: e.x, y: e.y, pts: [[P.x, P.y - 6]], t: 0, dur: K.flask.flight, r: t.r, dmg: t.dmg, el, fired: false, targets: [{ e, x: e.x, y: e.y }] });
      }
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'manaNova') {
      if (!nearest(s, P.x, P.y, t.r + 10)) { P.cds[id] = 0.2; continue; }
      s.effects.push({ type: 'nova', x: P.x, y: P.y, R: t.r, t: 0, dur: t.dur, hit: new Set(), dmg: t.dmg, tag: T.manaNova, col: '#e08cff' });
      sfx(s, 'nova');
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'starfall') {
      const vis = visibleEnemies(s);
      if (!vis.length) { P.cds[id] = 0.2; continue; }
      for (let i = 0; i < t.n; i++) {
        const e = vis[R.int(vis.length)];
        s.effects.push({ type: 'meteor', x: e.x, y: e.y, t: 0, dur: 0, delay: K.starfall.delay + i * K.starfall.stagger, r: t.r, dmg: t.dmg, boomed: false, bt: 0, tag: T.starfall, col: '#e08cff' });
      }
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'sacredBlades') {
      if (!nearest(s, P.x, P.y, t.r)) { P.cds[id] = 0.1; continue; }
      const a = atan2(P.dy, P.dx), arc = K.sacredBlades.arc;
      for (const e of s.enemies) {
        if (e.dead) continue;
        const dx = e.x - P.x, dy = e.y - P.y, d = hypot(dx, dy);
        if (d < t.r + e.r && Math.abs(wrapAngle(atan2(dy, dx) - a)) < arc + e.r / Math.max(d, 1)) hit(s, e, t.dmg, '#fff8c0', K.sacredBlades.kb, T.sacredBlades);
      }
      s.effects.push({ type: 'slash', x: P.x, y: P.y, a, r: t.r, sp: arc, t: 0, dur: t.dur, dmg: 0 });
      sfx(s, 'lance');
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'judgePillar') {
      const vis = visibleEnemies(s);
      if (!vis.length) { P.cds[id] = 0.2; continue; }
      const e = vis.reduce((b, o) => ((o.boss || o.elite) && !(b.boss || b.elite)) || ((o.boss || o.elite) === (b.boss || b.elite) && o.hp > b.hp) ? o : b);
      s.effects.push({ type: 'meteor', x: e.x, y: e.y, t: 0, dur: 0, delay: K.judgePillar.delay, r: t.r, dmg: t.dmg, boomed: false, bt: 0, tag: T.judgePillar, col: '#fff8c0' });
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'aegisDome') {
      if (!nearest(s, P.x, P.y, 60) && !s.hz.length) { P.cds[id] = 0.3; continue; }
      P.inv = Math.max(P.inv, t.dur);
      for (const e of s.enemies) {
        if (e.dead) continue;
        const dx = e.x - P.x, dy = e.y - P.y, d = hypot(dx, dy) || 1;
        if (d < t.r + e.r) { const k = K.aegisDome.kb * (e.boss ? 0.2 : 1); e.kx += (dx / d) * k; e.ky += (dy / d) * k; }
      }
      s.effects.push({ type: 'dome', x: P.x, y: P.y, r: t.r, t: 0, dur: t.dur, dmg: 0 });
      flash(s, 0.15, '#fff8c0');
      sfx(s, 'ult');
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'arrowRain') {
      const vis = visibleEnemies(s).filter((e) => hypot(e.x - P.x, e.y - P.y) < t.range);
      if (!vis.length) { P.cds[id] = 0.2; continue; }
      const e = vis[R.int(vis.length)];
      s.effects.push({ type: 'rain', x: e.x, y: e.y, r: t.r, t: 0, dur: t.dur, dmg: t.dmg, tick: 0 });
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'thunderHawk') {
      const c = K.thunderHawk, first = nearest(s, P.x, P.y, t.range);
      if (!first) { P.cds[id] = 0.15; continue; }
      const set = new Set<Enemy>([first]), pts: [number, number][] = [[P.x, P.y - 10], [first.x, first.y]];
      let cur = first;
      for (let j = 0; j < t.jumps; j++) {
        const n = nearest(s, cur.x, cur.y, c.jumpRange, set);
        if (!n) break;
        set.add(n); pts.push([n.x, n.y]); cur = n;
      }
      for (const e of set) hit(s, e, t.dmg, '#fff35c', c.kb, T.thunderHawk);
      s.effects.push({ type: 'chain', pts, t: 0, dur: 0.25, x: P.x, y: P.y, dmg: 0 });
      sfx(s, 'zap');
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'cauldron') {
      if (!nearest(s, P.x, P.y, t.r + 60)) { P.cds[id] = 0.3; continue; }
      s.effects.push({ type: 'cauldron', x: P.x, y: P.y, r: t.r, t: 0, dur: t.dur, dmg: t.dmg, tick: 0, n: 0 });
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'elixirRain') {
      if (P.hp >= P.maxHp && !Object.values(P.cds).some((v) => (v || 0) > 1)) { P.cds[id] = 0.5; continue; }
      const c = K.elixirRain, heal = Math.round(P.maxHp * linAt(c.heal, lv)), cut = linAt(c.cdCut, lv);
      P.hp = Math.min(P.maxHp, P.hp + heal);
      for (const k of Object.keys(P.cds) as SkillId[]) if (k !== id) P.cds[k] = Math.max(0, (P.cds[k] || 0) - cut);
      s.events.push({ t: 'text', x: P.x, y: P.y - 14, v: '+' + heal, col: '#6fe36a', cr: false });
      s.effects.push({ type: 'elixir', x: P.x, y: P.y, t: 0, dur: 0.8, dmg: 0 });
      P.cds[id] = t.cd * P.cdMul;
    } else if (id === 'hole') {
      const vis = visibleEnemies(s);
      if (vis.length < K.hole.minTargets) { P.cds[id] = 0.3; continue; }
      const best = densest(vis, t.r, R);
      s.effects.push({ type: 'hole', x: best.x, y: best.y, t: 0, dur: K.hole.dur, r: t.r, dmg: t.dmg, boom: t.boom, tick: 0, boomed: false, bt: 0 });
      P.cds[id] = t.cd * P.cdMul;
    }
  }
  if (sk.orbit) {
    const t = st(s, 'orbit', sk.orbit);
    P.orbitA += t.spd * dt;
    for (let i = 0; i < t.n; i++) {
      const a = P.orbitA + (i * TAU) / t.n, bx = P.x + cos(a) * t.r, by = P.y + sin(a) * t.r * 0.8;
      for (const e of s.enemies) {
        if (e.dead || e.oc > 0) continue;
        const dx = e.x - bx, dy = e.y - by, rr = e.r + 5;
        if (dx * dx + dy * dy < rr * rr) {
          e.oc = K.orbit.hitCd;
          hit(s, e, t.dmg, '#7df9ff', K.orbit.kb, T.orbit);
          burst(s, bx, by, '#c8fdff', 3, 40, 0.25, 0.4);
        }
      }
    }
  }
  for (const id of castSeen) if ((P.cds[id] || 0) >= st(s, id, sk[id]!).cd * P.cdMul - 1e-9) s.events.push({ t: 'cast', id });
  if (sk.timeWarp) {
    const t = st(s, 'timeWarp', sk.timeWarp);
    P.cds.timeWarp = (P.cds.timeWarp || 0) - dt;
    const tick = P.cds.timeWarp <= 0;
    if (tick) P.cds.timeWarp = K.timeWarp.tick;
    for (const e of s.enemies) {
      if (e.dead) continue;
      const dx = e.x - P.x, dy = e.y - P.y;
      if (dx * dx + dy * dy < t.r * t.r) { e.slowT = Math.max(e.slowT, 0.15); if (tick) hit(s, e, t.dmg, '#e08cff', 0, T.timeWarp); }
    }
  }
  if (sk.galeStep) {
    const t = st(s, 'galeStep', sk.galeStep);
    P.cds.galeStep = (P.cds.galeStep || 0) - dt;
    if (P.moving && P.cds.galeStep <= 0) {
      P.cds.galeStep = K.galeStep.every;
      s.effects.push({ type: 'gale', x: P.x, y: P.y + 4, r: t.r, t: 0, dur: t.dur, dmg: t.dmg, hit: new Set() });
    }
  }
  if (sk.shield) {
    const t = st(s, 'shield', sk.shield);
    P.shieldA += t.spd * dt;
    for (const [bx, by] of shieldPoints(s)) {
      for (const e of s.enemies) {
        if (e.dead || (e.shc || 0) > 0) continue;
        const dx = e.x - bx, dy = e.y - by, rr = e.r + 6;
        if (dx * dx + dy * dy < rr * rr) {
          e.shc = K.shield.hitCd;
          hit(s, e, t.dmg, '#fff8c0', K.shield.kb, T.shield);
          burst(s, bx, by, '#fff8c0', 3, 40, 0.25, 0.4);
        }
      }
    }
  }
  if (sk.frost) {
    const t = st(s, 'frost', sk.frost);
    s.frostT -= dt;
    for (const e of s.enemies) {
      if (e.dead) continue;
      const dx = e.x - P.x, dy = e.y - P.y;
      if (dx * dx + dy * dy < t.r * t.r) { e.slowT = K.frost.tick; if (t.freeze && !e.boss) e.frz = K.frost.tick; } // bosses are slowed, never frozen
    }
    if (s.frostT <= 0) {
      s.frostT = K.frost.tick;
      for (const e of s.enemies) {
        if (e.dead) continue;
        const dx = e.x - P.x, dy = e.y - P.y;
        if (dx * dx + dy * dy < t.r * t.r) { hit(s, e, t.dmg, '#9fd8ff', K.frost.kb, T.frost); if (!e.dead) chillTick(s, e); }
      }
    }
  }
}

export function stepBolts(s: SimState, dt: number): void {
  const P = s.P;
  for (const bo of s.bolts) {
    if (bo.kind === 'boom') {
      bo.d! += bo.spd! * dt;
      bo.spin! += dt * 20;
      if (!bo.ret && bo.d! > bo.range!) { bo.ret = true; bo.hit.clear(); }
      if (bo.ret) {
        const dx = P.x - bo.x, dy = P.y - bo.y, l = hypot(dx, dy) || 1;
        bo.vx = (dx / l) * bo.spd! * 1.2;
        bo.vy = (dy / l) * bo.spd! * 1.2;
        if (l < 8) bo.life = 0;
      }
    }
    bo.x += bo.vx * dt;
    bo.y += bo.vy * dt;
    bo.life -= dt;
    for (const e of s.enemies) {
      if (e.dead || bo.hit.has(e)) continue;
      const dx = e.x - bo.x, dy = e.y - bo.y, rr = e.r + bo.rad;
      if (dx * dx + dy * dy < rr * rr) {
        bo.hit.add(e);
        hit(s, e, bo.dmg, bo.col, bo.kb, bo.tag);
        burst(s, bo.x, bo.y, bo.col, 4, 50, 0.25);
        bo.pierce--;
        if (bo.pierce < 0) { bo.life = 0; break; }
      }
    }
  }
  s.bolts = s.bolts.filter((bo) => bo.life > 0);
}

export function updEffects(s: SimState, dt: number): void {
  const P = s.P, K = s.cfg.skills, gl = s.cfg.status.gatherLinger;
  for (const f of s.effects) {
    f.t += dt;
    if (f.type === 'nova') {
      const r = f.R! * Math.min(1, f.t / f.dur);
      for (const e of s.enemies) {
        if (e.dead || f.hit!.has(e)) continue;
        const d = hypot(e.x - f.x, e.y - f.y);
        if (d < r + e.r) { f.hit!.add(e); hit(s, e, f.dmg, '#ff8a3d', K.nova.kb, f.tag ?? T.nova); }
      }
    } else if (f.type === 'meteor') {
      if (!f.boomed && f.t >= f.delay!) {
        f.boomed = true;
        f.bt = 0;
        for (const e of s.enemies) {
          if (e.dead) continue;
          if (hypot(e.x - f.x, e.y - f.y) < f.r! + e.r) hit(s, e, f.dmg, '#ff4b3a', K.meteor.kb, f.tag ?? T.meteor);
        }
        burst(s, f.x, f.y, '#ff8a3d', 22, 90, 0.55);
        burst(s, f.x, f.y, '#ffd23f', 12, 60, 0.4);
        burst(s, f.x, f.y, '#5a5470', 8, 30, 0.8);
        shake(s, 4.5); flash(s, 0.06, '#ffb070', true);
        s.hitstop = Math.max(s.hitstop, 0.025);
        sfx(s, 'boom');
      }
      if (f.boomed) f.bt! += dt;
    } else if (f.type === 'pbreath') {
      if (P.pet) { f.x = P.pet.x; f.y = P.pet.y; }
      for (const e of s.enemies) {
        if (e.dead || f.hit!.has(e)) continue;
        const dx = e.x - f.x, dy = e.y - f.y, d = hypot(dx, dy);
        if (d > f.r! + e.r) continue;
        const da = wrapAngle(atan2(dy, dx) - f.a!);
        if (Math.abs(da) < f.sp! + e.r / Math.max(d, 1)) {
          f.hit!.add(e);
          hit(s, e, f.dmg, f.el === 'ice' ? '#9fd8ff' : '#ff8a3d', 30, f.tag ?? PET_FIRE);
          if (f.n && !e.dead) for (let i = 0; i < f.n; i++) chillTick(s, e); // Frost Companion: frost stacks
        }
      }
    } else if (f.type === 'cyclone') {
      f.x += f.vx! * dt;
      f.y += f.vy! * dt;
      const ddx = f.x - P.x, ddy = f.y - P.y;
      if (Math.abs(ddx) > s.viewport.w / 2 - 12) f.vx = -Math.sign(ddx) * Math.abs(f.vx!);
      if (Math.abs(ddy) > s.viewport.h / 2 - 12) f.vy = -Math.sign(ddy) * Math.abs(f.vy!);
      f.tick! -= dt;
      const doHit = f.tick! <= 0;
      if (doHit) f.tick = K.cyclone.tick;
      for (const e of s.enemies) {
        if (e.dead) continue;
        const dx = f.x - e.x, dy = f.y - e.y, d = hypot(dx, dy) || 1;
        if (d < f.r! * 2.2 && !e.boss) { const k = Math.min(d, K.cyclone.pull * dt); e.x += (dx / d) * k; e.y += (dy / d) * k; e.gath = gl; }
        if (doHit && d < f.r! + e.r) hit(s, e, f.dmg, '#d8f3e0', 0, T.cyclone);
      }
    } else if (f.type === 'toxic') {
      f.tick! -= dt;
      const doHit = f.tick! <= 0;
      if (doHit) f.tick = K.toxic.tick;
      for (const e of s.enemies) {
        if (e.dead) continue;
        const dx = f.x - e.x, dy = (f.y - e.y) * 1.4;
        if (dx * dx + dy * dy < (f.r! + e.r) * (f.r! + e.r)) { e.slowT = 0.3; if (doHit) hit(s, e, f.dmg, '#b6f24a', 0, T.toxic); }
      }
    } else if (f.type === 'laser') {
      f.a = f.a0! + TAU * Math.min(1, f.t / f.dur);
      const beams: [number, Set<Enemy>][] = f.twin ? [[f.a, f.hit!], [f.a + PI, f.hit2!]] : [[f.a, f.hit!]];
      for (const [ba, hs] of beams) {
        for (const e of s.enemies) {
          if (e.dead || hs.has(e)) continue;
          const dx = e.x - P.x, dy = e.y - P.y, d = hypot(dx, dy) || 1;
          if (d > f.len! + e.r) continue;
          const da = wrapAngle(atan2(dy, dx) - ba);
          if (Math.abs(da) < K.laser.width + (e.r + 3) / d) { hs.add(e); hit(s, e, f.dmg, '#5cf4ff', K.laser.kb, T.laser); burst(s, e.x, e.y, '#bff9ff', 3, 50, 0.3); }
        }
      }
      shake(s, 1.5);
    } else if (f.type === 'hole') {
      if (!f.boomed) {
        f.tick! -= dt;
        const doHit = f.tick! <= 0;
        if (doHit) f.tick = K.hole.tick;
        for (const e of s.enemies) {
          if (e.dead) continue;
          const dx = f.x - e.x, dy = f.y - e.y, d = hypot(dx, dy) || 1;
          if (d < f.r! * 1.5 && !e.boss) { const k = Math.min(d * 0.9, K.hole.pull * dt); e.x += (dx / d) * k; e.y += (dy / d) * k; e.gath = gl; }
          if (doHit && d < f.r!) hit(s, e, f.dmg, '#b07cff', 0, T.hole);
        }
        if (f.t >= f.dur - 0.3) {
          f.boomed = true;
          for (const e of s.enemies) {
            if (e.dead) continue;
            if (hypot(e.x - f.x, e.y - f.y) < f.r! * 1.1 + e.r) hit(s, e, f.boom!, '#d9b8ff', K.hole.kb, HOLE_BOOM);
          }
          burst(s, f.x, f.y, '#b07cff', 40, 130, 0.6);
          burst(s, f.x, f.y, '#ffffff', 16, 90, 0.4);
          shake(s, 7); flash(s, 0.15, '#b07cff', true);
          s.hitstop = Math.max(s.hitstop, 0.05);
          sfx(s, 'boom');
        }
      } else f.bt! += dt;
    } else if (f.type === 'sigil') {
      f.tick! -= dt;
      if (f.tick! <= 0) {
        f.tick = K.sigil.tick;
        for (const e of s.enemies) {
          if (e.dead) continue;
          const dx = e.x - f.x, dy = (e.y - f.y) * 1.25;
          if (dx * dx + dy * dy < (f.r! + e.r) * (f.r! + e.r)) hit(s, e, f.dmg, '#ff5cf4', 0, T.sigil);
        }
      }
    } else if (f.type === 'hawk') {
      const o = f.targets![0];
      if (!o.e.dead) { o.x = o.e.x; o.y = o.e.y; }
      if (!f.fired && f.t >= f.dur) {
        f.fired = true;
        // the prey (if still alive), then everything caught in the splash around where it was
        const struck = o.e.dead ? [] : [o.e];
        if (f.r) for (const e of s.enemies) if (e !== o.e && !e.dead && !e.hide && hypot(e.x - o.x, e.y - o.y) < f.r + e.r) struck.push(e);
        for (const e of struck) {
          hit(s, e, f.dmg, '#ffe9a8', K.hawk.kb, T.hawk);
          if (f.stun && !e.dead) { if (e.boss) e.slowT = Math.max(e.slowT, K.hawk.evo.stun); else e.stun = K.hawk.evo.stun; }
        }
        burst(s, o.x, o.y, '#c48a55', 8, 60, 0.3);
      }
    } else if (f.type === 'flask') {
      const o = f.targets?.[0];
      if (!f.fired && o && !o.e.dead) { f.x = o.e.x; f.y = o.e.y; }
      if (!f.fired && f.t >= f.dur) {
        f.fired = true;
        const tag = FLASK_TAGS[f.el!];
        for (const e of s.enemies) {
          if (e.dead) continue;
          if (hypot(e.x - f.x, e.y - f.y) < f.r! + e.r) {
            hit(s, e, f.dmg, FLASK_COL[f.el!], 30, tag);
            if (f.el === 'ice' && !e.dead) for (let i = 0; i < s.cfg.status.frostStacks; i++) chillTick(s, e);
          }
        }
        burst(s, f.x, f.y, FLASK_COL[f.el!], 16, 70, 0.45);
        sfx(s, 'boom');
      }
    } else if (f.type === 'rain') {
      f.tick! -= dt;
      if (f.tick! <= 0) {
        f.tick = K.arrowRain.tick;
        for (const e of s.enemies) if (!e.dead && hypot(e.x - f.x, (e.y - f.y) * 1.25) < f.r! + e.r) hit(s, e, f.dmg, '#ffe9a8', 10, T.arrowRain);
      }
    } else if (f.type === 'gale') {
      for (const e of s.enemies) {
        if (e.dead || f.hit!.has(e)) continue;
        if (hypot(e.x - f.x, e.y - f.y) < f.r! + e.r) { f.hit!.add(e); hit(s, e, f.dmg, '#d8f3e0', 30, T.galeStep); }
      }
    } else if (f.type === 'cauldron') {
      f.tick! -= dt;
      if (f.tick! <= 0) {
        f.tick = K.cauldron.tick;
        const el = FLASKS[f.n! % 3];
        f.n = f.n! + 1;
        for (const e of s.enemies) {
          if (e.dead || hypot(e.x - f.x, (e.y - f.y) * 1.25) > f.r! + e.r) continue;
          hit(s, e, f.dmg, FLASK_COL[el], 0, FLASK_TAGS[el]);
          if (el === 'ice' && !e.dead) chillTick(s, e);
        }
      }
    } else if (f.type === 'icewall') {
      stepIceWall(s, f);
    } else if (f.type === 'gturret') {
      // Gear Cannon: a turret keeps shooting the nearest monster for a few seconds
      f.tick! -= dt;
      if (f.tick! <= 0) {
        f.tick = s.cfg.weapons.turretEvery;
        const e = nearest(s, f.x, f.y, 200);
        if (e) {
          hit(s, e, f.dmg, WEAPONS.gearCannon.col, 40, ULT_TAG);
          burst(s, e.x, e.y, '#c7ced9', 3, 40, 0.2);
        }
      }
    } else if (f.type === 'judge') {
      if (!f.fired && f.t >= s.cfg.ult.delay) {
        f.fired = true;
        flash(s, 0.45, '#ffffff', false, true); shake(s, 11);
        s.hitstop = 0.08;
        const heal = { left: s.P.maxHp * s.cfg.weapons.harvestHealMax };
        if (WEAPONS[s.weapon].form === 'turret') s.effects.push({ type: 'gturret', x: s.P.x, y: s.P.y - 6, t: 0, dur: s.cfg.weapons.turretDur, dmg: f.dmg * s.cfg.weapons.turretDmg, tick: 0 });
        for (const o of f.targets!) {
          if (!o.e.dead) { o.x = o.e.x; o.y = o.e.y; ultStrike(s, o.e, f.dmg, heal); }
          burst(s, o.x, o.y, '#fff8c0', 8, 80, 0.6);
        }
        sfx(s, 'boom');
      }
    }
  }
  s.effects = s.effects.filter((f) =>
    f.type === 'meteor' || f.type === 'hole' ? !(f.boomed && f.bt! > 0.3) : f.type === 'flask' || f.type === 'hawk' ? f.t < f.dur + 0.25 : f.t < f.dur,
  );
}
