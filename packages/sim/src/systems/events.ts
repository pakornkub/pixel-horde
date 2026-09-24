import { TAU, atan2, cos, hypot, ipow, sin } from '../core/fmath';
import type { SkillId, SkillStats } from '../data/skills';
import type { Enemy, Hazard, RivalSkill, SimState } from '../types';
import { hit, hurtP } from './combat';
import { banner, burst, flash, sfx, shake } from './fx';
import { nearest, visibleEnemies } from './query';
import { edgePos, spawnEnemy } from './spawner';

/** Roll this stage's special event (Blood Moon / Inferno Dragon / Shadow Rival) with pity. */
export function rollStage(s: SimState, n: number): void {
  s.specialStage = s.dragonStage = s.rivalStage = false;
  s.dragonWarned = s.dragonSpawned = s.rivalSpawned = false;
  s.dragonE = s.rivalE = null;
  s.hz = [];
  const force = s.debug.event;
  if (force === 'bloodmoon') { s.specialStage = true; return; }
  if (force === 'dragon') { s.specialStage = true; s.dragonStage = true; return; }
  if (force === 'rival') { s.rivalStage = true; return; }
  if (n < 2) return;
  const R = s.rng.events, run = s.run;
  if (R.next() < 0.1 + 0.06 * run.spPity) {
    s.specialStage = true;
    run.spPity = 0;
    if (n >= 3 && R.next() < 0.25 + 0.15 * run.drPity) { s.dragonStage = true; run.drPity = 0; }
    else if (n >= 3) run.drPity++;
  } else {
    run.spPity++;
    if (R.next() < 0.25) s.rivalStage = true;
  }
}

export function addHz(s: SimState, h: Omit<Hazard, 'id' | 't'>): Hazard {
  const hz: Hazard = { ...h, id: s.hzId++, t: 0 };
  s.hz.push(hz);
  return hz;
}

const HZ_BURST_COL = (c: number | undefined): string => (c === 1 ? '#b07cff' : c === 2 ? '#fff35c' : '#ff8a3d');

/** Telegraphed hazards; they damage the player only through hurtP(). */
export function stepHz(s: SimState, dt: number): void {
  const P = s.P;
  for (const h of s.hz) {
    h.t += dt;
    if (h.k === 'cone') {
      if (h.t >= h.te! && h.t < h.te! + h.du!) {
        h.tk = (h.tk || 0) - dt;
        if (h.tk <= 0) {
          h.tk = 0.2;
          const dx = P.x - h.x, dy = P.y - h.y, dd = hypot(dx, dy);
          const da = atan2(sin(atan2(dy, dx) - h.a!), cos(atan2(dy, dx) - h.a!));
          if (dd < h.r! && Math.abs(da) < h.sp!) hurtP(s, h.d!);
        }
      }
    } else if (h.k === 'circ') {
      if (!h.done && h.t >= h.te!) {
        h.done = true;
        if (hypot(P.x - h.x, P.y - h.y) < h.r! + 5) hurtP(s, h.d!);
        burst(s, h.x, h.y, HZ_BURST_COL(h.c), 14, 70, 0.45);
        sfx(s, 'boom');
        shake(s, 3);
      }
    } else if (h.k === 'line') {
      if (h.fire && !h.fired && h.t >= h.te!) {
        h.fired = true;
        addHz(s, { k: 'proj', x: h.x, y: h.y, vx: cos(h.a!) * 260, vy: sin(h.a!) * 260, r: 4, d: h.d, life: 1.2, c: 1 });
      }
    } else if (h.k === 'proj') {
      h.x += h.vx! * dt;
      h.y += h.vy! * dt;
      if (!h.hitP && hypot(P.x - h.x, P.y - h.y) < h.r! + 5) { h.hitP = true; hurtP(s, h.d!); h.life = 0; }
    } else if (h.k === 'ring') {
      const r = h.r! * Math.min(1, h.t / h.du!);
      if (!h.hitP && Math.abs(hypot(P.x - h.x, P.y - h.y) - r) < 7) { h.hitP = true; hurtP(s, h.d!); }
    }
  }
  s.hz = s.hz.filter((h) =>
    h.k === 'cone' ? h.t < h.te! + h.du! : h.k === 'circ' ? h.t < h.te! + 0.3 : h.k === 'line' ? h.t < h.te! + 0.05 : h.k === 'proj' ? h.t < (h.life || 1.5) : h.t < h.du!,
  );
}

/* ---------- Inferno Dragon ---------- */
export function spawnDragon(s: SimState): void {
  const [x, y] = edgePos(s);
  const e = spawnEnemy(s, 'dragon', x, y, false);
  e.hp = e.maxHp = 6000 * ipow(1.5, s.stage - 1);
  e.cd = 2; e.lock = 0; e.dashT = 0;
  s.dragonE = e;
  banner(s, 'dragonAppears', 2.4, true);
  shake(s, 8); flash(s, 0.3, '#ff4b3a'); sfx(s, 'ult');
}

export function dragonAI(s: SimState, e: Enemy, dt: number, tx: number, ty: number, damp: number): void {
  const R = s.rng.ai;
  const dx = tx - e.x, dy = ty - e.y, l = hypot(dx, dy) || 1;
  if (e.dashT! > 0) {
    e.dashT! -= dt;
    e.x += cos(e.dashA!) * 320 * dt;
    e.y += sin(e.dashA!) * 320 * dt;
    e.dmgMul = 1.6;
    burst(s, e.x, e.y, '#ff8a3d', 2, 40, 0.3, 0.8);
    return;
  }
  e.dmgMul = 1;
  if (e.lock! > 0) {
    e.lock! -= dt;
    if (e.lock! <= 0 && e.pend === 'dash') { e.dashT = 0.5; e.pend = null; }
    return;
  }
  const sp = e.spd * (e.slowT > 0 ? 0.6 : 1);
  e.x += (dx / l) * sp * dt + e.kx * dt;
  e.y += (dy / l) * sp * dt + e.ky * dt;
  e.kx *= damp; e.ky *= damp;
  e.cd! -= dt;
  if (e.cd! > 0) return;
  const whelps = s.enemies.filter((o) => !o.dead && o.type === 'whelp').length;
  const opts = ['breath', 'breath', 'dash', 'rain'];
  if (whelps < 6) opts.push('summon');
  const pick = opts[R.int(opts.length)], a = atan2(dy, dx);
  e.cd = R.range(1.8, 2.6);
  if (pick === 'breath') { addHz(s, { k: 'cone', x: e.x, y: e.y, a, r: 100, sp: 0.5, te: 0.75, du: 0.7, d: e.dmg * 0.45 }); e.lock = 1.45; }
  else if (pick === 'dash') { addHz(s, { k: 'line', x: e.x, y: e.y, a, r: 190, te: 0.65, c: 0 }); e.lock = 0.65; e.pend = 'dash'; e.dashA = a; }
  else if (pick === 'rain') {
    for (let i = 0; i < 6; i++) addHz(s, { k: 'circ', x: tx + (i ? R.range(-40, 40) : 0), y: ty + (i ? R.range(-30, 30) : 0), r: 18, te: 0.9 + i * 0.08, d: e.dmg * 1.1, c: 0 });
  } else {
    for (let i = 0; i < 4; i++) spawnEnemy(s, 'whelp', e.x + R.range(-20, 20), e.y + R.range(-20, 20), false);
    banner(s, 'dragonSummons', 1);
  }
}

/* ---------- Shadow Rival ---------- */
const RIVAL_SK: RivalSkill[] = ['bolt', 'lance', 'nova', 'meteor', 'zap'];

export function spawnRival(s: SimState): void {
  const R = s.rng.events;
  const [x, y] = edgePos(s);
  const e = spawnEnemy(s, 'rival', x, y, false);
  e.hp = e.maxHp = 1400 * ipow(1.5, s.stage - 1);
  const pool = RIVAL_SK.slice();
  e.sk = [];
  while (e.sk.length < 3) e.sk.push(pool.splice(R.int(pool.length), 1)[0]);
  e.rlv = 1 + Math.floor((s.stage - 1) / 2);
  e.cds = {};
  e.sk.forEach((k, i) => { e.cds![k] = 1 + i * 0.7; });
  e.life = 35;
  e.ang = R.next() * TAU;
  s.rivalE = e;
  banner(s, 'rivalAppears', 2.6, true);
  sfx(s, 'zap');
}

export function rivalAI(s: SimState, e: Enemy, dt: number, tx: number, ty: number, damp: number): void {
  const R = s.rng.ai;
  e.life! -= dt;
  if (e.life! <= 0) {
    burst(s, e.x, e.y, '#8a5ad6', 30, 90, 0.7);
    e.dead = true;
    s.rivalE = null;
    banner(s, 'rivalEscaped', 1.8);
    return;
  }
  const dx = tx - e.x, dy = ty - e.y, l = hypot(dx, dy) || 1;
  e.ang! += dt * 0.9;
  let mx = 0, my = 0;
  if (l > 90) { mx = dx / l; my = dy / l; } else if (l < 60) { mx = -dx / l; my = -dy / l; }
  mx += (-dy / l) * sin(e.ang!) * 0.8;
  my += (dx / l) * sin(e.ang!) * 0.8;
  const m = hypot(mx, my) || 1;
  const sp = e.spd * (e.slowT > 0 ? 0.6 : 1) * (e.frz > 0 ? 0.3 : 1);
  e.x += (mx / m) * sp * dt + e.kx * dt;
  e.y += (my / m) * sp * dt + e.ky * dt;
  e.kx *= damp; e.ky *= damp;
  const L = e.rlv!, a = atan2(dy, dx);
  for (const k of e.sk!) {
    e.cds![k]! -= dt;
    if (e.cds![k]! > 0) continue;
    if (k === 'bolt') {
      const n = 1 + Math.floor(L / 2);
      for (let i = 0; i < n; i++) {
        const aa = a + (i - (n - 1) / 2) * 0.25;
        addHz(s, { k: 'proj', x: e.x, y: e.y, vx: cos(aa) * 110, vy: sin(aa) * 110, r: 3, d: e.dmg * 0.6, life: 2, c: 1 });
      }
      e.cds![k] = Math.max(0.9, 1.9 - 0.1 * L);
    } else if (k === 'lance') {
      addHz(s, { k: 'line', x: e.x, y: e.y, a, r: 220, te: 0.5, d: e.dmg, c: 1, fire: true });
      e.cds![k] = Math.max(1.6, 3.2 - 0.15 * L);
    } else if (k === 'nova') {
      if (l > 110) { e.cds![k] = 0.3; continue; }
      addHz(s, { k: 'ring', x: e.x, y: e.y, r: 80 + 8 * L, du: 0.7, d: e.dmg });
      e.cds![k] = Math.max(2, 4 - 0.2 * L);
    } else if (k === 'meteor') {
      for (let i = 0; i < 2 + L; i++) addHz(s, { k: 'circ', x: tx + (i ? R.range(-35, 35) : 0), y: ty + (i ? R.range(-25, 25) : 0), r: 16, te: 1 + i * 0.1, d: e.dmg * 1.2, c: 1 });
      e.cds![k] = Math.max(2.6, 4.6 - 0.2 * L);
    } else {
      addHz(s, { k: 'circ', x: tx, y: ty, r: 10, te: 0.5, d: e.dmg * 0.9, c: 2 });
      e.cds![k] = Math.max(1.4, 3 - 0.15 * L);
    }
  }
}

/* ---------- rewards ---------- */
export function grantDragon(s: SimState): void {
  const P = s.P;
  if (!P.pet) {
    P.pet = { lv: 1, cd: 0.5, dive: 3, x: P.x, y: P.y };
    banner(s, 'dragonTamed', 2.6, true);
  } else {
    P.pet.lv++;
    banner(s, 'dragonPowerUp', 2, false, { lv: P.pet.lv });
  }
  flash(s, 0.35, '#ffd23f');
  sfx(s, 'clear');
  s.runGold += 100;
}

export function grantShadow(s: SimState): void {
  const P = s.P;
  P.shards++;
  if (P.clone) {
    P.clone.lv++;
    banner(s, 'clonePowerUp', 2, false, { lv: P.clone.lv });
  } else if (s.rng.loot.next() < 0.35 || P.shards >= 3) {
    P.clone = { lv: 1, x: P.x, y: P.y };
    P.shards = 0;
    banner(s, 'shadowClone', 2.6, true);
    flash(s, 0.35, '#b07cff');
  } else banner(s, 'shadowShard', 2.4, false, { n: P.shards });
  sfx(s, 'clear');
  s.runGold += 40;
}

/* ---------- pet dragon ---------- */
export function petStep(s: SimState, dt: number): void {
  const P = s.P, pt = P.pet, R = s.rng.skills;
  if (!pt || P.down) return;
  const tx = P.x + cos(s.clock * 1.3) * 22, ty = P.y - 14 + sin(s.clock * 2.6) * 4;
  pt.x += (tx - pt.x) * Math.min(1, dt * 6);
  pt.y += (ty - pt.y) * Math.min(1, dt * 6);
  pt.cd -= dt;
  pt.dive -= dt;
  if (pt.cd <= 0) {
    const t = nearest(s, pt.x, pt.y, 100);
    if (t) {
      pt.cd = Math.max(0.6, 1.3 - 0.1 * pt.lv);
      const a = atan2(t.y - pt.y, t.x - pt.x);
      s.effects.push({ type: 'pbreath', x: pt.x, y: pt.y, a, r: 70 + 6 * pt.lv, sp: 0.45, t: 0, dur: 0.4, hit: new Set(), dmg: (25 + 8 * P.lv) * (1 + 0.4 * (pt.lv - 1)) });
    } else pt.cd = 0.2;
  }
  if (pt.dive <= 0) {
    const vis = visibleEnemies(s);
    if (vis.length) {
      pt.dive = Math.max(2.5, 5 - 0.4 * pt.lv);
      const e = vis[R.int(vis.length)];
      s.effects.push({ type: 'meteor', x: e.x, y: e.y, t: 0, dur: 0, delay: 0.45, r: 26, dmg: (120 + 25 * P.lv) * (1 + 0.4 * (pt.lv - 1)), boomed: false, bt: 0 });
    } else pt.dive = 0.5;
  }
}

/* ---------- shadow clone ---------- */
export function cloneStep(s: SimState, dt: number): void {
  const P = s.P, c = P.clone;
  if (!c) return;
  const tx = P.x - P.dx * 22, ty = P.y - P.dy * 22 - 2;
  c.x += (tx - c.x) * Math.min(1, dt * 7);
  c.y += (ty - c.y) * Math.min(1, dt * 7);
}

/** The clone repeats bolt/lance/boomer/chain/nova/meteor casts at 35–60% damage. */
export function cloneCast(s: SimState, id: SkillId, t: SkillStats): void {
  const P = s.P, c = P.clone, R = s.rng.skills;
  if (!c || P.down) return;
  const f = Math.min(0.6, 0.35 + 0.08 * (c.lv - 1));
  if (id === 'bolt') {
    const tg = nearest(s, c.x, c.y, 200);
    if (!tg) return;
    for (let i = 0; i < t.n; i++) {
      const a = atan2(tg.y - c.y, tg.x - c.x) + R.range(-0.25, 0.25);
      s.bolts.push({ kind: 'bolt', x: c.x, y: c.y - 3, vx: cos(a) * 200, vy: sin(a) * 200, life: 1.1, dmg: t.dmg * f, pierce: t.pierce, hit: new Set(), col: '#b58cff', rad: 3, kb: 25 });
    }
  } else if (id === 'lance') {
    const a0 = atan2(P.dy, P.dx);
    for (let i = 0; i < t.n; i++) {
      const a = a0 + (i - (t.n - 1) / 2) * 0.22;
      s.bolts.push({ kind: 'lance', x: c.x, y: c.y - 3, vx: cos(a) * 280, vy: sin(a) * 280, a, life: 0.9, dmg: t.dmg * f, pierce: Infinity, hit: new Set(), col: '#b58cff', rad: 4, kb: 15 });
    }
  } else if (id === 'boomer') {
    const tg = nearest(s, c.x, c.y, 180);
    if (!tg) return;
    const a = atan2(tg.y - c.y, tg.x - c.x);
    s.bolts.push({ kind: 'boom', x: c.x, y: c.y - 3, vx: cos(a) * 170, vy: sin(a) * 170, spd: 170, d: 0, range: t.range, ret: false, life: 3, dmg: t.dmg * f, pierce: Infinity, hit: new Set(), col: '#b58cff', rad: 5, kb: 25, spin: 0 });
  } else if (id === 'chain') {
    const first = nearest(s, c.x, c.y, 150);
    if (!first) return;
    const set = new Set<Enemy>([first]), pts: [number, number][] = [[c.x, c.y - 4], [first.x, first.y]];
    let cur = first;
    for (let j = 0; j < Math.ceil(t.jumps / 2); j++) {
      const n = nearest(s, cur.x, cur.y, 75, set);
      if (!n) break;
      set.add(n); pts.push([n.x, n.y]); cur = n;
    }
    for (const e of set) hit(s, e, t.dmg * f, '#d9b8ff', 20);
    s.effects.push({ type: 'chain', pts, t: 0, dur: 0.2, x: c.x, y: c.y, dmg: 0 });
  } else if (id === 'nova') {
    s.effects.push({ type: 'nova', x: c.x, y: c.y, R: t.r * 0.8, t: 0, dur: 0.38, hit: new Set(), dmg: t.dmg * f });
  } else if (id === 'meteor') {
    const vis = visibleEnemies(s);
    for (let i = 0; i < Math.ceil(t.n / 2) && vis.length; i++) {
      const e = vis[R.int(vis.length)];
      s.effects.push({ type: 'meteor', x: e.x, y: e.y, t: 0, dur: 0, delay: 0.6 + i * 0.1, r: t.r, dmg: t.dmg * f, boomed: false, bt: 0 });
    }
  }
}
