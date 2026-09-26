import { DEFAULT_RESOLVED } from '@pixel-horde/config';
import { createRng, createStreams, hashString } from './core/rng';
import { exp, hypot, ipow, log } from './core/fmath';
import { realm, prog, spawnEnemy, edgePos, spawnStep } from './systems/spawner';
import { newPlayer, recompute, U } from './systems/player';
import { afterStage, answerAwaken, chooseEndless, banish, buyRevive, buySp, reroll, spUpgrade, swapBench, discardBench, choose, chestStop, chooseRoute, gameOver, kingEscapes, openChest, openLevelUp, startStage, stageClear, stageEndRewards, stepGems, levelCheck } from './systems/progress';
import { stepBolts, updEffects, updSkills, useUlt } from './systems/skills';
import { stepEnemies } from './systems/enemies';
import { cloneStep, spawnRival, stepHz } from './systems/events';
import { answerFuse, levelCompanion, petStep, spawnGuardian, swapCompanion } from './systems/guardians';
import { banner, shake } from './systems/fx';
import { directionOf, initKing } from './systems/kings';
import { REALMS } from './content/lumora/realms';
import { isWeapon } from './data/weapons';
import { usableWeapons } from './systems/combat';
import { DT, type Command, type InputFrame, type Phase, type SimEvent, type ScoreLine, type SimOptions, type SimState } from './types';
import type { RunFacts } from './data/achievements';
import { applyRemoteHits, applySnap, attacksPaused, chooseStep, choosing, coopGems, guestEnemies, hostStep, initCoop, setMates, smoothMates } from './systems/coop';


export interface Sim {
  /** Advance one fixed tick (1/60 s). Commands apply before the tick. Returns this tick's events. */
  step(input: InputFrame, commands?: readonly Command[]): SimEvent[];
  /** Read-only view of the whole state for rendering. Do not mutate. */
  view(): Readonly<SimState>;
  /** Arcade score of the current state. */
  score(): number;
  /** 32-bit hash of the gameplay state (determinism checks). */
  hash(): number;
  /** Everything needed to reproduce this Run exactly (the recorder is always on). */
  replay(): Replay;
  /** State at the start of the current Stage (taken automatically), for suspend/resume. */
  checkpoint(): Checkpoint;
}

/** A Stage-start snapshot. `hash` identifies it on the server (single use). */
export interface Checkpoint { chapter: number; configVersion: number; hash: string; data: string }

const SKIP = new Set(['cfg', 'events', 'rng', 'seen', 'pending', 'levelUp', 'chest', 'mobile', 'coop', 'pickReturn']); // mobile: the resuming device decides

/** Serialize the state at a Stage start (no live monsters, effects or menus). */
function snapshotOf(s: SimState): Checkpoint {
  const state: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) if (!SKIP.has(k)) state[k] = v;
  const rng = Object.fromEntries(Object.entries(s.rng).map(([k, r]) => [k, r.state().map((x) => x >>> 0)]));
  const data = JSON.stringify({ v: 1, state, rng, seen: [...s.seen] });
  const h = (hashString(data) >>> 0).toString(16).padStart(8, '0') + (hashString(data, 0x9747b28c) >>> 0).toString(16).padStart(8, '0');
  return { chapter: s.stage, configVersion: s.cfg.version, hash: h, data };
}

function restoreInto(s: SimState, data: string): void {
  const d = JSON.parse(data) as { v: number; state: Partial<SimState>; rng: Record<string, [number, number, number, number]>; seen: string[] };
  Object.assign(s, d.state);
  s.seen = new Set(d.seen);
  for (const k of Object.keys(s.rng) as (keyof SimState['rng'])[]) {
    const st = d.rng[k];
    if (st) s.rng[k] = createRng(st[0], st[1], st[2], st[3]);
  }
  s.events = [];
  s.levelUp = null; s.chest = null; s.pending = {};
}

/** A recorded Run: options + input changes + commands, plus the hash every 60 ticks. */
export interface Replay {
  v: 1;
  opts: SimOptions;
  ticks: number;
  /** [stepIndex, mx, my] recorded only when the input changes. */
  inputs: [number, number, number][];
  /** [stepIndex, command] */
  commands: [number, Command][];
  /** hash() after every 60th tick. */
  hashes: number[];
}

export const HASH_EVERY = 60;

const NO_COMMANDS: readonly Command[] = [];

const lnCache = new WeakMap<object, number>();
/** ln(kbDecay), cached per config object. */
function knockbackLog(cfg: SimState['cfg']): number {
  let v = lnCache.get(cfg);
  if (v === undefined) { v = log(cfg.player.kbDecay); lnCache.set(cfg, v); }
  return v;
}

export function createSim(opts: SimOptions): Sim {
  const cfg = opts.config ?? DEFAULT_RESOLVED;
  const P = newPlayer(cfg, opts.hero);
  const s: SimState = {
    tick: 0, clock: 0, seed: opts.seed >>> 0, cfg, configVersions: [cfg.version], eventSwitches: { bloodMoon: true, dragon: true, rival: true, ...opts.events }, pending: {},
    phase: 'play', hero: opts.hero,
    meta: { up: { ...opts.meta.up }, wallet: Math.max(0, opts.meta.wallet || 0), weapons: [...(opts.meta.weapons || [])] },
    viewport: { w: opts.viewport.w, h: opts.viewport.h }, mobile: !!opts.mobile, firstRun: !!opts.firstRun, coop: opts.coop ? initCoop(opts.coop.role, opts.coop.self) : null,
    debug: { ...opts.debug },
    stage: 1, realm: 'greenvale', visited: ['greenvale'], route: null, overtime: false, lastEnd: null, repicks: 0,
    chaptersCleared: [], kingsKilled: [], escapes: 0, escapedKings: [], combos: 0, revivesBought: 0, victory: false, victoryTime: 0, dragonKind: 'inferno', fuseOffer: false, boss2: null, doubleKing: false, skipped: null, swaps: 0, walletSpent: 0, awakenOffer: false, comboCounts: {}, killsByType: {}, doubleKingsBeaten: 0, sp: 0, banished: [], mode: opts.mode ?? 'solo', crack: Math.max(0, Math.min(3, Math.floor(opts.crack || 0))), endless: false, main: null, endlessFrom: null, reviveEndless: false, darkness: false, weapon: opts.weapon && isWeapon(opts.weapon) ? opts.weapon : 'judgement', foundWeapons: [], ultBudget: 0, bloodMoonShown: false,
    stageTime: 0, stageDur: cfg.stage.durBase, spawnAcc: 0, waveT: cfg.spawn.swarmFirst, front: { a: 0, t: 0 }, bossSpawned: false, boss: null, eid: 1,
    kills: 0, stageKills: 0, streak: 0, maxStreak: 0, streakT: 0, ult: 0,
    pendingLv: 0, pendingChest: 0, chestQueue: 0, pickReturn: null, levelUp: null, chest: null,
    totalTime: 0, clearT: 0, slowT: 0, hitstop: 0, frostT: 0, runGold: 0,
    P, enemies: [], bolts: [], gems: [], effects: [], hz: [], hzId: 1,
    dir: { v: cfg.director.start, lastHurt: 0 }, run: { spPity: 0, drPity: 0 },
    specialStage: false, dragonStage: false, rivalStage: false, dragonWarned: false, dragonSpawned: false, rivalSpawned: false,
    dragonE: null, rivalE: null, seen: new Set(),
    rng: createStreams(opts.seed >>> 0),
    events: [],
  };
  recompute(s);
  P.hp = P.maxHp;
  P.revives = U(s, 'revive');
  if (opts.resume) restoreInto(s, opts.resume);
  else {
    if (s.debug.realm && REALMS[s.debug.realm]) { s.realm = s.debug.realm; s.visited = [s.realm]; }
    startStage(s, 1);
  }
  let cp = snapshotOf(s);

  const rec: Replay = { v: 1, opts: JSON.parse(JSON.stringify(opts)), ticks: 0, inputs: [], commands: [], hashes: [] };
  let lastMx = NaN, lastMy = NaN;

  function apply(c: Command): void {
    // guests follow the host's Stage flow; these become votes/ready messages in the client
    if (s.coop?.role === 'guest' && (c.type === 'next' || c.type === 'route' || c.type === 'endless' || c.type === 'pause' || c.type === 'resume')) return;
    switch (c.type) {
      case 'mates': setMates(s, c.mates); break;
      case 'remoteHits': applyRemoteHits(s, c.hits, c.from, c.q); break;
      case 'snap': applySnap(s, c.snap); break;
      case 'pick': choose(s, c.index); break;
      case 'chestStop': chestStop(s); break;
      case 'pause': if (s.phase === 'play') s.phase = 'pause'; break;
      case 'resume': if (s.phase === 'pause') s.phase = 'play'; break;
      case 'next':
        if (s.phase === 'clear') {
          s.P.hp = Math.min(s.P.maxHp, s.P.hp + s.P.maxHp * s.cfg.stage.clearHeal);
          afterStage(s);
        }
        break;
      case 'route': chooseRoute(s, c.index); break;
      case 'swap': swapBench(s, c.bench, c.slot); break;
      case 'discard': discardBench(s, c.bench); break;
      case 'awaken': answerAwaken(s, c.accept); break;
      case 'weapon': if (s.phase === 'clear' && usableWeapons(s).includes(c.id)) s.weapon = c.id; break;
      case 'endless': chooseEndless(s, c.go); break;
      case 'companion': swapCompanion(s, c.index); break;
      case 'fuse': answerFuse(s, c.accept); break;
      case 'spCompanion': if ((s.phase === 'clear' || s.phase === 'levelup') && s.P.pet && s.P.pet.lv < s.cfg.companion.maxLv && s.sp >= s.cfg.companion.spCost) { s.sp -= s.cfg.companion.spCost; levelCompanion(s); } break;
      case 'reroll': reroll(s); break;
      case 'banish': banish(s, c.index); break;
      case 'spUpgrade': spUpgrade(s, c.id); break;
      case 'buySp': buySp(s); break;
      case 'revive': buyRevive(s); break;
      case 'giveUp': if (s.phase === 'revive') gameOver(s); break;
      case 'ult': useUlt(s); break;
      case 'viewport':
        if (c.w > 0 && c.h > 0) { s.viewport.w = c.w; s.viewport.h = c.h; }
        break;
      case 'setConfig': s.pending.cfg = c.config; break;
      case 'setEvents': s.pending.events = { ...c.events }; break;
    }
  }

  /** Player movement (shared by every role). */
  function move(input: InputFrame, dt: number): void {
    let mx = input.mx || 0, my = input.my || 0;
    const ml = hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    if (s.phase !== 'play' || P.down) { mx = 0; my = 0; }
    P.moving = hypot(mx, my) > 0.05;
    // Ice floor keeps momentum; a chill slows (King moves).
    const spd = P.chill > 0 ? P.spd * s.cfg.kings.throne.chillSpd : P.spd;
    const slipping = P.slip > 0;
    if (slipping) {
      const k = Math.min(1, dt * P.slipGrip);
      P.vx += (mx * spd - P.vx) * k;
      P.vy += (my * spd - P.vy) * k;
      P.x += P.vx * dt;
      P.y += P.vy * dt;
      P.slip -= dt;
    } else { P.vx = mx * spd; P.vy = my * spd; }
    if (P.chill > 0) P.chill -= dt;
    if (P.moving) {
      if (!slipping) { P.x += mx * spd * dt; P.y += my * spd * dt; }
      P.anim += dt;
      if (Math.abs(mx) > 0.1) P.face = mx < 0 ? -1 : 1;
      P.dx = mx;
      P.dy = my;
    }
    P.inv -= dt;
    if (P.guardT > 0) { P.guardT -= dt; if (P.guardT <= 0) P.guard = 0; }
  }

  /** Co-op guest: own Hero and Skills against the host's mirrored world. */
  function guestUpdate(input: InputFrame): void {
    smoothMates(s, DT);
    // Stage-end menus, or the room is paused; a level-up / chest does not stop the world (shield bubble)
    if ((s.phase !== 'play' && !choosing(s)) || s.coop!.hostPhase !== 'play') return;
    const live = s.phase === 'play';
    if (s.hitstop > 0) { s.hitstop -= DT; return; }
    let dt = DT;
    if (s.slowT > 0) { s.slowT -= DT; dt *= 0.3; }
    move(input, dt);
    s.stageTime = Math.min(s.stageDur, s.stageTime + dt);
    s.totalTime += dt;
    const U = s.cfg.ult, rate = U.max / U.fill;
    s.ult = Math.min(U.max, s.ult + rate * dt);
    const armed = !P.down && !attacksPaused(s);
    if (armed) updSkills(s, dt);
    stepBolts(s, dt);
    updEffects(s, dt);
    guestEnemies(s, dt, live);
    if (s.phase !== 'play' && !choosing(s)) return;
    chooseStep(s, dt);
    stepHz(s, dt);
    if (armed) petStep(s, dt);
    cloneStep(s, dt);
    if (s.streakT > 0) { s.streakT -= dt; if (s.streakT <= 0) s.streak = 0; }
    levelCheck(s);
    if (s.phase !== 'play') return;
    if (s.chestQueue > 0) { s.chestQueue--; openChest(s); return; }
    if (s.pendingLv > 0 || s.pendingChest > 0) openLevelUp(s);
  }

  function update(input: InputFrame): void {
    if (s.coop?.role === 'guest') { guestUpdate(input); return; }
    if (s.coop) smoothMates(s, DT);
    const phase: Phase = s.phase;
    const live = phase === 'play';
    // co-op: the host picking a level-up or spinning a chest does not stop the room's world
    const world = live || choosing(s);
    if (!world && phase !== 'clearing') return;
    if (s.hitstop > 0) { s.hitstop -= DT; return; }
    let dt = DT;
    if (s.slowT > 0) { s.slowT -= DT; dt *= 0.3; }

    move(input, dt);

    if (world) {
      s.stageTime += dt;
      s.totalTime += dt;
      // the Ultimate fills over time; kills may add at most killCap × this rate
      const U = s.cfg.ult, rate = U.max / U.fill;
      s.ult = Math.min(U.max, s.ult + rate * dt);
      s.ultBudget = Math.min(rate * U.killCap * 2, s.ultBudget + rate * U.killCap * dt);
      spawnStep(s, dt);
      if (s.rivalStage && !s.rivalSpawned && prog(s) >= s.cfg.events.rivalAt) { s.rivalSpawned = true; spawnRival(s); }
      if (s.dragonStage && !s.dragonWarned && prog(s) >= s.cfg.events.dragonWarnAt) {
        s.dragonWarned = true;
        banner(s, 'dragonOmen', 2.2);
        s.effects.push({ type: 'shadowpass', t: 0, dur: 1.6, x: 0, y: 0, dmg: 0 });
        shake(s, 3);
      }
      if (s.specialStage && !s.bloodMoonShown && prog(s) >= s.cfg.stage.bloodMoonRevealAt) { s.bloodMoonShown = true; banner(s, 'bloodMoon', 3, true); }
      if (s.dragonStage && !s.dragonSpawned && prog(s) >= s.cfg.events.dragonAt) { s.dragonSpawned = true; spawnGuardian(s); }
      if (!s.bossSpawned && prog(s) >= s.cfg.stage.bossAt) {
        s.bossSpawned = true;
        const [x, y] = edgePos(s);
        const b = spawnEnemy(s, realm(s).king, x, y, false);
        b.hp *= ipow(s.cfg.stage.bossHpGrowth, s.stage - 1);
        if (b.type === 'umbra') b.hp *= 1 + s.cfg.stage.umbraEscapeHp * s.escapes;
        if (s.firstRun && s.stage === 1) b.hp *= s.cfg.tutorial.kingHp;
        b.maxHp = b.hp;
        s.boss = b;
        initKing(s, b);
        s.events.push({ t: 'kingIntro', realm: s.realm, x: b.x, y: b.y });
        if (s.doubleKing && s.skipped) {
          // the King of the Realm not taken joins; both at reduced HP, both pay out
          const [x2, y2] = edgePos(s);
          const b2 = spawnEnemy(s, REALMS[s.skipped].king, x2, y2, false);
          b2.hp = b.maxHp * s.cfg.events.doubleKingHp; b2.maxHp = b2.hp;
          b.hp = b.maxHp = b.maxHp * s.cfg.events.doubleKingHp;
          s.boss2 = b2;
          initKing(s, b2);
          s.events.push({ t: 'kingIntro', realm: s.skipped, x: b2.x, y: b2.y });
        }
        banner(s, 'bossIncoming', 2, false, { dir: directionOf(s, x, y) });
        shake(s, 5);
      }
    }
    const armed = world && !P.down && !attacksPaused(s); // co-op: no attacks while choosing (coop.choosingSkills 0)
    if (armed) updSkills(s, dt);
    stepBolts(s, dt);
    updEffects(s, dt);
    const damp = exp(dt * knockbackLog(s.cfg));
    stepEnemies(s, dt, damp, live);
    if (s.phase === 'over') return;
    if (world) stepHz(s, dt);
    if (armed) petStep(s, dt);
    if (world) cloneStep(s, dt);
    if (world && s.coop) { chooseStep(s, dt); hostStep(s, dt); if ((s.phase as Phase) === 'over') return; }
    if (s.streakT > 0) { s.streakT -= dt; if (s.streakT <= 0) s.streak = 0; }
    if (s.coop) coopGems(s, dt); else stepGems(s, dt);

    if (s.phase === 'play') {
      // rewards first (a King killed in overtime still pays out its chest before the clear)
      if (s.chestQueue > 0) { s.chestQueue--; openChest(s); return; }
      if (s.pendingLv > 0 || s.pendingChest > 0) { openLevelUp(s); return; }
      // King must die: the Stage clears at the timer only if the King is dead; otherwise overtime,
      // and a King that survives overtime escapes (Umbra never does).
      if (s.stageTime >= s.stageDur) {
        const kingDead = s.bossSpawned && (!s.boss || s.boss.dead) && (!s.boss2 || s.boss2.dead);
        if (kingDead) { stageClear(s); return; }
        if (!s.overtime) {
          s.overtime = true;
          for (const k of [s.boss, s.boss2]) if (k) { k.spd *= s.cfg.stage.enrageSpd; k.dmg *= s.cfg.stage.enrageDmg; }
          banner(s, 'overtime', 2, true);
          shake(s, 4);
        } else if (s.stageTime >= s.stageDur + s.cfg.stage.overtime && (s.boss || s.boss2) && s.boss?.type !== 'umbra') {
          kingEscapes(s);
          return;
        }
      }
    } else if (s.phase === 'clearing') {
      s.clearT -= DT;
      // let the end-of-Stage vacuum finish (a King's chest may still be flying in), then open every
      // reward still waiting — chests, level-ups, the Blood Moon chest — before the Stage-end screen
      if (s.clearT <= 0 && (s.gems.length === 0 || s.clearT < -s.cfg.stage.clearDelay * 2)) {
        if (stageEndRewards(s, 'clearing')) return;
        if (s.victory && !s.endless && s.lastEnd === 'clear' && s.stage >= s.cfg.stage.chapters) {
          // the main Score is final now; the player may continue in Endless
          s.main = scoreBreakdown(s);
          s.events.push({ t: 'victory' });
          s.phase = 'victory';
        }
        else s.phase = 'clear';
      }
    }
  }

  return {
    step(input, commands = NO_COMMANDS) {
      const i = rec.ticks++;
      const mx = input.mx || 0, my = input.my || 0;
      if (mx !== lastMx || my !== lastMy) { rec.inputs.push([i, mx, my]); lastMx = mx; lastMy = my; }
      s.events = [];
      for (const c of commands) { if (c.type !== 'snap') rec.commands.push([i, { ...c }]); apply(c); } // snapshots are too big to record
      if (s.events.some((e) => e.t === 'stageStart')) cp = snapshotOf(s); // auto-save point
      s.tick++;
      s.clock += DT;
      update({ mx, my });
      if (s.tick % HASH_EVERY === 0) rec.hashes.push(hashState(s));
      return s.events;
    },
    replay: () => JSON.parse(JSON.stringify(rec)) as Replay,
    checkpoint: () => cp,
    view: () => s,
    score: () => scoreOf(s),
    hash: () => hashState(s),
  };
}


/**
 * Arcade Score (decision #15): progress dominates, kills and Combos separate equal progress.
 * Chapters +1,000×Ch · Kings +500×Ch · monsters +1 · Combos +5 · Umbra +20,000 ·
 * fast finish +(1,500 − s)×10 · Escapes −3,000 each · a bought revive −15%.
 */
export function scoreBreakdown(s: Readonly<SimState>): { lines: ScoreLine[]; total: number } {
  if (s.main) return s.main;
  const C = s.cfg.score;
  const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
  const lines: ScoreLine[] = [
    { key: 'chapters', count: s.chaptersCleared.length, points: C.chapter * sum(s.chaptersCleared) },
    { key: 'kings', count: s.kingsKilled.length, points: C.king * sum(s.kingsKilled) },
    { key: 'kills', count: s.kills, points: C.kill * s.kills },
    { key: 'combos', count: s.combos, points: C.combo * s.combos },
  ];
  if (s.victory) {
    lines.push({ key: 'victory', count: 1, points: C.victory });
    lines.push({ key: 'fast', count: Math.round(s.victoryTime), points: Math.max(0, Math.round((C.fastBase - s.victoryTime) * C.fastMul)) });
  }
  if (s.escapes) lines.push({ key: 'escapes', count: s.escapes, points: -C.escape * s.escapes });
  let total = Math.max(0, sum(lines.map((l) => l.points)));
  if (s.revivesBought > 0) {
    const cut = Math.round(total * C.revivePenalty);
    lines.push({ key: 'revive', count: s.revivesBought, points: -cut });
    total -= cut;
  }
  return { lines, total };
}

/** Endless Score (its own board): Chapters and Kings beyond the last, kills and Combos since Umbra. */
export function endlessBreakdown(s: Readonly<SimState>): { lines: ScoreLine[]; total: number } {
  const C = s.cfg.score, from = s.endlessFrom, last = s.cfg.stage.chapters;
  if (!from) return { lines: [], total: 0 };
  const sum = (a: number[]): number => a.reduce((x, y) => x + y, 0);
  const ch = s.chaptersCleared.filter((c) => c > last), kg = s.kingsKilled.filter((c) => c > last);
  const lines: ScoreLine[] = [
    { key: 'chapters', count: ch.length, points: C.chapter * sum(ch) },
    { key: 'kings', count: kg.length, points: C.king * sum(kg) },
    { key: 'kills', count: s.kills - from.kills, points: C.kill * (s.kills - from.kills) },
    { key: 'combos', count: s.combos - from.combos, points: C.combo * (s.combos - from.combos) },
  ];
  const esc = s.escapes - from.escapes;
  if (esc) lines.push({ key: 'escapes', count: esc, points: -C.escape * esc });
  let total = Math.max(0, sum(lines.map((l) => l.points)));
  if (s.reviveEndless) { const cut = Math.round(total * C.revivePenalty); lines.push({ key: 'revive', count: 1, points: -cut }); total -= cut; }
  return { lines, total };
}

/** Facts about the Run for achievements and the bestiary (sent in the Run summary). */
export function runFacts(s: Readonly<SimState>): RunFacts {
  const pets = [s.P.pet, ...s.P.petStore].filter(Boolean) as { kind: string; lv: number }[];
  return {
    hero: s.hero, victory: s.victory, chapter: s.stage, escapes: s.escapes, kingsKilled: s.kingsKilled.length, kills: s.kills,
    maxStreak: s.maxStreak, time: Math.round(s.totalTime), victoryTime: Math.round(s.victoryTime), revivesBought: s.revivesBought,
    awakened: s.P.awakened, crack: s.crack, endlessChapter: s.endless ? s.stage : 0, combos: { ...s.comboCounts },
    guardians: [...s.P.guardiansBeaten], fused: pets.some((p) => p.kind === 'tri'), companionMax: Math.max(0, ...pets.map((p) => p.lv)),
    doubleKings: s.doubleKingsBeaten, killsByType: { ...s.killsByType },
  };
}

/** The one score computation. */
export function scoreOf(s: Readonly<SimState>): number {
  return scoreBreakdown(s).total;
}

const PHASES: Phase[] = ['play', 'levelup', 'chest', 'pause', 'clearing', 'clear', 'over', 'route', 'revive', 'victory'];

/** FNV-1a over the bytes of the gameplay-relevant numbers. */
export function hashState(s: Readonly<SimState>): number {
  const buf = new DataView(new ArrayBuffer(8));
  let h = 0x811c9dc5;
  const num = (v: number): void => {
    buf.setFloat64(0, v);
    for (let i = 0; i < 8; i++) { h ^= buf.getUint8(i); h = Math.imul(h, 0x01000193); }
  };
  num(s.tick); num(PHASES.indexOf(s.phase)); num(s.stage); num(s.stageTime); num(s.kills); num(s.runGold); num(s.ult);
  num(s.dir.v); num(s.P.x); num(s.P.y); num(s.P.hp); num(s.P.xp); num(s.P.lv);
  num(s.enemies.length);
  for (const e of s.enemies) { num(e.id); num(e.x); num(e.y); num(e.hp); }
  num(s.gems.length); num(s.bolts.length); num(s.effects.length); num(s.hz.length);
  for (const k of Object.keys(s.rng) as (keyof typeof s.rng)[]) for (const v of s.rng[k].state()) num(v);
  return h >>> 0;
}

/** Re-run a recorded Run headlessly; returns the fresh sim (compare its replay().hashes). */
export function runReplay(r: Replay): Sim {
  const sim = createSim(r.opts);
  let ii = 0, ci = 0, mx = 0, my = 0;
  for (let i = 0; i < r.ticks; i++) {
    while (ii < r.inputs.length && r.inputs[ii][0] === i) { mx = r.inputs[ii][1]; my = r.inputs[ii][2]; ii++; }
    const cmds: Command[] = [];
    while (ci < r.commands.length && r.commands[ci][0] === i) cmds.push(r.commands[ci++][1]);
    sim.step({ mx, my }, cmds);
  }
  return sim;
}
