// Special shop (ticket 56): the Gold sinks after the permanent shop. One screen with tabs: Weapon forge and outfits
// open after the first win (Umbra beaten once), Hero Mastery from the start. The server refuses locked purchases too.
import { WEAPON_IDS, WEAPONS, forgeCost, forgeDmg, forgeMul, forgeStun, ultCap, type WeaponId } from '@pixel-horde/sim';
import { onLangChange, t } from '@pixel-horde/i18n';
import { sfx } from '../audio/sfx';
import { active } from '../config';
import { META, metaSync } from '../meta';
import { HELD_SPR } from '../render/sprites';
import { $, hide, show } from './overlays';
import { realmName } from './text';

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
    case 'judgement': return sec(forgeStun(C, lv));
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

function forgeRows(box: HTMLElement): void {
  const max = active.cfg.forge.max;
  const note = document.createElement('p');
  note.className = 'slots';
  note.textContent = t('forge.note');
  box.appendChild(note);
  for (const w of WEAPON_IDS) {
    if (!WEAPONS[w].available) continue;
    const owned = metaSync.ownsWeapon(w), lv = metaSync.forgeLv(w), maxed = lv >= max, cost = forgeCost(active.cfg, lv);
    const row = document.createElement('div');
    row.className = 'srow' + (owned ? '' : ' locked');
    const ico = document.createElement('span');
    ico.className = 'ico wpn';
    const url = weaponImg(w);
    if (url) { const img = document.createElement('img'); img.alt = ''; img.src = url; ico.appendChild(img); } else ico.textContent = t(`weapon.${w}.name`).charAt(0);
    const txt = document.createElement('span');
    const nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = `${t(`weapon.${w}.name`)} ${t('forge.lv', { lv, max })}`;
    const ds = document.createElement('span');
    ds.className = 'ds';
    const now = fxValue(w, lv);
    ds.textContent = owned
      ? t(`forge.fx.${w}`, { v: maxed ? now : `${now} → ${fxValue(w, lv + 1)}` })
      : t('forge.notOwned', { realm: WEAPONS[w].realm ? realmName(WEAPONS[w].realm) : '' });
    txt.append(nm, ds);
    if (owned) {
      const pw = document.createElement('span');
      pw.className = 'ds';
      pw.textContent = t('forge.power', { v: maxed ? powerValue(lv) : `${powerValue(lv)} → ${powerValue(lv + 1)}` });
      txt.appendChild(pw);
    }
    const bt = document.createElement('button');
    bt.className = 'buy';
    bt.textContent = !owned ? t('forge.missing') : maxed ? t('shop.maxed') : t('shop.buy', { cost });
    bt.disabled = !owned || maxed || META.gold < cost;
    bt.addEventListener('click', async () => {
      bt.disabled = true;
      const err = await metaSync.forgeWeapon(w);
      msg = err ? t('special.err') : '';
      if (!err) sfx('lv');
      render();
    });
    row.append(ico, txt, bt);
    box.appendChild(row);
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
  if (locked(tab)) p(t('special.locked'));
  else if (tab === 'forge') forgeRows(box);
  else p(t(`special.${tab}Soon`));
  const m = $('specialMsg');
  m.textContent = msg;
  m.hidden = !msg;
}

/** Title button: "NEW" once the first win opened the locked tabs, until the shop is visited. */
export function renderSpecialBtn(): void {
  const b = $('specialBtn');
  b.textContent = t('title.special');
  if (metaSync.hasWon() && !META.tips.includes(SEEN)) {
    const s = document.createElement('small');
    s.textContent = t('special.new');
    b.append(' ', s);
  }
}

export function openSpecialShop(from: string): void {
  msg = '';
  tab = metaSync.hasWon() ? 'forge' : 'mastery';
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
