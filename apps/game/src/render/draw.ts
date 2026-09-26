// Renderer: reads the sim's view() and client vfx; never mutates gameplay state.
import { REALMS, WEAPONS, benchSize, signatureOf, skillStats, type Enemy, type SimState, type SkillId, type PassiveId } from '@pixel-horde/sim';
import { b, buf, ctx, cv, screen } from '../platform/screen';
import { touch } from '../platform/input';
import { INK, HERO_SPR, ENEMY_SPR, HELD_SPR, PET_SPR } from './sprites';
import { tileAtT } from './tiles';
import { MET, TAU, fxRng, rnd, vfx, zoomK } from './vfx';
import { lang, t } from '@pixel-horde/i18n';
import { PASSIVE_ICON, SKILL_ICON, kingName, realmShort } from '../ui/text';
import { iconAtlas, iconRect } from '../ui/icons';

const K = INK;
const R = fxRng.next;
const clamp = (v: number, a: number, c: number): number => (v < a ? a : v > c ? c : v);
let ox = 0, oy = 0;
/** World (low-res buffer) → hi-res canvas, following the zoom moment around the screen centre. */
function toScreen(x: number, y: number): [number, number] {
  const { S } = screen, z = zoomK(), W = cv.width, H = cv.height;
  return [W / 2 + ((x + ox) * S - W / 2) * z, H / 2 + ((y + oy) * S - H / 2) * z];
}

export function fmtT(s: number): string {
  s = Math.max(0, Math.ceil(s));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/** Hazard colour codes: 0 fire, 1 shadow, 2 lightning/sand, 3 slime, 4 bone, 5 ice. */
const HZ_COL: Record<number, string> = { 0: '#ff2a3a', 1: '#b07cff', 2: '#fff35c', 3: '#8fce6a', 4: '#f4f0e0', 5: '#9fd8ff' };

/** King moves are always drawn in this red so they stand out from everything else. */
const KING_RED = '#ff2a3a';

function drawHz(v: Readonly<SimState>, clock: number): void {
  for (const h of v.hz) {
    const x = h.x + ox, y = h.y + oy, king = !!h.bm;
    b.save();
    if (h.k === 'cone') {
      const on = h.t >= h.te!;
      const cc = king ? KING_RED : h.c ? HZ_COL[h.c] : null; // poison / water cones (Bog Queen, Tide Queen)
      b.globalAlpha = on ? 0.55 : 0.18 + 0.12 * Math.sin(clock * 20);
      b.fillStyle = on ? cc ?? '#ff8a3d' : cc ?? '#ff2a3a';
      b.beginPath(); b.moveTo(x, y); b.arc(x, y, h.r!, h.a! - h.sp!, h.a! + h.sp!); b.closePath(); b.fill();
      if (!on) { b.globalAlpha = 0.8; b.strokeStyle = '#ff2a3a'; b.lineWidth = 1; b.stroke(); }
    } else if (h.k === 'circ') {
      if (h.t < h.te!) {
        const k = h.t / h.te!;
        const col = king ? KING_RED : HZ_COL[h.c ?? 0] || '#ff2a3a';
        if (king) { b.globalAlpha = 0.16 + 0.1 * Math.sin(clock * 18); b.fillStyle = KING_RED; b.beginPath(); b.ellipse(x, y, h.r!, h.r! * 0.6, 0, 0, TAU); b.fill(); }
        b.globalAlpha = 0.25 + 0.3 * k; b.fillStyle = col;
        b.beginPath(); b.ellipse(x, y, h.r! * k, h.r! * k * 0.6, 0, 0, TAU); b.fill();
        b.globalAlpha = 0.9; b.strokeStyle = col; b.lineWidth = king ? 2 : 1;
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
      b.strokeStyle = king ? KING_RED : h.c ? HZ_COL[h.c] : '#ff2a3a';
      b.lineWidth = king ? 3 : h.c ? 2 : 6;
      b.beginPath(); b.moveTo(x, y); b.lineTo(x + Math.cos(h.a!) * h.r!, y + Math.sin(h.a!) * h.r!); b.stroke();
    } else if (h.k === 'proj') {
      const col = king ? '#ff4b5c' : h.c === 1 ? '#8a5ad6' : h.c === 3 ? '#d27bff' : h.c === 4 ? '#f4f0e0' : h.c === 5 ? '#bfe6ff' : '#ff8a3d';
      b.fillStyle = K; b.beginPath(); b.arc(x, y, h.r! + 1, 0, TAU); b.fill();
      b.fillStyle = col; b.beginPath(); b.arc(x, y, h.r!, 0, TAU); b.fill();
      b.fillStyle = '#fff'; b.fillRect(Math.round(x) - 1, Math.round(y) - 1, 1, 1);
    } else if (h.k === 'ring') {
      const r = h.r! * Math.min(1, h.t / h.du!);
      b.globalAlpha = 1 - (h.t / h.du!) * 0.6;
      b.strokeStyle = '#3a1f66'; b.lineWidth = 5; b.beginPath(); b.ellipse(x, y, r, r * 0.85, 0, 0, TAU); b.stroke();
      b.strokeStyle = king ? KING_RED : h.c === 3 ? '#8fce6a' : h.c === 0 ? '#ff8a3d' : h.c === 5 ? '#9fd8ff' : '#b07cff'; b.lineWidth = king ? 3 : 2; b.stroke();
    } else if (h.k === 'beam') {
      const ex = x + Math.cos(h.a!) * h.r!, ey = y + Math.sin(h.a!) * h.r!;
      b.lineCap = 'round';
      if (h.t < h.te!) {
        b.globalAlpha = 0.18 + 0.12 * Math.sin(clock * 20); b.strokeStyle = '#ff2a3a'; b.lineWidth = h.w! * 2;
        b.beginPath(); b.moveTo(x, y); b.lineTo(ex, ey); b.stroke();
        b.globalAlpha = 0.8; b.lineWidth = 1; b.stroke();
      } else {
        b.globalAlpha = Math.max(0, 1 - (h.t - h.te!) / 0.3); b.strokeStyle = king ? KING_RED : HZ_COL[h.c ?? 2]; b.lineWidth = h.w! * 2;
        b.beginPath(); b.moveTo(x, y); b.lineTo(ex, ey); b.stroke();
      }
    } else if (h.k === 'pull') {
      const on = h.t >= h.te!;
      b.globalAlpha = on ? 0.35 : 0.15 + 0.1 * Math.sin(clock * 20);
      b.fillStyle = king && !on ? KING_RED : '#b88a45'; b.beginPath(); b.ellipse(x, y, h.r!, h.r! * 0.6, 0, 0, TAU); b.fill();
      b.globalAlpha = 0.9; b.strokeStyle = on ? '#7a5a2a' : '#ff2a3a'; b.lineWidth = 1; b.setLineDash([3, 3]); b.lineDashOffset = -clock * 20; b.stroke(); b.setLineDash([]);
      b.fillStyle = '#5a3f1a'; b.beginPath(); b.ellipse(x, y, h.w!, h.w! * 0.6, 0, 0, TAU); b.fill();
    } else if (h.k === 'ice') {
      const on = h.t >= h.te!;
      b.globalAlpha = on ? 0.45 : 0.2 + 0.1 * Math.sin(clock * 20);
      b.fillStyle = on ? '#dff4ff' : '#ff2a3a'; b.beginPath(); b.ellipse(x, y, h.r!, h.r! * 0.6, 0, 0, TAU); b.fill();
      if (on) { b.globalAlpha = 0.8; b.strokeStyle = '#ffffff'; b.lineWidth = 1; b.beginPath(); b.moveTo(x - h.r! * 0.4, y - 3); b.lineTo(x + h.r! * 0.2, y - 6); b.stroke(); }
    } else if (h.k === 'bliz') {
      const { LW, LH } = screen, on = h.t >= h.te!;
      b.globalAlpha = on ? 0.22 : 0.1 + 0.08 * Math.sin(clock * 12);
      b.fillStyle = '#dff4ff'; b.fillRect(0, 0, LW, LH);
      b.globalAlpha = 0.9; b.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) { const sx = (i * 37 + clock * 60 * (1 + (i % 3))) % LW, sy = (i * 53 + clock * 90) % LH; b.fillRect(Math.round(sx), Math.round(sy), 1, 1); }
      if (on && (h.tk || 0) > 0) { b.strokeStyle = '#4fa8ff'; b.lineWidth = 2; b.beginPath(); b.arc(v.P.x + ox, v.P.y + oy, 12, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, (h.tk || 0) / h.sp!)); b.stroke(); }
    } else if (h.k === 'safe') {
      const { LW, LH } = screen;
      b.globalAlpha = h.t < h.te! ? 0.2 + 0.25 * (h.t / h.te!) : Math.max(0, 0.7 - (h.t - h.te!) * 2);
      b.fillStyle = king ? KING_RED : h.c === 3 ? '#6fb553' : '#9fd8ff'; // Gossip Swamp / Absolute Throne: everything but the safe spots
      b.beginPath(); b.rect(0, 0, LW, LH);
      for (const [px, py] of h.pts!) { b.moveTo(px + ox + h.r!, py + oy); b.ellipse(px + ox, py + oy, h.r!, h.r! * 0.7, 0, 0, TAU, true); }
      b.fill('evenodd');
      b.globalAlpha = 1; b.strokeStyle = king ? '#6fe36a' : '#ffffff'; b.lineWidth = king ? 2 : 1;
      for (const [px, py] of h.pts!) { b.beginPath(); b.ellipse(px + ox, py + oy, h.r!, h.r! * 0.7, 0, 0, TAU); b.stroke(); }
    }
    b.restore();
  }
}

/** Seconds a new monster takes to fade in. */
const SPAWN_FADE = 0.35;

/** 1-px white rim around a sprite's silhouette (cached per sprite canvas), drawn at (x − 1, y − 1). */
const rims = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function rim(img: HTMLCanvasElement): HTMLCanvasElement {
  let o = rims.get(img);
  if (o) return o;
  o = document.createElement('canvas');
  o.width = img.width + 2; o.height = img.height + 2;
  const x = o.getContext('2d')!;
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) x.drawImage(img, dx, dy);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = '#ffffff'; x.fillRect(0, 0, o.width, o.height);
  x.globalCompositeOperation = 'destination-out'; x.drawImage(img, 1, 1);
  rims.set(img, o);
  return o;
}

/** Pulsing ring under the Hero's feet so the player finds themselves in a crowd. */
function heroRing(x: number, y: number, clock: number): void {
  b.save();
  b.globalAlpha = 0.55; b.strokeStyle = K; b.lineWidth = 3;
  b.beginPath(); b.ellipse(x, y, 9, 4, 0, 0, TAU); b.stroke();
  b.globalAlpha = 0.8 + 0.2 * Math.sin(clock * 6); b.strokeStyle = '#7df9ff'; b.lineWidth = 1; b.stroke();
  b.restore();
}

export function renderWorld(v: Readonly<SimState> | null, clock: number, hideSelf: boolean): void {
  const { LW, LH, S } = screen;
  const P = v?.P;
  const sh = vfx.shake, sx = sh ? rnd(-sh, sh) : 0, sy = sh ? rnd(-sh, sh) : 0;
  ox = Math.round(LW / 2 - (P ? P.x : clock * 6) + sx); // title: the scene drifts slowly
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
    // gems (co-op guests draw the host's shared drops)
    for (const g of v.coop?.role === 'guest' ? v.coop.drops : v.gems) {
      const x = Math.round(g.x + ox), y = Math.round(g.y + oy);
      if (x < -4 || y < -4 || x > LW + 4 || y > LH + 4) continue;
      if (g.kind === 'xp') {
        const c = g.v >= 20 ? '#ff5cf4' : g.v >= 5 ? '#4dff88' : '#4fc3ff'; // mid gem green: gold is for coins
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
      } else if (g.kind === 'shield') {
        const bob = Math.round(Math.sin(clock * 4));
        b.fillStyle = K; b.fillRect(x - 4, y - 4 + bob, 8, 7); b.fillRect(x - 3, y + 3 + bob, 6, 1); b.fillRect(x - 1, y + 4 + bob, 2, 1);
        b.fillStyle = '#4fb4ff'; b.fillRect(x - 3, y - 3 + bob, 6, 6); b.fillRect(x - 2, y + 3 + bob, 4, 1);
        b.fillStyle = '#bfe8ff'; b.fillRect(x - 2, y - 2 + bob, 2, 3); b.fillStyle = '#fff'; b.fillRect(x - 2, y - 2 + bob, 1, 1);
      } else {
        b.fillStyle = K; b.fillRect(x - 4, y - 3, 8, 6); b.fillStyle = '#ff4b5c';
        b.fillRect(x - 3, y - 3, 2, 1); b.fillRect(x + 1, y - 3, 2, 1); b.fillRect(x - 3, y - 2, 6, 2); b.fillRect(x - 2, y, 4, 1); b.fillRect(x - 1, y + 1, 2, 1);
      }
    }
    // meteor shadows, ground sigils
    for (const f of v.effects) {
      if (f.type === 'sigil') {
        const x = f.x + ox, y = f.y + oy, r = f.r!, fade = Math.min(1, (f.dur - f.t) / 0.3, f.t / 0.15);
        b.save(); b.globalAlpha = 0.35 * fade; b.fillStyle = '#e08cff';
        b.beginPath(); b.ellipse(x, y, r, r * 0.8, 0, 0, TAU); b.fill();
        b.globalAlpha = 0.9 * fade; b.strokeStyle = '#ff5cf4'; b.lineWidth = 1;
        b.beginPath(); b.ellipse(x, y, r, r * 0.8, 0, 0, TAU); b.stroke();
        b.beginPath(); b.ellipse(x, y, r * 0.62, r * 0.5, 0, 0, TAU); b.stroke();
        for (let i = 0; i < 5; i++) {
          const a = clock * 0.8 + (i * TAU) / 5, a2 = a + (2 * TAU) / 5;
          b.beginPath(); b.moveTo(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.5); b.lineTo(x + Math.cos(a2) * r * 0.62, y + Math.sin(a2) * r * 0.5); b.stroke();
        }
        b.restore();
      }
      if (f.type === 'meteor' && !f.boomed) {
        const k = f.t / f.delay!;
        b.fillStyle = 'rgba(30,27,51,' + (0.2 + 0.3 * k) + ')'; b.beginPath(); b.ellipse(f.x + ox, f.y + oy, f.r! * k, f.r! * k * 0.5, 0, 0, TAU); b.fill();
        b.strokeStyle = '#ff4b3a'; b.lineWidth = 1; b.beginPath(); b.ellipse(f.x + ox, f.y + oy, f.r!, f.r! * 0.5, 0, 0, TAU); b.stroke();
      }
    }
    drawHz(v, clock);
    // co-op: shield bubbles around players picking a level-up / spinning a chest (the room keeps playing)
    if (v.coop) {
      const bubble = (x: number, y: number, fade = 1): void => {
        const r = v.cfg.coop.shieldR * (0.92 + 0.05 * Math.sin(clock * 5));
        b.save(); b.globalAlpha = 0.16 * fade; b.fillStyle = '#8fdcff';
        b.beginPath(); b.arc(Math.round(x + ox), Math.round(y + oy), r, 0, TAU); b.fill();
        b.globalAlpha = 0.75 * fade; b.strokeStyle = '#e6f6ff'; b.lineWidth = 1; b.setLineDash([3, 2]); b.lineDashOffset = -clock * 12; b.stroke(); b.restore();
      };
      const after = v.coop.shieldT; // the bubble stays a few seconds after choosing; it blinks in the last one
      if ((v.phase === 'levelup' || v.phase === 'chest') && !v.pickReturn) bubble(P.x, P.y);
      else if (after > 0 && (after > 1 || Math.floor(clock * 8) & 1)) bubble(P.x, P.y, Math.min(1, 0.5 + after / 2));
      for (const m of v.coop.mates) if ((m.sel || m.sh) && !m.dn) bubble(m.rx, m.ry);
    }
    // co-op mates (under the entities; they never block)
    for (const m of v.coop?.mates ?? []) {
      const CS3 = HERO_SPR[m.hero] || HERO_SPR.mage, fr = m.mv ? Math.floor(clock * 8) & 1 : 0;
      const mx = Math.round(m.rx + ox), my = Math.round(m.ry + oy);
      b.fillStyle = 'rgba(30,27,51,.35)'; b.beginPath(); b.ellipse(mx, my + 7, 5, 2, 0, 0, TAU); b.fill();
      b.globalAlpha = m.dn ? 0.4 : 1;
      b.drawImage(m.fc < 0 ? CS3.l[fr] : CS3.r[fr], mx - 8, my - 9);
      b.globalAlpha = 1;
      if (m.gt && !m.dn) { // an ally's Shield pickup, same bubble as the local Hero's
        b.save(); b.globalAlpha = 0.22; b.fillStyle = '#7fd4ff';
        b.beginPath(); b.arc(mx, my - 1, 12, 0, TAU); b.fill();
        b.globalAlpha = 0.8; b.strokeStyle = '#bfe8ff'; b.lineWidth = 1; b.stroke(); b.restore();
      }
    }
    // entities sorted by y
    const ents: (Enemy | null)[] = v.enemies.slice();
    ents.push(null); // null = the player
    ents.sort((a, c) => (a ? a.y : P.y) - (c ? c.y : P.y));
    // the Hero's sprite this frame; `covered` once a monster drawn after it overlaps it (x-ray on top later)
    let self: { img: HTMLCanvasElement; x: number; y: number } | null = null, covered = false;
    for (const e of ents) {
      if (!e) {
        if (hideSelf) continue;
        const CS2 = HERO_SPR[P.ch] || HERO_SPR.mage;
        if (P.down) { b.globalAlpha = 0.35; b.drawImage(CS2.w, Math.round(P.x + ox - 8), Math.round(P.y + oy - 9)); b.globalAlpha = 1; continue; }
        const fr = P.moving ? Math.floor(P.anim * 8) & 1 : 0;
        // facing: down / up when moving mostly vertically, else the side view (left mirrored)
        const dir = P.dx === 0 && P.dy === 0 ? 'down' : Math.abs(P.dy) > Math.abs(P.dx) + 0.1 ? (P.dy > 0 ? 'down' : 'up') : 'side';
        const img = P.inv > 0 && Math.floor(clock * 20) & 1 ? CS2.w : dir === 'down' ? CS2.down[fr] : dir === 'up' ? CS2.up[fr] : P.face < 0 ? CS2.l[fr] : CS2.r[fr];
        const hw = HELD_SPR[v.weapon], hx = Math.round(P.x + ox), hy = Math.round(P.y + oy);
        const bob = P.moving ? (fr ? -1 : 0) : 0;
        b.fillStyle = 'rgba(30,27,51,.35)'; b.beginPath(); b.ellipse(P.x + ox, P.y + oy + 7, 5, 2, 0, 0, TAU); b.fill();
        heroRing(P.x + ox, P.y + oy + 7, clock);
        if (P.clone) { const c = P.clone, dk = P.face < 0 ? CS2.dkl : CS2.dk; b.globalAlpha = 0.75; b.drawImage(dk[fr], Math.round(c.x + ox - 8), Math.round(c.y + oy - 9)); b.globalAlpha = 1; }
        if (hw && dir === 'up') b.drawImage(hw[0], hx + 1, hy - 9 + bob); // the Weapon on the back
        self = { img, x: Math.round(P.x + ox - 8), y: Math.round(P.y + oy - 9 + bob) };
        b.drawImage(rim(img), self.x - 1, self.y - 1);
        b.drawImage(img, self.x, self.y);
        if (P.guardT > 0 && (P.guardT > 2 || Math.floor(clock * 8) & 1)) { // Shield pickup bubble (blinks in its last 2 s)
          b.save(); b.globalAlpha = 0.22; b.fillStyle = '#7fd4ff';
          b.beginPath(); b.arc(P.x + ox, P.y + oy - 1, 12, 0, TAU); b.fill();
          b.globalAlpha = 0.8; b.strokeStyle = '#bfe8ff'; b.lineWidth = 1; b.stroke(); b.restore();
        }
        if (hw && dir !== 'up') { // in the hand
          if (dir === 'down') b.drawImage(hw[0], hx + 4, hy - 4 + bob);
          else if (P.face < 0) b.drawImage(hw[1], hx - 10, hy - 5 + bob);
          else b.drawImage(hw[0], hx + 4, hy - 5 + bob);
        }
        if (P.pet) {
          const pt = P.pet;
          b.fillStyle = 'rgba(30,27,51,.25)'; b.beginPath(); b.ellipse(pt.x + ox, pt.y + oy + 14, 4, 1.5, 0, 0, TAU); b.fill();
          const left = Math.cos(clock * 1.3) < 0, bob = Math.floor(clock * 6) & 1;
          const sc = pt.lv >= v.cfg.companion.growAt || pt.kind === 'tri' ? v.cfg.companion.growMul : 1;
          const kinds = pt.kind === 'tri' ? ['storm', 'inferno', 'frost'] : [pt.kind];
          kinds.forEach((k, i) => {
            const im = PET_SPR[k][left ? 1 : 0], w = Math.round(im.width * sc), h = Math.round(im.height * sc);
            const dx = kinds.length > 1 ? (i - 1) * 7 : 0, dy = kinds.length > 1 && i !== 1 ? 3 : 0;
            b.drawImage(im, Math.round(pt.x + ox - w / 2 + dx), Math.round(pt.y + oy - h / 2 + bob + dy), w, h);
          });
        }
        continue;
      }
      if (e.hide) {
        b.fillStyle = 'rgba(30,27,51,.35)'; b.beginPath(); b.ellipse(e.x + ox, e.y + oy + 8, 10, 3, 0, 0, TAU); b.fill();
        continue;
      }
      // Kings with a wind-up frame (3 frames): idle on the first two, wind-up while a move plays out
      const frames = ENEMY_SPR[e.type], sp = frames.length === 3 && e.kg ? frames[e.kg.lock > 0 ? 2 : Math.floor(e.ph / 2) % 2] : frames[Math.floor(e.ph / 2) % frames.length];
      const im = e.flash > 0 ? sp.w : e.frz > 0 ? sp.i : e.armor ? sp.a : e.elite ? sp.e : sp.n;
      const w = im.width * e.sc, h = im.height * e.sc, x = Math.round(e.x + ox - w / 2);
      const y = Math.round(e.y + oy - h / 2 + (e.type === 'bat' ? 0 : Math.sin(e.ph * 0.5) * (e.sc > 1 ? 1 : 0.5)));
      if (x < -w || y < -h || x > LW + w || y > LH + h) continue;
      if (self && !covered && x < self.x + 14 && x + w > self.x + 2 && y < self.y + 15 && y + h > self.y + 2) covered = true;
      // fade in right after spawning: with the camera zoomed out, the spawn ring can be inside the view
      const age = v.clock - e.born, fade = !e.boss && age < SPAWN_FADE ? Math.max(0, age) / SPAWN_FADE : 1;
      b.globalAlpha = fade;
      b.fillStyle = 'rgba(30,27,51,.3)'; b.beginPath(); b.ellipse(e.x + ox, e.y + oy + h / 2, w * 0.35, Math.max(1.5, h * 0.12), 0, 0, TAU); b.fill();
      if (e.type === 'ghost') b.globalAlpha = 0.85 * fade;
      b.drawImage(im, x, y, w, h);
      b.globalAlpha = 1;
      if (e.slowT > 0) { b.fillStyle = 'rgba(159,216,255,.45)'; b.fillRect(x, y + h - 3, w, 3); }
      // Statuses: small marks above the head (Frozen already tints the sprite)
      {
        let mx = Math.round(e.x + ox) - 5;
        const my = y - (e.elite ? 8 : 4);
        const mark = (c: string): void => { b.fillStyle = K; b.fillRect(mx - 1, my - 1, 4, 4); b.fillStyle = c; b.fillRect(mx, my, 2, 2); mx += 4; };
        if ((e.burn || 0) > 0) mark(Math.floor(clock * 10) & 1 ? '#ff8a3d' : '#ffd23f');
        if ((e.shock || 0) > 0) mark(Math.floor(clock * 14) & 1 ? '#fff35c' : '#ffffff');
        if ((e.pois || 0) > 0) mark('#b6f24a');
        if ((e.gath || 0) > 0) mark('#d8f3e0');
        if ((e.chill || 0) > 0 && e.frz <= 0) mark('#bfe6ff');
      }
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
    // line-skill auras and the awakened glow
    if (P.skills.timeWarp && !P.down) {
      const r = skillStats(v.cfg, 'timeWarp', P.skills.timeWarp, false).r;
      b.save(); b.globalAlpha = 0.12; b.fillStyle = '#8fdcff'; b.beginPath(); b.ellipse(P.x + ox, P.y + oy, r, r * 0.85, 0, 0, TAU); b.fill();
      b.globalAlpha = 0.5; b.strokeStyle = '#c9a8ff'; b.setLineDash([3, 4]); b.lineDashOffset = -clock * 8; b.stroke(); b.restore();
    }
    if (P.skills.transmute && !P.down) {
      const r = skillStats(v.cfg, 'transmute', P.skills.transmute, false).r;
      b.save(); b.globalAlpha = 0.5; b.strokeStyle = '#ff5cf4'; b.setLineDash([2, 5]); b.lineDashOffset = clock * 6;
      b.beginPath(); b.ellipse(P.x + ox, P.y + oy, r, r * 0.85, 0, 0, TAU); b.stroke(); b.restore();
    }
    if (P.awakened && !P.down) {
      b.save(); b.globalAlpha = 0.35 + 0.15 * Math.sin(clock * 5); b.fillStyle = '#ffd23f';
      b.beginPath(); b.ellipse(P.x + ox, P.y + oy + 8, 9, 3, 0, 0, TAU); b.fill(); b.restore();
    }
    // holy shields
    if (P.skills.shield && v.phase !== 'over' && !P.down) {
      const sh = skillStats(v.cfg, 'shield', P.skills.shield, !!P.evo.shield);
      for (let i = 0; i < sh.n; i++) {
        const a = P.shieldA + (i * TAU) / sh.n, x = Math.round(P.x + ox + Math.cos(a) * sh.r), y = Math.round(P.y + oy + Math.sin(a) * sh.r * 0.8);
        b.fillStyle = K; b.beginPath(); b.arc(x, y, 5, 0, TAU); b.fill();
        b.fillStyle = P.evo.shield ? '#ffd23f' : '#c7ced9'; b.beginPath(); b.arc(x, y, 4, 0, TAU); b.fill();
        b.fillStyle = '#fff8c0'; b.fillRect(x - 1, y - 3, 2, 6); b.fillRect(x - 3, y - 1, 6, 2);
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
      if (f.type === 'icewall') {
        const k = f.t / f.dur, ux = Math.cos(f.a!), uy = Math.sin(f.a!), half = f.len! / 2;
        b.save(); b.globalAlpha = k > 0.8 ? (1 - k) * 5 : 1;
        for (let d = -half; d <= half; d += 7) {
          const x = Math.round(f.x + ux * d + ox), y = Math.round(f.y + uy * d + oy);
          b.fillStyle = K; b.fillRect(x - 3, y - 8, 7, 11); b.fillStyle = '#9fd8ff'; b.fillRect(x - 2, y - 7, 5, 9); b.fillStyle = '#ffffff'; b.fillRect(x - 1, y - 7, 1, 5);
        }
        b.restore();
        continue;
      }
      if (f.type === 'hawk' && !f.fired) {
        const o = f.targets![0], k = Math.min(1, f.t / f.dur);
        const x = Math.round(f.x + (o.x - f.x) * k + ox), y = Math.round(f.y + (o.y - f.y) * k - Math.sin(k * Math.PI) * 18 + oy);
        const dir = o.x < f.x ? -1 : 1, flap = Math.floor(clock * 16) & 1;
        b.fillStyle = K; b.fillRect(x - 4, y - 2, 8, 4); b.fillRect(x - 6, y - (flap ? 4 : 0), 12, 2);
        b.fillStyle = '#c48a55'; b.fillRect(x - 3, y - 1, 6, 2); b.fillRect(x - 5, y - (flap ? 3 : 1) + 0, 10, 1);
        b.fillStyle = '#ffd23f'; b.fillRect(x + dir * 4, y - 1, 1, 1);
        continue;
      }
      if (f.type === 'flask') {
        const col = f.el === 'fire' ? '#ff8a3d' : f.el === 'ice' ? '#9fd8ff' : '#b6f24a';
        if (!f.fired) {
          const [sx, sy] = f.pts![0], k = Math.min(1, f.t / f.dur);
          const x = Math.round(sx + (f.x - sx) * k + ox), y = Math.round(sy + (f.y - sy) * k - Math.sin(k * Math.PI) * 24 + oy);
          b.fillStyle = K; b.fillRect(x - 3, y - 3, 6, 7); b.fillStyle = col; b.fillRect(x - 2, y - 1, 4, 4); b.fillStyle = '#e9f1ff'; b.fillRect(x - 1, y - 3, 2, 2);
          b.save(); b.globalAlpha = 0.5; b.strokeStyle = col; b.lineWidth = 1; b.beginPath(); b.ellipse(f.x + ox, f.y + oy, f.r!, f.r! * 0.6, 0, 0, TAU); b.stroke(); b.restore();
        } else {
          const k = Math.min(1, (f.t - f.dur) / 0.25);
          b.save(); b.globalAlpha = 0.6 * (1 - k); b.fillStyle = col; b.beginPath(); b.ellipse(f.x + ox, f.y + oy, f.r! * (0.7 + k * 0.4), f.r! * 0.6 * (0.7 + k * 0.4), 0, 0, TAU); b.fill(); b.restore();
        }
        continue;
      }
      if (f.type === 'nova') {
        const k = Math.min(1, f.t / f.dur), r = f.R! * k;
        b.save(); b.globalAlpha = 1 - k * 0.7;
        b.strokeStyle = f.col ? '#5a3f8a' : '#ff4b3a'; b.lineWidth = 6; b.beginPath(); b.ellipse(f.x + ox, f.y + oy, r, r * 0.85, 0, 0, TAU); b.stroke();
        b.strokeStyle = f.col || '#ffd23f'; b.lineWidth = 3; b.stroke(); b.strokeStyle = '#fff'; b.lineWidth = 1; b.stroke(); b.restore();
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
        if (!f.boomed && f.col === '#fff8c0') {
          // Judgement Pillar: a beam of light narrowing onto the target
          const k = f.t / f.delay!;
          b.save(); b.globalAlpha = 0.3 + 0.5 * k; b.fillStyle = '#fff8c0';
          b.fillRect(Math.round(f.x + ox - f.r! * (1.4 - k)), 0, Math.round(f.r! * 2 * (1.4 - k)), Math.round(f.y + oy)); b.restore();
        } else if (!f.boomed) {
          const k = f.t / f.delay!, x = f.x + ox + 60 * (1 - k), y = f.y + oy - 150 * (1 - k);
          b.fillStyle = 'rgba(255,138,61,.5)';
          for (let i = 1; i < 5; i++) b.fillRect(Math.round(x + i * 4 - 2), Math.round(y - i * 10 - 2), 4 - (i > 2 ? 1 : 0), 4);
          b.fillStyle = K; b.beginPath(); b.arc(x, y, 5, 0, TAU); b.fill(); b.fillStyle = f.col || '#ff4b3a'; b.beginPath(); b.arc(x, y, 4, 0, TAU); b.fill();
          b.fillStyle = '#ffd23f'; b.beginPath(); b.arc(x - 1, y - 1, 2, 0, TAU); b.fill();
        } else {
          const k = f.bt! / 0.3;
          b.save(); b.globalAlpha = Math.max(0, 1 - k); b.fillStyle = '#fff3c4';
          b.beginPath(); b.ellipse(f.x + ox, f.y + oy, f.r! * (0.6 + k * 0.6), f.r! * (0.5 + k * 0.5), 0, 0, TAU); b.fill();
          b.strokeStyle = f.col || '#ff4b3a'; b.lineWidth = 3; b.stroke(); b.restore();
        }
      } else if (f.type === 'slash') {
        const k = f.t / f.dur, x = f.x + ox, y = f.y + oy;
        b.save(); b.globalAlpha = 1 - k; b.fillStyle = '#fff8c0';
        b.beginPath(); b.moveTo(x, y); b.arc(x, y, f.r!, f.a! - f.sp! + k * 0.4, f.a! + f.sp! * (0.2 + k)); b.closePath(); b.fill();
        b.strokeStyle = '#ffd23f'; b.lineWidth = 2; b.beginPath(); b.arc(x, y, f.r!, f.a! - f.sp!, f.a! + f.sp!); b.stroke(); b.restore();
      } else if (f.type === 'dome') {
        const k = f.t / f.dur;
        b.save(); b.globalAlpha = 0.35 * (1 - k * 0.5) + 0.1 * Math.sin(clock * 12); b.fillStyle = '#ffe9a8';
        b.beginPath(); b.ellipse(P.x + ox, P.y + oy - 2, f.r!, f.r! * 0.9, 0, 0, TAU); b.fill();
        b.globalAlpha = 0.9; b.strokeStyle = '#ffd23f'; b.lineWidth = 2; b.stroke(); b.restore();
      } else if (f.type === 'rain') {
        b.save(); b.globalAlpha = 0.25; b.fillStyle = '#c48a55'; b.beginPath(); b.ellipse(f.x + ox, f.y + oy, f.r!, f.r! * 0.8, 0, 0, TAU); b.fill(); b.restore();
        b.fillStyle = '#ffe9a8';
        for (let i = 0; i < 6; i++) { const a = R() * TAU, d = R() * f.r!; b.fillRect(Math.round(f.x + ox + Math.cos(a) * d), Math.round(f.y + oy + Math.sin(a) * d * 0.8 - 6), 1, 5); }
      } else if (f.type === 'gale') {
        const k = f.t / f.dur;
        b.save(); b.globalAlpha = 1 - k; b.translate(Math.round(f.x + ox), Math.round(f.y + oy)); b.rotate(clock * 14);
        b.fillStyle = '#d8f3e0'; b.fillRect(-f.r!, -1, f.r! * 2, 2); b.fillRect(-1, -f.r!, 2, f.r! * 2); b.restore();
      } else if (f.type === 'cauldron') {
        const x = Math.round(f.x + ox), y = Math.round(f.y + oy);
        b.save(); b.globalAlpha = 0.2; b.fillStyle = ['#ff8a3d', '#9fd8ff', '#b6f24a'][(f.n || 0) % 3]; b.beginPath(); b.ellipse(x, y, f.r!, f.r! * 0.8, 0, 0, TAU); b.fill(); b.restore();
        b.fillStyle = K; b.fillRect(x - 6, y - 5, 12, 9); b.fillStyle = '#3a3363'; b.fillRect(x - 5, y - 4, 10, 7);
        b.fillStyle = ['#ff8a3d', '#9fd8ff', '#b6f24a'][(f.n || 0) % 3]; b.fillRect(x - 5, y - 4, 10, 2);
      } else if (f.type === 'elixir') {
        const k = f.t / f.dur;
        b.fillStyle = '#6fe36a';
        for (let i = 0; i < 5; i++) b.fillRect(Math.round(P.x + ox + (i - 2) * 6), Math.round(P.y + oy - 30 + k * 30 + (i % 2) * 6), 2, 3);
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
      } else if (f.type === 'gturret') {
        // Gear Cannon turret
        const x = Math.round(f.x + ox), y = Math.round(f.y + oy), fade = Math.min(1, (f.dur - f.t) / 0.4);
        b.save(); b.globalAlpha = fade;
        b.fillStyle = K; b.fillRect(x - 5, y - 2, 10, 8); b.fillRect(x - 2, y - 6, 4, 5);
        b.fillStyle = '#8a94a8'; b.fillRect(x - 4, y - 1, 8, 6); b.fillStyle = '#c7ced9'; b.fillRect(x - 1, y - 5, 2, 4);
        if (Math.floor(clock * 12) & 1) { b.fillStyle = '#ffd23f'; b.fillRect(x - 1, y - 7, 2, 1); }
        b.restore();
      } else if (f.type === 'judge') {
        if (!f.fired) {
          b.save(); b.globalAlpha = 0.5; b.strokeStyle = f.col || '#fff35c'; b.lineWidth = 2;
          const r = (1 - f.t / 0.3) * LW * 0.6 + 8;
          b.beginPath(); b.ellipse(P.x + ox, P.y + oy, r, r * 0.85, 0, 0, TAU); b.stroke(); b.restore();
          for (const o of f.targets!) { b.fillStyle = 'rgba(255,243,92,.8)'; b.fillRect(Math.round(o.x + ox) - 1, 0, 2, Math.round(o.y + oy)); }
        } else {
          b.save(); b.globalAlpha = Math.max(0, 1 - (f.t - 0.3) / 0.7);
          for (const o of f.targets!) {
            const x = Math.round(o.x + ox), y = Math.round(o.y + oy);
            b.fillStyle = f.col && f.col !== '#fff35c' ? f.col : '#ffd23f'; b.fillRect(x - 5, 0, 10, y); b.fillStyle = '#fff8c0'; b.fillRect(x - 3, 0, 6, y); b.fillStyle = '#fff'; b.fillRect(x - 1, 0, 2, y);
            b.fillStyle = '#fff8c0'; b.beginPath(); b.ellipse(x, y, 9, 4, 0, 0, TAU); b.fill();
          }
          b.restore();
        }
      }
    }
    if (self && covered) { // x-ray: the Hero's outline and a ghost of it show through monsters in front
      b.drawImage(rim(self.img), self.x - 1, self.y - 1);
      b.globalAlpha = 0.45; b.drawImage(self.img, self.x, self.y); b.globalAlpha = 1;
    }
    if (v.specialStage) { b.fillStyle = 'rgba(200,20,40,0.22)'; b.fillRect(0, 0, LW, LH); }
    if (v.darkness) {
      // Umbra's darkened heart: only a light around the player remains
      const r = v.cfg.umbra.lightR, px = P.x + ox, py = P.y + oy;
      const g = b.createRadialGradient(px, py, r * 0.55, px, py, r);
      g.addColorStop(0, 'rgba(10,6,20,0)'); g.addColorStop(1, 'rgba(10,6,20,0.92)');
      b.fillStyle = g; b.fillRect(0, 0, LW, LH);
    }
    // particles
    for (const r of vfx.rings) {
      const k = r.t / r.life;
      b.globalAlpha = 1 - k; b.strokeStyle = r.col; b.lineWidth = 3 * (1 - k) + 1;
      b.beginPath(); b.ellipse(r.x + ox, r.y + oy, r.r * k, r.r * k * 0.8, 0, 0, TAU); b.stroke();
    }
    for (const p of vfx.fx) { b.globalAlpha = Math.max(0, 1 - p.t / p.life); b.fillStyle = p.col; b.fillRect(Math.round(p.x + ox), Math.round(p.y + oy), p.sz, p.sz); }
    b.globalAlpha = 1;
  }
  if (!v) { // title sparkle: fixed twinkling stars over the scene
    for (let i = 0; i < 14; i++) {
      const a = Math.sin(clock * (1.3 + (i % 5) * 0.37) + i * 2.1);
      if (a < 0.4) continue;
      const x = Math.round(((i * 97 + 31) % 100) / 100 * LW), y = Math.round(((i * 61 + 17) % 100) / 100 * LH);
      b.globalAlpha = (a - 0.4) / 0.6; b.fillStyle = i % 3 ? '#ffffff' : '#fff35c';
      b.fillRect(x, y - 1, 1, 3); b.fillRect(x - 1, y, 3, 1);
    }
    b.globalAlpha = 1;
  }
  // blit
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const z = zoomK();
  if (z > 1.001) { const sw = LW / z, sh2 = LH / z; ctx.drawImage(buf, (LW - sw) / 2, (LH - sh2) / 2, sw, sh2, 0, 0, LW * S, LH * S); }
  else ctx.drawImage(buf, 0, 0, LW * S, LH * S);
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

/** A screen-edge arrow pointing at (sx, sy) (hi-res pixels), with a glow; returns where it was drawn. */
function edgeArrow(sx: number, sy: number, mg: number, sz: number, col: string): { ax: number; ay: number; a: number } {
  const D = screen.HD, W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy;
  const g = Math.max(mg, sz * 1.8 + 8 * D); // keep the whole tip on screen
  const k = Math.min((W / 2 - g) / Math.max(1e-6, Math.abs(dx)), (H / 2 - g) / Math.max(1e-6, Math.abs(dy)));
  const ax = cx + dx * k, ay = cy + dy * k, a = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(ax, ay); ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(sz * 1.8, 0); ctx.lineTo(sz * 0.2, -sz * 1.2); ctx.lineTo(sz * 0.55, 0); ctx.lineTo(sz * 0.2, sz * 1.2); ctx.closePath();
  ctx.shadowColor = col; ctx.shadowBlur = 14 * D; // glow so it stands out on any Realm
  ctx.fillStyle = col; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = INK; ctx.lineWidth = 4 * D; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fill();
  ctx.restore();
  return { ax, ay, a };
}

/** Round badge behind an arrow: a sprite in a ringed disc, a sonar ping and the distance under it. */
function edgeBadge(ax: number, ay: number, a: number, sz: number, col: string, im: CanvasImageSource | undefined, dist: number, clock: number): { bx: number; by: number; r: number } {
  const D = screen.HD, r = 24 * D, bx = ax - Math.cos(a) * (sz * 0.2 + r * 1.05), by = ay - Math.sin(a) * (sz * 0.2 + r * 1.05);
  const ping = (clock * 0.9) % 1; // an expanding ring once a second
  ctx.save();
  ctx.globalAlpha = 0.7 * (1 - ping); ctx.strokeStyle = col; ctx.lineWidth = 3 * D;
  ctx.beginPath(); ctx.arc(bx, by, r * (1 + ping * 0.8), 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 4 * D; ctx.stroke();
  if (im) { const isz = r * 1.5; ctx.imageSmoothingEnabled = false; ctx.drawImage(im, bx - isz / 2, by - isz / 2, isz, isz); }
  ctx.restore();
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  outlined(Math.round(dist / 16) + 'm', bx, by + r + 4 * D, 10 * D, col);
  return { bx, by, r };
}

/** Off-screen arrows with the boss icon (Kings, dragon, Shadow Rival, Umbra). Always on. */
function drawArrows(v: Readonly<SimState>, clock: number): void {
  const { S, HD: D, LW, LH } = screen, m = 34 * D;
  for (const e of [v.boss, v.boss2, v.dragonE, v.rivalE]) {
    if (!e || e.dead) continue;
    const sx = e.x + ox, sy = e.y + oy;
    if (sx > 0 && sy > 0 && sx < LW && sy < LH) continue;
    if (v.clock - e.born < 2 && Math.floor(clock * 8) & 1) continue; // blink right after the spawn
    const pulse = 1 + 0.1 * Math.sin(clock * 6);
    const sz = 22 * D * pulse, col = e === v.boss || e === v.boss2 ? '#ffd23f' : e === v.dragonE ? '#ff6a2a' : '#b07cff';
    const { ax, ay, a } = edgeArrow(sx * S, sy * S, m, sz, col);
    edgeBadge(ax, ay, a, sz, col, ENEMY_SPR[e.type]?.[0]?.n, Math.hypot(e.x - v.P.x, e.y - v.P.y), clock);
  }
}

/** King dialogue bubbles; they follow a living speaker and stay on screen. */
function drawBubbles(v: Readonly<SimState>): void {
  const { HD: D } = screen, W = cv.width, H = cv.height;
  for (const bb of vfx.bubbles) {
    const who = [v.boss, v.boss2, v.rivalE].find((k) => k && k.type === bb.who) ?? null;
    if (who) { bb.x = who.x; bb.y = who.y; }
    const px = 11 * D;
    ctx.font = lang() === 'en' ? `${Math.round(px * 0.75)}px "Press Start 2P", ui-monospace, monospace` : `700 ${Math.round(px)}px "Chakra Petch", Tahoma, sans-serif`;
    const tw = Math.min(ctx.measureText(bb.txt).width, W * 0.8), pad = 6 * D, bw = tw + pad * 2, bh = px + pad * 2;
    const [bx, by] = toScreen(bb.x, bb.y - 30);
    let x = bx - bw / 2, y = by - bh;
    x = Math.max(8 * D, Math.min(W - bw - 8 * D, x));
    y = Math.max(80 * D, Math.min(H - bh - 60 * D, y));
    const k = bb.t / bb.life;
    ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : Math.min(1, bb.t / 0.12);
    ctx.fillStyle = INK; ctx.fillRect(x - 2 * D, y - 2 * D, bw + 4 * D, bh + 4 * D);
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(bb.txt, x + bw / 2, y + bh / 2, tw);
    ctx.globalAlpha = 1;
  }
}

/** Co-op: names and HP over teammates; off screen, a big arrow with the ally's Hero, name and
 * distance — downed allies blink red so someone goes to revive them. */
function drawMates(v: Readonly<SimState>, clock: number): void {
  const mates = v.coop?.mates;
  if (!mates?.length) return;
  const { HD: D, LW, LH } = screen;
  for (const m of mates) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const [x, y] = toScreen(m.rx, m.ry - 12);
    const on = m.rx + ox > 0 && m.rx + ox < LW && m.ry + oy > 0 && m.ry + oy < LH;
    const label = (m.name || 'P') + (m.dn ? ' · ' + t('coop.down') : m.sel ? ' · ' + t('coop.choosing') : '');
    if (on) {
      outlined(label, x, y - 6 * D, 7 * D, m.dn ? '#ff8a8a' : '#8fdcff');
      const bw = 26 * D;
      ctx.fillStyle = INK; ctx.fillRect(x - bw / 2 - D, y - 4 * D, bw + 2 * D, 4 * D);
      ctx.fillStyle = '#e8434f'; ctx.fillRect(x - bw / 2, y - 3 * D, bw * clamp(m.hp / (m.mh || 1), 0, 1), 2 * D);
      continue;
    }
    const blink = m.dn && Math.floor(clock * 4) & 1, col = m.dn ? (blink ? '#ff4b5c' : '#ffd9de') : '#8fdcff';
    const sz = (m.dn ? 22 : 18) * D * (m.dn ? 1 + 0.12 * Math.sin(clock * 8) : 1);
    const { ax, ay, a } = edgeArrow(x, y, 30 * D, sz, col);
    const spr = HERO_SPR[m.hero] || HERO_SPR.mage;
    const { bx, by, r } = edgeBadge(ax, ay, a, sz, col, m.fc < 0 ? spr.l[0] : spr.r[0], Math.hypot(m.x - v.P.x, m.y - v.P.y), clock);
    // the name in a dark pill beside the badge, on the side facing the middle of the screen
    ctx.font = font(9 * D);
    const tw = ctx.measureText(label).width, pw = tw + 12 * D, ph = 18 * D;
    const left = Math.cos(a) > 0.3, px = left ? bx - r - 6 * D - pw : bx + r + 6 * D;
    const py = Math.max(ph, Math.min(cv.height - ph * 2, by - ph / 2));
    const qx = Math.max(4 * D, Math.min(cv.width - pw - 4 * D, px));
    ctx.fillStyle = 'rgba(30,27,51,.85)'; ctx.fillRect(qx, py, pw, ph);
    ctx.strokeStyle = col; ctx.lineWidth = 2 * D; ctx.strokeRect(qx, py, pw, ph);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    outlined(label, qx + 6 * D, py + ph / 2 + D, 9 * D, m.dn ? '#ff8a8a' : '#8fdcff');
  }
}

export function drawTexts(clock: number): void {
  const { CS0, DPR } = screen;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const base = CS0 * DPR; // same size at every camera distance
  for (const t of vfx.texts) {
    const k = t.t / t.life, pop = 1 + (t.cr || t.big ? 1.1 : 0.6) * Math.max(0, 1 - t.t / 0.12);
    let px = (t.big ? 3.6 : t.cr ? 4.4 : 2.9) * base;
    if (typeof t.v === 'number' && t.v >= 1000) px *= 1.2;
    if (typeof t.v === 'number' && t.v >= 10000) px *= 1.15;
    px *= pop;
    ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    const [x, y] = toScreen(t.x, t.y);
    const txt = t.cr ? t.v + '!' : String(t.v);
    outlined(txt, x, y, px, t.cr && !t.hurt ? (Math.floor(clock * 16) & 1 ? '#ffd23f' : '#ff7a3d') : t.col);
  }
  ctx.globalAlpha = 1;
}

function bar(x: number, y: number, w: number, h: number, val: number, col: string, bg?: string): void {
  const D = screen.HD;
  ctx.fillStyle = INK; ctx.fillRect(x - 2 * D, y - 2 * D, w + 4 * D, h + 4 * D);
  ctx.fillStyle = bg || '#3a3363'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = col; ctx.fillRect(x, y, w * clamp(val, 0, 1), h);
}

export function drawHud(v: Readonly<SimState>, clock: number, runGoldShown: number): void {
  // D = one HUD pixel: grows with the screen (screen.UI) so the HUD keeps its share of big screens
  const { HD: D, DPR, UI, SAFE } = screen, VW = screen.VW / UI;
  const P = v.P, W = cv.width, top = SAFE.t * DPR, left = SAFE.l * DPR + 12 * D, right = W - SAFE.r * DPR - 12 * D;
  // phones in portrait: three tight columns (left LV/HP/SP, middle timer/chapter/streak, right KO/Gold)
  // so the overtime timer, SP and streak no longer run into each other or the pause button
  const narrow = VW < 560;
  const blink = Math.floor(clock * 4) & 1;
  ctx.textBaseline = 'top';
  bar(0 + 2 * D, top + 2 * D, W - 4 * D, 7 * D, P.xp / P.need, '#4fc3ff');
  ctx.textAlign = 'left';
  const hpText = Math.ceil(P.hp) + '/' + P.maxHp + (P.guardT > 0 ? (narrow ? ' +' : '  +') + P.guard : '');
  let hudBottom: number; // lowest HUD line: the boss bars and co-op label start below it
  if (narrow) {
    outlined('LV ' + P.lv, left, top + 16 * D, 10 * D, '#ffffff');
    const hw = Math.min(120, VW * 0.3) * D;
    bar(left, top + 32 * D, hw, 9 * D, P.hp / P.maxHp, '#e8434f');
    if (P.guardT > 0) bar(left, top + 42 * D, hw * Math.min(1, P.guard / P.maxHp), 2 * D, P.guardT / v.cfg.loot.shieldDur, '#7fd4ff', '#2a5a80');
    outlined(hpText, left, top + 46 * D, 7 * D, '#ffd9de');
    hudBottom = top + 56 * D;
    if (v.sp > 0) {
      const label = t('hud.sp', { n: v.sp });
      ctx.font = font(8 * D);
      const pw = ctx.measureText(label).width + 10 * D;
      ctx.fillStyle = INK; ctx.fillRect(left, top + 58 * D, pw, 14 * D);
      ctx.fillStyle = '#3a2a55'; ctx.fillRect(left + D, top + 59 * D, pw - 2 * D, 12 * D);
      outlined(label, left + 5 * D, top + 61 * D, 8 * D, '#c9a8ff');
      hudBottom = top + 74 * D;
    }
    ctx.textAlign = 'center';
    if (v.overtime) {
      const otLeft = v.stageDur + v.cfg.stage.overtime - v.stageTime;
      const umbra = v.boss?.type === 'umbra'; // Umbra never escapes: no countdown
      const col = blink ? '#ff4b5c' : '#ffb347';
      if (!umbra) outlined(fmtT(Math.max(0, otLeft)), W / 2, top + 14 * D, 18 * D, col);
      outlined(t('hud.overtime'), W / 2, top + (umbra ? 20 : 38) * D, (umbra ? 12 : 8) * D, '#ff4b5c');
    } else {
      const rem = v.stageDur - v.stageTime;
      outlined(fmtT(rem), W / 2, top + 14 * D, 18 * D, rem <= 10 && v.phase === 'play' && blink ? '#ff4b5c' : '#ffffff');
      outlined((v.endless ? t('hud.endless') + ' ' : '') + t('hud.chapter', { n: v.stage, realm: realmShort(v.realm).toUpperCase() }), W / 2, top + 38 * D, 8 * D, '#ffd23f');
    }
    if (v.streak >= 10) {
      const pulse = 1 + 0.15 * Math.max(0, 1 - (2.2 - v.streakT) / 0.15);
      const c = v.streak >= 200 ? '#ff5cf4' : v.streak >= 100 ? '#ff7a3d' : v.streak >= 50 ? '#ffd23f' : '#ffffff';
      outlined(t('hud.streak', { n: v.streak }), W / 2, top + 52 * D, 9 * D * pulse, c);
      hudBottom = Math.max(hudBottom, top + 68 * D);
    }
    ctx.textAlign = 'right';
    outlined('KO ' + v.kills, right, top + 16 * D, 10 * D, '#ffffff');
    outlined(runGoldShown + ' G', right, top + 32 * D, 9 * D, '#ffd23f');
  } else {
    outlined('LV ' + P.lv, left, top + 18 * D, 11 * D, '#ffffff');
    const hw = Math.min(150, VW * 0.32) * D;
    bar(left, top + 36 * D, hw, 10 * D, P.hp / P.maxHp, '#e8434f');
    outlined(hpText, left, top + 52 * D, 8 * D, '#ffd9de');
    if (P.guardT > 0) bar(left, top + 47 * D, hw * Math.min(1, P.guard / P.maxHp), 3 * D, P.guardT / v.cfg.loot.shieldDur, '#7fd4ff', '#2a5a80');
    ctx.textAlign = 'center';
    if (v.overtime) {
      const otLeft = v.stageDur + v.cfg.stage.overtime - v.stageTime;
      const umbra = v.boss?.type === 'umbra'; // Umbra never escapes: no countdown
      outlined(t('hud.overtime') + (umbra ? '' : ' ' + fmtT(Math.max(0, otLeft))), W / 2, top + 18 * D, 16 * D, blink ? '#ff4b5c' : '#ffb347');
    } else {
      const rem = v.stageDur - v.stageTime;
      outlined(fmtT(rem), W / 2, top + 18 * D, 20 * D, rem <= 10 && v.phase === 'play' ? (blink ? '#ff4b5c' : '#ffffff') : '#ffffff');
    }
    outlined((v.endless ? t('hud.endless') + ' ' : '') + t('hud.chapter', { n: v.stage, realm: realmShort(v.realm).toUpperCase() }), W / 2, top + 44 * D, 9 * D, '#ffd23f');
    ctx.textAlign = 'right';
    outlined('KO ' + v.kills, right, top + 18 * D, 11 * D, '#ffffff');
    outlined(runGoldShown + ' G', right, top + 36 * D, 10 * D, '#ffd23f');
    if (v.sp > 0) outlined(t('hud.sp', { n: v.sp }), right - 90 * D, top + 36 * D, 10 * D, '#c9a8ff');
    hudBottom = top + 62 * D;
    if (v.streak >= 10) { // centred under the Chapter: on the right it ran into the pause button
      const pulse = 1 + 0.25 * Math.max(0, 1 - (2.2 - v.streakT) / 0.15);
      const c = v.streak >= 200 ? '#ff5cf4' : v.streak >= 100 ? '#ff7a3d' : v.streak >= 50 ? '#ffd23f' : '#ffffff';
      ctx.textAlign = 'center';
      outlined(t('hud.streak', { n: v.streak }), W / 2, top + 58 * D, 11 * D * pulse * (v.streak >= 100 ? 1.15 : 1), c);
      hudBottom = top + 80 * D;
    }
  }
  // boss bars
  {
    let yy = hudBottom;
    const bw = Math.min(300, VW * 0.6) * D;
    ctx.textAlign = 'center';
    const bars: [Enemy | null, string, string, string][] = [
      [v.boss, kingName(v.realm), v.overtime ? '#ff4b5c' : '#4fa8ff', '#8fdcff'],
      [v.boss2, v.skipped ? kingName(v.skipped) : '', v.overtime ? '#ff4b5c' : '#4fa8ff', '#8fdcff'],
      [v.dragonE, t(`guardian.${v.dragonKind}`).toUpperCase(), v.dragonKind === 'frost' ? '#4fa8ff' : v.dragonKind === 'storm' ? '#d8b400' : '#ff6a2a', '#ffb347'],
      [v.rivalE, 'SHADOW ???', '#8a5ad6', '#d9b8ff'],
    ];
    for (const [e, nm, col, lc] of bars) {
      if (!e || e.dead) continue;
      outlined(e === v.rivalE && e.life != null ? nm + '  ' + Math.ceil(e.life) + 's' : nm, W / 2, yy, 8 * D, lc);
      bar(W / 2 - bw / 2, yy + 14 * D, bw, 7 * D, e.hp / e.maxHp, col);
      yy += 30 * D;
    }
  }
  drawArrows(v, clock);
  drawMates(v, clock);
  drawBubbles(v);
  if (v.coop) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    outlined(t('coop.hud', { n: v.coop.mates.length + 1 }), left, top + (narrow ? (v.sp > 0 ? 76 : 60) : 66) * D, 8 * D, '#8fdcff');
    const msg = v.coop.role === 'guest' && v.coop.hostPhase === 'pause' ? t('coop.hostPaused') : '';
    if (msg) { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; outlined(msg, W / 2, cv.height * 0.45, 12 * D, '#ffffff'); }
    ctx.textBaseline = 'top';
  }
  drawSkillPanel(v, left, cv.height - SAFE.b * DPR - 14 * D, W - (SAFE.r * DPR + 110 * D));
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
  // King move warning: centre of the screen, just above the player
  const wn = vfx.warn;
  if (wn) {
    const k = wn.t / wn.life, a = k < 0.1 ? k / 0.1 : k > 0.8 ? (1 - k) / 0.2 : 1;
    const y = cv.height * 0.3, bandH = (wn.ult ? 58 : 44) * D;
    ctx.globalAlpha = Math.max(0, a) * 0.78;
    ctx.fillStyle = wn.ult ? '#8a0f1c' : '#3a0a12'; ctx.fillRect(0, y - bandH / 2, W, bandH);
    ctx.fillStyle = KING_RED; ctx.fillRect(0, y - bandH / 2, W, 2 * D); ctx.fillRect(0, y + bandH / 2 - 2 * D, W, 2 * D);
    ctx.globalAlpha = Math.max(0, a);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const pulse = 1 + 0.06 * Math.sin(clock * 18);
    thaiText('⚠ ' + t(wn.ult ? 'warn.ult' : 'warn.move'), W / 2, y - bandH * 0.22, 11 * D, Math.floor(clock * 8) & 1 ? '#ffd23f' : '#ffffff', 3 * D);
    thaiText(wn.txt, W / 2, y + bandH * 0.18, (wn.ult ? 20 : 16) * D * pulse, '#ff6b76', 4 * D);
    if (wn.ult) { // red edges for ultimates
      const g = ctx.createRadialGradient(W / 2, cv.height / 2, Math.min(W, cv.height) * 0.35, W / 2, cv.height / 2, Math.max(W, cv.height) * 0.75);
      g.addColorStop(0, 'rgba(255,42,58,0)'); g.addColorStop(1, 'rgba(255,42,58,0.35)');
      ctx.globalAlpha = Math.max(0, a) * (0.6 + 0.4 * Math.sin(clock * 12)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, cv.height);
    }
    ctx.globalAlpha = 1; ctx.textBaseline = 'top';
  }
  // King intro card: slides in from the left under the banner
  const it = vfx.intro;
  if (it) {
    const k = it.t / it.life, slide = k < 0.15 ? 1 - k / 0.15 : k > 0.85 ? -(k - 0.85) / 0.15 : 0;
    const ch = 54 * D, cw = Math.min(W * 0.8, 340 * D), cx = (W - cw) / 2 - slide * W, cy = cv.height * 0.56;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = INK; ctx.fillRect(cx - 3 * D, cy - 3 * D, cw + 6 * D, ch + 6 * D);
    ctx.fillStyle = '#3a1f66'; ctx.fillRect(cx, cy, cw, ch);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(cx, cy + ch - 3 * D, cw * Math.min(1, it.t / 0.5), 3 * D);
    ctx.globalAlpha = 1;
    const im = ENEMY_SPR[it.king]?.[0]?.n;
    if (im) { ctx.imageSmoothingEnabled = false; const is = 40 * D; ctx.drawImage(im, cx + 8 * D, cy + (ch - is) / 2, is, is); }
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    outlined(kingName(it.realm), cx + 56 * D, cy + 18 * D, 12 * D, '#fff35c');
    thaiText(t('intro.kingOf', { realm: t(`realm.${it.realm}.short`) }), cx + 56 * D, cy + 38 * D, 12 * D, '#ffffff', 3 * D);
    ctx.textBaseline = 'top';
  }
  // Kill Streak popup
  const st = vfx.streak;
  if (st) {
    const pop = 1 + 0.8 * Math.max(0, 1 - st.t / 0.15), a = st.t > 1.1 ? (1.4 - st.t) / 0.3 : 1;
    ctx.globalAlpha = Math.max(0, a); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    outlined('×' + st.n + ' KO!', right, top + 96 * D, 14 * D * pop, st.n >= 100 ? '#ff5cf4' : '#ffd23f');
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
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(joy.ox * DPR, joy.oy * DPR, 40 * DPR, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.7;
    const dx = joy.cx - joy.ox, dy = joy.cy - joy.oy, l = Math.hypot(dx, dy), m = Math.min(l, 40) / (l || 1);
    ctx.beginPath(); ctx.arc((joy.ox + dx * m) * DPR, (joy.oy + dy * m) * DPR, 18 * DPR, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  const ub = document.getElementById('ultBtn')!;
  ub.style.setProperty('--p', (v.ult / v.cfg.ult.max) * 100 + '%');
  ub.classList.toggle('ready', v.ult >= v.cfg.ult.max);
  if (ub.dataset.w !== v.weapon + lang()) {
    ub.dataset.w = v.weapon + lang();
    ub.style.setProperty('--wcol', WEAPONS[v.weapon].col);
    document.getElementById('ultName')!.textContent = t(`weapon.${v.weapon}.name`).toUpperCase();
  }
}

/* ---------- skill panel (bottom left) ---------- */
function rrect(x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
/** A framed icon: square (Skills, Bench) or rounded (Passives); the atlas picture for `pic`, else the coloured letter. */
function panelIcon(x: number, y: number, sz: number, col: string, g: string, round: boolean, pic?: string): void {
  const D = screen.HD, r = iconRect(pic ?? '');
  ctx.fillStyle = INK; rrect(x - 2 * D, y - 2 * D, sz + 4 * D, sz + 4 * D, round ? 5 * D : 0); ctx.fill();
  ctx.fillStyle = r ? '#3a3363' : col; rrect(x, y, sz, sz, round ? 3 * D : 0); ctx.fill();
  if (r) {
    ctx.save(); rrect(x, y, sz, sz, round ? 3 * D : 0); ctx.clip();
    ctx.imageSmoothingEnabled = false; ctx.drawImage(iconAtlas, r[0], r[1], r[2], r[2], x, y, sz, sz);
    ctx.restore();
    return;
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.font = font(Math.round(sz * 0.42));
  ctx.fillText(g, x + sz / 2, y + sz / 2 + D);
}
/** An empty slot: dashed outline, so the player sees how many are left. */
function panelSlot(x: number, y: number, sz: number, round: boolean): void {
  const D = screen.HD;
  ctx.save(); ctx.setLineDash([3 * D, 2 * D]); ctx.strokeStyle = 'rgba(244,247,228,.5)'; ctx.lineWidth = 1.5 * D;
  rrect(x, y, sz, sz, round ? 3 * D : 0); ctx.stroke(); ctx.restore();
}
/** Level in the top-right corner; gold MAX at the cap. */
function panelLv(x: number, y: number, sz: number, lv: string | number, max = Infinity, col = '#ffffff'): void {
  const D = screen.HD, top = typeof lv === 'number' && lv >= max;
  ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  outlined(top ? 'MAX' : String(lv), x + sz + 3 * D, y - 4 * D, 6 * D, top ? '#ffd23f' : col);
}
/** EVO / AWK ribbon across the bottom edge of an icon. */
function panelRibbon(txt: string, x: number, y: number, sz: number): void {
  const D = screen.HD;
  ctx.fillStyle = INK; ctx.fillRect(x - 2 * D, y + sz - 5 * D, sz + 4 * D, 9 * D);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - D, y + sz - 4 * D, sz + 2 * D, 7 * D);
  ctx.fillStyle = INK; ctx.font = font(5 * D); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(txt, x + sz / 2, y + sz - 2.5 * D);
}

/**
 * Bottom-left panel: SKILL row (Signature first, x/attack slots), then PASSIVE x/slots, BENCH x/size and
 * PET (dragon, Shadow Clone, or the Shadow Shards collected toward one). Stops before `maxX` (the ULT button).
 */
function drawSkillPanel(v: Readonly<SimState>, left: number, bottom: number, maxX: number): void {
  const D = screen.HD, P = v.P, cfg = v.cfg;
  const sz = 22 * D, gap = 8 * D, ps = 16 * D, pg = 7 * D, lab = 6 * D;
  const yP = bottom - ps, yPl = yP - lab - 7 * D, yS = yPl - sz - 12 * D, ySl = yS - lab - 8 * D;
  const sig = signatureOf(P.ch);
  const skills = (Object.keys(P.skills) as SkillId[]).sort((a, c) => (a === sig ? -1 : c === sig ? 1 : 0));
  const atkSlots = Math.max(cfg.maxAttackSlots, skills.length);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  outlined(`${t('hud.panel.skill')} ${skills.length}/${cfg.maxAttackSlots}`, left, ySl, lab, '#ffb3b3');
  for (let i = 0; i < atkSlots; i++) {
    const x = left + i * (sz + gap);
    if (x + sz > maxX) break;
    const id = skills[i];
    if (!id) { panelSlot(x, yS, sz, false); continue; }
    const m = SKILL_ICON[id], lv = P.skills[id]!, evo = !!P.evo[id], isSig = id === sig;
    if (isSig && P.awakened) { // awakened: a pulsing gold glow
      ctx.fillStyle = `rgba(255,210,63,${0.3 + 0.4 * (0.5 + 0.5 * Math.sin(v.clock * 6))})`;
      rrect(x - 6 * D, yS - 6 * D, sz + 12 * D, sz + 12 * D, 4 * D); ctx.fill();
    }
    if (evo) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 4 * D, yS - 4 * D, sz + 8 * D, sz + 8 * D); }
    panelIcon(x, yS, sz, m.col, m.g, false, id);
    const cdv = P.cds[id] ?? 0;
    if (cdv > 0 && id !== 'orbit' && id !== 'frost') {
      const st = skillStats(cfg, id, lv, evo);
      if (st.cd) { ctx.fillStyle = 'rgba(30,27,51,.45)'; ctx.fillRect(x, yS, sz, sz * clamp(cdv / (st.cd * P.cdMul), 0, 1)); }
    }
    if (isSig) { // Signature: pink corner
      ctx.fillStyle = '#ff5cf4'; ctx.beginPath(); ctx.moveTo(x - 2 * D, yS - 2 * D); ctx.lineTo(x + 7 * D, yS - 2 * D); ctx.lineTo(x - 2 * D, yS + 7 * D); ctx.fill();
    }
    panelLv(x, yS, sz, lv, cfg.skills[id].max);
    if (isSig && P.awakened) panelRibbon('AWK', x, yS, sz);
    else if (evo) panelRibbon('EVO', x, yS, sz);
  }
  // passives
  const pas = Object.keys(P.pas) as PassiveId[], pasSlots = Math.max(cfg.passiveSlots, pas.length);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  outlined(`${t('hud.panel.passive')} ${pas.length}/${cfg.passiveSlots}`, left, yPl, lab, '#b3d4ff');
  for (let i = 0; i < pasSlots; i++) {
    const x = left + i * (ps + pg), id = pas[i];
    if (!id) { panelSlot(x, yP, ps, true); continue; }
    panelIcon(x, yP, ps, PASSIVE_ICON[id].col, PASSIVE_ICON[id].g, true, id);
    panelLv(x, yP, ps, P.pas[id]!, cfg.passives.max[id]);
  }
  let gx = left + pasSlots * (ps + pg) + 10 * D;
  /** Starts a group after a divider; returns its width (the label may be wider than the icons), or 0 if it does not fit. */
  const group = (label: string, col: string, iconsW: number): number => {
    ctx.font = font(lab);
    const w = Math.max(iconsW, ctx.measureText(label).width + 2 * D);
    if (gx + w > maxX) return 0;
    ctx.fillStyle = 'rgba(244,247,228,.3)'; ctx.fillRect(gx - 8 * D, yPl, 1.5 * D, ps + lab + 9 * D);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; outlined(label, gx, yPl, lab, col);
    return w;
  };
  // bench: dimmed with a dashed frame (these do not fire)
  const bSize = benchSize(v as SimState);
  const benchW = P.bench.length ? group(`${t('hud.panel.bench')} ${P.bench.length}/${bSize}`, '#c8c3d8', bSize * (ps + pg)) : 0;
  if (benchW) {
    for (let i = 0; i < bSize; i++) {
      const x = gx + i * (ps + pg), bk = P.bench[i];
      if (!bk) { panelSlot(x, yP, ps, false); continue; }
      ctx.globalAlpha = 0.5; panelIcon(x, yP, ps, SKILL_ICON[bk.id].col, SKILL_ICON[bk.id].g, false, bk.id); ctx.globalAlpha = 1;
      ctx.save(); ctx.setLineDash([2 * D, 2 * D]); ctx.strokeStyle = '#e8e4f4'; ctx.lineWidth = D; ctx.strokeRect(x - 3 * D, yP - 3 * D, ps + 6 * D, ps + 6 * D); ctx.restore();
      panelLv(x, yP, ps, bk.lv, cfg.skills[bk.id].max);
    }
    gx += benchW + 12 * D;
  }
  // companions: dragon pet, Shadow Clone, or the Shadow Shards collected toward one (dimmed, n/needed)
  const pets: { col: string; g: string; lv: string; dim: boolean; pic: string }[] = [];
  if (P.pet) pets.push({ pic: 'pet', col: P.pet.kind === 'frost' ? '#4fa8ff' : P.pet.kind === 'storm' ? '#d8b400' : P.pet.kind === 'tri' ? '#ffd23f' : '#ff6a2a', g: 'D', lv: String(P.pet.lv), dim: false });
  if (P.clone) pets.push({ pic: 'clone', col: '#6a4a9a', g: 'S', lv: String(P.clone.lv), dim: false });
  else if (P.shards > 0) pets.push({ pic: 'clone', col: '#6a4a9a', g: 'S', lv: `${P.shards}/${cfg.rival.shards}`, dim: true });
  ctx.font = font(6 * D);
  const step = pets.map((p) => ps + Math.max(pg, ctx.measureText(p.lv).width + 2 * D)); // room for the level / shard count
  if (pets.length && group(t('hud.panel.pet'), '#ffc59e', step.reduce((a, c) => a + c, 0))) {
    let x = gx;
    pets.forEach((p, i) => {
      if (i) x += step[i - 1];
      const cx = x + ps / 2, cy = yP + ps / 2;
      ctx.globalAlpha = p.dim ? 0.45 : 1;
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx, cy, ps / 2 + 2 * D, 0, TAU); ctx.fill();
      const r = iconRect(p.pic);
      ctx.fillStyle = r ? '#3a3363' : p.col; ctx.beginPath(); ctx.arc(cx, cy, ps / 2, 0, TAU); ctx.fill();
      if (r) {
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, ps / 2, 0, TAU); ctx.clip();
        ctx.imageSmoothingEnabled = false; ctx.drawImage(iconAtlas, r[0], r[1], r[2], r[2], x, yP, ps, ps); ctx.restore();
      } else { ctx.fillStyle = INK; ctx.font = font(7 * D); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.g, cx, cy + D); }
      ctx.globalAlpha = 1;
      panelLv(x, yP, ps, p.lv, Infinity, p.dim ? '#d9b8ff' : '#ffffff');
    });
  }
}
