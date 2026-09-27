// Special shop (ticket 56): the Gold sinks after the permanent shop. One screen with tabs: Weapon forge and outfits
// open after the first win (Umbra beaten once), Hero Mastery from the start. The server refuses locked purchases too.
import { OUTFIT_SETS, OUTFIT_SLOTS, WEAPON_IDS, WEAPONS, forgeCost, forgeDmg, forgeMul, forgeStun, outfitCost, outfitSet, ultCap, type OutfitSet, type OutfitSlot, type WeaponId } from '@pixel-horde/sim';
import { onLangChange, t } from '@pixel-horde/i18n';
import { sfx } from '../audio/sfx';
import { active } from '../config';
import { META, metaSync } from '../meta';
import { HELD_SPR } from '../render/sprites';
import { $, hide, show } from './overlays';

type Tab = 'forge' | 'mastery' | 'outfits';
let tab: Tab = 'forge';
let msg = '';
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

/** Ultimate damage × and the King cap at a forge level. */
function powerValue(lv: number): string {
  const C = active.cfg;
  return `×${round(forgeDmg(C, lv))} · ${round(ultCap(C, false, lv) * 100)}%`;
}

/** Buy button text and state: the price, "Max", or how much Gold is still missing (red). */
function priceButton(bt: HTMLButtonElement, cost: number, maxed: boolean): void {
  const short = !maxed && META.gold < cost;
  bt.className = 'buy' + (short ? ' short' : '');
  bt.textContent = maxed ? t('shop.maxed') : short ? t('forge.need', { n: cost - META.gold }) : t('shop.buy', { cost });
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
    pw.textContent = t('forge.power', { v: maxed ? powerValue(lv) : `${powerValue(lv)} → ${powerValue(lv + 1)}` });
    txt.append(nm, ds, pw);
    const bt = document.createElement('button');
    priceButton(bt, cost, maxed);
    bt.addEventListener('click', async () => {
      bt.disabled = true;
      const err = await metaSync.forgeWeapon(w);
      msg = buyError(err);
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

/** A piece's stat at a level, as shown in the shop. */
function slotValue(slot: OutfitSlot, lv: number): string {
  const O = active.cfg.outfits;
  if (slot === 'hat') return t('outfit.stat.hat', { v: round(O.hatDmg * lv * 100) });
  if (slot === 'body') return t('outfit.stat.body', { v: round(O.bodyHp * lv, 0) });
  return t('outfit.stat.cloak', { v: round(O.cloakCrit * lv * 100) });
}
/** The full-set bonus (%) with its lowest piece at a level. */
const setPct = (lv: number): string => round((active.cfg.outfits.setBase + active.cfg.outfits.setPerLv * lv) * 100, 0);

function outfitRows(box: HTMLElement): void {
  const C = active.cfg, max = C.outfits.max, full = outfitSet(C, metaSync.worn());
  const p = (text: string, cls = 'slots'): void => { const e = document.createElement('p'); e.className = cls; e.textContent = text; box.appendChild(e); };
  p(t('outfit.note'));
  p(full ? t('outfit.active', { set: t(`outfit.set.${full.set}.name`), bonus: t(`outfit.set.${full.set}.bonus`, { v: setPct(full.lv) }) }) : t('outfit.none'), 'slots goldline');
  for (const set of OUTFIT_SETS) {
    const h = document.createElement('h3');
    h.className = 'oset';
    h.style.borderColor = SET_COL[set];
    h.textContent = `${t(`outfit.set.${set}.name`)} · ${t(`outfit.set.${set}.bonus`, { v: setPct(1) + '–' + setPct(max) })}`;
    box.appendChild(h);
    for (const slot of OUTFIT_SLOTS) {
      const lv = metaSync.outfitLv(set, slot), maxed = lv >= max, cost = outfitCost(C, lv), wearing = META.wear[slot] === set && lv > 0;
      const row = document.createElement('div');
      row.className = 'srow' + (lv ? '' : ' locked');
      const ico = document.createElement('span');
      ico.className = 'ico';
      ico.style.background = SET_COL[set];
      ico.textContent = SLOT_GLYPH[slot];
      const txt = document.createElement('span');
      const nm = document.createElement('span');
      nm.className = 'nm';
      const lvs = document.createElement('span');
      lvs.className = 'lv';
      lvs.textContent = t('forge.lv', { lv, max });
      nm.append(t(`outfit.slot.${slot}`) + ' ', lvs);
      const ds = document.createElement('span');
      ds.className = 'ds';
      ds.textContent = lv === 0 ? slotValue(slot, 1) : maxed ? slotValue(slot, lv) : `${slotValue(slot, lv)} → ${slotValue(slot, lv + 1)}`;
      txt.append(nm, ds);
      const btns = document.createElement('span');
      btns.className = 'btns';
      const bt = document.createElement('button');
      priceButton(bt, cost, maxed);
      if (!lv && !bt.disabled) bt.textContent = t('outfit.get', { cost });
      bt.addEventListener('click', async () => {
        bt.disabled = true;
        const err = await metaSync.buyOutfit(set, slot);
        msg = buyError(err);
        if (!err) sfx('lv');
        render();
      });
      btns.appendChild(bt);
      if (lv) {
        const wb = document.createElement('button');
        wb.className = 'buy ghost' + (wearing ? ' on' : '');
        wb.textContent = wearing ? t('outfit.worn') : t('outfit.wear');
        wb.addEventListener('click', () => { metaSync.wearOutfit(slot, wearing ? null : set); render(); });
        btns.appendChild(wb);
      }
      row.append(ico, txt, btns);
      box.appendChild(row);
    }
  }
}


function render(): void {
  $('specialGold').textContent = 'GOLD ' + META.gold;
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
  tab = 'forge'; // before the first win too: the locked Forge shows what the win unlocks
  if (metaSync.hasWon()) metaSync.markTip(SEEN);
  hide(from);
  render();
  show('ovSpecial');
  $('specialBack').onclick = () => { hide('ovSpecial'); renderSpecialBtn(); show(from); };
  setTimeout(() => $('specialBack').focus({ preventScroll: true }), 30);
}

export function initSpecialShop(): void {
  $('specialTabs').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab as Tab; msg = ''; render(); }));
  const refresh = (): void => { if ($('ovSpecial').classList.contains('on')) render(); renderSpecialBtn(); };
  metaSync.onChange(refresh);
  onLangChange(refresh);
  renderSpecialBtn();
}
