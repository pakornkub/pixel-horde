// Nickname prompt, one-tab guard and "account opened elsewhere" screens (ticket 08).
import { t } from '@pixel-horde/i18n';
import { backend, BackendError, type Account } from '../net';
import { nicknameProblem } from '../net/nickname';
import { guardTab, takeOver } from '../platform/tabs';
import { $, hide, show } from './overlays';
import { metaSync } from '../meta';

const NAMED = 'pixelhorde-named';
const named = (): boolean => { try { return localStorage.getItem(NAMED) === '1'; } catch { return true; } };
const markNamed = (): void => { try { localStorage.setItem(NAMED, '1'); } catch { /* ignore */ } };

export interface AccountHooks {
  /** Stop gameplay (pause the Run) while a blocking screen is up. */
  pauseGame(): void;
  /** Server numbers arrived: re-render wallet, heroes, shop. */
  onMetaChanged(): void;
}

let hooks: AccountHooks;
let started = false;

const RUNS = 'pixelhorde-runs-done';
const WON = 'pixelhorde-won';
/** Count finished Runs; after the 3rd one the game suggests linking Google. */
export function noteRunFinished(victory = false): void {
  try {
    localStorage.setItem(RUNS, String((Number(localStorage.getItem(RUNS)) || 0) + 1));
    if (victory) localStorage.setItem(WON, '1');
  } catch { /* ignore */ }
  renderAccountLine();
}
const runsDone = (): number => { try { return Number(localStorage.getItem(RUNS)) || 0; } catch { return 0; } };
const hasWon = (): boolean => { try { return localStorage.getItem(WON) === '1'; } catch { return false; } };

export function renderAccountLine(): void {
  const a = backend.account();
  const canLink = !!a && a.anonymous && backend.status() === 'online';
  $('linkRow').hidden = !canLink;
  $('linkBtn2').hidden = !(canLink && (runsDone() >= 3 || hasWon())); // suggested after the 3rd Run and the first victory
  const res = backend.linkResult();
  if (res) $('linkTxt').textContent = res === 'merged' ? t('link.merged') : res === 'linked' ? t('link.linked') : t('link.failed');
  if (res && !res.startsWith('failed')) $('linkRow').hidden = false;
  $('acctTxt').textContent = a ? t('account.as', { name: a.nickname }) + (backend.status() === 'offline' ? t('account.offline') : '') : '';
  $('renameBtn').hidden = !a;
}

function askName(initial: string, onDone: (nick: string | null) => Promise<void>): void {
  const input = $('nameInput') as HTMLInputElement;
  input.value = initial;
  $('nameErr').textContent = '';
  const titleWasOn = $('ovTitle').classList.contains('on');
  hide('ovTitle');
  show('ovName');
  setTimeout(() => input.focus({ preventScroll: true }), 30);
  const finish = async (nick: string | null): Promise<void> => {
    try {
      await onDone(nick);
    } catch (e) {
      const code = e instanceof BackendError ? e.code : 'UNKNOWN';
      $('nameErr').textContent = code === 'NICKNAME_REJECTED' ? t('name.err.rude') : t('name.err.offline');
      return;
    }
    hide('ovName');
    if (titleWasOn || !started) show('ovTitle');
    renderAccountLine();
  };
  $('nameOk').onclick = () => {
    const p = nicknameProblem(input.value);
    if (p) { $('nameErr').textContent = t('name.err.' + p); return; }
    void finish(input.value.trim());
  };
  $('nameSkip').onclick = () => void finish(null);
  input.onkeydown = (e) => { if (e.key === 'Enter') $('nameOk').click(); };
}

async function startAccount(): Promise<void> {
  if (started) return;
  if (!named()) {
    askName('', async (nick) => {
      markNamed();
      await backend.start({ nickname: nick ?? undefined });
      started = true;
      await afterStart();
    });
    return;
  }
  await backend.start({});
  started = true;
  renderAccountLine();
  await afterStart();
}

/** Upload the legacy save / offline queue and take the server's Gold. */
async function afterStart(): Promise<void> {
  if (await metaSync.sync()) hooks.onMetaChanged();
}

export function initAccount(h: AccountHooks): void {
  hooks = h;
  backend.onStatus((s) => {
    renderAccountLine();
    if (s === 'replaced') { hooks.pauseGame(); show('ovReplaced'); }
  });
  $('replacedBtn').addEventListener('click', async () => {
    try { await backend.reclaim(); hide('ovReplaced'); } catch { /* stays open */ }
  });
  $('renameBtn').addEventListener('click', () => {
    const a: Account | null = backend.account();
    askName(a?.nickname ?? '', async (nick) => { if (nick) await backend.setNickname(nick); });
  });
  $('tabBtn').addEventListener('click', () => { takeOver(); });
  const link = (): void => { void backend.linkGoogle().catch(() => { $('linkTxt').textContent = t('link.failed'); }); };
  $('linkBtn').addEventListener('click', link);
  $('linkBtn2').addEventListener('click', link);
  void guardTab({
    onAcquired: () => { hide('ovTab'); void startAccount(); },
    onBlocked: () => { $('tabTitle').textContent = t('tab.blockedTitle'); $('tabText').textContent = t('tab.blockedText'); show('ovTab'); },
    onLost: () => { hooks.pauseGame(); $('tabTitle').textContent = t('tab.lostTitle'); $('tabText').textContent = t('tab.lostText'); show('ovTab'); },
  });
  addEventListener('visibilitychange', () => { if (!document.hidden) void backend.checkSession(); });
}

/** Call at Run start and Stage start. */
export function checkSession(): void { void backend.checkSession(); }
