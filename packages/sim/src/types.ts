import type { ResolvedConfig } from '@pixel-horde/config';
import type { Streams } from './core/rng';
import type { EnemyId } from './data/enemies';
import type { HeroId } from './data/heroes';
import type { PassiveId, SkillId } from './data/skills';
import type { ShopId } from './data/shop';

/** Fixed simulation rate. */
export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

export type Phase = 'play' | 'levelup' | 'chest' | 'pause' | 'clearing' | 'clear' | 'over';

/** Player input for one tick. mx/my in [-1, 1]; magnitude <= 1. */
export interface InputFrame {
  mx: number;
  my: number;
}

export type Command =
  | { type: 'pick'; index: number } // choose a level-up / chest option
  | { type: 'chestStop' } // chest wheel animation finished
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'next' } // continue to the next stage from the clear screen
  | { type: 'ult' }
  | { type: 'viewport'; w: number; h: number }; // low-res view size changed (affects on-screen rules)

export interface Meta {
  /** Permanent shop levels. */
  up: Partial<Record<ShopId, number>>;
}

export type DebugEvent = 'dragon' | 'rival' | 'bloodmoon';

export interface SimOptions {
  seed: number;
  hero: HeroId;
  meta: Meta;
  /** Low-res viewport in world pixels (the renderer's buffer size). */
  viewport: { w: number; h: number };
  world?: 'lumora';
  /** Resolved Balance Config; defaults to the built-in one. */
  config?: ResolvedConfig;
  debug?: { event?: DebugEvent; god?: boolean };
}

export interface Pet { lv: number; cd: number; dive: number; x: number; y: number }
export interface Clone { lv: number; x: number; y: number }

export interface Player {
  ch: HeroId;
  x: number; y: number;
  hp: number; maxHp: number;
  spd: number;
  lv: number; xp: number; need: number;
  inv: number;
  face: 1 | -1;
  dx: number; dy: number;
  moving: boolean;
  anim: number;
  down: boolean;
  skills: Partial<Record<SkillId, number>>;
  pas: Partial<Record<PassiveId, number>>;
  evo: Partial<Record<SkillId, boolean>>;
  revives: number;
  cds: Partial<Record<SkillId, number>>;
  dmgMul: number; cdMul: number; cdRed: number;
  crit: number; critMul: number;
  pick: number;
  orbitA: number;
  pet: Pet | null;
  clone: Clone | null;
  shards: number;
}

export interface Enemy {
  id: number;
  type: EnemyId;
  x: number; y: number;
  hp: number; maxHp: number;
  spd: number; dmg: number; xp: number;
  r: number; sc: number;
  elite: boolean; boss: boolean;
  dmgMul: number;
  kx: number; ky: number;
  flash: number; slowT: number; frz: number; oc: number;
  wob: number; ph: number;
  dead: boolean;
  armor: number;
  born: number;
  // AI state
  cd?: number;
  cst?: 'walk' | 'tele' | 'dash';
  ct?: number; ca?: number;
  lock?: number; dashT?: number; dashA?: number; pend?: 'dash' | null;
  sk?: RivalSkill[]; rlv?: number; cds?: Partial<Record<RivalSkill, number>>; life?: number; ang?: number;
}

export type RivalSkill = 'bolt' | 'lance' | 'nova' | 'meteor' | 'zap';

export interface Bolt {
  kind: 'bolt' | 'lance' | 'boom';
  x: number; y: number; vx: number; vy: number;
  life: number; dmg: number; pierce: number;
  hit: Set<Enemy>;
  col: string; rad: number; kb: number;
  a?: number;
  spd?: number; d?: number; range?: number; ret?: boolean; spin?: number;
}

export type EffectType = 'nova' | 'meteor' | 'pbreath' | 'cyclone' | 'toxic' | 'laser' | 'hole' | 'judge' | 'chain' | 'shadowpass';

export interface Effect {
  type: EffectType;
  t: number; dur: number;
  x: number; y: number;
  dmg: number;
  R?: number; r?: number;
  hit?: Set<Enemy>; hit2?: Set<Enemy>;
  delay?: number; boomed?: boolean; bt?: number;
  a?: number; a0?: number; sp?: number; len?: number; twin?: boolean;
  vx?: number; vy?: number; tick?: number; boom?: number;
  fired?: boolean; targets?: { e: Enemy; x: number; y: number }[];
  pts?: [number, number][];
}

export type HazardKind = 'cone' | 'circ' | 'line' | 'proj' | 'ring';

export interface Hazard {
  id: number;
  k: HazardKind;
  x: number; y: number;
  t: number;
  a?: number; r?: number; sp?: number;
  te?: number; du?: number; d?: number;
  vx?: number; vy?: number;
  /** Colour/variant code. */
  c?: number;
  life?: number;
  fire?: boolean; fired?: boolean;
  done?: boolean; hitP?: boolean; tk?: number;
}

export interface Gem {
  kind: 'xp' | 'coin' | 'chest' | 'heart';
  x: number; y: number;
  v: number;
  mag: boolean;
  sp?: number;
  got?: boolean;
}

export type LevelOption =
  | { kind: 'evo'; id: SkillId }
  | { kind: 'skill'; id: SkillId }
  | { kind: 'pas'; id: PassiveId }
  | { kind: 'heal' };

export interface LevelUpView {
  options: LevelOption[];
  /** true when the choice comes from a chest reward rather than a level-up. */
  chest: boolean;
  /** Level being celebrated. */
  lv: number;
}

export interface ChestView {
  /** Free upgrades won (1–3). */
  res: number;
  /** Wheel cell the spin must stop on. */
  target: number;
  /** Wheel cell the spin starts from. */
  start: number;
}

/** Presentation events the sim emits; the game turns them into sound, particles and text. */
export type SimEvent =
  | { t: 'sfx'; k: SfxKey }
  | { t: 'text'; x: number; y: number; v: number | string; col: string; cr: boolean; hurt?: boolean; jitter?: boolean }
  | { t: 'burst'; x: number; y: number; col: string; n: number; sp: number; life: number; p?: number }
  | { t: 'shake'; v: number }
  | { t: 'flash'; v: number; col?: string; max?: boolean }
  | { t: 'banner'; key: BannerKey; dur: number; big?: boolean; args?: Record<string, string | number> }
  | { t: 'dmg'; d: number }
  | { t: 'kill'; ttk: number }
  | { t: 'stageStart'; stage: number; special: boolean }
  | { t: 'stageClear'; stage: number }
  | { t: 'gameOver' };

/** Banner texts are looked up by key in the game's text table. */
export type BannerKey =
  | 'stage' | 'bloodMoon' | 'intro.caster' | 'intro.charger' | 'intro.splitter' | 'intro.armor'
  | 'bossDown' | 'judgement' | 'swarm' | 'bossIncoming' | 'dragonOmen' | 'stageClear' | 'stageClearDragonFled'
  | 'stageClearRivalFled' | 'evolved' | 'secondWind' | 'dragonAppears' | 'dragonSummons' | 'rivalAppears'
  | 'rivalEscaped' | 'dragonTamed' | 'dragonPowerUp' | 'clonePowerUp' | 'shadowClone' | 'shadowShard';

export type SfxKey = 'hit' | 'crit' | 'boom' | 'zap' | 'nova' | 'lance' | 'laser' | 'lv' | 'hurt' | 'ult' | 'coin' | 'tick' | 'gem' | 'clear';

export interface SimState {
  tick: number;
  clock: number;
  seed: number;
  cfg: ResolvedConfig;
  phase: Phase;
  hero: HeroId;
  meta: Meta;
  viewport: { w: number; h: number };
  debug: { event?: DebugEvent; god?: boolean };

  stage: number;
  stageTime: number; stageDur: number;
  spawnAcc: number; waveT: number;
  bossSpawned: boolean;
  boss: Enemy | null;
  eid: number;
  kills: number; stageKills: number;
  /** Kill Streak (formerly `combo`): kills without a 2.2 s gap. */
  streak: number; maxStreak: number; streakT: number;
  ult: number;
  pendingLv: number; pendingChest: number; chestQueue: number;
  levelUp: LevelUpView | null;
  chest: ChestView | null;
  totalTime: number;
  clearT: number;
  slowT: number;
  hitstop: number;
  frostT: number;
  runGold: number;

  P: Player;
  enemies: Enemy[];
  bolts: Bolt[];
  gems: Gem[];
  effects: Effect[];
  hz: Hazard[];
  hzId: number;

  dir: { v: number; lastHurt: number };
  run: { spPity: number; drPity: number };
  specialStage: boolean;
  dragonStage: boolean; rivalStage: boolean;
  dragonWarned: boolean; dragonSpawned: boolean; rivalSpawned: boolean;
  dragonE: Enemy | null;
  rivalE: Enemy | null;
  seen: Set<string>;

  rng: Streams;
  events: SimEvent[];
}

