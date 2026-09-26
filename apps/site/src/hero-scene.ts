// The animated strip at the bottom of the home hero: the four Heroes hold the middle while
// monsters from every Realm walk in and get knocked out by auto-firing skills. Pure decoration
// (aria-hidden); uses the game's real sprites. Reduced motion draws one still frame.
import type { HeroId } from '@pixel-horde/sim';
import { ENEMY_SPR, HERO_SPR } from '../../game/src/render/sprites';

const INK = '#1e1b33';
const HEROES: HeroId[] = ['knight', 'mage', 'ranger', 'alchemist'];
const MOBS = ['slime', 'bat', 'mush', 'sslime', 'scorp', 'mummy', 'ghost', 'islime', 'ibat', 'snowman', 'fbat', 'sala', 'frog', 'spore', 'cloud', 'sbird', 'jelly', 'crab', 'spider', 'book', 'lantern', 'charger', 'caster'];
const COLS = ['#ff5cf4', '#fff35c', '#ff8a3d', '#9fd8ff', '#b6f24a', '#7df9ff'];

interface Mob { id: string; x: number; y: number; vx: number; hp: number; flash: number; bob: number }
interface Shot { x: number; y: number; tx: number; ty: number; t: number; col: string; target: Mob }
interface Bit { x: number; y: number; vx: number; vy: number; t: number; col: string }
interface Gem { x: number; y: number; t: number; big: boolean }

export function heroScene(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SCALE = 3;
  let W = 0, H = 0;
  const mobs: Mob[] = [], shots: Shot[] = [], bits: Bit[] = [], gems: Gem[] = [];
  let spawnT = 0, fireT = 0, last = performance.now(), clock = 0;

  function resize(): void {
    const r = canvas.getBoundingClientRect();
    W = Math.max(120, Math.ceil(r.width / SCALE));
    H = Math.max(60, Math.ceil(r.height / SCALE));
    canvas.width = W; canvas.height = H;
  }
  resize();
  addEventListener('resize', resize);

  const cx = (): number => W / 2, groundY = (): number => H - 22;

  function spawn(): void {
    const left = Math.random() < 0.5;
    mobs.push({ id: MOBS[Math.floor(Math.random() * MOBS.length)], x: left ? -18 : W + 18, y: groundY() - 26 + Math.random() * 30, vx: (left ? 1 : -1) * (10 + Math.random() * 14), hp: 1 + Math.floor(Math.random() * 3), flash: 0, bob: Math.random() * 6 });
  }

  function pop(m: Mob): void {
    for (let i = 0; i < 10; i++) bits.push({ x: m.x, y: m.y - 6, vx: (Math.random() - 0.5) * 80, vy: -Math.random() * 60, t: 0.5 + Math.random() * 0.3, col: COLS[i % COLS.length] });
    gems.push({ x: m.x, y: m.y, t: 3, big: Math.random() < 0.15 });
  }

  function step(dt: number): void {
    clock += dt;
    spawnT -= dt; fireT -= dt;
    if (spawnT <= 0 && mobs.length < Math.max(8, W / 18)) { spawn(); spawnT = 0.35 + Math.random() * 0.5; }
    const guard = 46; // heroes stand between cx-guard and cx+guard
    for (const m of mobs) {
      const dist = m.x - cx();
      if (Math.abs(dist) > guard) m.x += m.vx * dt;
      m.flash = Math.max(0, m.flash - dt);
    }
    if (fireT <= 0 && mobs.length) {
      fireT = 0.16;
      const near = mobs.filter((m) => m.x > 0 && m.x < W).sort((a, b) => Math.abs(a.x - cx()) - Math.abs(b.x - cx()))[0];
      if (near) {
        const from = HEROES.length ? cx() - 30 + Math.floor(Math.random() * 4) * 20 : cx();
        shots.push({ x: from, y: groundY() - 14, tx: near.x, ty: near.y - 6, t: 0, col: COLS[Math.floor(Math.random() * COLS.length)], target: near });
      }
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.t += dt * 3.2;
      if (s.t >= 1) {
        shots.splice(i, 1);
        const m = s.target, idx = mobs.indexOf(m);
        if (idx < 0) continue;
        m.hp--; m.flash = 0.1;
        if (m.hp <= 0) { mobs.splice(idx, 1); pop(m); }
      }
    }
    for (let i = bits.length - 1; i >= 0; i--) { const b = bits[i]; b.t -= dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 160 * dt; if (b.t <= 0) bits.splice(i, 1); }
    for (let i = gems.length - 1; i >= 0; i--) {
      const gm = gems[i];
      gm.t -= dt;
      if (gm.t < 1.2) { gm.x += (cx() - gm.x) * dt * 3; gm.y += (groundY() - 8 - gm.y) * dt * 3; }
      if (gm.t <= 0) gems.splice(i, 1);
    }
  }

  function shadow(x: number, y: number, w: number): void {
    ctx.fillStyle = 'rgba(20,17,42,.35)';
    ctx.fillRect(Math.round(x - w / 2), Math.round(y), w, 2);
    ctx.fillRect(Math.round(x - w / 2 + 1), Math.round(y - 1), w - 2, 4);
  }

  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    const f = Math.floor(clock * 4) % 2;
    // gems
    for (const gm of gems) {
      const x = Math.round(gm.x), y = Math.round(gm.y), c = gm.big ? '#ff5cf4' : '#4fc3ff';
      ctx.fillStyle = INK; ctx.fillRect(x - 2, y - 3, 4, 6); ctx.fillRect(x - 3, y - 2, 6, 4);
      ctx.fillStyle = c; ctx.fillRect(x - 1, y - 2, 2, 4); ctx.fillRect(x - 2, y - 1, 4, 2); ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 2, 1, 1);
    }
    // monsters (sorted by y so nearer ones overlap)
    for (const m of [...mobs].sort((a, b) => a.y - b.y)) {
      const sh = ENEMY_SPR[m.id]; if (!sh) continue;
      const fr = sh[Math.floor(clock * 3 + m.bob) % sh.length];
      const img = m.flash > 0 ? fr.w : fr.n;
      const flip = m.vx < 0;
      shadow(m.x, m.y, img.width - 4);
      ctx.save();
      ctx.translate(Math.round(m.x), Math.round(m.y - img.height));
      if (!flip) { ctx.scale(-1, 1); ctx.drawImage(img, -Math.round(img.width / 2), 0); }
      else ctx.drawImage(img, -Math.round(img.width / 2), 0);
      ctx.restore();
    }
    // heroes
    HEROES.forEach((h, i) => {
      const x = cx() - 30 + i * 20, y = groundY() + (i % 2 ? -4 : 0);
      const img = (i < 2 ? HERO_SPR[h].l : HERO_SPR[h].r)[f];
      shadow(x, y, 12);
      ctx.drawImage(img, Math.round(x - 8), Math.round(y - 16));
    });
    // orbit blades around the knight
    for (let k = 0; k < 3; k++) {
      const a = clock * 3 + (k * Math.PI * 2) / 3, x = cx() - 30 + Math.cos(a) * 16, y = groundY() - 8 + Math.sin(a) * 9;
      ctx.fillStyle = INK; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
      ctx.fillStyle = '#7df9ff'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
    }
    // shots
    for (const s of shots) {
      const x = s.x + (s.tx - s.x) * s.t, y = s.y + (s.ty - s.y) * s.t - Math.sin(s.t * Math.PI) * 10;
      ctx.fillStyle = INK; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
      ctx.fillStyle = s.col; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    }
    for (const b of bits) { ctx.fillStyle = b.col; ctx.fillRect(Math.round(b.x), Math.round(b.y), 2, 2); }
  }

  if (reduced) {
    for (let i = 0; i < 14; i++) spawn();
    mobs.forEach((m, i) => { m.x = i % 2 ? cx() + 60 + i * 9 : cx() - 60 - i * 9; });
    draw();
    return;
  }
  function loop(now: number): void {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    if (!document.hidden) { step(dt); draw(); }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
