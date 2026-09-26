// Feedback screen (title footer + Settings): a category and a message, sent to the server with a small
// context. Offline (or not signed in yet) the message waits in an outbox and goes out once online.
import { t } from '@pixel-horde/i18n';
import { backend, BackendError, type FeedbackCategory, type FeedbackInput } from '../net';
import { BUILD } from '../live';
import { $, hide, show } from './overlays';

const OUTBOX = 'pixelhorde-feedback-outbox';
const MAX_LEN = 1000;
const CATS: FeedbackCategory[] = ['bug', 'balance', 'idea', 'other'];

let from = 'ovTitle';
let cat: FeedbackCategory = 'bug';
let runContext: () => Record<string, string | number | boolean> = () => ({});
let sending = false;

function readOutbox(): FeedbackInput[] {
  try { const a = JSON.parse(localStorage.getItem(OUTBOX) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}
function writeOutbox(a: FeedbackInput[]): void {
  try { if (a.length) localStorage.setItem(OUTBOX, JSON.stringify(a.slice(-10))); else localStorage.removeItem(OUTBOX); } catch { /* storage full or blocked */ }
}

/** Send what waited offline. Stops at the first failure; a message the server refuses for good is dropped. */
export async function flushFeedback(): Promise<void> {
  if (backend.status() !== 'online') return;
  const box = readOutbox();
  while (box.length) {
    try { await backend.sendFeedback(box[0]); }
    catch (e) { if (e instanceof BackendError && (e.code === 'OFFLINE' || e.code === 'FEEDBACK_LIMIT' || e.code === 'NOT_SIGNED_IN')) break; }
    box.shift();
    writeOutbox(box);
  }
}

function context(): FeedbackInput['context'] {
  return {
    build: String(BUILD),
    device: navigator.userAgent.slice(0, 200),
    screen: `${innerWidth}x${innerHeight}@${Math.round((devicePixelRatio || 1) * 100) / 100}`,
    lang: document.documentElement.lang || navigator.language,
    sentAt: new Date().toISOString(),
    ...runContext(),
  };
}

function render(): void {
  const seg = $('fbCats');
  seg.innerHTML = '';
  for (const c of CATS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = t(`feedback.cat.${c}`);
    b.setAttribute('aria-pressed', String(cat === c));
    b.addEventListener('click', () => { cat = c; render(); });
    seg.appendChild(b);
  }
  const txt = $('fbText') as HTMLTextAreaElement;
  $('fbCount').textContent = `${txt.value.length}/${MAX_LEN}`;
}

async function send(): Promise<void> {
  if (sending) return;
  const txt = $('fbText') as HTMLTextAreaElement, msg = $('fbMsg');
  const message = txt.value.trim();
  if (!message) { msg.textContent = t('feedback.empty'); txt.focus(); return; }
  const f: FeedbackInput = { category: cat, message: message.slice(0, MAX_LEN), context: context() };
  sending = true;
  ($('fbSend') as HTMLButtonElement).disabled = true;
  msg.textContent = t('feedback.sending');
  try {
    await backend.sendFeedback(f);
    msg.textContent = t('feedback.sent');
    txt.value = '';
  } catch (e) {
    const code = e instanceof BackendError ? e.code : 'UNKNOWN';
    if (code === 'FEEDBACK_LIMIT') msg.textContent = t('feedback.limit');
    else if (code === 'ACCOUNT_SUSPENDED') msg.textContent = t('feedback.failed');
    else { writeOutbox([...readOutbox(), f]); msg.textContent = t('feedback.queued'); txt.value = ''; }
  } finally {
    sending = false;
    ($('fbSend') as HTMLButtonElement).disabled = false;
    render();
  }
}

export function openFeedback(fromOverlay: string): void {
  from = fromOverlay;
  hide(from);
  $('fbMsg').textContent = '';
  render();
  show('ovFeedback');
  setTimeout(() => ($('fbText') as HTMLTextAreaElement).focus({ preventScroll: true }), 30);
}

export function closeFeedback(): void {
  hide('ovFeedback');
  show(from);
}

export const feedbackOpen = (): boolean => $('ovFeedback').classList.contains('on');

/** Wire the screen once. `run` adds the current Run's Chapter / Hero / mode when sent from the pause menu. */
export function initFeedback(run: () => Record<string, string | number | boolean>): void {
  runContext = run;
  const txt = $('fbText') as HTMLTextAreaElement;
  txt.maxLength = MAX_LEN;
  txt.addEventListener('input', () => { $('fbCount').textContent = `${txt.value.length}/${MAX_LEN}`; $('fbMsg').textContent = ''; });
  $('fbSend').addEventListener('click', () => void send());
  $('fbBack').addEventListener('click', closeFeedback);
  backend.onStatus((s) => { if (s === 'online') void flushFeedback(); });
  void flushFeedback();
}
