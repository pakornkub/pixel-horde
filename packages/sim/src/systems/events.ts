import { TAU, atan2, cos, hypot, ipow, sin } from '../core/fmath';
import { SKILL_TAGS, type SkillId, type SkillStats } from '../data/skills';
import type { Enemy, Hazard, RivalSkill, SimState, BossMove } from '../types';
import { hit, hurtP } from './combat';
import { banner, burst, flash, sfx, shake } from './fx';
import { nearest, visibleEnemies } from './query';
import { edgePos, spawnEnemy } from './spawner';
import { say } from './kings';
import { shieldBlocks } from './shield';
import { guardianPity, pickGuardian } from './guardians';

/** Roll this stage's special event (Blood Moon / Inferno Dragon / Shadow Rival) with pity. */
export function rollStage(s: SimState, n: number): void {
  s.doubleKing = false;
  s.boss2 = null;
  const E0 = s.cfg.events;
  // double-King Stage: never announced; rolled first on its own stream so other rolls stay put
  if (n >= E0.doubleKingFrom && n <= E0.lastChapter && n < s.cfg.stage.chapters && s.skipped && s.rng.route.next() < E0.doubleKingChance) s.doubleKing = true;
  s.specialStage = s.dragonStage = s.rivalStage = false;
  s.dragonWarned = s.dragonSpawned = s.rivalSpawned = false;
  s.dragonE = s.rivalE = null;
  s.hz = [];
  const force = s.debug.event;
  s.dragonKind = pickGuardian(s);
  if (force === 'bloodmoon') { s.specialStage = true; return; }
  if (force === 'dragon' || force === 'frostdragon' || force === 'stormdragon') {
    s.specialStage = true; s.dragonStage = true;
    s.dragonKind = force === 'frostdragon' ? 'frost' : force === 'stormdragon' ? 'storm' : 'inferno';
    return;
  }
  if (force === 'rival') { s.rivalStage = true; return; }
  const E = s.cfg.events;
  if (n < E.bloodMoonFrom || n > E.lastChapter || n >= s.cfg.stage.chapters) return;
  const R = s.rng.events, run = s.run;
  // Rolls always consume the same random numbers; switched-off events just do not happen.
  const on = s.eventSwitches;
  // after the first Guardian, Realms whose element matches a missing one favour Blood Moon + Guardian
  const pity = guardianPity(s);
  if (R.next() < (E.bloodMoonChance + E.bloodMoonPity * run.spPity) * (pity ? s.cfg.guardians.pityBloodMoon : 1)) {
    s.specialStage = on.bloodMoon;
    run.spPity = 0;
    const dc = Math.max(E.dragonChance + E.dragonPity * run.drPity, pity ? s.cfg.guardians.pityDragon : 0);
    if (n >= E.dragonFrom && R.next() < dc) { s.dragonStage = on.bloodMoon && on.dragon; run.drPity = 0; }
    else if (n >= E.dragonFrom) run.drPity++;
  } else {
    run.spPity++;
    if (R.next() < E.rivalChance) s.rivalStage = on.rival;
  }
}

/** Tag every hazard added since index `from` with the boss move that made it. */
export function tagSince(s: SimState, from: number, k: BossMove): void {
  for (let i = from; i < s.hz.length; i++) s.hz[i].bm = k;
}

export function addHz(s: SimState, h: Omit<Hazard, 'id' | 't'>): Hazard {
  const hz: Hazard = { ...h, id: s.hzId++, t: 0 };
  s.hz.push(hz);
  return hz;
}

const HZ_BURST_COL = (c: number | undefined): string =>
  c === 1 ? '#b07cff' : c === 2 ? '#fff35c' : c === 3 ? '#8fce6a' : c === 4 ? '#f4f0e0' : c === 5 ? '#bfe6ff' : '#ff8a3d';

/** Distance from (px,py) to the segment starting at (x,y) with angle a and length len. */
function segDist(px: number, py: number, x: number, y: number, a: number, len: number): number {
  const ux = cos(a), uy = sin(a), t = Math.max(0, Math.min(len, (px - x) * ux + (py - y) * uy));
  return hypot(px - (x + ux * t), py - (y + uy * t));
}

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
          if (dd < h.r! && Math.abs(da) < h.sp!) { hurtP(s, h.d!); if (h.chill && !s.debug.god) P.chill = Math.max(P.chill, h.chill); }
        }
      }
    } else if (h.k === 'circ') {
      if (!h.done && h.t >= h.te!) {
        h.done = true;
        if (h.spawn) { const m = spawnEnemy(s, h.spawn, h.x, h.y, false); if (h.bm) m.summoned = true; burst(s, h.x, h.y, HZ_BURST_COL(h.c), 8, 40, 0.4); continue; }
        if (hypot(P.x - h.x, P.y - h.y) < h.r! + 5) hurtP(s, h.d!);
        burst(s, h.x, h.y, HZ_BURST_COL(h.c), 14, 70, 0.45);
        sfx(s, 'boom');
        shake(s, 3);
      }
    } else if (h.k === 'line') {
      if (h.fire && !h.fired && h.t >= h.te!) {
        h.fired = true;
        const sp = h.sp ?? s.cfg.rival.lance.speed;
        addHz(s, { k: 'proj', x: h.x, y: h.y, vx: cos(h.a!) * sp, vy: sin(h.a!) * sp, r: 4, d: h.d, life: 1.2, c: h.c || 1, ...(h.bm ? { bm: h.bm } : {}) });
      }
    } else if (h.k === 'proj') {
      h.x += h.vx! * dt;
      h.y += h.vy! * dt;
      if (shieldBlocks(s, h)) continue;
      if (h.bounce) {
        const w = s.viewport.w / 2 - 4, hh = s.viewport.h / 2 - 4;
        if (Math.abs(h.x - P.x) > w) h.vx = -Math.sign(h.x - P.x) * Math.abs(h.vx!);
        if (Math.abs(h.y - P.y) > hh) h.vy = -Math.sign(h.y - P.y) * Math.abs(h.vy!);
      }
      if (!h.hitP && hypot(P.x - h.x, P.y - h.y) < h.r! + 5) { h.hitP = true; hurtP(s, h.d!); h.life = 0; }
    } else if (h.k === 'ring') {
      const r = h.r! * Math.min(1, h.t / h.du!);
      if (!h.hitP && Math.abs(hypot(P.x - h.x, P.y - h.y) - r) < 7) { h.hitP = true; hurtP(s, h.d!); }
    } else if (h.k === 'beam') {
      if (!h.done && h.t >= h.te!) {
        h.done = true;
        if (segDist(P.x, P.y, h.x, h.y, h.a!, h.r!) < h.w! + 5) hurtP(s, h.d!);
        shake(s, 3);
        sfx(s, 'laser');
      }
    } else if (h.k === 'pull') {
      if (h.t >= h.te! && h.t < h.te! + h.du!) {
        const dx = h.x - P.x, dy = h.y - P.y, l = hypot(dx, dy);
        if (l < h.r! && l > 1 && !P.down) { P.x += (dx / l) * h.sp! * dt; P.y += (dy / l) * h.sp! * dt; }
        h.tk = (h.tk || 0) - dt;
        if (h.tk <= 0) { h.tk = 0.4; if (l < h.w! + 5) hurtP(s, h.d!); }
      }
    } else if (h.k === 'ice') {
      if (h.t >= h.te! && h.t < h.te! + h.du! && hypot(P.x - h.x, P.y - h.y) < h.r!) { P.slip = 0.15; P.slipGrip = h.sp!; }
    } else if (h.k === 'bliz') {
      // Frost Dragon's blizzard: standing still too long freezes you
      if (h.t >= h.te! && h.t < h.te! + h.du!) {
        h.tk = P.moving ? 0 : (h.tk || 0) + dt;
        if (h.tk >= h.sp!) { h.tk = 0; hurtP(s, h.d!); P.chill = Math.max(P.chill, 1.5); burst(s, P.x, P.y, '#dff4ff', 10, 50, 0.4); }
      }
    } else if (h.k === 'safe') {
      if (!h.done && h.t >= h.te!) {
        h.done = true;
        if (!h.pts!.some(([x, y]) => hypot(P.x - x, P.y - y) < h.r!)) {
          hurtP(s, h.d!);
          if (!P.down && !s.debug.god && h.c !== 3) P.chill = s.cfg.kings.throne.chill; // ice chills; the swamp (c 3) only poisons
        }
        flash(s, 0.35, h.c === 3 ? '#b6f24a' : '#bfe6ff');
        shake(s, 5);
      }
    }
  }
  s.hz = s.hz.filter((h) =>
    h.k === 'cone' || h.k === 'pull' || h.k === 'ice' || h.k === 'bliz' ? h.t < h.te! + h.du! : h.k === 'circ' ? h.t < h.te! + 0.3 : h.k === 'line' ? h.t < h.te! + 0.05
      : h.k === 'proj' ? h.t < (h.life || 1.5) : h.k === 'beam' || h.k === 'safe' ? h.t < h.te! + 0.3 : h.t < h.du!,
  );
}

/* ---------- Inferno Dragon (Guardian) ---------- */
export function dragonAI(s: SimState, e: Enemy, dt: number, tx: number, ty: number, damp: number): void {
  const R = s.rng.ai, D = s.cfg.dragon;
  const dx = tx - e.x, dy = ty - e.y, l = hypot(dx, dy) || 1;
  if (e.dashT! > 0) {
    e.dashT! -= dt;
    e.x += cos(e.dashA!) * D.dashSpeed * dt;
    e.y += sin(e.dashA!) * D.dashSpeed * dt;
    e.dmgMul = D.dashDmg;
    burst(s, e.x, e.y, '#ff8a3d', 2, 40, 0.3, 0.8);
    return;
  }
  e.dmgMul = 1;
  if (e.lock! > 0) {
    e.lock! -= dt;
    if (e.lock! <= 0 && e.pend === 'dash') { e.dashT = D.dashTime; e.pend = null; }
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
  if (whelps < D.whelpCap) opts.push('summon');
  const pick = opts[R.int(opts.length)], a = atan2(dy, dx);
  e.cd = R.range(D.cdMin, D.cdMax);
  const n0 = s.hz.length;
  if (pick === 'breath') { addHz(s, { k: 'cone', x: e.x, y: e.y, a, r: D.breathR, sp: D.breathArc, te: D.breathWarn, du: D.breathDur, d: e.dmg * D.breathDmg }); e.lock = D.breathWarn + D.breathDur; }
  else if (pick === 'dash') { addHz(s, { k: 'line', x: e.x, y: e.y, a, r: D.dashLen, te: D.dashWarn, c: 0 }); e.lock = D.dashWarn; e.pend = 'dash'; e.dashA = a; }
  else if (pick === 'rain') {
    for (let i = 0; i < D.rainCount; i++) addHz(s, { k: 'circ', x: tx + (i ? R.range(-40, 40) : 0), y: ty + (i ? R.range(-30, 30) : 0), r: D.rainR, te: D.rainWarn + i * 0.08, d: e.dmg * D.rainDmg, c: 0 });
  } else {
    for (let i = 0; i < D.whelps; i++) spawnEnemy(s, 'whelp', e.x + R.range(-20, 20), e.y + R.range(-20, 20), false);
    banner(s, 'dragonSummons', 1);
  }
  if (pick !== 'summon') tagSince(s, n0, pick === 'breath' ? 'dBreath' : pick === 'dash' ? 'dDash' : 'dRain');
}

/* ---------- Shadow Rival ---------- */
const RIVAL_SK: RivalSkill[] = ['bolt', 'lance', 'nova', 'meteor', 'zap'];
const RIVAL_MOVE: Record<RivalSkill, BossMove> = { bolt: 'rBolt', lance: 'rLance', nova: 'rNova', meteor: 'rMeteor', zap: 'rZap' };

export function spawnRival(s: SimState): void {
  const R = s.rng.events, V = s.cfg.rival;
  const [x, y] = edgePos(s);
  const e = spawnEnemy(s, 'rival', x, y, false);
  e.hp = e.maxHp = V.hp * ipow(V.hpGrowth, s.stage - 1);
  const pool = RIVAL_SK.slice();
  e.sk = [];
  while (e.sk.length < V.skills) e.sk.push(pool.splice(R.int(pool.length), 1)[0]);
  e.rlv = 1 + Math.floor((s.stage - 1) / V.lvEvery);
  e.cds = {};
  e.sk.forEach((k, i) => { e.cds![k] = 1 + i * 0.7; });
  e.life = V.life;
  e.ang = R.next() * TAU;
  s.rivalE = e;
  say(s, e, 'arrive');
  banner(s, 'rivalAppears', 2.6, true);
  sfx(s, 'zap');
}

export function rivalAI(s: SimState, e: Enemy, dt: number, tx: number, ty: number, damp: number): void {
  const R = s.rng.ai, V = s.cfg.rival;
  e.life! -= dt;
  if (e.life! <= 0) {
    burst(s, e.x, e.y, '#8a5ad6', 30, 90, 0.7);
    e.dead = true;
    s.rivalE = null;
    say(s, e, 'escape');
    banner(s, 'rivalEscaped', 1.8);
    return;
  }
  const dx = tx - e.x, dy = ty - e.y, l = hypot(dx, dy) || 1;
  e.ang! += dt * 0.9;
  let mx = 0, my = 0;
  if (l > V.keepFar) { mx = dx / l; my = dy / l; } else if (l < V.keepNear) { mx = -dx / l; my = -dy / l; }
  mx += (-dy / l) * sin(e.ang!) * 0.8;
  my += (dx / l) * sin(e.ang!) * 0.8;
  const m = hypot(mx, my) || 1;
  const sp = e.spd * (e.slowT > 0 ? V.slow : 1) * (e.frz > 0 ? V.frozen : 1);
  e.x += (mx / m) * sp * dt + e.kx * dt;
  e.y += (my / m) * sp * dt + e.ky * dt;
  e.kx *= damp; e.ky *= damp;
  const L = e.rlv!, a = atan2(dy, dx);
  for (const k of e.sk!) {
    e.cds![k]! -= dt;
    if (e.cds![k]! > 0) continue;
    const n0 = s.hz.length;
    if (k === 'bolt') {
      const c = V.bolt, n = 1 + Math.floor(L / 2);
      for (let i = 0; i < n; i++) {
        const aa = a + (i - (n - 1) / 2) * c.spread;
        addHz(s, { k: 'proj', x: e.x, y: e.y, vx: cos(aa) * c.speed, vy: sin(aa) * c.speed, r: 3, d: e.dmg * c.dmg, life: 2, c: 1 });
      }
      e.cds![k] = Math.max(c.cdMin, c.cd - c.cdPerLv * L);
    } else if (k === 'lance') {
      const c = V.lance;
      addHz(s, { k: 'line', x: e.x, y: e.y, a, r: c.len, te: c.warn, d: e.dmg * c.dmg, c: 1, fire: true });
      e.cds![k] = Math.max(c.cdMin, c.cd - c.cdPerLv * L);
    } else if (k === 'nova') {
      const c = V.nova;
      if (l > c.range) { e.cds![k] = 0.3; continue; }
      addHz(s, { k: 'ring', x: e.x, y: e.y, r: c.r + c.rPerLv * L, du: c.dur, d: e.dmg });
      e.cds![k] = Math.max(c.cdMin, c.cd - c.cdPerLv * L);
    } else if (k === 'meteor') {
      const c = V.meteor;
      for (let i = 0; i < 2 + L; i++) addHz(s, { k: 'circ', x: tx + (i ? R.range(-35, 35) : 0), y: ty + (i ? R.range(-25, 25) : 0), r: c.r, te: c.warn + i * 0.1, d: e.dmg * c.dmg, c: 1 });
      e.cds![k] = Math.max(c.cdMin, c.cd - c.cdPerLv * L);
    } else {
      const c = V.zap;
      addHz(s, { k: 'circ', x: tx, y: ty, r: c.r, te: c.warn, d: e.dmg * c.dmg, c: 2 });
      e.cds![k] = Math.max(c.cdMin, c.cd - c.cdPerLv * L);
    }
    tagSince(s, n0, RIVAL_MOVE[k]);
  }
}

/* ---------- rewards ---------- */
export function grantShadow(s: SimState): void {
  const P = s.P;
  P.shards++;
  if (P.clone) {
    P.clone.lv++;
    banner(s, 'clonePowerUp', 2, false, { lv: P.clone.lv });
  } else if (s.rng.loot.next() < s.cfg.rival.cloneChance || P.shards >= s.cfg.rival.shards) {
    P.clone = { lv: 1, x: P.x, y: P.y };
    P.shards = 0;
    banner(s, 'shadowClone', 2.6, true);
    flash(s, 0.35, '#b07cff');
  } else banner(s, 'shadowShard', 2.4, false, { n: P.shards });
  sfx(s, 'clear');
  s.runGold += s.cfg.rival.gold;
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
  const CL = s.cfg.clone, f = Math.min(CL.dmgMax, CL.dmg + CL.dmgPerLv * (c.lv - 1));
  if (id === 'bolt') {
    const tg = nearest(s, c.x, c.y, 200);
    if (!tg) return;
    for (let i = 0; i < t.n; i++) {
      const a = atan2(tg.y - c.y, tg.x - c.x) + R.range(-0.25, 0.25);
      s.bolts.push({ kind: 'bolt', x: c.x, y: c.y - 3, vx: cos(a) * 200, vy: sin(a) * 200, life: 1.1, dmg: t.dmg * f, pierce: t.pierce, hit: new Set(), col: '#b58cff', rad: 3, kb: 25, tag: SKILL_TAGS.bolt });
    }
  } else if (id === 'lance') {
    const a0 = atan2(P.dy, P.dx);
    for (let i = 0; i < t.n; i++) {
      const a = a0 + (i - (t.n - 1) / 2) * 0.22;
      s.bolts.push({ kind: 'lance', x: c.x, y: c.y - 3, vx: cos(a) * 280, vy: sin(a) * 280, a, life: 0.9, dmg: t.dmg * f, pierce: Infinity, hit: new Set(), col: '#b58cff', rad: 4, kb: 15, tag: SKILL_TAGS.lance });
    }
  } else if (id === 'boomer') {
    const tg = nearest(s, c.x, c.y, 180);
    if (!tg) return;
    const a = atan2(tg.y - c.y, tg.x - c.x);
    s.bolts.push({ kind: 'boom', x: c.x, y: c.y - 3, vx: cos(a) * 170, vy: sin(a) * 170, spd: 170, d: 0, range: t.range, ret: false, life: 3, dmg: t.dmg * f, pierce: Infinity, hit: new Set(), col: '#b58cff', rad: 5, kb: 25, spin: 0, tag: SKILL_TAGS.boomer });
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
    for (const e of set) hit(s, e, t.dmg * f, '#d9b8ff', 20, SKILL_TAGS.chain);
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
