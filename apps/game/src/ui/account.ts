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

/** Say why linking failed (the server setting "Allow manual linking" is the usual culprit); known codes get a plain-language reason, others show the raw code. */
function linkFailText(reason: string): string {
  if (/manual.?linking/i.test(reason)) return t('link.failed.manual_linking_disabled');
  if (reason === 'OFFLINE') return t('link.failed.offline');
  if (/^access_denied$/i.test(reason)) return t('link.failed.cancelled');
  const r = reason.trim().slice(0, 60);
  return r ? t('link.failed.reason', { reason: r }) : t('link.failed');
}

/** Inside Facebook / LINE / … Google refuses to sign in, so the link buttons send the player to a real browser. */
const inApp = inAppBrowser(navigator.userAgent);
const gameUrl = (): string => location.origin + location.pathname;

// Title's button reads "Login" (first impression); the run-over and Settings buttons keep the
// original "Link account" framing since they're offered mid-lifecycle to a player who already has progress.
const NORMAL_KEY: Record<string, string> = { linkBtn: 'login.button', linkBtn2: 'link.button', setLinkBtn: 'link.button' };

function linkButtons(): void {
  for (const id of ['linkBtn', 'linkBtn2', 'setLinkBtn']) {
    const btn = $(id), span = btn.querySelector<HTMLElement>('[data-i18n]');
    const key = inApp ? (isAndroid(navigator.userAgent) ? 'link.openBrowser' : 'link.copyLink') : NORMAL_KEY[id];
    if (span) { span.dataset.i18n = key; span.textContent = t(key); }
    btn.querySelector<SVGElement>('.glogo')?.style.setProperty('display', inApp ? 'none' : '');
  }
}

/** The row's hint line: the shared link result (merged/linked/failed) if there is one, else its own default prompt. */
function hintText(defaultKey: string): { text: string; cls: string } {
  const res = backend.linkResult();
  const text = res === 'merged' ? t('link.merged') : res === 'linked' ? t('link.linked') : res ? linkFailText(res.replace(/^failed:/, '')) : t(inApp ? 'link.inapp' : defaultKey);
  const cls = 'linkhint' + (res ? (res.startsWith('failed') ? ' bad' : ' ok') : '');
  return { text, cls };
}

export function renderAccountLine(): void {
  const a = backend.account();
  const canLink = !!a && a.anonymous && backend.status() === 'online';
  const res = backend.linkResult();
  const showResult = !!res && !res.startsWith('failed'); // keep the row up a moment to show "linked!" even though canLink just turned false

  $('linkRow').hidden = !(canLink || showResult);
  const linkTxt = $('linkTxt'), h1 = hintText('login.hint');
  linkTxt.textContent = h1.text; linkTxt.className = h1.cls;

  $('setLinkRow').hidden = !(canLink || showResult);
  const setLinkTxt = $('setLinkTxt'), h2 = hintText('link.hint');
  setLinkTxt.textContent = h2.text; setLinkTxt.className = h2.cls;

  const showLinkBtn2 = canLink && (runsDone() >= 3 || hasWon()); // suggested after the 3rd Run and the first victory
  $('linkBtn2').hidden = !showLinkBtn2;
  if (!showLinkBtn2) $('linkTxt2').hidden = true; // don't let a stale message from a past attempt reappear with the button
  $('linkBtn').hidden = !canLink;
  $('setLinkBtn').hidden = !canLink;
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
  const link = (rowId: string, txtId: string) => (): void => {
    if (inApp) {
      $(rowId).hidden = false;
      if (isAndroid(navigator.userAgent)) { location.href = chromeIntent(gameUrl()); return; }
      const txt = $(txtId);
      const copy = navigator.clipboard ? navigator.clipboard.writeText(gameUrl()) : Promise.reject(new Error('no clipboard'));
      void copy.then(
        () => { txt.textContent = t('link.copied'); txt.className = 'linkhint ok'; },
        () => { txt.textContent = gameUrl(); }, // copy blocked: show the link so it can be copied by hand
      );
      return;
    }
    void backend.linkGoogle().catch((e: unknown) => {
      const err = e as { code?: string; message?: string };
      $(rowId).hidden = false;
      const txt = $(txtId);
      txt.textContent = linkFailText(String(err?.message || err?.code || ''));
      txt.className = 'linkhint bad'; // must carry .bad: short screens hide any #linkTxt that isn't .ok/.bad
    });
  };
  $('linkBtn').addEventListener('click', link('linkRow', 'linkTxt'));
  $('linkBtn2').addEventListener('click', link('linkTxt2', 'linkTxt2'));
  $('setLinkBtn').addEventListener('click', link('setLinkRow', 'setLinkTxt'));
  void guardTab({
    onAcquired: () => { hide('ovTab'); void startAccount(); },
    onBlocked: () => { $('tabTitle').textContent = t('tab.blockedTitle'); $('tabText').textContent = t('tab.blockedText'); show('ovTab'); },
    onLost: () => { hooks.pauseGame(); $('tabTitle').textContent = t('tab.lostTitle'); $('tabText').textContent = t('tab.lostText'); show('ovTab'); },
  });
  addEventListener('visibilitychange', () => { if (!document.hidden) void backend.checkSession(); });
}

/** Call at Run start and Stage start. */
export function checkSession(): void { void backend.checkSession(); }
