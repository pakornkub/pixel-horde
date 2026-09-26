// Nickname prompt, one-tab guard and "account opened elsewhere" screens (ticket 08).
import { t } from '@pixel-horde/i18n';
import { backend, BackendError, type Account } from '../net';
import { nicknameProblem } from '../net/nickname';
import { chromeIntent, inAppBrowser, isAndroid } from '../platform/inapp';
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
  /** The account is ready (signed in or offline), or its nickname changed. */
  onAccount?(): void;
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

/** Say why linking failed (the server setting "Allow manual linking" is the usual culprit). */
function linkFailText(reason: string): string {
  if (/manual.?linking/i.test(reason)) return t('link.failed.manual_linking_disabled');
  const r = reason.trim().slice(0, 60);
  return r ? t('link.failed.reason', { reason: r }) : t('link.failed');
}

/** Inside Facebook / LINE / … Google refuses to sign in, so the link buttons send the player to a real browser. */
const inApp = inAppBrowser(navigator.userAgent);
const gameUrl = (): string => location.origin + location.pathname;

function linkButtons(): void {
  const key = inApp ? (isAndroid(navigator.userAgent) ? 'link.openBrowser' : 'link.copyLink') : 'link.button';
  for (const id of ['linkBtn', 'linkBtn2']) {
    const btn = $(id), span = btn.querySelector<HTMLElement>('[data-i18n]');
    if (span) { span.dataset.i18n = key; span.textContent = t(key); }
    btn.querySelector<SVGElement>('.glogo')?.style.setProperty('display', inApp ? 'none' : '');
  }
}

export function renderAccountLine(): void {
  const a = backend.account();
  const canLink = !!a && a.anonymous && backend.status() === 'online';
  $('linkRow').hidden = !canLink;
  $('linkBtn2').hidden = !(canLink && (runsDone() >= 3 || hasWon())); // suggested after the 3rd Run and the first victory
  const res = backend.linkResult();
  const txt = $('linkTxt');
  txt.textContent = res === 'merged' ? t('link.merged') : res === 'linked' ? t('link.linked') : res ? linkFailText(res.replace(/^failed:/, '')) : t(inApp ? 'link.inapp' : 'link.hint');
  txt.className = 'linkhint' + (res ? (res.startsWith('failed') ? ' bad' : ' ok') : '');
  if (res && !res.startsWith('failed')) $('linkRow').hidden = false;
  $('linkBtn').hidden = !canLink;
  linkButtons();
  $('acctTxt').textContent = a ? t('account.as', { name: a.nickname }) + (backend.status() === 'offline' ? t('account.offline') : backend.status() === 'suspended' ? t('account.suspended') : '') : '';
  $('renameBtn').hidden = !a;
}

/** An admin suspended this account: say until when (the player may still play offline, uncredited). */
function showSuspended(): void {
  const until = backend.account()?.suspendedUntil;
  const d = until ? new Date(until) : null;
  $('suspendedText').textContent = t('suspended.text', { until: d && !Number.isNaN(d.getTime()) ? d.toLocaleString(document.documentElement.lang === 'th' ? 'th-TH' : 'en-GB') : '-' });
  hooks.pauseGame();
  show('ovSuspended');
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
      hooks.onAccount?.();
      await afterStart();
    });
    return;
  }
  await backend.start({});
  started = true;
  renderAccountLine();
  hooks.onAccount?.();
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
    if (s === 'suspended') showSuspended();
  });
  $('replacedBtn').addEventListener('click', async () => {
    try { await backend.reclaim(); hide('ovReplaced'); } catch { /* stays open */ }
  });
  $('renameBtn').addEventListener('click', () => {
    const a: Account | null = backend.account();
    askName(a?.nickname ?? '', async (nick) => { if (nick) { await backend.setNickname(nick); hooks.onAccount?.(); } });
  });
  $('tabBtn').addEventListener('click', () => { takeOver(); });
  $('suspendedBtn').addEventListener('click', () => hide('ovSuspended'));
  const link = (): void => {
    if (inApp) {
      $('linkRow').hidden = false;
      if (isAndroid(navigator.userAgent)) { location.href = chromeIntent(gameUrl()); return; }
      const txt = $('linkTxt');
      const copy = navigator.clipboard ? navigator.clipboard.writeText(gameUrl()) : Promise.reject(new Error('no clipboard'));
      void copy.then(
        () => { txt.textContent = t('link.copied'); txt.className = 'linkhint ok'; },
        () => { txt.textContent = gameUrl(); }, // copy blocked: show the link so it can be copied by hand
      );
      return;
    }
    void backend.linkGoogle().catch((e: unknown) => {
      const err = e as { code?: string; message?: string };
      $('linkRow').hidden = false;
      $('linkTxt').textContent = linkFailText(String(err?.message || err?.code || ''));
    });
  };
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
