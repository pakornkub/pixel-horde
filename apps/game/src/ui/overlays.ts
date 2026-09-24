// DOM overlays: title, hero select, shop, level-up, chest wheel, stage clear, game over, pause.
import { EVO_PASSIVE, HERO_IDS, HEROES, SHOP_IDS, WHEEL, shopCost, shopMax, skillStats, type LevelOption, type SimState } from '@pixel-horde/sim';
import { sfx } from '../audio/sfx';
import { META, U, getBest, ownsHero, saveMeta } from '../meta';
import { active } from '../config';
import { HERO_SPR } from '../render/sprites';
import { fmtT } from '../render/draw';
import { EVO_TEXT, HERO_TEXT, PASSIVE_TEXT, SHOP_TEXT, SKILL_TEXT, skillDetail } from './text';

export const $ = (id: string): HTMLElement => document.getElementById(id)!;
export const show = (id: string): void => { $(id).classList.add('on'); };
export const hide = (id: string): void => { $(id).classList.remove('on'); };
const focusSoon = (id: string): void => { setTimeout(() => $(id).focus({ preventScroll: true }), 30); };

export function bestLine(): string {
  const bb = getBest();
  return `เหรียญในกระเป๋า ${META.gold}G` + (bb ? ` | สถิติดีที่สุด: ถึงด่าน ${bb.stage}, KO ${bb.kills}` : '');
}

export function statRows(rows: [string, string | number][]): string {
  return rows.map(([a, c]) => `<span>${a}</span><span>${c}</span>`).join('');
}

/* ---------- hero select ---------- */
const CHIMG: Record<string, string> = {};
function charImg(k: string): string {
  if (CHIMG[k]) return CHIMG[k];
  const c = document.createElement('canvas');
  c.width = 48; c.height = 48;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.drawImage(HERO_SPR[k].r[0], 0, 0, 48, 48);
  let u = '';
  try { u = c.toDataURL(); } catch { /* ignore */ }
  return (CHIMG[k] = u);
}

export function renderChars(): void {
  const box = $('chars');
  box.innerHTML = '';
  for (const k of HERO_IDS) {
    const c = active.cfg.heroes[k], t = HERO_TEXT[k], owned = ownsHero(k);
    const bt = document.createElement('button');
    bt.className = 'ch' + (META.ch === k ? ' sel' : '') + (owned ? '' : ' locked');
    const im = document.createElement('img'); im.alt = ''; im.src = charImg(k);
    const cn = document.createElement('span'); cn.className = 'cn'; cn.textContent = t.name;
    const cc = document.createElement('span'); cc.className = 'cc'; cc.textContent = owned ? (META.ch === k ? 'เลือกอยู่' : 'เลือก') : 'ปลดล็อก ' + c.cost + 'G';
    bt.append(im, cn, cc);
    bt.addEventListener('click', () => {
      if (!owned) {
        if (META.gold < c.cost) { $('chDesc').textContent = `${t.name} ต้องใช้ ${c.cost}G ในการปลดล็อก ตอนนี้มี ${META.gold}G`; return; }
        META.gold -= c.cost;
        META.owned.push(k);
        sfx('lv');
      }
      META.ch = k;
      saveMeta();
      renderChars();
      $('bestTxt').textContent = bestLine();
    });
    box.appendChild(bt);
  }
  const sel = HEROES[META.ch];
  $('chDesc').textContent = `${HERO_TEXT[META.ch].name}: เริ่มด้วย ${SKILL_TEXT[sel.start].name}, ${HERO_TEXT[META.ch].th}`;
}

/* ---------- shop ---------- */
let shopFrom = 'ovTitle';
function renderShop(): void {
  $('shopGold').textContent = 'GOLD ' + META.gold;
  const list = $('shopList');
  list.innerHTML = '';
  for (const id of SHOP_IDS) {
    const m = SHOP_TEXT[id], lv = U(id), max = shopMax(active.cfg, id), maxed = lv >= max, c = shopCost(active.cfg, id, lv);
    const row = document.createElement('div');
    row.className = 'srow';
    row.innerHTML = `<span class="ico" style="background:${m.col}">${m.g}</span><span><span class="nm">${m.name} ${lv}/${max}</span><span class="ds">${m.th}</span></span>`;
    const bt = document.createElement('button');
    bt.className = 'buy';
    bt.textContent = maxed ? 'เต็มแล้ว' : `ซื้อ ${c}G`;
    bt.disabled = maxed || META.gold < c;
    bt.addEventListener('click', () => {
      const cost = shopCost(active.cfg, id, U(id));
      if (U(id) >= max || META.gold < cost) return;
      META.gold -= cost;
      META.up[id] = U(id) + 1;
      saveMeta();
      sfx('lv');
      renderShop();
    });
    row.appendChild(bt);
    list.appendChild(row);
  }
}
export function openShop(from: string): void {
  shopFrom = from;
  hide(from);
  renderShop();
  show('ovShop');
  focusSoon('shopBack');
}
export function closeShop(): void {
  hide('ovShop');
  renderChars();
  $('bestTxt').textContent = bestLine();
  $('bestOver').textContent = bestLine();
  show(shopFrom);
}

/* ---------- level up ---------- */
export function renderLevelUp(v: Readonly<SimState>, onPick: (i: number) => void): void {
  const lu = v.levelUp!, P = v.P;
  const box = $('opts');
  box.innerHTML = '';
  $('lvSlots').textContent = `ช่องสกิลโจมตี ${Object.keys(P.skills).length}/6 (เต็มแล้วจะได้แค่อัปเกรดสกิลเดิม)`;
  $('lvTitle').textContent = lu.chest ? 'TREASURE CHEST' : 'LEVEL UP!  LV ' + lu.lv;
  lu.options.forEach((o: LevelOption, idx) => {
    const bt = document.createElement('button');
    bt.className = 'opt';
    let meta: { col: string; g: string }, name: string, desc: string, tag = '';
    if (o.kind === 'evo') {
      const ev = EVO_TEXT[o.id];
      meta = { col: '#ffd23f', g: SKILL_TEXT[o.id].g };
      name = ev.name; tag = '<i>EVOLVE!</i>';
      desc = `${ev.th} (${SKILL_TEXT[o.id].name} + ${PASSIVE_TEXT[EVO_PASSIVE[o.id]].name})`;
      bt.classList.add('evo');
    } else if (o.kind === 'skill') {
      meta = SKILL_TEXT[o.id];
      const lv = P.skills[o.id] || 0;
      name = SKILL_TEXT[o.id].name;
      tag = lv ? `LV ${lv}→${lv + 1}` : '<i>NEW!</i>';
      desc = (lv ? '' : SKILL_TEXT[o.id].th + ' ') + '(' + skillDetail(o.id, skillStats(v.cfg, o.id, lv + 1, false)) + ')';
      if (lv + 1 === v.cfg.skills[o.id].max) desc += ` ขั้นสุดท้าย วิวัฒน์ได้ถ้ามี ${PASSIVE_TEXT[EVO_PASSIVE[o.id]].name}`;
    } else if (o.kind === 'pas') {
      meta = PASSIVE_TEXT[o.id];
      const lv = P.pas[o.id] || 0;
      name = PASSIVE_TEXT[o.id].name;
      tag = lv ? `LV ${lv}→${lv + 1}` : '<i>NEW!</i>';
      desc = PASSIVE_TEXT[o.id].th;
    } else {
      meta = { col: '#ffa6c2', g: '♥' };
      name = 'Recover';
      desc = 'ฟื้น HP เต็มหลอด';
    }
    bt.innerHTML = `<span class="cur">▶</span><span class="ico" style="background:${meta.col}">${meta.g}</span><span><span class="nm">${name} ${tag}</span><span class="ds">${desc}</span></span>`;
    bt.addEventListener('click', () => onPick(idx));
    bt.dataset.k = String(idx + 1);
    box.appendChild(bt);
  });
  show('ovLevel');
  setTimeout(() => { const f = box.querySelector<HTMLElement>('.opt'); if (f) f.focus({ preventScroll: true }); }, 30);
}

/* ---------- chest wheel (animation only; the sim already chose the result) ---------- */
interface Spin { idx: number; left: number; iv: number; acc: number; res: number; hold: number; done: boolean }
let spin: Spin | null = null;

export function openChest(res: number, target: number, start: number): void {
  spin = { idx: start, left: 24 + ((target - start + 8) % 8), iv: 0.035, acc: 0, res, hold: 0, done: false };
  const w = $('wheel');
  w.innerHTML = '';
  WHEEL.forEach((val) => { const c = document.createElement('div'); c.className = 'cell'; c.textContent = 'x' + val; w.appendChild(c); });
  $('chestTxt').textContent = 'กำลังหมุน...';
  hlWheel();
  show('ovChest');
}
function hlWheel(): void {
  const cs = $('wheel').children;
  for (let i = 0; i < cs.length; i++) cs[i].classList.toggle('on', i === spin!.idx);
}
/** Returns true once the spin + hold has finished (then the caller sends chestStop). */
export function chestTick(rdt: number): boolean {
  if (!spin) return false;
  if (spin.left > 0) {
    spin.acc += rdt;
    while (spin.left > 0 && spin.acc >= spin.iv) { spin.acc -= spin.iv; spin.idx = (spin.idx + 1) % 8; spin.left--; spin.iv *= 1.06; sfx('tick'); }
    hlWheel();
    if (spin.left === 0) {
      spin.done = true;
      $('chestTxt').textContent = `ได้อัปเกรดฟรี ${spin.res} ครั้ง!`;
      sfx('clear');
      const c = $('wheel').children[spin.idx];
      if (c) c.classList.add('win');
    }
    return false;
  }
  spin.hold += rdt;
  if (spin.hold > 1.1) { spin = null; hide('ovChest'); return true; }
  return false;
}
export function cancelChest(): void { spin = null; hide('ovChest'); }

/* ---------- stage clear / game over ---------- */
export function showClear(v: Readonly<SimState>, runGold: number): void {
  $('clearTitle').textContent = 'STAGE ' + v.stage + ' CLEAR';
  $('clearStats').innerHTML = statRows([['KO ในด่านนี้', v.stageKills], ['เหรียญรอบนี้', runGold + 'G'], ['KO รวม', v.kills], ['Kill Streak สูงสุด', v.maxStreak], ['เลเวล', v.P.lv]]);
  show('ovClear');
  focusSoon('nextBtn');
}

export function showOver(v: Readonly<SimState>, runGold: number): void {
  $('retryBtn').hidden = false;
  $('overStats').innerHTML = statRows([['ตัวละคร', HERO_TEXT[v.hero].name], ['เหรียญที่ได้รอบนี้', runGold + 'G'], ['เหรียญในกระเป๋า', META.gold + 'G'], ['ด่านที่ไปถึง', v.stage], ['เวลารอดรวม', fmtT(v.totalTime)], ['KO รวม', v.kills], ['Kill Streak สูงสุด', v.maxStreak], ['เลเวล', v.P.lv]]);
  $('bestOver').textContent = bestLine();
  show('ovOver');
  focusSoon('retryBtn');
}

export function showPause(): void {
  $('leaveBtn').textContent = 'จบรอบนี้และกลับหน้าแรก';
  $('pauseTxt').textContent = 'กด P หรือปุ่มด้านล่างเพื่อเล่นต่อ';
  show('ovPause');
  focusSoon('resumeBtn');
}

export function setPlayUI(on: boolean): void {
  $('ultBtn').style.display = on ? 'block' : 'none';
  $('pauseBtn').style.display = on ? 'block' : 'none';
}
