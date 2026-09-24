import './style.css';
import { createSim, DT, isHero, type Command, type DebugEvent, type Sim, type SimOptions } from '@pixel-horde/sim';
import { lang, onLangChange, t } from '@pixel-horde/i18n';
import { initAudio, audio } from './audio/sfx';
import { applyLang, settings } from './settings';
import { closeSettings, openSettings, settingsOpen } from './ui/settings-screen';
import { checkSession, initAccount, renderAccountLine } from './ui/account';
import { initLeaderboard } from './ui/leaderboard';
import { active } from './config';
import { META, getBest, metaSync, setBest, simMeta } from './meta';
import { backend, type Announcement, type RunResult, type RunTicket } from './net';
import { announcementText, live } from './live';
import { keys, readInput, touch } from './platform/input';
import { cv, onResize, screen } from './platform/screen';
import { drawHud, drawTexts, renderWorld } from './render/draw';
import { MET, ambient, clearVfx, consume, stepVfx } from './render/vfx';
import {
  $, bestLine, cancelChest, chestTick, closeShop, hide, openChest, openShop, renderChars, renderLevelUp,
  setPlayUI, show, showClear, showOver, showPause, applyStaticText,
} from './ui/overlays';

/* ---------- debug flags: ?debug=dragon|rival|bloodmoon|god (comma separated) ---------- */
const debugFlags = new Set((new URLSearchParams(location.search).get('debug') || '').split(',').filter(Boolean));
const debug: SimOptions['debug'] = {
  god: debugFlags.has('god'),
  event: (['dragon', 'rival', 'bloodmoon'] as DebugEvent[]).find((k) => debugFlags.has(k)),
};

/* ---------- run state ---------- */
let sim: Sim | null = null;
let queue: Command[] = [];
let runBanked = 0;
let ticket: RunTicket | null = null;
let clientRunId = '';
let runWallStart = 0;
let starting = false;
let shownLevelUp: object | null = null;
let shownPhase = '';
let acc = 0;
let last = performance.now();
let rclock = 0;

const cmd = (c: Command): void => { queue.push(c); };

/** What the server needs to check and credit this Run. */
function runResult(result: RunResult['result']): RunResult | null {
  if (!sim) return null;
  const v = sim.view();
  const playMs = Math.round(v.totalTime * 1000);
  return {
    clientRunId, hero: v.hero, mode: 'solo', result, chapter: v.stage, kills: v.kills, level: v.P.lv, gold: v.runGold,
    score: sim.score(), playMs, pausedMs: Math.max(0, Math.round(performance.now() - runWallStart) - playMs),
    configVersion: ticket?.configVersion ?? v.configVersions[0],
    summary: { configVersions: v.configVersions },
  };
}

/** Stage clear / Run end: show the Gold in the wallet now; the server credits it on submit. */
function bank(final?: RunResult['result']): void {
  if (!sim) return;
  if (final) void refreshLive();
  const add = sim.view().runGold - runBanked;
  if (add > 0) { metaSync.bankLocal(add); runBanked += add; }
  const r = runResult(final ?? 'quit');
  if (r) metaSync.recordRun(r, ticket, !final);
  if (final) void metaSync.sync();
}

async function newRun(): Promise<void> {
  if (starting) return;
  starting = true;
  initAudio();
  // The server picks the seed when online; give it a moment, then fall back to a local seed.
  ticket = await Promise.race([backend.startRun(META.ch).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
  starting = false;
  clientRunId = globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random();
  runWallStart = performance.now();
  hide('ovTitle'); hide('ovOver');
  clearVfx();
  sim = createSim({
    seed: ticket ? ticket.seed : (Math.random() * 4294967296) >>> 0,
    hero: isHero(META.ch) ? META.ch : 'mage',
    meta: simMeta(),
    viewport: { w: screen.LW, h: screen.LH },
    config: active.cfg,
    events: { bloodMoon: live.flags().bloodMoon, dragon: live.flags().dragon, rival: live.flags().rival },
    debug,
  });
  queue = [];
  runBanked = 0;
  shownLevelUp = null;
  shownPhase = '';
  consume(sim.view().events, sim.view());
  checkSession();
  setPlayUI(true);
  last = performance.now();
  acc = 0;
}

function toTitle(): void {
  sim = null;
  queue = [];
  ['ovOver', 'ovPause', 'ovLevel', 'ovClear', 'ovMsg'].forEach(hide);
  cancelChest();
  clearVfx();
  setPlayUI(false);
  renderChars();
  $('bestTxt').textContent = bestLine();
  show('ovTitle');
}

/** Open/close overlays when the sim's phase changes. */
function syncOverlays(): void {
  if (!sim) return;
  const v = sim.view();
  if (v.phase === 'levelup' && v.levelUp && v.levelUp !== shownLevelUp) {
    shownLevelUp = v.levelUp;
    renderLevelUp(v, (i) => {
      if (sim && sim.view().phase === 'levelup') { hide('ovLevel'); cmd({ type: 'pick', index: i }); }
    });
  }
  if (v.phase !== shownPhase) {
    const prev = shownPhase;
    shownPhase = v.phase;
    if (prev === 'levelup' && v.phase !== 'levelup') { hide('ovLevel'); shownLevelUp = null; }
    if (v.phase === 'chest' && v.chest) openChest(v.chest.res, v.chest.target, v.chest.start);
    if (v.phase === 'clear') showClear(v, v.runGold);
    if (v.phase === 'over') {
      bank('dead');
      const bb = getBest();
      if (!bb || v.stage > bb.stage || (v.stage === bb.stage && v.kills > bb.kills)) setBest({ stage: v.stage, kills: v.kills });
      showOver(v, v.runGold);
    }
  }
}

function frame(now: number): void {
  const rdt = Math.min(0.25, Math.max(0, (now - last) / 1000));
  last = now;
  rclock += rdt;
  try {
    if (sim) {
      if (chestTick(rdt)) cmd({ type: 'chestStop' });
      acc += rdt;
      let steps = 0;
      while (acc >= DT && steps < 8) {
        const input = readInput();
        const events = sim.step(input, queue);
        queue = [];
        const v = sim.view();
        consume(events, v);
        if (events.some((e) => e.t === 'stageClear')) bank();
        if (events.some((e) => e.t === 'stageStart')) { checkSession(); void refreshLive(); }
        if (v.phase === 'play' || v.phase === 'clearing') ambient(v);
        acc -= DT;
        steps++;
        if (v.phase !== 'play' && v.phase !== 'clearing') { acc = 0; break; }
      }
      if (steps >= 8) acc = 0;
      syncOverlays();
      const v = sim.view();
      stepVfx(rdt, v.slowT > 0 ? rdt * 0.3 : rdt);
    } else stepVfx(rdt, rdt);
  } catch (err) {
    console.error(err);
  }
  const v = sim ? sim.view() : null;
  renderWorld(v, v ? v.clock : rclock, !v || v.phase === 'over');
  if (v) { drawTexts(v.clock); drawHud(v, v.clock, v.runGold); }
  requestAnimationFrame(frame);
}

onResize(() => { if (sim) cmd({ type: 'viewport', w: screen.LW, h: screen.LH }); });

/* ---------- input ---------- */
let leaveArmed = false;
function pause(): void {
  if (!sim || sim.view().phase !== 'play') return;
  cmd({ type: 'pause' });
  leaveArmed = false;
  showPause();
}
function resume(): void {
  if (!sim || sim.view().phase !== 'pause') return;
  hide('ovPause');
  cmd({ type: 'resume' });
  last = performance.now();
}
function metLabel(): void {
  $('metBtn').textContent = t('pause.meter', { state: t(MET.on ? 'pause.on' : 'pause.off') });
}
function toggleMet(): void {
  MET.on = !MET.on;
  MET.dmg = [];
  MET.ttk = [];
  metLabel();
}
const playing = (): boolean => !!sim && sim.view().phase === 'play';

addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && playing()) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'Space' && playing()) cmd({ type: 'ult' });
  if (e.code === 'Escape' && settingsOpen()) { closeSettings(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { if (playing()) pause(); else if (sim && sim.view().phase === 'pause') resume(); }
  if (e.code === 'KeyM') audio.muted = !audio.muted;
  if (e.code === 'KeyI') toggleMet();
  if (sim && sim.view().phase === 'levelup' && /^Digit[1-3]$/.test(e.code)) {
    const bt = $('opts').children[+e.code.slice(5) - 1] as HTMLElement | undefined;
    if (bt) bt.click();
  }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
cv.addEventListener('pointerdown', (e) => {
  if (!playing()) return;
  touch.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY, cx: e.clientX, cy: e.clientY, act: true };
  try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
});
cv.addEventListener('pointermove', (e) => { const j = touch.joy; if (j && j.id === e.pointerId) { j.cx = e.clientX; j.cy = e.clientY; } });
const endJoy = (e: PointerEvent): void => { if (touch.joy && touch.joy.id === e.pointerId) touch.joy = null; };
cv.addEventListener('pointerup', endJoy);
cv.addEventListener('pointercancel', endJoy);

$('ultBtn').addEventListener('click', () => cmd({ type: 'ult' }));
$('pauseBtn').addEventListener('click', () => (sim && sim.view().phase === 'pause' ? resume() : pause()));
$('resumeBtn').addEventListener('click', resume);
$('metBtn').addEventListener('click', toggleMet);
$('homeBtn').addEventListener('click', toTitle);
$('leaveBtn').addEventListener('click', () => {
  if (!leaveArmed) { leaveArmed = true; $('leaveBtn').textContent = t('pause.confirm'); return; }
  leaveArmed = false;
  bank('quit');
  toTitle();
});
$('msgBtn').addEventListener('click', toTitle);
$('shopBtn1').addEventListener('click', () => { initAudio(); openShop('ovTitle'); });
$('shopBtn2').addEventListener('click', () => { initAudio(); openShop('ovOver'); });
$('shopBack').addEventListener('click', closeShop);
$('settingsBtn1').addEventListener('click', () => { initAudio(); openSettings('ovTitle'); });
$('settingsBtn2').addEventListener('click', () => openSettings('ovPause'));
$('setBack').addEventListener('click', closeSettings);
$('startBtn').addEventListener('click', () => void newRun());
$('nextBtn').addEventListener('click', () => { hide('ovClear'); cmd({ type: 'next' }); last = performance.now(); });
$('retryBtn').addEventListener('click', () => void newRun());

/** Export the always-on recording (seed, options, inputs, commands, hashes) as JSON. */
function downloadReplay(): void {
  if (!sim) return;
  const r = sim.replay();
  const blob = new Blob([JSON.stringify(r)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pixel-horde-replay-${r.opts.seed}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('replayBtn').addEventListener('click', downloadReplay);
$('replayBtn2').addEventListener('click', downloadReplay);

/* ---------- live state: flags, announcements, maintenance, config ---------- */
let news: Announcement[] = [];
let maintDismissed = false;
function renderNews(): void {
  const box = $('news');
  box.innerHTML = '';
  for (const a of news) {
    const { title, body } = announcementText(a);
    const d = document.createElement('div');
    const b = document.createElement('b'); b.textContent = title;
    const p = document.createElement('span'); p.textContent = body;
    d.append(b, p);
    box.appendChild(d);
  }
  box.hidden = news.length === 0;
}
async function refreshLive(): Promise<void> {
  await live.refresh({
    onAnnouncements: (list) => { news = list; renderNews(); },
    onMaintenance: (on) => { if (on && !maintDismissed) { pause(); show('ovMaint'); } if (!on) hide('ovMaint'); },
    onTooOld: () => { pause(); show('ovUpdate'); },
    onConfig: (cfg) => { if (sim) cmd({ type: 'setConfig', config: cfg }); },
  });
  const f = live.flags();
  if (sim) cmd({ type: 'setEvents', events: { bloodMoon: f.bloodMoon, dragon: f.dragon, rival: f.rival } });
}
$('maintBtn').addEventListener('click', () => { maintDismissed = true; hide('ovMaint'); });
$('updateBtn').addEventListener('click', () => location.reload());

/* ---------- language ---------- */
function refreshText(): void {
  applyStaticText();
  metLabel();
  renderChars();
  $('bestTxt').textContent = bestLine();
  renderAccountLine();
  renderNews();
}
onLangChange(refreshText);
$('langBtn').addEventListener('click', () => applyLang(lang() === 'th' ? 'en' : 'th'));
applyLang(settings.lang);
refreshText();
initAccount({ pauseGame: pause, onMetaChanged: () => { refreshText(); void refreshLive(); } });
void refreshLive();
initLeaderboard();
requestAnimationFrame(frame);
