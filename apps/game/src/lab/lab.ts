// Sprite Lab (ticket 33): developer-only pixel editor for the per-Realm sprite files.
// Served by `npm run lab` (vite dev); never part of the production build.
import './lab.css';
import { LUMORA } from '../sprites/lumora';
import { formatRows, parseRows, validateSprite, TRANSPARENT, type SpriteDef } from '../sprites/types';
import { recolor, spr } from '../render/sprites';
import { tileAtT } from '../render/tiles';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const DRAFT = 'spritelab:';
const FREE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJLMNOPQRSTUVWXZ0123456789';
const GROUNDS = ['Greenvale (grass)', 'Sunscar (desert)', 'Deepdark (cave)', 'Frostpeak (snow)'];

type Tool = 'pen' | 'erase' | 'fill' | 'pick';
interface Entry { realm: string; name: string; file: SpriteDef; palette: string[]; ground: number }

const entries: Entry[] = LUMORA.flatMap((r) => Object.entries(r.sprites).map(([name, file]) => ({ realm: r.realm, name, file, palette: r.palette, ground: r.ground })));
let cur: Entry = entries.find((e) => e.name === 'slime') || entries[0];
let def: SpriteDef = load(cur);
let frame = 0;
let tool: Tool = 'pen';
let ink = 'K';
const undo: string[] = [];

function clone(d: SpriteDef): SpriteDef { return JSON.parse(JSON.stringify({ frames: d.frames, pal: d.pal })); }
function load(e: Entry): SpriteDef {
  try { const s = localStorage.getItem(DRAFT + e.name); if (s) return JSON.parse(s); } catch { /* ignore */ }
  return clone(e.file);
}
const isDirty = (e: Entry): boolean => { try { return localStorage.getItem(DRAFT + e.name) !== null; } catch { return false; } };
function save(): void {
  try {
    if (JSON.stringify(def) === JSON.stringify(clone(cur.file))) localStorage.removeItem(DRAFT + cur.name);
    else localStorage.setItem(DRAFT + cur.name, JSON.stringify(def));
  } catch { /* ignore */ }
}
function snapshot(): void { undo.push(JSON.stringify(def)); if (undo.length > 100) undo.shift(); }

/* ---------- list ---------- */
function renderList(): void {
  const nav = $('list');
  nav.innerHTML = '';
  for (const r of LUMORA) {
    const h = document.createElement('h4'); h.textContent = r.realm; nav.appendChild(h);
    for (const name of Object.keys(r.sprites)) {
      const e = entries.find((x) => x.name === name)!;
      const b = document.createElement('button');
      b.textContent = name;
      if (isDirty(e)) { const d = document.createElement('span'); d.className = 'dot'; d.title = 'draft (unsaved to file)'; b.appendChild(d); }
      b.setAttribute('aria-current', String(e === cur));
      b.addEventListener('click', () => select(e));
      nav.appendChild(b);
    }
  }
}
function select(e: Entry): void {
  cur = e; def = load(e); frame = 0; undo.length = 0;
  ink = Object.keys(def.pal).find((k) => k !== 'K') || 'K';
  ($('ground') as HTMLSelectElement).value = String(e.ground);
  renderAll();
}

/* ---------- grid ---------- */
const grid = $<HTMLCanvasElement>('grid');
const gx = grid.getContext('2d')!;
const rows = (): string[] => def.frames[frame];
const W = (): number => rows()[0]?.length || 1;
const H = (): number => rows().length || 1;
const cell = (): number => Math.max(8, Math.min(28, Math.floor(560 / Math.max(W(), H()))));

function drawGrid(): void {
  const c = cell(), w = W(), h = H();
  grid.width = w * c; grid.height = h * c;
  gx.clearRect(0, 0, grid.width, grid.height);
  rows().forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      if (ch === TRANSPARENT) continue;
      gx.fillStyle = def.pal[ch] || '#ff00ff';
      gx.fillRect(x * c, y * c, c, c);
    }
  });
  gx.strokeStyle = 'rgba(30,27,51,.15)';
  gx.lineWidth = 1;
  for (let x = 0; x <= w; x++) { gx.beginPath(); gx.moveTo(x * c + 0.5, 0); gx.lineTo(x * c + 0.5, h * c); gx.stroke(); }
  for (let y = 0; y <= h; y++) { gx.beginPath(); gx.moveTo(0, y * c + 0.5); gx.lineTo(w * c, y * c + 0.5); gx.stroke(); }
}

function setCell(x: number, y: number, ch: string): void {
  const r = rows();
  if (y < 0 || y >= r.length || x < 0 || x >= r[y].length || r[y][x] === ch) return;
  r[y] = r[y].slice(0, x) + ch + r[y].slice(x + 1);
}
function flood(x: number, y: number, ch: string): void {
  const r = rows(), from = r[y]?.[x];
  if (from === undefined || from === ch) return;
  const stack: [number, number][] = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    if (rows()[cy]?.[cx] !== from) continue;
    setCell(cx, cy, ch);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
}
function at(ev: PointerEvent): [number, number] {
  const b = grid.getBoundingClientRect(), c = cell() * (b.width / grid.width);
  return [Math.floor((ev.clientX - b.left) / c), Math.floor((ev.clientY - b.top) / c)];
}
let painting = false;
function apply(ev: PointerEvent): void {
  const [x, y] = at(ev);
  const erase = ev.buttons === 2 || tool === 'erase';
  if (tool === 'pick') { const ch = rows()[y]?.[x]; if (ch && ch !== TRANSPARENT) { ink = ch; setTool('pen'); renderPalette(); } return; }
  if (tool === 'fill' && !erase) { flood(x, y, ink); painting = false; }
  else setCell(x, y, erase ? TRANSPARENT : ink);
  changed();
}
grid.addEventListener('contextmenu', (e) => e.preventDefault());
grid.addEventListener('pointerdown', (e) => { snapshot(); painting = true; grid.setPointerCapture(e.pointerId); apply(e); });
grid.addEventListener('pointermove', (e) => { if (painting && tool !== 'fill' && tool !== 'pick') apply(e); });
grid.addEventListener('pointerup', () => { painting = false; });

/* ---------- palette ---------- */
function renderPalette(): void {
  const box = $('palette');
  box.innerHTML = '';
  for (const [ch, col] of Object.entries(def.pal)) {
    const b = document.createElement('div');
    b.className = 'sw';
    b.setAttribute('role', 'button');
    b.tabIndex = 0;
    b.setAttribute('aria-pressed', String(ch === ink));
    const chip = document.createElement('span'); chip.className = 'chip'; chip.style.background = col;
    const code = document.createElement('code'); code.textContent = ch;
    const picker = document.createElement('input'); picker.type = 'color'; picker.value = col; picker.title = 'change colour';
    picker.addEventListener('input', () => { snapshot(); def.pal[ch] = picker.value; changed(); });
    b.append(chip, code, picker);
    b.addEventListener('click', (e) => { if (e.target !== picker) { ink = ch; setTool('pen'); renderPalette(); } });
    box.appendChild(b);
  }
  const lab = document.createElement('span'); lab.className = 'muted'; lab.textContent = ' + สีจากชุดของดินแดน:'; box.appendChild(lab);
  for (const col of cur.palette) {
    const b = document.createElement('button');
    b.className = 'chip'; b.style.background = col; b.title = 'add ' + col;
    b.addEventListener('click', () => {
      const existing = Object.entries(def.pal).find(([, c]) => c.toLowerCase() === col.toLowerCase());
      if (existing) { ink = existing[0]; }
      else {
        const ch = [...FREE_CHARS].find((c) => !(c in def.pal));
        if (!ch) return;
        snapshot(); def.pal[ch] = col; ink = ch; changed();
      }
      setTool('pen'); renderPalette();
    });
    box.appendChild(b);
  }
}

/* ---------- frames ---------- */
function renderFrames(): void {
  const box = $('frameTabs');
  box.innerHTML = '';
  def.frames.forEach((_, i) => {
    const b = document.createElement('button');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(i === frame));
    b.textContent = 'เฟรม ' + (i + 1);
    b.addEventListener('click', () => { frame = i; renderAll(); });
    box.appendChild(b);
  });
  const add = document.createElement('button'); add.textContent = '+ ทำสำเนาเฟรม';
  add.addEventListener('click', () => { snapshot(); def.frames.splice(frame + 1, 0, rows().slice()); frame++; changed(); });
  const del = document.createElement('button'); del.textContent = '− ลบเฟรม'; del.disabled = def.frames.length < 2;
  del.addEventListener('click', () => { snapshot(); def.frames.splice(frame, 1); frame = Math.max(0, frame - 1); changed(); });
  box.append(add, del);
  ($('w') as HTMLInputElement).value = String(W());
  ($('h') as HTMLInputElement).value = String(H());
}

/* ---------- preview ---------- */
const pv = $<HTMLCanvasElement>('preview');
const px = pv.getContext('2d')!;
const low = document.createElement('canvas');
const lx = low.getContext('2d')!;
function drawPreview(t: number): void {
  const sc = Number(($('scale') as HTMLSelectElement).value);
  const gi = Number(($('ground') as HTMLSelectElement).value);
  low.width = Math.ceil(pv.width / sc); low.height = Math.ceil(pv.height / sc);
  lx.imageSmoothingEnabled = false;
  for (let ty = 0; ty * 16 < low.height; ty++) for (let tx = 0; tx * 16 < low.width; tx++) lx.drawImage(tileAtT(gi, tx + 3, ty + 5), tx * 16, ty * 16);
  const fi = Math.floor(t / 250) % def.frames.length;
  const img = spr(def.frames[fi], def.pal);
  const bossScale = /^boss/.test(cur.name) ? 3 : cur.name === 'dragon' || cur.name === 'splitter' ? 2 : 1;
  const w = img.width * bossScale, h = img.height * bossScale, cx = low.width / 2, cy = low.height / 2;
  lx.fillStyle = 'rgba(30,27,51,.3)';
  lx.beginPath(); lx.ellipse(cx, cy + h / 2, w * 0.35, Math.max(1.5, h * 0.12), 0, 0, Math.PI * 2); lx.fill();
  const bob = Math.round(Math.sin(t / 160) * 0.5);
  lx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2 + bob), w, h);
  px.imageSmoothingEnabled = false;
  px.drawImage(low, 0, 0, low.width * sc, low.height * sc);
}
function renderVariants(): void {
  const box = $('variants');
  box.innerHTML = '';
  const base = spr(rows(), def.pal);
  const list: [string, HTMLCanvasElement][] = [['ปกติ', base], ['โดนตี', recolor(base, '#ffffff', 1)], ['elite', recolor(base, '#ff2a3a', 0.45)], ['แข็ง', recolor(base, '#9fd8ff', 0.6)], ['เกราะ', recolor(base, '#8a94a8', 0.55)]];
  for (const [label, c] of list) {
    const f = document.createElement('figure');
    const v = document.createElement('canvas');
    v.width = c.width * 3; v.height = c.height * 3;
    const x = v.getContext('2d')!; x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, v.width, v.height);
    const cap = document.createElement('figcaption'); cap.textContent = label;
    f.append(v, cap); box.appendChild(f);
  }
}
const loop = (t: number): void => { drawPreview(t); requestAnimationFrame(loop); };

/* ---------- validation + text ---------- */
function renderProblems(): void {
  const p = validateSprite(cur.name, def);
  const el = $('problems');
  el.className = 'problems' + (p.length ? '' : ' ok');
  el.textContent = p.length ? p.map((x) => `เฟรม ${x.frame + 1} แถว ${x.row + 1}: ${x.message}`).join('\n') : '✓ ผ่านตัวตรวจ (แถวยาวเท่ากัน, ใช้แต่สีในชุด)';
}
function tsLiteral(): string {
  const frames = def.frames.map((f) => formatRows(f).replace(/\n/g, '\n  ')).join(',\n  ');
  const pal = Object.entries(def.pal).map(([k, v]) => `${/^[A-Za-z_]\w*$/.test(k) ? k : JSON.stringify(k)}: '${v}'`).join(', ');
  return `${cur.name}: {\n  frames: [\n  ${frames}\n  ],\n  pal: { ${pal} },\n},`;
}

function changed(): void { save(); renderAll(); }
function renderAll(): void {
  renderList(); renderFrames(); renderPalette(); drawGrid(); renderVariants(); renderProblems();
  ($('rows') as HTMLTextAreaElement).value = formatRows(rows());
}
function setTool(t: Tool): void {
  tool = t;
  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
}
function msg(s: string): void { $('msg').textContent = s; }

document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool as Tool)));
$('resize').addEventListener('click', () => {
  const w = Math.max(1, Math.min(64, Number(($('w') as HTMLInputElement).value) || W()));
  const h = Math.max(1, Math.min(64, Number(($('h') as HTMLInputElement).value) || H()));
  snapshot();
  def.frames = def.frames.map((f) => {
    const out = f.slice(0, h).map((r) => r.slice(0, w).padEnd(w, TRANSPARENT));
    while (out.length < h) out.push(TRANSPARENT.repeat(w));
    return out;
  });
  changed();
});
$('undo').addEventListener('click', () => { const s = undo.pop(); if (s) { def = JSON.parse(s); frame = Math.min(frame, def.frames.length - 1); changed(); } });
addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); $('undo').click(); } });
$('flipH').addEventListener('click', () => { snapshot(); def.frames[frame] = rows().map((r) => [...r].reverse().join('')); changed(); });
$('reset').addEventListener('click', () => {
  if (!confirm('ทิ้งการแก้ไขของ ' + cur.name + ' แล้วคืนค่าจากไฟล์?')) return;
  try { localStorage.removeItem(DRAFT + cur.name); } catch { /* ignore */ }
  def = clone(cur.file); frame = 0; undo.length = 0; renderAll();
});
$('copy').addEventListener('click', async () => {
  const text = formatRows(rows());
  ($('rows') as HTMLTextAreaElement).value = text;
  try { await navigator.clipboard.writeText(text); msg('คัดลอกเฟรมแล้ว'); } catch { msg('เลือกข้อความในช่องแล้วกด Ctrl+C'); }
});
$('copyAll').addEventListener('click', async () => {
  const text = tsLiteral();
  ($('rows') as HTMLTextAreaElement).value = text;
  try { await navigator.clipboard.writeText(text); msg('คัดลอกทั้งตัวแล้ว วางแทนของเดิมในไฟล์ sprites/lumora/' + cur.realm + '.ts'); } catch { msg('เลือกข้อความในช่องแล้วกด Ctrl+C'); }
});
$('paste').addEventListener('click', () => {
  const r = parseRows(($('rows') as HTMLTextAreaElement).value);
  if (!r.length) { msg('ไม่พบแถวตัวอักษร'); return; }
  snapshot(); def.frames[frame] = r; changed();
  msg('วางแล้ว ' + r.length + ' แถว');
});
const gsel = $('ground') as HTMLSelectElement;
GROUNDS.forEach((g, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = g; gsel.appendChild(o); });
gsel.value = String(cur.ground);
$('scale').addEventListener('change', () => undefined);

select(cur);
requestAnimationFrame(loop);
