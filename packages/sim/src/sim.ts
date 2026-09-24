import { DEFAULT_RESOLVED } from '@pixel-horde/config';
import { createStreams } from './core/rng';
import { exp, hypot, ipow, log } from './core/fmath';
import { realm, prog, spawnEnemy, edgePos, spawnStep } from './systems/spawner';
import { newPlayer, recompute, U } from './systems/player';
import { afterStage, answerAwaken, banish, buyRevive, buySp, reroll, spUpgrade, swapBench, choose, chestStop, chooseRoute, gameOver, kingEscapes, openChest, openLevelUp, startStage, stageClear, stepGems } from './systems/progress';
import { stepBolts, updEffects, updSkills, useUlt } from './systems/skills';
import { stepEnemies } from './systems/enemies';
import { cloneStep, petStep, spawnDragon, spawnRival, stepHz } from './systems/events';
import { banner, shake } from './systems/fx';
import { directionOf, initKing } from './systems/kings';
import { isWeapon } from './data/weapons';
import { DT, type Command, type InputFrame, type Phase, type SimEvent, type SimOptions, type SimState } from './types';


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
    viewport: { w: opts.viewport.w, h: opts.viewport.h },
    debug: { ...opts.debug },
    stage: 1, realm: 'greenvale', visited: ['greenvale'], route: null, overtime: false, lastEnd: null, repicks: 0,
    chaptersCleared: [], kingsKilled: [], escapes: 0, escapedKings: [], combos: 0, revivesBought: 0, victory: false, victoryTime: 0, swaps: 0, walletSpent: 0, awakenOffer: false, sp: 0, banished: [], mode: opts.mode ?? 'solo', weapon: opts.weapon && isWeapon(opts.weapon) ? opts.weapon : 'judgement', foundWeapons: [], ultBudget: 0, bloodMoonShown: false,
    stageTime: 0, stageDur: cfg.stage.durBase, spawnAcc: 0, waveT: cfg.spawn.swarmFirst, bossSpawned: false, boss: null, eid: 1,
    kills: 0, stageKills: 0, streak: 0, maxStreak: 0, streakT: 0, ult: 0,
    pendingLv: 0, pendingChest: 0, chestQueue: 0, levelUp: null, chest: null,
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
  startStage(s, 1);

  const rec: Replay = { v: 1, opts: JSON.parse(JSON.stringify(opts)), ticks: 0, inputs: [], commands: [], hashes: [] };
  let lastMx = NaN, lastMy = NaN;

  function apply(c: Command): void {
    switch (c.type) {
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
      case 'awaken': answerAwaken(s, c.accept); break;
      case 'weapon': if (s.phase === 'clear' && s.foundWeapons.includes(c.id)) s.weapon = c.id; break;
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

  function update(input: InputFrame): void {
    const phase: Phase = s.phase;
    const live = phase === 'play';
    if (!live && phase !== 'clearing') return;
    if (s.hitstop > 0) { s.hitstop -= DT; return; }
    let dt = DT;
    if (s.slowT > 0) { s.slowT -= DT; dt *= 0.3; }

    // player movement
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

    if (live) {
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
      if (s.dragonStage && !s.dragonSpawned && prog(s) >= s.cfg.events.dragonAt) { s.dragonSpawned = true; spawnDragon(s); }
      if (!s.bossSpawned && prog(s) >= s.cfg.stage.bossAt) {
        s.bossSpawned = true;
        const [x, y] = edgePos(s);
        const b = spawnEnemy(s, realm(s).king, x, y, false);
        b.hp *= ipow(s.cfg.stage.bossHpGrowth, s.stage - 1);
        if (b.type === 'umbra') b.hp *= 1 + s.cfg.stage.umbraEscapeHp * s.escapes;
        b.maxHp = b.hp;
        s.boss = b;
        initKing(s, b);
        banner(s, 'bossIncoming', 2, false, { dir: directionOf(s, x, y) });
        shake(s, 5);
      }
    }
    if (live && !P.down) updSkills(s, dt);
    stepBolts(s, dt);
    updEffects(s, dt);
    const damp = exp(dt * knockbackLog(s.cfg));
    stepEnemies(s, dt, damp, live);
    if (s.phase === 'over') return;
    if (live) stepHz(s, dt);
    if (live) { petStep(s, dt); cloneStep(s, dt); }
    if (s.streakT > 0) { s.streakT -= dt; if (s.streakT <= 0) s.streak = 0; }
    stepGems(s, dt);

    if (s.phase === 'play') {
      // rewards first (a King killed in overtime still pays out its chest before the clear)
      if (s.chestQueue > 0) { s.chestQueue--; openChest(s); return; }
      if (s.pendingLv > 0 || s.pendingChest > 0) { openLevelUp(s); return; }
      // King must die: the Stage clears at the timer only if the King is dead; otherwise overtime,
      // and a King that survives overtime escapes (Umbra never does).
      if (s.stageTime >= s.stageDur) {
        const kingDead = s.bossSpawned && (!s.boss || s.boss.dead);
        if (kingDead) { stageClear(s); return; }
        if (!s.overtime) {
          s.overtime = true;
          if (s.boss) { s.boss.spd *= s.cfg.stage.enrageSpd; s.boss.dmg *= s.cfg.stage.enrageDmg; }
          banner(s, 'overtime', 2, true);
          shake(s, 4);
        } else if (s.stageTime >= s.stageDur + s.cfg.stage.overtime && s.boss && s.boss.type !== 'umbra') {
          kingEscapes(s);
          return;
        }
      }
    } else if (s.phase === 'clearing') {
      s.clearT -= DT;
      if (s.clearT <= 0) {
        if (s.victory && s.lastEnd === 'clear' && s.stage >= s.cfg.stage.chapters) { s.events.push({ t: 'victory' }); gameOver(s); }
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
      for (const c of commands) { rec.commands.push([i, { ...c }]); apply(c); }
      s.tick++;
      s.clock += DT;
      update({ mx, my });
      if (s.tick % HASH_EVERY === 0) rec.hashes.push(hashState(s));
      return s.events;
    },
    replay: () => JSON.parse(JSON.stringify(rec)) as Replay,
    view: () => s,
    score: () => scoreOf(s),
    hash: () => hashState(s),
  };
}

export interface ScoreLine { key: 'chapters' | 'kings' | 'kills' | 'combos' | 'victory' | 'fast' | 'escapes' | 'revive'; count: number; points: number }

/**
 * Arcade Score (decision #15): progress dominates, kills and Combos separate equal progress.
 * Chapters +1,000×Ch · Kings +500×Ch · monsters +1 · Combos +5 · Umbra +20,000 ·
 * fast finish +(1,500 − s)×10 · Escapes −3,000 each · a bought revive −15%.
 */
export function scoreBreakdown(s: Readonly<SimState>): { lines: ScoreLine[]; total: number } {
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

/** The one score computation. */
export function scoreOf(s: Readonly<SimState>): number {
  return scoreBreakdown(s).total;
}

const PHASES: Phase[] = ['play', 'levelup', 'chest', 'pause', 'clearing', 'clear', 'over', 'route', 'revive'];

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
