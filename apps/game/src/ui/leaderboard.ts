// Leaderboard screen (ticket 10): board tabs, Hero filter, top 100, my rank with neighbours.
import { t } from '@pixel-horde/i18n';
import { HERO_IDS } from '@pixel-horde/sim';
import { backend, type BoardId, type BoardRow } from '../net';
import { $, hide, show } from './overlays';
import { heroName } from './text';

const BOARDS: BoardId[] = ['solo', 'coop', 'endless', 'alltime'];
let board: BoardId = 'solo';
let from = 'ovTitle';
let req = 0;

function row(r: BoardRow): HTMLLIElement {
  const li = document.createElement('li');
  if (r.me) li.className = 'me';
  const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = '#' + r.rank;
  const nm = document.createElement('span');
  nm.textContent = r.me ? `${r.name} (${t('board.you')})` : r.name;
  if (r.title) { const ti = document.createElement('span'); ti.className = 'ttl'; ti.textContent = r.title; nm.appendChild(ti); }
  if (!r.verified) { const u = document.createElement('span'); u.className = 'unv'; u.textContent = t('board.unverified'); nm.appendChild(u); }
  const meta = document.createElement('span'); meta.className = 'meta';
  meta.textContent = `${t('board.chapter', { n: r.chapter })} · ${heroName(r.hero as (typeof HERO_IDS)[number])}${r.weapon ? ' · ' + r.weapon : ''}`;
  const sc = document.createElement('span'); sc.className = 'sc'; sc.textContent = r.score.toLocaleString();
  li.append(rk, nm, meta, sc);
  return li;
}

async function load(): Promise<void> {
  const id = ++req;
  const list = $('boardList'), mine = $('boardMine');
  list.innerHTML = ''; mine.innerHTML = '';
  $('boardNote').textContent = t('board.loading');
  const heroSel = $('boardHero') as HTMLSelectElement;
  try {
    const v = await backend.getLeaderboard(board, heroSel.value || null);
    if (id !== req) return;
    $('boardNote').textContent = board === 'alltime' ? '' : t('board.season', { n: v.season });
    if (!v.top.length) $('boardNote').textContent = t('board.empty');
    for (const r of v.top) list.appendChild(row(r));
    for (const r of v.around.length ? v.around : v.me && v.me.rank > 100 ? [v.me] : []) mine.appendChild(row(r));
  } catch {
    if (id === req) $('boardNote').textContent = t('board.offline');
  }
}

function renderTabs(): void {
  const box = $('boardTabs');
  box.innerHTML = '';
  for (const b of BOARDS) {
    const bt = document.createElement('button');
    bt.setAttribute('role', 'tab');
    bt.setAttribute('aria-selected', String(b === board));
    bt.textContent = t('board.' + b);
    bt.addEventListener('click', () => { board = b; renderTabs(); void load(); });
    box.appendChild(bt);
  }
  const sel = $('boardHero') as HTMLSelectElement, cur = sel.value;
  sel.innerHTML = '';
  const all = document.createElement('option'); all.value = ''; all.textContent = t('board.allHeroes'); sel.appendChild(all);
  for (const h of HERO_IDS) { const o = document.createElement('option'); o.value = h; o.textContent = heroName(h); sel.appendChild(o); }
  sel.value = cur;
}

export function initLeaderboard(): void {
  ($('boardHero') as HTMLSelectElement).addEventListener('change', () => void load());
  $('boardBtn').addEventListener('click', () => { from = 'ovTitle'; hide(from); renderTabs(); show('ovBoard'); void load(); });
  $('boardBack').addEventListener('click', () => { hide('ovBoard'); show(from); });
}
