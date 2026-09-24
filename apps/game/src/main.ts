import './style.css';
import { createSim, DT, isHero, isWeapon, type Command, type DebugEvent, type Sim, type SimOptions, type SimState, type SkillId, type WeaponId, endlessBreakdown, reviveCost, runFacts } from '@pixel-horde/sim';
import { lang, onLangChange, t } from '@pixel-horde/i18n';
import { initAudio, audio, playMusic, setMuted } from './audio/sfx';
import { applyLang, saveSettings, settings } from './settings';
import { closeSettings, openSettings, settingsOpen } from './ui/settings-screen';
import { checkSession, initAccount, noteRunFinished, renderAccountLine } from './ui/account';
import { initLeaderboard } from './ui/leaderboard';
import { active } from './config';
import { heroName } from './ui/text';
import { initCollection, openCollection } from './ui/collection';
import { initTitle, renderTitleSel } from './ui/title';
import { clearSave, configFor, readSave, writeSave, type LocalSave } from './save';
import { META, getBest, metaSync, setBest, simMeta } from './meta';
import { backend, type Announcement, type RunResult, type RunTicket } from './net';
import { DRAFT, announcementText, live } from './live';
import { installTelemetry, telemetry } from './telemetry';
import { createFpsWatch } from './fpswatch';
import { createTips, type TipId } from './tips';
import { initLobby, leaveRoom, openLobby } from './ui/lobby';
import { createTeam } from './coop/team';
import type { Session } from './coop/session';
import type { CloseReason } from '@pixel-horde/coop';
import { isMobile } from './platform/device';
import { keys, readInput, touch } from './platform/input';
import { cv, onResize, screen } from './platform/screen';
import { drawHud, drawTexts, renderWorld } from './render/draw';
import { MET, ambient, clearVfx, consume, setBanner, stepVfx, vfx } from './render/vfx';
import {
  $, bestLine, cancelChest, chestTick, closeShop, hide, openChest, openShop, renderAwaken, renderBench, renderCompanions, renderSp, renderWeaponSwitch, showRevive, renderChars, renderLevelUp, renderRoute,
  setPlayUI, show, showClear, showOver, showPause, applyStaticText,
} from './ui/overlays';

/* ---------- debug flags: ?debug=dragon|frostdragon|stormdragon|rival|bloodmoon|god (comma separated) ---------- */
const debugFlags = new Set((new URLSearchParams(location.search).get('debug') || '').split(',').filter(Boolean));
const debug: SimOptions['debug'] = {
  god: debugFlags.has('god'),
  event: (['dragon', 'frostdragon', 'stormdragon', 'rival', 'bloodmoon'] as DebugEvent[]).find((k) => debugFlags.has(k)),
};

/* ---------- run state ---------- */
let sim: Sim | null = null;
let queue: Command[] = [];
let runBanked = 0;
let walletBanked = 0;
let ticket: RunTicket | null = null;
let clientRunId = '';
let runWallStart = 0;
let starting = false;
let shownLevelUp: object | null = null;
let shownPhase = '';
let acc = 0;
let last = performance.now();
let rclock = 0;
const fpsWatch = createFpsWatch();
const tips = createTips({ seen: () => META.tips, mark: (id) => metaSync.markTip(id), enabled: () => settings.tips });
let tipShown: TipId | null = null;
function showTip(id: TipId | null): void {
  if (id === tipShown) return;
  tipShown = id;
  const bar = $('tipBar');
  bar.hidden = !id;
  if (id) bar.textContent = t(`tip.${id}`);
}

const cmd = (c: Command): void => { queue.push(c); };

/** What the server needs to check and credit this Run. */
function runResult(result: RunResult['result']): RunResult | null {
  if (!sim) return null;
  const v = sim.view();
  const playMs = Math.round(v.totalTime * 1000);
  return {
    clientRunId, hero: v.hero, mode: coop ? 'coop' : 'solo', result, chapter: v.stage, kills: v.kills, level: v.P.lv, gold: v.runGold, walletSpent: v.walletSpent, resumedHash, weapon: v.weapon, weaponsFound: [...v.foundWeapons],
    endlessScore: endlessBreakdown(v).total, victory: v.victory, crack: v.crack, facts: { ...runFacts(v) },
    score: sim.score(), playMs, pausedMs: Math.max(0, Math.round(performance.now() - runWallStart) - playMs),
    configVersion: ticket?.configVersion ?? v.configVersions[0],
    summary: telemetry.summary(v),
  };
}

/** Mirror this Run's Gold (and wallet spending) in the local wallet display. */
function syncWallet(): void {
  if (!sim) return;
  const v = sim.view(), add = v.runGold - runBanked, ws = v.walletSpent - walletBanked;
  if (add > 0) metaSync.bankLocal(add); else if (add < 0) metaSync.spendLocal(-add);
  if (ws > 0) metaSync.spendLocal(ws);
  runBanked = v.runGold; walletBanked = v.walletSpent;
}

/** Stage clear / Run end: show the Gold in the wallet now; the server credits it on submit. */
function bank(final?: RunResult['result']): void {
  if (!sim) return;
  if (final) void refreshLive();
  syncWallet();
  const r = runResult(final ?? 'quit');
  if (r) metaSync.recordRun(r, ticket, !final);
  if (final) {
    clearSave();
    metaSync.markTip('first');
    newAch = metaSync.recordFacts(runFacts(sim.view()));
    noteRunFinished(final === 'victory');
    telemetry.queueSample(backend.account()?.id ?? '', ticket?.runId ?? null, r?.configVersion ?? 0);
    void metaSync.sync().then(() => telemetry.flush());
  }
}

async function newRun(): Promise<void> {
  if (starting) return;
  const saved = readSave();
  if (saved && !confirm(t('save.discard', { chapter: saved.chapter, hero: heroName(saved.hero) }))) return;
  clearSave();
  starting = true;
  initAudio();
  // The server picks the seed when online; give it a moment, then fall back to a local seed.
  ticket = await Promise.race([backend.startRun(META.ch, 'solo', META.weapon).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
  starting = false;
  clientRunId = globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random();
  resumedHash = undefined;
  usedHash = undefined;
  beginRun(createSim({
    seed: ticket ? ticket.seed : (Math.random() * 4294967296) >>> 0,
    hero: isHero(META.ch) ? META.ch : 'mage',
    weapon: metaSync.ownsWeapon(META.weapon) ? META.weapon : 'judgement',
    crack: Math.min(META.crack, META.crackMax),
    firstRun: !META.tips.includes('first'), // the account's very first Greenvale is a little easier
    meta: simMeta(),
    viewport: { w: screen.LW, h: screen.LH }, mobile: isMobile(),
    config: active.cfg,
    events: { bloodMoon: live.flags().bloodMoon, dragon: live.flags().dragon, rival: live.flags().rival },
    debug,
  }));
}

/* ---------- co-op (tickets 41/42) ---------- */
let coop: Session | null = null;
const team = createTeam(active.cfg.coop.clearWait, active.cfg.coop.voteTime);
let teamT = 0, teamPhase = '';
const isGuest = (): boolean => coop?.role === 'guest';

function playerPid(): string {
  const a = backend.account();
  if (a) return a.id;
  try {
    const p = localStorage.getItem('pixelhorde-pid') || String(Math.random()).slice(2, 14);
    localStorage.setItem('pixelhorde-pid', p);
    return p;
  } catch { return String(Math.random()).slice(2, 14); }
}

async function startCoop(s: Session, seed: number, cfgVersion: number): Promise<void> {
  if (sim) return;
  coop = s;
  initAudio();
  clearSave();
  const config = s.role === 'guest' ? (await configFor(cfgVersion)) ?? active.cfg : active.cfg; // guests use the host's Balance Config
  ticket = await Promise.race([backend.startRun(META.ch, 'coop', META.weapon).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
  clientRunId = globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random();
  resumedHash = undefined; usedHash = undefined;
  teamPhase = '';
  beginRun(createSim({
    seed: s.role === 'host' ? seed : (Math.random() * 4294967296) >>> 0,
    hero: isHero(META.ch) ? META.ch : 'mage',
    weapon: metaSync.ownsWeapon(META.weapon) ? META.weapon : 'judgement',
    meta: simMeta(), viewport: { w: screen.LW, h: screen.LH }, mobile: isMobile(), config,
    events: { bloodMoon: live.flags().bloodMoon, dragon: live.flags().dragon, rival: live.flags().rival },
    coop: { role: s.role, self: s.selfId },
  }));
  s.on((e) => {
    if (coop !== s) return;
    if (e.t === 'ready') team.setReady(e.id, e.on);
    else if (e.t === 'vote') team.vote(e.id, e.i);
    else if (e.t === 'team') renderTeam(e.ready, e.votes, e.left);
  });
}

/** Co-op: when this player goes down, offer the bought revive (the room keeps playing). */
let downShown = false;
function coopDown(v: Readonly<SimState>): void {
  const down = v.P.down && v.phase === 'play';
  if (down && !downShown) {
    downShown = true;
    const can = v.mode !== 'daily' && v.revivesBought === 0 && v.runGold + Math.max(0, (v.meta.wallet || 0) - v.walletSpent) >= reviveCost(v as SimState);
    showRevive(v, reviveCost(v as SimState));
    $('reviveTxt').textContent = t('coop.downText') + (can ? ' ' + $('reviveTxt').textContent : '');
    ($('reviveBtn') as HTMLButtonElement).hidden = !can;
    $('giveUpBtn').textContent = t('coop.wait');
  } else if (!down && downShown) {
    downShown = false;
    hide('ovRevive');
    ($('reviveBtn') as HTMLButtonElement).hidden = false;
    $('giveUpBtn').textContent = t('revive.giveUp');
  }
}

/** The room closed during a Run: keep what was collected. */
function coopClosed(reason: CloseReason): void {
  if (!sim || !coop) return;
  const v = sim.view();
  if (v.phase !== 'over') bank(v.victory ? 'victory' : 'quit');
  coop = null;
  toTitle();
  if (reason !== 'left') showMsg(t(`coop.err.${reason}`));
}

/** Host: run the team's Stage-end decisions and tell the guests. */
function hostTeam(rdt: number): void {
  if (!sim || !coop || coop.role !== 'host') return;
  const v = sim.view(), ph = v.phase === 'clear' ? 'clear' : v.phase === 'route' ? 'route' : 'other';
  if (ph !== teamPhase) { teamPhase = ph; team.enter(ph, coop.selfId, v.cfg.coop); }
  const ids = [coop.selfId, ...(v.coop?.mates.map((m) => m.id) ?? [])];
  const act = team.tick(rdt, ids, v.route?.choices.length ?? 2);
  if (act?.k === 'next') { hide('ovClear'); cmd({ type: 'next' }); }
  if (act?.k === 'route') { hide('ovRoute'); cmd({ type: 'route', index: act.index }); }
  teamT -= rdt;
  if (team.mode !== 'none' && teamT <= 0) {
    teamT = 0.5;
    const st = team.status();
    coop.send({ k: 'team', ...st });
    renderTeam(st.ready, st.votes, st.left);
  }
}

function renderTeam(ready: string[], votes: Record<string, number>, left: number): void {
  if (!coop) return;
  const names = coop.names();
  const who = (ids: string[]): string => ids.map((i) => names[i] ?? '?').join(', ');
  const note = $('clearTeam'), rnote = $('routeTeam');
  note.hidden = rnote.hidden = false;
  note.textContent = t('coop.teamReady', { who: who(ready) || '-', left });
  rnote.textContent = t('coop.teamVotes', { who: who(Object.keys(votes)) || '-', left });
}

/** Common start for new and resumed Runs. */
function beginRun(s: Sim): void {
  sim = s;
  runWallStart = performance.now();
  telemetry.startRun();
  hide('ovTitle'); hide('ovOver');
  clearVfx();
  queue = [];
  runBanked = s.view().runGold; // Gold up to a checkpoint was already shown in the wallet
  walletBanked = s.view().walletSpent;
  shownLevelUp = null;
  shownPhase = '';
  consume(s.view().events, s.view());
  autoSave();
  checkSession();
  setPlayUI(true);
  last = performance.now();
  acc = 0;
}

/* ---------- suspend / resume (ticket 31) ---------- */
function showMsg(txt: string): void { $('msgTxt').textContent = txt; hide('ovTitle'); show('ovMsg'); }
let resumedHash: string | undefined;
/** Achievements unlocked by the Run that just ended (shown on the Run-end screen). */
let newAch: string[] = [];
/** The checkpoint this session continued from: single use, never saved again (no Stage retries). */
let usedHash: string | undefined;
const canSave = (): boolean => !!sim && !coop && active.cfg.version !== -1 && sim.view().mode !== 'daily' && sim.checkpoint().hash !== usedHash;

/** Every Stage start: keep the checkpoint locally and on the server. */
function autoSave(quit = false): void {
  if (!sim || !canSave()) return;
  const v = sim.view(), cp = sim.checkpoint();
  writeSave({ runId: ticket?.runId, token: ticket?.token, seed: v.seed, hero: v.hero, weapon: v.weapon, crack: v.crack, chapter: cp.chapter,
    configVersion: cp.configVersion, hash: cp.hash, data: cp.data, savedAt: Date.now(), clientRunId });
  if (ticket) void backend.saveCheckpoint({ runId: ticket.runId, token: ticket.token, chapter: cp.chapter, hash: cp.hash, data: cp.data, configVersion: cp.configVersion, quit });
}

function saveAndQuit(): void {
  if (!canSave()) return;
  autoSave(true);
  toTitle();
}

/** Title: "Continue from Chapter N" (local save, or the account's save from another device). */
async function refreshContinue(): Promise<void> {
  const local = readSave();
  let chapter = local?.chapter, hero = local?.hero;
  if (backend.status() === 'online') {
    try {
      const srv = await backend.getCheckpoint();
      if (srv && (!local || Date.parse(srv.savedAt) >= local.savedAt) && isHero(srv.hero)) { chapter = srv.chapter; hero = srv.hero; }
    } catch { /* offline: local only */ }
  }
  const bt = $('continueBtn');
  bt.hidden = !chapter || !hero;
  if (chapter && hero) bt.textContent = t('save.continue', { chapter, hero: heroName(hero) });
}

async function continueRun(): Promise<void> {
  if (starting) return;
  starting = true;
  initAudio();
  try {
    const local = readSave();
    let pick: LocalSave | null = local;
    let seasonNote = false;
    if (backend.status() === 'online') {
      const srv = await backend.getCheckpoint().catch(() => null);
      if (srv && isHero(srv.hero) && (!local || Date.parse(srv.savedAt) >= local.savedAt)) {
        pick = { runId: srv.runId, token: srv.token, seed: Number(srv.seed), hero: srv.hero, weapon: isWeapon(srv.weapon) ? srv.weapon : 'judgement', crack: 0,
          chapter: srv.chapter, configVersion: srv.configVersion, hash: srv.hash, data: srv.data, savedAt: Date.parse(srv.savedAt), clientRunId: local?.clientRunId ?? '' };
      }
      if (pick?.runId) {
        const r = await backend.resumeRun(pick.runId, pick.hash).catch((e) => { throw e; });
        seasonNote = r.seasonChanged;
        resumedHash = undefined; // the server consumed this checkpoint
      }
    } else resumedHash = pick?.hash; // offline: the server checks it when the Run is submitted
    if (!pick) return;
    const config = await configFor(pick.configVersion);
    if (!config) { showMsg(t('save.noConfig')); return; }
    ticket = pick.runId && pick.token ? { runId: pick.runId, token: pick.token, seed: pick.seed, configVersion: pick.configVersion } : null;
    clientRunId = pick.clientRunId || (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
    const s = createSim({ seed: pick.seed, hero: pick.hero, weapon: pick.weapon, crack: pick.crack, meta: simMeta(), viewport: { w: screen.LW, h: screen.LH }, mobile: isMobile(),
      config, events: { bloodMoon: live.flags().bloodMoon, dragon: live.flags().dragon, rival: live.flags().rival }, debug, resume: pick.data });
    clearSave();
    usedHash = s.checkpoint().hash;
    beginRun(s);
    if (seasonNote) setBanner(t('save.seasonChanged'), '', 4);
  } catch {
    clearSave();
    showMsg(t('save.stale'));
    void refreshContinue();
  } finally {
    starting = false;
  }
}

function toTitle(): void {
  if (coop) { coop = null; leaveRoom(); }
  guestMenu = false;
  downShown = false;
  ($('reviveBtn') as HTMLButtonElement).hidden = false;
  $('giveUpBtn').textContent = t('revive.giveUp');
  sim = null;
  queue = [];
  $('fpsTip').hidden = true;
  tips.reset();
  showTip(null);
  $('retryBtn').hidden = false;
  ['ovCoop', 'ovHero', 'ovOver', 'ovPause', 'ovLevel', 'ovClear', 'ovRoute', 'ovRevive', 'ovEnding', 'ovMsg'].forEach(hide);
  cancelChest();
  clearVfx();
  setPlayUI(false);
  renderChars();
  renderTitleSel();
  $('bestTxt').textContent = bestLine();
  show('ovTitle');
  void refreshContinue();
}

let benchDirty = false;
function onSwap(bench: number, slot: SkillId | null): void { cmd({ type: 'swap', bench, slot }); benchDirty = true; }
function onAwaken(accept: boolean): void { cmd({ type: 'awaken', accept }); benchDirty = true; }
function renderClear(v: Readonly<SimState>, denied = false): void {
  showClear(v, v.runGold);
  renderAwaken(v, onAwaken);
  renderCompanions(v, (i) => { cmd({ type: 'companion', index: i }); benchDirty = true; }, (ok) => { cmd({ type: 'fuse', accept: ok }); benchDirty = true; },
    () => { cmd({ type: 'spCompanion' }); benchDirty = true; });
  renderWeaponSwitch(v, (id) => { cmd({ type: 'weapon', id }); benchDirty = true; });
  renderSp(v, () => { cmd({ type: 'buySp' }); benchDirty = true; }, (id) => { cmd({ type: 'spUpgrade', id }); benchDirty = true; });
  renderBench(v, onSwap, denied);
}

/** Open/close overlays when the sim's phase changes. */
function syncOverlays(): void {
  if (!sim) return;
  const v = sim.view();
  if (v.phase === 'levelup' && v.levelUp && v.levelUp !== shownLevelUp) {
    shownLevelUp = v.levelUp;
    renderLevelUp(v, (i) => {
      if (sim && sim.view().phase === 'levelup') {
        const o = sim.view().levelUp?.options[i];
        if (o) { const id = o.kind === 'heal' || o.kind === 'comp' ? o.kind : o.kind + ':' + o.id; telemetry.pick(id); telemetry.event({ k: 'pick', id, lv: sim.view().P.lv, t: Math.round(sim.view().totalTime) }); }
        hide('ovLevel');
        cmd({ type: 'pick', index: i });
      }
    }, { reroll: () => cmd({ type: 'reroll' }), banish: (i) => cmd({ type: 'banish', index: i }) });
  }
  if (v.phase !== shownPhase) {
    const prev = shownPhase;
    shownPhase = v.phase;
    if (prev === 'levelup' && v.phase !== 'levelup') { hide('ovLevel'); shownLevelUp = null; }
    if (prev === 'clear' && v.phase !== 'clear') hide('ovClear');
    if (prev === 'route' && v.phase !== 'route') hide('ovRoute');
    if (v.phase === 'chest' && v.chest) openChest(v.chest.res, v.chest.target, v.chest.start);
    if (v.phase === 'clear') { renderClear(v); $('clearTeam').hidden = !coop; $('clearTeam').textContent = ''; ($('nextBtn') as HTMLButtonElement).disabled = false; }
    if (v.phase === 'revive') showRevive(v, reviveCost(v as SimState));
    if (v.phase === 'victory') { metaSync.unlockCrack(v.crack); show('ovEnding'); }
    if (prev === 'victory' && v.phase !== 'victory') hide('ovEnding');
    if (prev === 'revive' && v.phase !== 'revive') hide('ovRevive');
    if (v.phase === 'route' && v.route) {
      $('routeTeam').hidden = !coop; $('routeTeam').textContent = '';
      renderRoute(v, (i) => {
        if (!sim || sim.view().phase !== 'route') return;
        if (coop) { // co-op: a vote
          if (coop.role === 'host') team.vote(coop.selfId, i); else coop.send({ k: 'vote', i });
          $('routeTeam').hidden = false; $('routeTeam').textContent = t('coop.voteWait');
          return;
        }
        hide('ovRoute'); cmd({ type: 'route', index: i }); last = performance.now();
      });
    }
    if (v.phase === 'over') {
      bank(v.victory && !v.endless && v.P.hp > 0 ? 'victory' : 'dead');
      const bb = getBest();
      if (!bb || v.stage > bb.stage || (v.stage === bb.stage && v.kills > bb.kills)) setBest({ stage: v.stage, kills: v.kills });
      showOver(v, v.runGold, newAch);
      $('retryBtn').hidden = !!coop; // co-op: back to the title (and the lobby) instead
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
      acc += vfx.slowmo > 0 ? rdt * sim.view().cfg.fx.slowmoScale : rdt; // King-death slow motion (presentation only)
      let steps = 0;
      while (acc >= DT && steps < 8) {
        const input = readInput();
        if (coop) queue.push(...coop.commands());
        const events = sim.step(input, queue);
        queue = [];
        const v = sim.view();
        consume(events, v);
        tips.observe(events, v);
        if (events.some((e) => e.t === 'spent')) syncWallet();
        const found = events.filter((e) => e.t === 'weaponFound').map((e) => (e as { id: WeaponId }).id);
        if (found.length) metaSync.addWeapons(found);
        if (benchDirty && v.phase === 'clear') {
          benchDirty = false;
          syncWallet();
          renderClear(v, events.some((e) => e.t === 'swapDenied'));
        }
        if (events.some((e) => e.t === 'stageClear')) { bank(); telemetry.event({ k: 'clear', st: v.stage, t: Math.round(v.totalTime), hp: Math.round(v.P.hp), lv: v.P.lv }); }
        if (events.some((e) => e.t === 'stageStart')) { checkSession(); void refreshLive(); autoSave(); }
        if (v.phase === 'play' || v.phase === 'clearing') ambient(v);
        acc -= DT;
        steps++;
        if (v.phase !== 'play' && v.phase !== 'clearing') { acc = 0; break; }
      }
      if (steps >= 8) acc = 0;
      if (coop && steps === 0 && sim.view().phase !== 'play') { // menus: keep applying snapshots / presence
        const events = sim.step({ mx: 0, my: 0 }, [...queue.splice(0), ...coop.commands()]);
        consume(events, sim.view());
      }
      if (coop) {
        coopDown(sim.view());
        hostTeam(rdt);
        if (!coop.tick(rdt, sim.view(), sim.view().cfg.coop.hostLost)) setTimeout(() => coopClosed('host-left'), 0);
      }
      syncOverlays();
      const v = sim.view();
      showTip(tips.tick(rdt));
      stepVfx(rdt, rdt * (v.slowT > 0 ? 0.3 : 1) * (vfx.slowmo > 0 ? v.cfg.fx.slowmoScale : 1));
      if (v.phase === 'play') {
        telemetry.frame(rdt);
        if (settings.effects !== 'off' && fpsWatch.feed(rdt, v.cfg.fx.lowFps, v.cfg.fx.lowFpsSecs)) $('fpsTip').hidden = false;
      }
    } else stepVfx(rdt, rdt);
  } catch (err) {
    console.error(err);
    telemetry.recordError(String((err as Error)?.message ?? err), (err as Error)?.stack ?? '');
  }
  const v = sim ? sim.view() : null;
  // music: title theme outside Runs, King and Umbra themes during their fights (Realm themes come with Realm tickets)
  playMusic(!v || v.phase === 'over' ? 'title' : v.boss?.type === 'umbra' ? 'umbra' : v.boss || v.boss2 || v.dragonE ? 'king' : null);
  renderWorld(v, v ? v.clock : rclock, !v || v.phase === 'over');
  if (v) { drawTexts(v.clock); drawHud(v, v.clock, v.runGold); }
  requestAnimationFrame(frame);
}

onResize(() => { if (sim) cmd({ type: 'viewport', w: screen.LW, h: screen.LH }); });

/* ---------- input ---------- */
let leaveArmed = false;
let guestMenu = false; // a guest's pause menu never stops the room
function pause(): void {
  if (!sim || sim.view().phase !== 'play') return;
  if (isGuest()) { if (!guestMenu) { guestMenu = true; ($('saveQuitBtn') as HTMLButtonElement).disabled = true; leaveArmed = false; showPause(); } return; }
  ($('saveQuitBtn') as HTMLButtonElement).disabled = !canSave();
  cmd({ type: 'pause' });
  leaveArmed = false;
  showPause();
}
function resume(): void {
  if (guestMenu) { guestMenu = false; hide('ovPause'); return; }
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
  if (e.code === 'KeyP' || e.code === 'Escape') { if (guestMenu) resume(); else if (playing()) pause(); else if (sim && sim.view().phase === 'pause') resume(); }
  if (e.code === 'KeyM') setMuted(!audio.muted);
  if (e.code === 'KeyI') toggleMet();
  const choosing = sim?.view().phase === 'levelup' ? 'opts' : sim?.view().phase === 'route' ? 'routeOpts' : '';
  if (choosing && /^Digit[1-3]$/.test(e.code)) {
    const bt = $(choosing).children[+e.code.slice(5) - 1] as HTMLElement | undefined;
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
$('pauseBtn').addEventListener('click', () => (guestMenu || (sim && sim.view().phase === 'pause') ? resume() : pause()));
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
$('collBtn').addEventListener('click', () => { initAudio(); void openCollection('ovTitle'); });
initCollection();
initTitle();
initLobby({ name: () => backend.account()?.nickname ?? 'Hero', pid: playerPid, onStart: (s, seed, cfg) => void startCoop(s, seed, cfg), onClosed: coopClosed });
{ const j = new URLSearchParams(location.search).get('join'); if (j) setTimeout(() => openLobby(j), 300); } // invite link
$('shopBtn2').addEventListener('click', () => { initAudio(); openShop('ovOver'); });
$('shopBack').addEventListener('click', closeShop);
$('settingsBtn1').addEventListener('click', () => { initAudio(); openSettings('ovTitle'); });
$('settingsBtn2').addEventListener('click', () => openSettings('ovPause'));
$('setBack').addEventListener('click', closeSettings);
$('startBtn').addEventListener('click', () => void newRun());
$('continueBtn').addEventListener('click', () => void continueRun());
$('saveQuitBtn').addEventListener('click', () => { hide('ovPause'); saveAndQuit(); });
$('endlessBtn').addEventListener('click', () => { hide('ovEnding'); cmd({ type: 'endless', go: true }); last = performance.now(); });
$('finishBtn').addEventListener('click', () => {
  hide('ovEnding');
  if (isGuest()) { bank('victory'); coop = null; toTitle(); return; } // a guest who stops keeps their rewards
  cmd({ type: 'endless', go: false });
});
$('reviveBtn').addEventListener('click', () => { cmd({ type: 'revive' }); last = performance.now(); });
$('giveUpBtn').addEventListener('click', () => { hide('ovRevive'); if (!coop) cmd({ type: 'giveUp' }); }); // co-op: just close it and wait for an ally
$('nextBtn').addEventListener('click', () => {
  if (coop) { // co-op: ready; the host continues when everyone is (or after the wait)
    if (coop.role === 'host') team.setReady(coop.selfId); else coop.send({ k: 'ready', on: true });
    ($('nextBtn') as HTMLButtonElement).disabled = true;
    $('clearTeam').hidden = false; $('clearTeam').textContent = t('coop.readyNext');
    return;
  }
  hide('ovClear'); cmd({ type: 'next' }); last = performance.now();
});
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
$('fpsLower').addEventListener('click', () => {
  settings.effects = settings.effects === 'all' ? 'some' : 'off';
  saveSettings();
  $('fpsTip').hidden = true;
});
$('fpsKeep').addEventListener('click', () => { $('fpsTip').hidden = true; });
$('maintBtn').addEventListener('click', () => { maintDismissed = true; hide('ovMaint'); });
$('updateBtn').addEventListener('click', () => location.reload());

/* ---------- language ---------- */
function refreshText(): void {
  applyStaticText();
  renderTitleSel();
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
installTelemetry();
$('draftBadge').hidden = !DRAFT;
requestAnimationFrame(frame);
