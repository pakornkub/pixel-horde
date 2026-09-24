// DOM overlays: title, hero select, shop, level-up, chest wheel, stage clear, game over, pause.
import { EVO_PASSIVE, HERO_IDS, HEROES, SHOP_IDS, WHEEL, shopCost, shopMax, skillStats, type LevelOption, type SimState } from '@pixel-horde/sim';
import { sfx } from '../audio/sfx';
import { META, U, getBest, metaSync, ownsHero } from '../meta';
import { active } from '../config';
import { HERO_SPR } from '../render/sprites';
import { fmtT } from '../render/draw';
import { t } from '@pixel-horde/i18n';
import { PASSIVE_ICON, SHOP_ICON, SKILL_ICON, evoDesc, evoName, heroDesc, heroName, passiveDesc, passiveName, shopDesc, shopName, skillDesc, skillDetail, skillName } from './text';

export const $ = (id: string): HTMLElement => document.getElementById(id)!;
export const show = (id: string): void => { $(id).classList.add('on'); };
export const hide = (id: string): void => { $(id).classList.remove('on'); };
const focusSoon = (id: string): void => { setTimeout(() => $(id).focus({ preventScroll: true }), 30); };

export function bestLine(): string {
  const bb = getBest();
  return t('title.best', { gold: META.gold }) + (bb ? t('title.bestRecord', { stage: bb.stage, kills: bb.kills }) : '');
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
    const c = active.cfg.heroes[k], name = heroName(k), owned = ownsHero(k);
    const bt = document.createElement('button');
    bt.className = 'ch' + (META.ch === k ? ' sel' : '') + (owned ? '' : ' locked');
    const im = document.createElement('img'); im.alt = ''; im.src = charImg(k);
    const cn = document.createElement('span'); cn.className = 'cn'; cn.textContent = name;
    const cc = document.createElement('span'); cc.className = 'cc'; cc.textContent = owned ? (META.ch === k ? t('hero.picked') : t('hero.pick')) : t('hero.unlock', { cost: c.cost });
    bt.append(im, cn, cc);
    bt.addEventListener('click', () => {
      void (async () => {
        if (!owned) {
          if (META.gold < c.cost) { $('chDesc').textContent = t('hero.needGold', { name, cost: c.cost, gold: META.gold }); return; }
          const err = await metaSync.unlockHero(k);
          if (err) { $('chDesc').textContent = t('hero.needGold', { name, cost: c.cost, gold: META.gold }); return; }
          sfx('lv');
        }
        metaSync.selectHero(k);
        renderChars();
        $('bestTxt').textContent = bestLine();
      })();
    });
    box.appendChild(bt);
  }
  const sel = HEROES[META.ch];
  $('chDesc').textContent = t('hero.desc', { name: heroName(META.ch), skill: skillName(sel.start), bonus: heroDesc(META.ch) });
}

/* ---------- shop ---------- */
let shopFrom = 'ovTitle';
function renderShop(): void {
  $('shopGold').textContent = 'GOLD ' + META.gold;
  const list = $('shopList');
  list.innerHTML = '';
  for (const id of SHOP_IDS) {
    const m = SHOP_ICON[id], lv = U(id), max = shopMax(active.cfg, id), maxed = lv >= max, c = shopCost(active.cfg, id, lv);
    const row = document.createElement('div');
    row.className = 'srow';
    row.innerHTML = `<span class="ico" style="background:${m.col}">${m.g}</span><span><span class="nm">${shopName(id)} ${lv}/${max}</span><span class="ds">${shopDesc(id)}</span></span>`;
    const bt = document.createElement('button');
    bt.className = 'buy';
    bt.textContent = maxed ? t('shop.maxed') : t('shop.buy', { cost: c });
    bt.disabled = maxed || META.gold < c;
    bt.addEventListener('click', async () => {
      bt.disabled = true;
      const err = await metaSync.buy(id);
      if (!err) sfx('lv');
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
  $('lvSlots').textContent = t('level.slots', { n: Object.keys(P.skills).length, max: v.cfg.maxAttackSlots });
  $('lvTitle').textContent = lu.chest ? t('level.chestTitle') : t('level.title', { lv: lu.lv });
  lu.options.forEach((o: LevelOption, idx) => {
    const bt = document.createElement('button');
    bt.className = 'opt';
    let meta: { col: string; g: string }, name: string, desc: string, tag = '';
    if (o.kind === 'evo') {
      meta = { col: '#ffd23f', g: SKILL_ICON[o.id].g };
      name = evoName(o.id); tag = `<i>${t('level.evolve')}</i>`;
      desc = `${evoDesc(o.id)} (${skillName(o.id)} + ${passiveName(EVO_PASSIVE[o.id])})`;
      bt.classList.add('evo');
    } else if (o.kind === 'skill') {
      meta = SKILL_ICON[o.id];
      const lv = P.skills[o.id] || 0;
      name = skillName(o.id);
      tag = lv ? `LV ${lv}→${lv + 1}` : `<i>${t('level.new')}</i>`;
      desc = (lv ? '' : skillDesc(o.id) + ' ') + '(' + skillDetail(o.id, skillStats(v.cfg, o.id, lv + 1, false)) + ')';
      if (lv + 1 === v.cfg.skills[o.id].max) desc += t('level.final', { passive: passiveName(EVO_PASSIVE[o.id]) });
    } else if (o.kind === 'pas') {
      meta = PASSIVE_ICON[o.id];
      const lv = P.pas[o.id] || 0;
      name = passiveName(o.id);
      tag = lv ? `LV ${lv}→${lv + 1}` : `<i>${t('level.new')}</i>`;
      desc = passiveDesc(o.id);
    } else {
      meta = { col: '#ffa6c2', g: '♥' };
      name = t('level.recover');
      desc = t('level.recoverDesc');
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
  $('chestTxt').textContent = t('chest.spinning');
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
      $('chestTxt').textContent = t('chest.won', { n: spin.res });
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
  $('clearTitle').textContent = t('clear.title', { n: v.stage });
  $('clearStats').innerHTML = statRows([[t('stat.stageKills'), v.stageKills], [t('stat.runGold'), runGold + 'G'], [t('stat.kills'), v.kills], [t('stat.streak'), v.maxStreak], [t('stat.level'), v.P.lv]]);
  show('ovClear');
  focusSoon('nextBtn');
}

export function showOver(v: Readonly<SimState>, runGold: number): void {
  $('retryBtn').hidden = false;
  $('overStats').innerHTML = statRows([[t('stat.hero'), heroName(v.hero)], [t('stat.runGoldOver'), runGold + 'G'], [t('stat.wallet'), META.gold + 'G'], [t('stat.stage'), v.stage], [t('stat.time'), fmtT(v.totalTime)], [t('stat.kills'), v.kills], [t('stat.streak'), v.maxStreak], [t('stat.level'), v.P.lv]]);
  $('bestOver').textContent = bestLine();
  show('ovOver');
  focusSoon('retryBtn');
}

export function showPause(): void {
  $('leaveBtn').textContent = t('pause.leave');
  $('pauseTxt').textContent = t('pause.text');
  show('ovPause');
  focusSoon('resumeBtn');
}

export function setPlayUI(on: boolean): void {
  $('ultBtn').style.display = on ? 'block' : 'none';
  $('pauseBtn').style.display = on ? 'block' : 'none';
}

/** Fill every [data-i18n], [data-i18n-html] and [data-i18n-aria] element. */
export function applyStaticText(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n!); });
  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml!); });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria!)); });
  document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder!); });
}
