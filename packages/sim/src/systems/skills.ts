import { PI, TAU, atan2, cos, hypot, ipow, sin } from '../core/fmath';
import { skillStats, type SkillId, type SkillStats } from '../data/skills';
import type { Enemy, SimState } from '../types';
import { hit } from './combat';
import { cloneCast } from './events';
import { banner, burst, flash, sfx, shake } from './fx';
import { nearest, nearestN, visibleEnemies } from './query';

export const st = (s: SimState, id: SkillId, lv: number): SkillStats => skillStats(s.cfg, id, lv, !!s.P.evo[id]);

function wrapAngle(a: number): number {
  return atan2(sin(a), cos(a));
}

export function useUlt(s: SimState): void {
  const U = s.cfg.ult;
  if (s.phase !== 'play' || s.ult < U.max) return;
  s.ult = 0;
  const targets = visibleEnemies(s);
  const dmg = (U.dmgBase + U.dmgPerLv * s.P.lv) * ipow(U.dmgGrowth, s.stage - 1);
  s.effects.push({ type: 'judge', t: 0, dur: 1.0, x: s.P.x, y: s.P.y, fired: false, targets: targets.map((e) => ({ e, x: e.x, y: e.y })), dmg });
  s.slowT = U.slow;
  flash(s, 0.25, '#fff8c0');
  shake(s, 6);
  sfx(s, 'ult');
  banner(s, 'judgement', 1.1, true);
}

export function updSkills(s: SimState, dt: number): void {
  const P = s.P, sk = P.skills, R = s.rng.skills, K = s.cfg.skills;
  for (const id of Object.keys(sk) as SkillId[]) {
    const lv = sk[id]!, t = st(s, id, lv);
    if (id === 'orbit' || id === 'frost') continue;
    P.cds[id] = (P.cds[id] || 0) - dt;
    if (P.cds[id]! > 0) continue;
    if (id === 'bolt') {
      const c = K.bolt, list = nearestN(s, t.n, c.range);
      if (!list.length) { P.cds[id] = 0.1; continue; }
      for (let i = 0; i < t.n; i++) {
        const e = list[i % list.length];
        const a = atan2(e.y - P.y, e.x - P.x) + (i >= list.length ? R.range(-0.3, 0.3) : 0);
        s.bolts.push({ kind: 'bolt', x: P.x, y: P.y - 3, vx: cos(a) * c.speed, vy: sin(a) * c.speed, life: c.life, dmg: t.dmg, pierce: t.pierce, hit: new Set(), col: '#ff5cf4', rad: 3, kb: c.kb });
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
      for (const e of set) hit(s, e, t.dmg, '#fff35c', c.kb);
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
        s.bolts.push({ kind: 'lance', x: P.x, y: P.y - 3, vx: cos(a) * c.speed, vy: sin(a) * c.speed, a, life: c.life, dmg: t.dmg, pierce: Infinity, hit: new Set(), col: '#ffe9a8', rad: 4, kb: c.kb });
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
        s.bolts.push({ kind: 'boom', x: P.x, y: P.y - 3, vx: cos(a) * c.speed, vy: sin(a) * c.speed, spd: c.speed, d: 0, range: t.range, ret: false, life: 3, dmg: t.dmg, pierce: Infinity, hit: new Set(), col: '#7dffb0', rad: 5, kb: c.kb, spin: 0 });
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
    } else if (id === 'hole') {
      const vis = visibleEnemies(s);
      if (vis.length < K.hole.minTargets) { P.cds[id] = 0.3; continue; }
      let best = vis[0], bc = -1;
      for (let k = 0; k < 8; k++) {
        const c = vis[R.int(vis.length)];
        let n = 0;
        for (const e of vis) if ((e.x - c.x) * (e.x - c.x) + (e.y - c.y) * (e.y - c.y) < t.r * t.r) n++;
        if (n > bc) { bc = n; best = c; }
      }
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
          hit(s, e, t.dmg, '#7df9ff', K.orbit.kb);
          burst(s, bx, by, '#c8fdff', 3, 40, 0.25, 0.4);
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
      if (dx * dx + dy * dy < t.r * t.r) { e.slowT = K.frost.tick; if (t.freeze) e.frz = K.frost.tick; }
    }
    if (s.frostT <= 0) {
      s.frostT = K.frost.tick;
      for (const e of s.enemies) {
        if (e.dead) continue;
        const dx = e.x - P.x, dy = e.y - P.y;
        if (dx * dx + dy * dy < t.r * t.r) hit(s, e, t.dmg, '#9fd8ff', K.frost.kb);
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
        hit(s, e, bo.dmg, bo.col, bo.kb);
        burst(s, bo.x, bo.y, bo.col, 4, 50, 0.25);
        bo.pierce--;
        if (bo.pierce < 0) { bo.life = 0; break; }
      }
    }
  }
  s.bolts = s.bolts.filter((bo) => bo.life > 0);
}

export function updEffects(s: SimState, dt: number): void {
  const P = s.P, K = s.cfg.skills;
  for (const f of s.effects) {
    f.t += dt;
    if (f.type === 'nova') {
      const r = f.R! * Math.min(1, f.t / f.dur);
      for (const e of s.enemies) {
        if (e.dead || f.hit!.has(e)) continue;
        const d = hypot(e.x - f.x, e.y - f.y);
        if (d < r + e.r) { f.hit!.add(e); hit(s, e, f.dmg, '#ff8a3d', K.nova.kb); }
      }
    } else if (f.type === 'meteor') {
      if (!f.boomed && f.t >= f.delay!) {
        f.boomed = true;
        f.bt = 0;
        for (const e of s.enemies) {
          if (e.dead) continue;
          if (hypot(e.x - f.x, e.y - f.y) < f.r! + e.r) hit(s, e, f.dmg, '#ff4b3a', K.meteor.kb);
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
        if (Math.abs(da) < f.sp! + e.r / Math.max(d, 1)) { f.hit!.add(e); hit(s, e, f.dmg, '#ff8a3d', 30); }
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
        if (d < f.r! * 2.2 && !e.boss) { const k = Math.min(d, K.cyclone.pull * dt); e.x += (dx / d) * k; e.y += (dy / d) * k; }
        if (doHit && d < f.r! + e.r) hit(s, e, f.dmg, '#d8f3e0', 0);
      }
    } else if (f.type === 'toxic') {
      f.tick! -= dt;
      const doHit = f.tick! <= 0;
      if (doHit) f.tick = K.toxic.tick;
      for (const e of s.enemies) {
        if (e.dead) continue;
        const dx = f.x - e.x, dy = (f.y - e.y) * 1.4;
        if (dx * dx + dy * dy < (f.r! + e.r) * (f.r! + e.r)) { e.slowT = 0.3; if (doHit) hit(s, e, f.dmg, '#b6f24a', 0); }
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
          if (Math.abs(da) < K.laser.width + (e.r + 3) / d) { hs.add(e); hit(s, e, f.dmg, '#5cf4ff', K.laser.kb); burst(s, e.x, e.y, '#bff9ff', 3, 50, 0.3); }
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
          if (d < f.r! * 1.5 && !e.boss) { const k = Math.min(d * 0.9, K.hole.pull * dt); e.x += (dx / d) * k; e.y += (dy / d) * k; }
          if (doHit && d < f.r!) hit(s, e, f.dmg, '#b07cff', 0);
        }
        if (f.t >= f.dur - 0.3) {
          f.boomed = true;
          for (const e of s.enemies) {
            if (e.dead) continue;
            if (hypot(e.x - f.x, e.y - f.y) < f.r! * 1.1 + e.r) hit(s, e, f.boom!, '#d9b8ff', K.hole.kb);
          }
          burst(s, f.x, f.y, '#b07cff', 40, 130, 0.6);
          burst(s, f.x, f.y, '#ffffff', 16, 90, 0.4);
          shake(s, 7); flash(s, 0.15, '#b07cff', true);
          s.hitstop = Math.max(s.hitstop, 0.05);
          sfx(s, 'boom');
        }
      } else f.bt! += dt;
    } else if (f.type === 'judge') {
      if (!f.fired && f.t >= s.cfg.ult.delay) {
        f.fired = true;
        flash(s, 0.45, '#ffffff'); shake(s, 11);
        s.hitstop = 0.08;
        for (const o of f.targets!) {
          if (!o.e.dead) { o.x = o.e.x; o.y = o.e.y; hit(s, o.e, f.dmg, '#fff35c', s.cfg.ult.kb); }
          burst(s, o.x, o.y, '#fff8c0', 8, 80, 0.6);
        }
        sfx(s, 'boom');
      }
    }
  }
  s.effects = s.effects.filter((f) =>
    f.type === 'meteor' || f.type === 'hole' ? !(f.boomed && f.bt! > 0.3) : f.t < f.dur,
  );
}
