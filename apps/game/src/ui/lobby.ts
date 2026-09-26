// Co-op lobby (ticket 41): create a room (5-character code + invite link) or join one, pick Hero and
// Weapon, ready up; the host starts. The Run itself is driven by main.ts through the Session.
import { t } from '@pixel-horde/i18n';
import { isCode, newCode, normalizeCode, type CloseReason } from '@pixel-horde/coop';
import { createSession, type LobbyPlayer, type Session } from '../coop/session';
import { ROOM_URL } from '../net/config';
import { wsConnect, type Connect } from '../net/transport';
import { META } from '../meta';
import { BUILD, live } from '../live';
import { active } from '../config';
import { backend } from '../net';
import { $, charImg, hide, show } from './overlays';
import { openHero, renderTitleSel } from './title';
import { heroName } from './text';

export interface LobbyHooks {
  name(): string;
  pid(): string;
  /** Both roles: the host pressed Start. */
  onStart(s: Session, seed: number, cfg: number): void;
  /** The room closed (host left, network…) — during a Run too. */
  onClosed(reason: CloseReason): void;
}

let hooks: LobbyHooks;
let session: Session | null = null;
let connect: Connect | null = ROOM_URL ? wsConnect(ROOM_URL) : null;

export const currentSession = (): Session | null => session;
/** Tests / dev: use another transport (e.g. the in-memory hub). */
export function setConnect(c: Connect): void { connect = c; }

const msg = (txt: string): void => { $('coopMsg').textContent = txt; };
export const coopAvailable = (): boolean => !!connect && live.flags().coop !== false && backend.status() !== 'suspended';

function renderRoom(players: LobbyPlayer[]): void {
  if (!session) return;
  $('coopEntry').hidden = true;
  $('coopRoom').hidden = false;
  $('coopCodeTxt').textContent = session.code;
  const ul = $('coopList');
  ul.innerHTML = '';
  for (const p of players) {
    const li = document.createElement('li');
    const im = document.createElement('img'); im.alt = ''; im.src = charImg(p.hero);
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = p.name + (p.id === session.selfId ? ' ★' : '');
    const hw = document.createElement('span'); hw.textContent = heroName(p.hero) + ' · ' + t(`weapon.${p.weapon}.name`);
    const st = document.createElement('span'); st.className = 'st' + (p.ready ? ' ok' : '');
    st.textContent = p.host ? t('coop.host') : p.ready ? t('coop.isReady') : t('coop.notYet');
    li.append(im, nm, hw, st);
    ul.appendChild(li);
  }
  const go = $('coopGo') as HTMLButtonElement;
  const odd = session.otherBuild(); // players on another game version cannot play together
  if (session.role === 'host') {
    const ok = players.length > 1 && session.allReady() && !odd.length;
    go.textContent = t('coop.start');
    go.disabled = !ok;
    msg(odd.length ? t('coop.versionHost', { who: odd.map((p) => p.name).join(', ') }) : players.length > 1 && !ok ? t('coop.startWait') : '');
  } else if (odd.length) {
    go.disabled = true;
    msg(t('coop.version'));
  } else {
    const me = players.find((p) => p.id === session!.selfId);
    go.disabled = false;
    go.textContent = me?.ready ? t('coop.notReady') : t('coop.ready');
    msg(me?.ready ? t('coop.waitHost') : '');
  }
}

function attach(s: Session): void {
  session = s;
  s.on((e) => {
    if (session !== s) return;
    if (e.t === 'lobby' && !s.started) renderRoom(e.players);
    else if (e.t === 'start') { hide('ovCoop'); hooks.onStart(s, e.seed, e.cfg); }
    else if (e.t === 'closed') {
      session = null;
      if (s.started) { hooks.onClosed(e.reason); return; }
      $('coopEntry').hidden = false; $('coopRoom').hidden = true;
      msg(t(`coop.err.${e.reason}`));
      if (e.reason === 'taken' && s.role === 'host') create(); // rare: pick another code
    }
  });
}

function open(role: 'host' | 'guest', code: string): void {
  if (!connect) return;
  msg(t('coop.connecting'));
  attach(createSession(connect, { role, code, name: hooks.name(), pid: hooks.pid(), hero: META.ch, weapon: META.weapon, build: BUILD }));
}
function create(): void { open('host', newCode(Math.random)); }
function join(raw: string): void {
  const code = normalizeCode(raw);
  if (!isCode(code)) { msg(t('coop.badCode')); return; }
  open('guest', code);
}

/** The player's nickname is known or changed: update it in the room. */
export function refreshLobbyName(): void { session?.setName(hooks.name()); }

/** Leave the room (lobby or Run). */
export function leaveRoom(): void {
  const s = session;
  session = null;
  s?.leave();
}

export function openLobby(code?: string): void {
  hide('ovTitle');
  show('ovCoop');
  const ready = coopAvailable();
  $('coopEntry').hidden = !!session; $('coopRoom').hidden = !session;
  ($('coopCreate') as HTMLButtonElement).disabled = !ready;
  ($('coopJoin') as HTMLButtonElement).disabled = !ready;
  msg(!connect ? t('coop.notSetUp') : backend.status() === 'suspended' ? t('coop.suspended') : live.flags().coop === false ? t('coop.off') : '');
  if (code) { ($('coopCode') as HTMLInputElement).value = code; if (ready && !session) join(code); }
}

export function initLobby(h: LobbyHooks): void {
  hooks = h;
  $('coopBtn').addEventListener('click', () => openLobby());
  $('coopCreate').addEventListener('click', create);
  $('coopJoin').addEventListener('click', () => join(($('coopCode') as HTMLInputElement).value));
  $('coopCode').addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') join(($('coopCode') as HTMLInputElement).value); });
  $('coopBack').addEventListener('click', () => { leaveRoom(); hide('ovCoop'); renderTitleSel(); show('ovTitle'); });
  $('coopHero').addEventListener('click', () => openHero('ovCoop', () => { const me = session?.players().find((p) => p.id === session?.selfId); session?.setMe(META.ch, META.weapon, me?.ready); }));
  $('coopGo').addEventListener('click', () => {
    const s = session;
    if (!s) return;
    // the host's Balance Config version goes with the start: guests load the same one
    if (s.role === 'host') { if (s.players().length > 1 && s.allReady() && !s.otherBuild().length) s.start((Math.random() * 4294967296) >>> 0, Math.max(0, active.cfg.version)); return; }
    const me = s.players().find((p) => p.id === s.selfId);
    s.setMe(META.ch, META.weapon, !me?.ready);
  });
  $('coopCopy').addEventListener('click', () => {
    if (!session) return;
    const url = location.origin + location.pathname + '?join=' + session.code;
    void navigator.clipboard?.writeText(url).then(() => msg(t('coop.copied')), () => msg(url));
  });
  // always clickable: when co-op is not available the lobby says why (a disabled grey button did not)
  $('coopBtn').querySelector('small')!.hidden = !!connect;
}
