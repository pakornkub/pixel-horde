// Renderer: reads the sim's view() and client vfx; never mutates gameplay state.
import { REALMS, skillStats, type Enemy, type SimState, type SkillId, type PassiveId } from '@pixel-horde/sim';
import { b, buf, ctx, cv, screen } from '../platform/screen';
import { touch } from '../platform/input';
import { INK, HERO_SPR, ENEMY_SPR, PET_R, PET_LEFT } from './sprites';
import { tileAtT } from './tiles';
import { MET, TAU, fxRng, rnd, vfx } from './vfx';
import { lang, t } from '@pixel-horde/i18n';
import { PASSIVE_ICON, SKILL_ICON, kingName, realmShort } from '../ui/text';

const K = INK;
const R = fxRng.next;
const clamp = (v: number, a: number, c: number): number => (v < a ? a : v > c ? c : v);
let ox = 0, oy = 0;

export function fmtT(s: number): string {
  s = Math.max(0, Math.ceil(s));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function drawHz(v: Readonly<SimState>, clock: number): void {
  for (const h of v.hz) {
    const x = h.x + ox, y = h.y + oy;
    b.save();
    if (h.k === 'cone') {
      const on = h.t >= h.te!;
      b.globalAlpha = on ? 0.55 : 0.18 + 0.12 * Math.sin(clock * 20);
      b.fillStyle = on ? '#ff8a3d' : '#ff2a3a';
      b.beginPath(); b.moveTo(x, y); b.arc(x, y, h.r!, h.a! - h.sp!, h.a! + h.sp!); b.closePath(); b.fill();
      if (!on) { b.globalAlpha = 0.8; b.strokeStyle = '#ff2a3a'; b.lineWidth = 1; b.stroke(); }
    } else if (h.k === 'circ') {
      if (h.t < h.te!) {
        const k = h.t / h.te!;
        const col = h.c === 1 ? '#b07cff' : h.c === 2 ? '#fff35c' : '#ff2a3a';
        b.globalAlpha = 0.25 + 0.3 * k; b.fillStyle = col;
        b.beginPath(); b.ellipse(x, y, h.r! * k, h.r! * k * 0.6, 0, 0, TAU); b.fill();
        b.globalAlpha = 0.9; b.strokeStyle = col; b.lineWidth = 1;
        b.beginPath(); b.ellipse(x, y, h.r!, h.r! * 0.6, 0, 0, TAU); b.stroke();
        if (h.c === 2) { b.globalAlpha = 0.7; b.strokeStyle = '#fff35c'; b.beginPath(); b.moveTo(x, y); b.lineTo(x + rnd(-3, 3), 0); b.stroke(); }
        if (h.c === 0) {
          const fy = y - 120 * (1 - k);
          b.globalAlpha = 1; b.fillStyle = K; b.beginPath(); b.arc(x + 30 * (1 - k), fy, 4, 0, TAU); b.fill();
          b.fillStyle = '#ff8a3d'; b.beginPath(); b.arc(x + 30 * (1 - k), fy, 3, 0, TAU); b.fill();
        }
      } else {
        const k = (h.t - h.te!) / 0.3;
        b.globalAlpha = Math.max(0, 1 - k); b.fillStyle = '#fff3c4';
        b.beginPath(); b.ellipse(x, y, h.r! * (0.8 + k * 0.5), h.r! * (0.5 + k * 0.3), 0, 0, TAU); b.fill();
      }
    } else if (h.k === 'line') {
      b.globalAlpha = 0.35 + 0.3 * Math.sin(clock * 25);
      b.strokeStyle = h.c === 1 ? '#b07cff' : '#ff2a3a';
      b.lineWidth = h.c === 1 ? 2 : 6;
      b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(h.a!) * h.r!, y + Math.sin(h.a!) * h.r!); b.stroke();
    } else if (h.k === 'proj') {
      const col = h.c === 1 ? '#8a5ad6' : h.c === 3 ? '#d27bff' : '#ff8a3d';
      b.fillStyle = K; b.beginPath(); b.arc(x, y, h.r! + 1, 0, TAU); b.fill();
      b.fillStyle = col; b.beginPath(); b.arc(x, y, h.r!, 0, TAU); b.fill();
      b.fillStyle = '#fff'; b.fillRect(Math.round(x) - 1, Math.round(y) - 1, 1, 1);
    } else if (h.k === 'ring') {
      const r = h.r! * Math.min(1, h.t / h.du!);
      b.globalAlpha = 1 - (h.t / h.du!) * 0.6;
      b.strokeStyle = '#3a1f66'; b.lineWidth = 5; b.beginPath(); b.ellipse(x, y, r, r * 0.85, 0, 0, TAU); b.stroke();
      b.strokeStyle = '#b07cff'; b.lineWidth = 2; b.stroke();
    }
    b.restore();
  }
}

export function renderWorld(v: Readonly<SimState> | null, clock: number, hideSelf: boolean): void {
  const { LW, LH, S } = screen;
  const P = v?.P;
  const sh = vfx.shake, sx = sh ? rnd(-sh, sh) : 0, sy = sh ? rnd(-sh, sh) : 0;
  ox = Math.round(LW / 2 - (P ? P.x : 0) + sx);
  oy = Math.round(LH / 2 - (P ? P.y : 0) + sy);
  b.imageSmoothingEnabled = false;
  const ti = REALMS[v ? v.realm : 'greenvale'].theme;
  const tx0 = Math.floor(-ox / 16) - 1, ty0 = Math.floor(-oy / 16) - 1, tx1 = tx0 + Math.ceil(LW / 16) + 2, ty1 = ty0 + Math.ceil(LH / 16) + 2;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) b.drawImage(tileAtT(ti, tx, ty), tx * 16 + ox, ty * 16 + oy);
  if (v && P) {
    // frost aura
    if (P.skills.frost) {
      const s = skillStats(v.cfg, 'frost', P.skills.frost, !!P.evo.frost);
      b.save(); b.globalAlpha = 0.18 + 0.05 * Math.sin(clock * 4); b.fillStyle = '#bfe6ff';
      b.beginPath(); b.ellipse(P.x + ox, P.y + oy, s.r, s.r * 0.85, 0, 0, TAU); b.fill();
      b.globalAlpha = 0.6; b.strokeStyle = '#e6f6ff'; b.lineWidth = 1; b.setLineDash([2, 3]); b.lineDashOffset = clock * 10; b.stroke(); b.restore();
      if (R() < 0.5) { const a = R() * TAU, d = R() * s.r; vfx.fx.push({ x: P.x + Math.cos(a) * d, y: P.y + Math.sin(a) * d * 0.85, vx: 0, vy: -8, t: 0, life: 0.5, col: '#ffffff', sz: 1 }); }
    }
    // gems
    for (const g of v.gems) {
      const x = Math.round(g.x + ox), y = Math.round(g.y + oy);
      if (x < -4 || y < -4 || x > LW + 4 || y > LH + 4) continue;
      if (g.kind === 'xp') {
        const c = g.v >= 20 ? '#ff5cf4' : g.v >= 5 ? '#ffd23f' : '#4fc3ff';
        b.fillStyle = K; b.fillRect(x - 2, y - 3, 4, 6); b.fillRect(x - 3, y - 2, 6, 4);
        b.fillStyle = c; b.fillRect(x - 1, y - 2, 2, 4); b.fillRect(x - 2, y - 1, 4, 2); b.fillStyle = '#fff'; b.fillRect(x - 1, y - 2, 1, 1);
      } else if (g.kind === 'coin') {
        const big = g.v >= 5;
        b.fillStyle = K; b.fillRect(x - 2, y - 3, 4, 6); b.fillRect(x - 3, y - 2, 6, 4);
        b.fillStyle = big ? '#ffb300' : '#ffd23f'; b.fillRect(x - 2, y - 2, 4, 4); b.fillStyle = '#fff8c0'; b.fillRect(x - 1, y - 2, 1, 2);
      } else if (g.kind === 'chest') {
        const bob = Math.round(Math.sin(clock * 5));
        b.fillStyle = K; b.fillRect(x - 7, y - 6 + bob, 14, 11); b.fillStyle = '#9a5a2a'; b.fillRect(x - 6, y - 5 + bob, 12, 9);
        b.fillStyle = '#c77d3a'; b.fillRect(x - 6, y - 5 + bob, 12, 3);
        b.fillStyle = '#ffd23f'; b.fillRect(x - 6, y - 2 + bob, 12, 1); b.fillRect(x - 1, y - 3 + bob, 2, 3);
        if (Math.floor(clock * 6) % 3 === 0) { b.fillStyle = '#fff'; b.fillRect(x + 4, y - 8 + bob, 1, 1); }
      } else {
        b.fillStyle = K; b.fillRect(x - 4, y - 3, 8, 6); b.fillStyle = '#ff4b5c';
        b.fillRect(x - 3, y - 3, 2, 1); b.fillRect(x + 1, y - 3, 2, 1); b.fillRect(x - 3, y - 2, 6, 2); b.fillRect(x - 2, y, 4, 1); b.fillRect(x - 1, y + 1, 2, 1);
      }
    }
    // meteor shadows
    for (const f of v.effects) {
      if (f.type === 'meteor' && !f.boomed) {
        const k = f.t / f.delay!;
        b.fillStyle = 'rgba(30,27,51,' + (0.2 + 0.3 * k) + ')'; b.beginPath(); b.ellipse(f.x + ox, f.y + oy, f.r! * k, f.r! * k * 0.5, 0, 0, TAU); b.fill();
        b.strokeStyle = '#ff4b3a'; b.lineWidth = 1; b.beginPath(); b.ellipse(f.x + ox, f.y + oy, f.r!, f.r! * 0.5, 0, 0, TAU); b.stroke();
      }
    }
    drawHz(v, clock);
    // entities sorted by y
    const ents: (Enemy | null)[] = v.enemies.slice();
    ents.push(null); // null = the player
    ents.sort((a, c) => (a ? a.y : P.y) - (c ? c.y : P.y));
    for (const e of ents) {
      if (!e) {
        if (hideSelf) continue;
        const CS2 = HERO_SPR[P.ch] || HERO_SPR.mage;
        if (P.down) { b.globalAlpha = 0.35; b.drawImage(CS2.w, Math.round(P.x + ox - 8), Math.round(P.y + oy - 9)); b.globalAlpha = 1; continue; }
        const fr = P.moving ? Math.floor(P.anim * 8) & 1 : 0;
        const img = P.inv > 0 && Math.floor(clock * 20) & 1 ? CS2.w : P.face < 0 ? CS2.l[fr] : CS2.r[fr];
        const bob = P.moving ? (fr ? -1 : 0) : 0;
        b.fillStyle = 'rgba(30,27,51,.35)'; b.beginPath(); b.ellipse(P.x + ox, P.y + oy + 7, 5, 2, 0, 0, TAU); b.fill();
        if (P.clone) { const c = P.clone, dk = P.face < 0 ? CS2.dkl : CS2.dk; b.globalAlpha = 0.75; b.drawImage(dk[fr], Math.round(c.x + ox - 8), Math.round(c.y + oy - 9)); b.globalAlpha = 1; }
        b.drawImage(img, Math.round(P.x + ox - 8), Math.round(P.y + oy - 9 + bob));
        if (P.pet) {
          const pt = P.pet;
          b.fillStyle = 'rgba(30,27,51,.25)'; b.beginPath(); b.ellipse(pt.x + ox, pt.y + oy + 14, 4, 1.5, 0, 0, TAU); b.fill();
          b.drawImage(Math.cos(clock * 1.3) < 0 ? PET_LEFT : PET_R, Math.round(pt.x + ox - 6), Math.round(pt.y + oy - 5 + (Math.floor(clock * 6) & 1)));
        }
        continue;
      }
      const frames = ENEMY_SPR[e.type], sp = frames[Math.floor(e.ph / 2) % frames.length];
      const im = e.flash > 0 ? sp.w : e.frz > 0 ? sp.i : e.armor ? sp.a : e.elite ? sp.e : sp.n;
      const w = im.width * e.sc, h = im.height * e.sc, x = Math.round(e.x + ox - w / 2);
      const y = Math.round(e.y + oy - h / 2 + (e.type === 'bat' ? 0 : Math.sin(e.ph * 0.5) * (e.sc > 1 ? 1 : 0.5)));
      if (x < -w || y < -h || x > LW + w || y > LH + h) continue;
      b.fillStyle = 'rgba(30,27,51,.3)'; b.beginPath(); b.ellipse(e.x + ox, e.y + oy + h / 2, w * 0.35, Math.max(1.5, h * 0.12), 0, 0, TAU); b.fill();
      if (e.type === 'ghost') b.globalAlpha = 0.85;
      b.drawImage(im, x, y, w, h);
      b.globalAlpha = 1;
      if (e.slowT > 0) { b.fillStyle = 'rgba(159,216,255,.45)'; b.fillRect(x, y + h - 3, w, 3); }
      if (e.armor) {
        b.fillStyle = K; b.fillRect(Math.round(e.x + ox) - 3, y - 6, 6, 6);
        b.fillStyle = '#c7ced9'; b.fillRect(Math.round(e.x + ox) - 2, y - 5, 4, 3); b.fillRect(Math.round(e.x + ox) - 1, y - 2, 2, 1);
      }
      if (e.elite) { b.fillStyle = K; b.fillRect(x, y - 4, w, 3); b.fillStyle = '#ff4b5c'; b.fillRect(x + 1, y - 3, Math.max(0, ((w - 2) * e.hp) / e.maxHp), 1); }
    }
    // orbit blades
    if (P.skills.orbit && v.phase !== 'over') {
      const s = skillStats(v.cfg, 'orbit', P.skills.orbit, !!P.evo.orbit);
      for (let i = 0; i < s.n; i++) {
        const a = P.orbitA + (i * TAU) / s.n, x = P.x + ox + Math.cos(a) * s.r, y = P.y + oy + Math.sin(a) * s.r * 0.8;
        b.save(); b.translate(Math.round(x), Math.round(y)); b.rotate(a + Math.PI / 2 + clock * 6);
        b.fillStyle = K; b.fillRect(-2, -6, 4, 12); b.fillStyle = '#7df9ff'; b.fillRect(-1, -5, 2, 8);
        b.fillStyle = '#ffffff'; b.fillRect(-1, -5, 1, 4); b.fillStyle = '#ffd23f'; b.fillRect(-2, 3, 4, 1); b.restore();
      }
    }
    // bolts
    for (const bo of v.bolts) {
      const x = Math.round(bo.x + ox), y = Math.round(bo.y + oy);
      if (bo.kind === 'lance') {
        b.save(); b.translate(x, y); b.rotate(bo.a!);
        b.fillStyle = K; b.fillRect(-9, -2, 19, 4); b.fillStyle = '#ffd23f'; b.fillRect(-8, -1, 14, 2);
        b.fillStyle = '#ffffff'; b.fillRect(2, -1, 7, 2); b.fillStyle = '#fff8c0'; b.fillRect(6, -2, 3, 4); b.restore();
        continue;
      }
      if (bo.kind === 'boom') {
        b.save(); b.translate(x, y); b.rotate(bo.spin!);
        b.fillStyle = K; b.beginPath(); b.arc(0, 0, 5, 0, TAU); b.fill(); b.fillStyle = '#7dffb0'; b.beginPath(); b.arc(0, 0, 4, 0, TAU); b.fill();
        b.fillStyle = '#ffffff'; b.fillRect(-4, -1, 8, 2); b.fillRect(-1, -4, 2, 8); b.fillStyle = K; b.fillRect(-1, -1, 2, 2); b.restore();
        continue;
      }
      b.fillStyle = K; b.fillRect(x - 3, y - 2, 6, 4); b.fillRect(x - 2, y - 3, 4, 6);
      b.fillStyle = '#ff5cf4'; b.fillRect(x - 2, y - 1, 4, 2); b.fillRect(x - 1, y - 2, 2, 4); b.fillStyle = '#fff'; b.fillRect(x - 1, y - 1, 2, 2);
    }
    // effects
    for (const f of v.effects) {
      if (f.type === 'nova') {
        const k = Math.min(1, f.t / f.dur), r = f.R! * k;
        b.save(); b.globalAlpha = 1 - k * 0.7;
        b.strokeStyle = '#ff4b3a'; b.lineWidth = 6; b.beginPath(); b.ellipse(f.x + ox, f.y + oy, r, r * 0.85, 0, 0, TAU); b.stroke();
        b.strokeStyle = '#ffd23f'; b.lineWidth = 3; b.stroke(); b.strokeStyle = '#fff'; b.lineWidth = 1; b.stroke(); b.restore();
        if (R() < 0.8) { const a = R() * TAU; vfx.fx.push({ x: f.x + Math.cos(a) * r, y: f.y + Math.sin(a) * r * 0.85, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30 - 10, t: 0, life: 0.3, col: R() < 0.5 ? '#ffd23f' : '#ff8a3d', sz: 1 }); }
      } else if (f.type === 'chain') {
        b.save(); b.globalAlpha = 1 - f.t / f.dur;
        b.beginPath();
        const pts = f.pts!;
        for (let i = 0; i < pts.length - 1; i++) {
          const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
          b.moveTo(x0 + ox, y0 + oy);
          for (let s = 1; s <= 4; s++) { const k = s / 4; b.lineTo(x0 + (x1 - x0) * k + ox + (s < 4 ? rnd(-4, 4) : 0), y0 + (y1 - y0) * k + oy + (s < 4 ? rnd(-4, 4) : 0)); }
        }
        b.strokeStyle = '#ffd23f'; b.lineWidth = 3; b.stroke(); b.strokeStyle = '#ffffff'; b.lineWidth = 1; b.stroke(); b.restore();
      } else if (f.type === 'meteor') {
        if (!f.boomed) {
          const k = f.t / f.delay!, x = f.x + ox + 60 * (1 - k), y = f.y + oy - 150 * (1 - k);
          b.fillStyle = 'rgba(255,138,61,.5)';
          for (let i = 1; i < 5; i++) b.fillRect(Math.round(x + i * 4 - 2), Math.round(y - i * 10 - 2), 4 - (i > 2 ? 1 : 0), 4);
          b.fillStyle = K; b.beginPath(); b.arc(x, y, 5, 0, TAU); b.fill(); b.fillStyle = '#ff4b3a'; b.beginPath(); b.arc(x, y, 4, 0, TAU); b.fill();
          b.fillStyle = '#ffd23f'; b.beginPath(); b.arc(x - 1, y - 1, 2, 0, TAU); b.fill();
        } else {
          const k = f.bt! / 0.3;
          b.save(); b.globalAlpha = Math.max(0, 1 - k); b.fillStyle = '#fff3c4';
          b.beginPath(); b.ellipse(f.x + ox, f.y + oy, f.r! * (0.6 + k * 0.6), f.r! * (0.5 + k * 0.5), 0, 0, TAU); b.fill();
          b.strokeStyle = '#ff4b3a'; b.lineWidth = 3; b.stroke(); b.restore();
        }
      } else if (f.type === 'cyclone') {
        const fade = Math.min(1, (f.dur - f.t) * 3);
        b.save(); b.globalAlpha = 0.85 * Math.max(0, fade);
        for (let i = 0; i < 5; i++) {
          const rr = f.r! * (0.35 + i * 0.18), yy = f.y + oy - i * 4 + 2;
          b.strokeStyle = i % 2 ? '#ffffff' : '#a9e38a'; b.lineWidth = 2; b.setLineDash([4, 3]); b.lineDashOffset = -clock * 60 * (i % 2 ? 1 : -1);
          b.beginPath(); b.ellipse(f.x + ox + Math.sin(clock * 9 + i) * 2, yy, rr, rr * 0.35, 0, 0, TAU); b.stroke();
        }
        b.restore();
      } else if (f.type === 'toxic') {
        const fade = Math.max(0, Math.min(1, (f.dur - f.t) * 2, f.t * 6));
        b.save(); b.globalAlpha = 0.5 * fade; b.fillStyle = '#7fcf2a'; b.beginPath(); b.ellipse(f.x + ox, f.y + oy, f.r!, f.r! * 0.6, 0, 0, TAU); b.fill();
        b.globalAlpha = 0.9 * fade; b.strokeStyle = '#3e7d1a'; b.lineWidth = 1; b.stroke(); b.fillStyle = '#d9ff8a';
        for (let i = 0; i < 4; i++) { const a = i * 1.9 + f.x, ph = (clock * 1.5 + i * 0.37) % 1; b.fillRect(Math.round(f.x + ox + Math.cos(a) * f.r! * 0.5), Math.round(f.y + oy + Math.sin(a) * f.r! * 0.3 - ph * 4), 2, 2); }
        b.restore();
      } else if (f.type === 'laser') {
        for (const ang of f.twin ? [f.a!, f.a! + Math.PI] : [f.a!]) {
          const ex = P.x + ox + Math.cos(ang) * f.len!, ey = P.y + oy - 4 + Math.sin(ang) * f.len!;
          b.save();
          for (let j = 3; j >= 1; j--) {
            const a2 = ang - j * 0.12; b.globalAlpha = 0.12 * (4 - j); b.strokeStyle = '#5cf4ff'; b.lineWidth = 4;
            b.beginPath(); b.moveTo(P.x + ox, P.y + oy - 4); b.lineTo(P.x + ox + Math.cos(a2) * f.len!, P.y + oy - 4 + Math.sin(a2) * f.len!); b.stroke();
          }
          b.globalAlpha = 1; b.lineCap = 'round'; b.strokeStyle = K; b.lineWidth = 8; b.beginPath(); b.moveTo(P.x + ox, P.y + oy - 4); b.lineTo(ex, ey); b.stroke();
          b.strokeStyle = '#ff5cf4'; b.lineWidth = 6; b.stroke(); b.strokeStyle = '#5cf4ff'; b.lineWidth = 4; b.stroke(); b.strokeStyle = '#ffffff'; b.lineWidth = 2; b.stroke();
          b.fillStyle = '#ffffff'; b.beginPath(); b.arc(ex, ey, 4 + Math.sin(clock * 40), 0, TAU); b.fill(); b.restore();
        }
      } else if (f.type === 'hole') {
        b.save();
        if (!f.boomed) {
          const g = Math.min(1, f.t / 0.3);
          b.globalAlpha = 0.35; b.fillStyle = '#3a1f66'; b.beginPath(); b.ellipse(f.x + ox, f.y + oy, f.r! * g, f.r! * g * 0.8, 0, 0, TAU); b.fill();
          b.globalAlpha = 1; b.strokeStyle = '#b07cff'; b.lineWidth = 2; b.setLineDash([3, 4]); b.lineDashOffset = clock * 40;
          b.beginPath(); b.ellipse(f.x + ox, f.y + oy, f.r! * g * 0.6, f.r! * g * 0.48, 0, 0, TAU); b.stroke();
          b.setLineDash([]); b.fillStyle = K; b.beginPath(); b.arc(f.x + ox, f.y + oy, 4 + g * 4, 0, TAU); b.fill(); b.strokeStyle = '#ffffff'; b.lineWidth = 1; b.stroke();
        } else {
          const k = f.bt! / 0.3;
          b.globalAlpha = Math.max(0, 1 - k); b.fillStyle = '#e9d9ff'; b.beginPath(); b.ellipse(f.x + ox, f.y + oy, f.r! * (0.8 + k * 0.7), f.r! * (0.65 + k * 0.55), 0, 0, TAU); b.fill();
          b.strokeStyle = '#b07cff'; b.lineWidth = 4; b.stroke();
        }
        b.restore();
      } else if (f.type === 'shadowpass') {
        const k = f.t / f.dur;
        b.save(); b.globalAlpha = 0.35 * Math.sin(Math.PI * k); b.fillStyle = '#1e1b33';
        b.beginPath(); b.ellipse(-60 + (LW + 120) * k, LH * 0.4 + Math.sin(k * 6) * 10, 70, 26, -0.2, 0, TAU); b.fill(); b.restore();
      } else if (f.type === 'judge') {
        if (!f.fired) {
          b.save(); b.globalAlpha = 0.5; b.strokeStyle = '#fff35c'; b.lineWidth = 2;
          const r = (1 - f.t / 0.3) * LW * 0.6 + 8;
          b.beginPath(); b.ellipse(P.x + ox, P.y + oy, r, r * 0.85, 0, 0, TAU); b.stroke(); b.restore();
          for (const o of f.targets!) { b.fillStyle = 'rgba(255,243,92,.8)'; b.fillRect(Math.round(o.x + ox) - 1, 0, 2, Math.round(o.y + oy)); }
        } else {
          b.save(); b.globalAlpha = Math.max(0, 1 - (f.t - 0.3) / 0.7);
          for (const o of f.targets!) {
            const x = Math.round(o.x + ox), y = Math.round(o.y + oy);
            b.fillStyle = '#ffd23f'; b.fillRect(x - 5, 0, 10, y); b.fillStyle = '#fff8c0'; b.fillRect(x - 3, 0, 6, y); b.fillStyle = '#fff'; b.fillRect(x - 1, 0, 2, y);
            b.fillStyle = '#fff8c0'; b.beginPath(); b.ellipse(x, y, 9, 4, 0, 0, TAU); b.fill();
          }
          b.restore();
        }
      }
    }
    if (v.specialStage) { b.fillStyle = 'rgba(200,20,40,0.14)'; b.fillRect(0, 0, LW, LH); }
    // particles
    for (const p of vfx.fx) { b.globalAlpha = Math.max(0, 1 - p.t / p.life); b.fillStyle = p.col; b.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), p.sz, p.sz); }
    b.globalAlpha = 1;
  }
  // blit
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(buf, 0, 0, LW * S, LH * S);
  if (vfx.flash > 0) { ctx.globalAlpha = Math.min(0.75, vfx.flash * 1.8); ctx.fillStyle = vfx.flashCol; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalAlpha = 1; }
}

function font(px: number): string {
  return `${Math.round(px)}px "Press Start 2P", ui-monospace, monospace`;
}
function outlined(txt: string, x: number, y: number, px: number, col: string, lw?: number): void {
  ctx.font = font(px); ctx.lineJoin = 'round'; ctx.lineWidth = lw || Math.max(2, px * 0.28);
  ctx.strokeStyle = INK; ctx.strokeText(txt, x, y); ctx.fillStyle = col; ctx.fillText(txt, x, y);
}
function thaiText(txt: string, x: number, y: number, px: number, col: string, lw: number): void {
  ctx.font = lang() === 'en' ? `${Math.round(px * 0.8)}px "Press Start 2P", ui-monospace, monospace` : `700 ${Math.round(px)}px "Chakra Petch", Tahoma, sans-serif`;
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.strokeText(txt, x, y); ctx.fillStyle = col; ctx.fillText(txt, x, y);
}

export function drawTexts(clock: number): void {
  const { CS, DPR, S } = screen;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const base = CS * DPR;
  for (const t of vfx.texts) {
    const k = t.t / t.life, pop = 1 + (t.cr ? 1.1 : 0.6) * Math.max(0, 1 - t.t / 0.12);
    let px = (t.cr ? 4.4 : 2.9) * base;
    if (typeof t.v === 'number' && t.v >= 1000) px *= 1.2;
    if (typeof t.v === 'number' && t.v >= 10000) px *= 1.15;
    px *= pop;
    ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    const x = (t.x + ox) * S, y = (t.y + oy) * S;
    const txt = t.cr ? t.v + '!' : String(t.v);
    outlined(txt, x, y, px, t.cr && !t.hurt ? (Math.floor(clock * 16) & 1 ? '#ffd23f' : '#ff7a3d') : t.col);
  }
  ctx.globalAlpha = 1;
}

function bar(x: number, y: number, w: number, h: number, val: number, col: string, bg?: string): void {
  const D = screen.DPR;
  ctx.fillStyle = INK; ctx.fillRect(x - 2 * D, y - 2 * D, w + 4 * D, h + 4 * D);
  ctx.fillStyle = bg || '#3a3363'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(val, 0, 1), h);
}

export function drawHud(v: Readonly<SimState>, clock: number, runGoldShown: number): void {
  const { DPR: D, VW, SAFE } = screen;
  const P = v.P, W = cv.width, top = SAFE.t * D, left = (SAFE.l + 12) * D, right = W - (SAFE.r + 12) * D;
  ctx.textBaseline = 'top';
  bar(0 + 2 * D, top + 2 * D, W - 4 * D, 7 * D, P.xp / P.need, '#4fc3ff');
  ctx.textAlign = 'left';
  outlined('LV ' + P.lv, left, top + 18 * D, 11 * D, '#ffffff');
  const hw = Math.min(150, VW * 0.32) * D;
  bar(left, top + 36 * D, hw, 10 * D, P.hp / P.maxHp, '#e8434f');
  outlined(Math.ceil(P.hp) + '/' + P.maxHp, left, top + 52 * D, 8 * D, '#ffd9de');
  ctx.textAlign = 'center';
  if (v.overtime) {
    const otLeft = v.stageDur + v.cfg.stage.overtime - v.stageTime;
    const umbra = v.boss?.type === 'umbra'; // Umbra never escapes: no countdown
    outlined(t('hud.overtime') + (umbra ? '' : ' ' + fmtT(Math.max(0, otLeft))), W / 2, top + 18 * D, 16 * D, Math.floor(clock * 4) & 1 ? '#ff4b5c' : '#ffb347');
  } else {
    const rem = v.stageDur - v.stageTime;
    outlined(fmtT(rem), W / 2, top + 18 * D, 20 * D, rem <= 10 && v.phase === 'play' ? (Math.floor(clock * 4) & 1 ? '#ff4b5c' : '#ffffff') : '#ffffff');
  }
  outlined(t('hud.chapter', { n: v.stage, realm: realmShort(v.realm).toUpperCase() }), W / 2, top + 44 * D, 9 * D, '#ffd23f');
  ctx.textAlign = 'right';
  outlined('KO ' + v.kills, right, top + 18 * D, 11 * D, '#ffffff');
  outlined(runGoldShown + ' G', right, top + 36 * D, 10 * D, '#ffd23f');
  if (v.streak >= 10) {
    const pulse = 1 + 0.25 * Math.max(0, 1 - (2.2 - v.streakT) / 0.15);
    const c = v.streak >= 200 ? '#ff5cf4' : v.streak >= 100 ? '#ff7a3d' : v.streak >= 50 ? '#ffd23f' : '#ffffff';
    outlined(t('hud.streak', { n: v.streak }), right, top + 54 * D, 11 * D * pulse * (v.streak >= 100 ? 1.25 : 1), c);
  }
  // boss bars
  {
    let yy = top + 62 * D;
    const bw = Math.min(300, VW * 0.6) * D;
    ctx.textAlign = 'center';
    const bars: [Enemy | null, string, string, string][] = [
      [v.boss, kingName(v.realm), v.overtime ? '#ff4b5c' : '#4fa8ff', '#8fdcff'],
      [v.dragonE, 'INFERNO DRAGON', '#ff6a2a', '#ffb347'],
      [v.rivalE, 'SHADOW ???', '#8a5ad6', '#d9b8ff'],
    ];
    for (const [e, nm, col, lc] of bars) {
      if (!e || e.dead) continue;
      outlined(e === v.rivalE && e.life != null ? nm + '  ' + Math.ceil(e.life) + 's' : nm, W / 2, yy, 8 * D, lc);
      bar(W / 2 - bw / 2, yy + 14 * D, bw, 7 * D, e.hp / e.maxHp, col);
      yy += 30 * D;
    }
  }
  // skills row
  const ids: string[] = [...Object.keys(P.skills), ...Object.keys(P.pas)];
  if (P.pet) ids.push('_pet');
  if (P.clone) ids.push('_clone');
  const sz = 24 * D, gap = 5 * D, by = cv.height - (SAFE.b + 14) * D - sz;
  ids.forEach((id, i) => {
    const sk = SKILL_ICON[id as SkillId], ps = PASSIVE_ICON[id as PassiveId];
    const m = sk || ps || (id === '_pet' ? { col: '#ff6a2a', g: 'D' } : { col: '#6a4a9a', g: 'S' });
    const lv = P.skills[id as SkillId] || P.pas[id as PassiveId] || (id === '_pet' ? P.pet!.lv : id === '_clone' ? P.clone!.lv : 1);
    const x = left + i * (sz + gap);
    if (x + sz > W - 100 * D) return;
    const gold = P.evo[id as SkillId] || id[0] === '_';
    ctx.fillStyle = gold ? '#ffd23f' : INK; ctx.fillRect(x - 2 * D, by - 2 * D, sz + 4 * D, sz + 4 * D);
    if (gold) { ctx.fillStyle = INK; ctx.fillRect(x - 1 * D, by - 1 * D, sz + 2 * D, sz + 2 * D); }
    ctx.fillStyle = m.col; ctx.fillRect(x, by, sz, sz);
    const cdv = P.cds[id as SkillId];
    if (sk && cdv! > 0 && id !== 'orbit' && id !== 'frost') {
      const s = skillStats(v.cfg, id as SkillId, lv, !!P.evo[id as SkillId]);
      ctx.fillStyle = 'rgba(30,27,51,.45)'; ctx.fillRect(x, by, sz, sz * clamp(cdv! / (s.cd * P.cdMul), 0, 1));
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.font = font(10 * D); ctx.fillText(m.g, x + sz / 2, by + sz / 2);
    ctx.textBaseline = 'top'; outlined(String(lv), x + sz - 2 * D, by - 6 * D, 7 * D, '#ffffff'); ctx.textBaseline = 'top';
  });
  // banner
  const bn = vfx.banner;
  if (bn) {
    const k = bn.t;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const px = (bn.big ? 26 : 18) * D * Math.min(1.4, 1 + Math.max(0, bn.t - (bn.big ? 0.9 : 1.2)) * 1.5);
    ctx.globalAlpha = Math.min(1, k * 2.5);
    outlined(bn.txt, W / 2, cv.height * 0.34, px, bn.big ? '#fff35c' : '#ffffff', px * 0.3);
    if (bn.sub) thaiText(bn.sub, W / 2, cv.height * 0.34 + 26 * D, 13 * D, '#ffd23f', 4 * D);
    ctx.globalAlpha = 1; ctx.textBaseline = 'top';
  }
  // stats meter
  if (MET.on) {
    const now = v.clock;
    while (MET.dmg.length && now - MET.dmg[0][0] > 5) MET.dmg.shift();
    const dps = Math.round(MET.dmg.reduce((a, r) => a + r[1], 0) / 5);
    const ttk = MET.ttk.length ? MET.ttk.reduce((a, x) => a + x, 0) / MET.ttk.length : 0;
    const prog = clamp(v.stageTime / v.stageDur, 0, 1);
    const hm = Math.pow(1.5, v.stage - 1) * (1 + 0.7 * prog) * (1 + 0.08 * (P.lv - 1)) * (0.85 + 0.15 * v.dir.v);
    const lines = [`DPS ${dps}`, `TTK ${ttk.toFixed(1)}s`, `DMG x${P.dmgMul.toFixed(2)}`, `CD -${Math.round(P.cdRed * 100)}%`, `CRIT ${Math.round(P.crit * 100)}% x${P.critMul.toFixed(1)}`,
      `MOB HP x${hm.toFixed(1)}`, `DIRECTOR x${v.dir.v.toFixed(2)}`, `MOBS ${v.enemies.length}`];
    const px = 8 * D, lh = 13 * D, bx = left, by2 = top + 84 * D, bw = 150 * D;
    ctx.fillStyle = 'rgba(30,27,51,.72)'; ctx.fillRect(bx - 6 * D, by2 - 6 * D, bw, lines.length * lh + 10 * D);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = font(px); ctx.fillStyle = '#e9f1ff';
    lines.forEach((l, i) => ctx.fillText(l, bx, by2 + i * lh));
  }
  // joystick
  const joy = touch.joy;
  if (joy && joy.act) {
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(joy.ox * D, joy.oy * D, 40 * D, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.7;
    const dx = joy.cx - joy.ox, dy = joy.cy - joy.oy, l = Math.hypot(dx, dy), m = Math.min(l, 40) / (l || 1);
    ctx.beginPath(); ctx.arc((joy.ox + dx * m) * D, (joy.oy + dy * m) * D, 18 * D, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  const ub = document.getElementById('ultBtn')!;
  ub.style.setProperty('--p', (v.ult / v.cfg.ult.max) * 100 + '%');
  ub.classList.toggle('ready', v.ult >= v.cfg.ult.max);
}
