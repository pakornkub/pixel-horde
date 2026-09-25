// Collection menu (ticket 32): achievements, Titles (pick one to show), badges, bestiary, Weapons.
import { ACHIEVEMENTS, ENEMY_IDS, WEAPON_IDS, WEAPONS, weaponKey } from '@pixel-horde/sim';
import { t } from '@pixel-horde/i18n';
import { backend } from '../net';
import { META, metaSync } from '../meta';
import { ENEMY_SPR } from '../render/sprites';
import { $, hide, show } from './overlays';

type Tab = 'ach' | 'titles' | 'badges' | 'bestiary' | 'weapons';
let tab: Tab = 'ach';
let badges: { badge: string; season: number }[] = [];
const IMG: Record<string, string> = {};

function spriteUrl(id: string): string {
  if (IMG[id] !== undefined) return IMG[id];
  const src = ENEMY_SPR[id]?.[0]?.n;
  if (!src) return (IMG[id] = '');
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  const k = Math.min(32 / src.width, 32 / src.height);
  x.drawImage(src, (32 - src.width * k) / 2, (32 - src.height * k) / 2, src.width * k, src.height * k);
  try { IMG[id] = c.toDataURL(); } catch { IMG[id] = ''; }
  return IMG[id];
}

function render(): void {
  const box = $('collBody');
  document.querySelectorAll<HTMLButtonElement>('#collTabs button').forEach((b) => b.classList.toggle('sel', b.dataset.tab === tab));
  const rows: string[] = [];
  if (tab === 'ach') {
    for (const a of ACHIEVEMENTS) {
      const got = META.ach.includes(a.id);
      rows.push(`<div class="crow${got ? '' : ' locked'}"><b>${got ? '★' : '☆'} ${t(`ach.${a.id}.name`)}</b><span>${t(`ach.${a.id}.desc`)}${a.title ? ' · ' + t('coll.titleReward', { title: a.title }) : ''}</span></div>`);
    }
  } else if (tab === 'titles') {
    if (!META.titles.length) rows.push(`<p>${t('coll.none')}</p>`);
    for (const ti of META.titles) rows.push(`<div class="crow"><b>${ti}</b><button class="link" data-title="${ti}">${META.shownTitle === ti ? t('coll.shown') : t('coll.show')}</button></div>`);
    if (META.shownTitle) rows.push(`<div class="crow"><button class="link" data-title="">${t('coll.hide')}</button></div>`);
  } else if (tab === 'badges') {
    if (!badges.length) rows.push(`<p>${t('coll.none')}</p>`);
    for (const b of badges) rows.push(`<div class="crow"><b>${t(`badge.${b.badge}`)}</b><span>${b.season ? t('coll.season', { n: b.season }) : ''}</span></div>`);
  } else if (tab === 'bestiary') {
    for (const id of ENEMY_IDS) {
      const n = META.bestiary[id] || 0, url = n ? spriteUrl(id) : '';
      rows.push(`<div class="crow${n ? '' : ' locked'}">${url ? `<img alt="" src="${url}">` : '<span class="ph">?</span>'}<span>${n ? t(`lore.${id}`) : t('coll.unknown')}</span><span>${n ? t('coll.kills', { n }) : ''}</span></div>`);
    }
  } else {
    for (const w of WEAPON_IDS) {
      if (!WEAPONS[w].available) continue;
      const got = w === 'judgement' || META.weapons.includes(weaponKey(w));
      rows.push(`<div class="crow${got ? '' : ' locked'}"><b>${got ? t(`weapon.${w}.name`) : t('coll.unknown')}</b><span>${got ? t(`weapon.${w}.desc`) : ''}</span></div>`);
    }
  }
  box.innerHTML = rows.join('');
  box.querySelectorAll<HTMLButtonElement>('[data-title]').forEach((b) => b.addEventListener('click', () => void pickTitle(b.dataset.title || null)));
}

async function pickTitle(title: string | null): Promise<void> {
  try { await backend.setTitle(title); } catch { /* offline: local only until next sync */ }
  META.shownTitle = title;
  metaSync.save();
  render();
}

export async function openCollection(from: string): Promise<void> {
  hide(from);
  show('ovCollection');
  render();
  try {
    const c = await backend.getCollection();
    if (c) { metaSync.applyCollection(c); badges = c.badges || []; render(); }
  } catch { /* offline: local mirror */ }
  $('collBack').onclick = () => { hide('ovCollection'); show(from); };
}

export function initCollection(): void {
  $('collTabs').querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab as Tab; render(); }));
}
