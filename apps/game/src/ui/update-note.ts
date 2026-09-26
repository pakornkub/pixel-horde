// Title screen "new update" notice: the newest public patch note's date and title, with a link to the
// website's updates page for the details. Highlighted until the player opens or closes it, then a
// small "latest update" line. The id seen last is kept per browser (`pixelhorde-update-seen`).
import { lang, t } from '@pixel-horde/i18n';
import { backend, type UpdateNote } from '../net';
import { browserStore, type KeyValue } from '../net/offline';

const K_SEEN = 'pixelhorde-update-seen';
/** The website's updates page; the game is served at /play/, the site at /. */
export const UPDATES_URL = '../updates.html';

export const isNewUpdate = (n: UpdateNote, store: KeyValue = browserStore): boolean => n.id > (Number(store.get(K_SEEN)) || 0);
export function markUpdateSeen(n: UpdateNote, store: KeyValue = browserStore): void { store.set(K_SEEN, String(n.id)); }

const dateOf = (iso: string): string =>
  new Date(iso).toLocaleDateString(lang() === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

let note: UpdateNote | null = null;

/** Draw the notice into `box` (hidden when there is no patch note or the game is offline). */
export function renderUpdateNote(box: HTMLElement): void {
  box.hidden = !note;
  if (!note) return;
  const n = note, fresh = isNewUpdate(n), title = (lang() === 'th' ? n.titleTh : n.titleEn) || n.titleTh;
  box.className = 'updnote' + (fresh ? ' new' : '');
  box.innerHTML = '';
  const head = document.createElement('b');
  head.textContent = t(fresh ? 'update.new' : 'update.latest', { date: dateOf(n.at) });
  const name = document.createElement('span'); name.textContent = title;
  const read = document.createElement('a');
  read.href = UPDATES_URL; read.target = '_blank'; read.rel = 'noopener';
  read.textContent = t('update.read');
  read.addEventListener('click', () => { markUpdateSeen(n); renderUpdateNote(box); });
  box.append(head, name, read);
  if (fresh) {
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕';
    x.title = x.ariaLabel = t('update.dismiss');
    x.addEventListener('click', () => { markUpdateSeen(n); renderUpdateNote(box); });
    box.append(x);
  }
}

/** Fetch the newest patch note (quietly nothing when offline) and draw it. */
export async function refreshUpdateNote(box: HTMLElement): Promise<void> {
  try { note = await backend.latestUpdate(); } catch { /* offline: keep what we had */ }
  renderUpdateNote(box);
}
