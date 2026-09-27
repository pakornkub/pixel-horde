// Special shop (ticket 56): the Gold sinks after the permanent shop. One screen with tabs: Weapon forge and outfits
// open after the first win (Umbra beaten once), Hero Mastery from the start. The server refuses locked purchases too.
import { OUTFIT_SETS, OUTFIT_SLOTS, WEAPON_IDS, WEAPONS, forgeCost, forgeDmg, forgeMul, forgeStun, outfitCost, outfitSet, ultCap, type OutfitSet, type OutfitSlot, type WeaponId } from '@pixel-horde/sim';
import { onLangChange, t } from '@pixel-horde/i18n';
import { sfx } from '../audio/sfx';
import { active } from '../config';
import { META, metaSync } from '../meta';
import { HELD_SPR } from '../render/sprites';
import { fmtN } from '../fmt';
import { $, hide, show } from './overlays';

type Tab = 'forge' | 'mastery' | 'outfits';
let tab: Tab = 'forge';
let msg = '';
/** The message is good news (e.g. bought but not worn), not a refusal. */
let msgOk = false;
/** An outfit purchase's note, shown on the piece's own card (the page may be scrolled far below #specialMsg). */
let pieceNote: { set: OutfitSet; slot: OutfitSlot; text: string; ok: boolean } | null = null;
/** Tutorial-hint id marking that the player has seen the unlocked special shop (clears the NEW badge). */
const SEEN = 'special';

/** Tabs that wait for the first win. */
const locked = (x: Tab): boolean => x !== 'mastery' && !metaSync.hasWon();

/** The held Weapon sprite (in the Weapon's colour) enlarged for a shop row; the dedicated 32×32 Weapon icons are a follow-up. */
const IMG: Partial<Record<WeaponId, string>> = {};
function weaponImg(w: WeaponId): string {
  if (IMG[w] !== undefined) return IMG[w];
  const src = HELD_SPR[w]?.[0];
  if (!src) return (IMG[w] = '');
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  const k = Math.floor(Math.min(32 / src.width, 32 / src.height));
  x.drawImage(src, Math.floor((32 - src.width * k) / 2), Math.floor((32 - src.height * k) / 2), src.width * k, src.height * k);
  try { IMG[w] = c.toDataURL(); } catch { IMG[w] = ''; }
  return IMG[w];
}

const round = (v: number, d = 1): string => String(Math.round(v * 10 ** d) / 10 ** d);
/** The forged effect of a Weapon at a level, as shown in the shop (Hero bonuses such as Vex's Statuses not included). */
function fxValue(w: WeaponId, lv: number): string {
  const C = active.cfg, W = C.weapons, m = forgeMul(C, w, lv), sec = (n: number): string => t('forge.sec', { n: round(n) });
  switch (WEAPONS[w].form) {
    case 'judgement': return lv ? sec(forgeStun(C, lv)) : t('forge.none');
    case 'root': return sec(W.root * m);
    case 'burn': return sec(C.status.burning * m);
    case 'reap': return round(Math.min(1, W.execute * m) * 100, 0) + '%';
    case 'freeze': return sec(W.freeze * m);
    case 'crash': return '×' + round(W.crashKb * m);
    case 'plague': return round(W.plagueDps * m * 100, 0) + '%';
    case 'shock': return sec(C.status.shocked * m);
    case 'push': return round(W.push * m, 0);
    case 'turret': return sec(W.turretDur * m);
    case 'harvest': return round(W.harvestHeal * m * 100) + '% / ' + round(W.harvestHealMax * m * 100, 0) + '%';
  }
}

/** Ultimate damage × and the King cap at a forge level (and the next one unless maxed). */
function powerLine(lv: number, maxed: boolean): string {
  const C = active.cfg, dmg = (l: number): string => `×${round(forgeDmg(C, l))}`, cap = (l: number): string => `${round(ultCap(C, false, l) * 100)}%`;
  return t('forge.power', { dmg: maxed ? dmg(lv) : `${dmg(lv)} → ${dmg(lv + 1)}`, cap: maxed ? cap(lv) : `${cap(lv)} → ${cap(lv + 1)}` });
}

/** Buy button text and state: the price, "Max", or how much Gold is still missing (red). */
function priceButton(bt: HTMLButtonElement, cost: number, maxed: boolean): void {
  const short = !maxed && META.gold < cost;
  bt.className = 'buy' + (short ? ' short' : '');
  bt.textContent = maxed ? t('shop.maxed') : short ? t('forge.need', { n: fmtN(cost - META.gold) }) : t('shop.buy', { cost: fmtN(cost) });
  bt.disabled = maxed || short;
}
/** Shop message for a refused purchase. */
const buyError = (err: { code: string } | null): string => (!err ? '' : err.code === 'NOT_ENOUGH_GOLD' ? t('special.noGold') : t('special.err'));

function forgeRows(box: HTMLElement): void {
  const max = active.cfg.forge.max;
  const note = document.createElement('p');
  note.className = 'slots';
  note.textContent = t('forge.note');
  box.appendChild(note);
  const all = WEAPON_IDS.filter((w) => WEAPONS[w].available), owned = all.filter((w) => metaSync.ownsWeapon(w)), missing = all.filter((w) => !metaSync.ownsWeapon(w));
  for (const w of owned) {
    const lv = metaSync.forgeLv(w), maxed = lv >= max, cost = forgeCost(active.cfg, lv);
    const row = document.createElement('div');
    row.className = 'srow';
    const ico = document.createElement('span');
    ico.className = 'ico wpn';
    const url = weaponImg(w);
    if (url) { const img = document.createElement('img'); img.alt = ''; img.src = url; ico.appendChild(img); } else ico.textContent = t(`weapon.${w}.name`).charAt(0);
    const txt = document.createElement('span');
    const nm = document.createElement('span');
    nm.className = 'nm';
    const lvs = document.createElement('span');
    lvs.className = 'lv';
    lvs.textContent = t('forge.lv', { lv, max });
    nm.append(t(`weapon.${w}.name`) + ' ', lvs);
    const ds = document.createElement('span');
    ds.className = 'ds';
    const now = fxValue(w, lv);
    ds.textContent = t(`forge.fx.${w}`, { v: maxed ? now : `${now} → ${fxValue(w, lv + 1)}` });
    const pw = document.createElement('span');
    pw.className = 'ds';
    pw.textContent = powerLine(lv, maxed);
    txt.append(nm, ds, pw);
    const bt = document.createElement('button');
    priceButton(bt, cost, maxed);
    bt.addEventListener('click', async () => {
      bt.disabled = true;
      const err = await metaSync.forgeWeapon(w);
      msg = buyError(err);
      msgOk = false;
      if (!err) sfx('lv');
      render();
    });
    row.append(ico, txt, bt);
    box.appendChild(row);
  }
  if (!missing.length) return;
  const h = document.createElement('h3');
  h.className = 'oset';
  h.textContent = t('forge.missingHead', { n: missing.length });
  box.appendChild(h);
  for (const w of missing) {
    const r = WEAPONS[w].realm, line = document.createElement('div');
    line.className = 'lockrow';
    line.textContent = '🔒 ' + t('forge.lockLine', { weapon: t(`weapon.${w}.name`), realm: r ? t(`realm.${r}.short`) : '' });
    box.appendChild(line);
  }
}

/* ---------- outfits (ticket 51) ---------- */
const SET_COL: Record<OutfitSet, string> = { ember: '#ff7a3d', frost: '#9fd8ff', storm: '#ffe35c', shadow: '#9a7aff' };
const SLOT_GLYPH: Record<OutfitSlot, string> = { hat: 'H', body: 'B', cloak: 'C' };

/** A piece's stat at a level, value only (the legend above the sets names the stat of each slot). */
function slotValue(slot: OutfitSlot, lv: number): string {
  const O = active.cfg.outfits;
  if (slot === 'hat') return `+${round(O.hatDmg * lv * 100)}%`;
  if (slot === 'body') return `+${round(O.bodyHp * lv, 0)}`;
  return `+${round(O.cloakCrit * lv * 100)}%`;
}
/** The full-set bonus (%) with its lowest piece at a level. */
const setPct = (lv: number): string => round((active.cfg.outfits.setBase + active.cfg.outfits.setPerLv * lv) * 100, 0);

function outfitRows(box: HTMLElement): void {
  const C = active.cfg, max = C.outfits.max, full = outfitSet(C, metaSync.worn());
  const p = (text: string, cls = 'slots'): HTMLElement => { const e = document.createElement('p'); e.className = cls; e.textContent = text; box.appendChild(e); return e; };
  p(t('outfit.note'), 'slots onote'); // hidden on short landscape screens, where the cards need the room
  p(t('outfit.legend'), 'slots legend');
  // the worn set as a chip: green when complete, small grey hint otherwise
  p(full ? t('outfit.active', { set: t(`outfit.set.${full.set}.name`), bonus: t(`outfit.set.${full.set}.bonus`, { v: setPct(full.lv) }) }) : t('outfit.none'), full ? 'ochip on' : 'ochip');
  const grid = document.createElement('div');
  grid.className = 'osets';
  box.appendChild(grid);
  for (const set of OUTFIT_SETS) {
    const card = document.createElement('div');
    card.className = 'ocard';
    card.style.borderColor = SET_COL[set];
    const lows = OUTFIT_SLOTS.map((slot) => metaSync.outfitLv(set, slot)), low = Math.min(...lows);
    const h = document.createElement('div');
    h.className = 'ohead';
    const b = document.createElement('b');
    b.textContent = t(`outfit.set.${set}.name`);
    const d = document.createElement('small');
    d.textContent = `${t(`outfit.set.${set}.target`)} · ${t('outfit.bonusLine', { now: low ? `+${setPct(low)}%` : t('forge.none'), max: `+${setPct(max)}%` })}`;
    h.append(b, d);
    card.appendChild(h);
    const row = document.createElement('div');
    row.className = 'opieces';
    for (const slot of OUTFIT_SLOTS) {
      const lv = metaSync.outfitLv(set, slot), maxed = lv >= max, cost = outfitCost(C, lv), wearing = META.wear[slot] === set && lv > 0;
      const cell = document.createElement('div');
      cell.className = 'opiece' + (lv ? '' : ' unowned');
      const ico = document.createElement('span');
      ico.className = 'ico';
      ico.style.background = SET_COL[set];
      ico.textContent = SLOT_GLYPH[slot];
      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = t(`outfit.slot.${slot}`);
      const lvs = document.createElement('span');
      lvs.className = 'lv';
      lvs.textContent = t('forge.lv', { lv, max });
      const ds = document.createElement('span');
      ds.className = 'ds';
      ds.textContent = lv === 0 ? slotValue(slot, 1) : maxed ? slotValue(slot, lv) : `${slotValue(slot, lv)} → ${slotValue(slot, lv + 1)}`;
      const bt = document.createElement('button');
      priceButton(bt, cost, maxed);
      if (!maxed && !bt.classList.contains('short')) bt.textContent = t(lv ? 'outfit.up' : 'outfit.get', { cost: fmtN(cost) });
      bt.addEventListener('click', async () => {
        bt.disabled = true;
        const err = await metaSync.buyOutfit(set, slot);
        msg = '';
        pieceNote = err ? { set, slot, text: buyError(err), ok: false } : null;
        if (!err) {
          sfx('lv');
          if (!lv && META.wear[slot] !== set) pieceNote = { set, slot, text: t('outfit.bought'), ok: true }; // kept the worn piece on
        }
        render();
      });
      cell.append(ico, nm, lvs, ds, bt);
      if (pieceNote && pieceNote.set === set && pieceNote.slot === slot) {
        const n = document.createElement('span');
        n.className = 'onote-piece' + (pieceNote.ok ? ' ok' : '');
        n.setAttribute('role', 'status');
        n.textContent = pieceNote.text;
        cell.appendChild(n);
      }
      if (wearing) {
        const w = document.createElement('span');
        w.className = 'oworn';
        w.textContent = t('outfit.worn');
        const off = document.createElement('button');
        off.className = 'link';
        off.textContent = t('outfit.off');
        off.addEventListener('click', () => { metaSync.wearOutfit(slot, null); render(); });
        w.append(' ', off);
        cell.appendChild(w);
      } else if (lv) {
        const wb = document.createElement('button');
        wb.className = 'buy ghost';
        wb.textContent = t('outfit.wear');
        wb.addEventListener('click', () => { metaSync.wearOutfit(slot, set); msg = ''; pieceNote = null; render(); });
        cell.appendChild(wb);
      }
      row.appendChild(cell);
    }
    card.appendChild(row);
    grid.appendChild(card);
  }
}

function render(): void {
  $('specialGold').textContent = 'GOLD ' + fmtN(META.gold);
  document.querySelectorAll<HTMLButtonElement>('#specialTabs button').forEach((b) => {
    const x = b.dataset.tab as Tab;
    b.classList.toggle('sel', x === tab);
    b.textContent = (locked(x) ? '🔒 ' : '') + t(`special.${x}`);
  });
  const box = $('specialBody');
  box.innerHTML = '';
  const p = (text: string): void => { const e = document.createElement('p'); e.className = 'slots'; e.textContent = text; box.appendChild(e); };
  if (locked(tab)) { if (tab === 'forge') p(t('forge.note')); p(t('special.locked')); }
  else if (tab === 'forge') forgeRows(box);
  else if (tab === 'outfits') outfitRows(box);
  else p(t(`special.${tab}Soon`));
  const m = $('specialMsg');
  m.textContent = msg;
  m.classList.toggle('err', !msgOk);
  m.hidden = !msg;
}

/** Title button: "NEW" once the first win opened the locked tabs, until the shop is visited. */
export function renderSpecialBtn(): void {
  const b = $('specialBtn'), won = metaSync.hasWon();
  // before the first win: a plain paper button with a lock and what unlocks it (owner, option A)
  b.classList.toggle('locked', !won);
  b.textContent = (won ? '' : '🔒 ') + t('title.special');
  if (!won) {
    const s = document.createElement('small');
    s.textContent = t('special.lockedHint');
    b.append(s);
  } else if (!META.tips.includes(SEEN)) {
    const s = document.createElement('small');
    s.textContent = t('special.new');
    b.append(' ', s);
  }
}

export function openSpecialShop(from: string): void {
  msg = '';
  pieceNote = null;
  tab = 'forge'; // before the first win too: the locked Forge shows what the win unlocks
  if (metaSync.hasWon()) metaSync.markTip(SEEN);
  hide(from);
  render();
  show('ovSpecial');
  $('specialBack').onclick = () => { hide('ovSpecial'); renderSpecialBtn(); show(from); };
  setTimeout(() => $('specialBack').focus({ preventScroll: true }), 30);
}

export function initSpecialShop(): void {
  $('specialTabs').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab as Tab; msg = ''; pieceNote = null; render(); }));
  const refresh = (): void => { if ($('ovSpecial').classList.contains('on')) render(); renderSpecialBtn(); };
  metaSync.onChange(refresh);
  onLangChange(refresh);
  renderSpecialBtn();
}
