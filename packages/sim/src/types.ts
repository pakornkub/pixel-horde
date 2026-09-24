import type { ResolvedConfig } from '@pixel-horde/config';
import type { Streams } from './core/rng';
import type { RealmId } from './content/lumora/realms';
import type { EnemyId } from './data/enemies';
import type { ComboId, HitTag } from './data/skills';
import type { HeroId } from './data/heroes';
import type { PassiveId, SkillId } from './data/skills';
import type { ShopId } from './data/shop';
import type { WeaponId } from './data/weapons';

export interface ScoreLine { key: 'chapters' | 'kings' | 'kills' | 'combos' | 'victory' | 'fast' | 'escapes' | 'revive'; count: number; points: number }

/** Fixed simulation rate. */
export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

/** 'revive' = down, offered the bought revive (the sim waits). */
export type Phase = 'play' | 'levelup' | 'chest' | 'pause' | 'clearing' | 'clear' | 'route' | 'revive' | 'victory' | 'over';

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
  | { type: 'next' } // continue from the clear screen (to the route choice or the next Chapter)
  | { type: 'route'; index: number } // pick one of the offered Realms
  | { type: 'weapon'; id: WeaponId } // clear screen: switch to a Weapon found this Run
  | { type: 'endless'; go: boolean } // after Umbra: continue in Endless or finish the Run
  | { type: 'companion'; index: number } // clear screen: make a stored Companion the active one
  | { type: 'fuse'; accept: boolean } // clear screen: fuse the three Guardians
  | { type: 'spCompanion' } // +1 Companion level for Skill Points
  | { type: 'reroll' } // level-up: new offers for Skill Points
  | { type: 'banish'; index: number } // level-up: remove that offer's Skill/passive from this Run
  | { type: 'spUpgrade'; id: SkillId } // level-up / clear screen: +1 level for Skill Points
  | { type: 'buySp' } // clear screen: Gold → 1 Skill Point
  | { type: 'revive' } // down: buy the revive
  | { type: 'giveUp' } // down: end the Run
  | { type: 'awaken'; accept: boolean } // clear screen: answer the Awakening prompt
  | { type: 'swap'; bench: number; slot: SkillId | null } // clear screen: Bench skill ↔ attack slot (null = empty slot)
  | { type: 'ult' }
  | { type: 'viewport'; w: number; h: number } // low-res view size changed (affects on-screen rules)
  | { type: 'setConfig'; config: ResolvedConfig } // new Balance Config: applies at the next Stage start
  | { type: 'setEvents'; events: EventSwitches }; // feature flags for events: apply at the next Stage start

/** Server feature flags that switch special events off. */
export interface EventSwitches { bloodMoon: boolean; dragon: boolean; rival: boolean }

export interface Meta {
  /** Permanent shop levels. */
  up: Partial<Record<ShopId, number>>;
  /** Wallet Gold at Run start (Stage-end costs draw on it after this Run's Gold). */
  wallet?: number;
  /** Owned Weapons ("lumora:thornwhip"); Kings only drop ones not owned. */
  weapons?: string[];
}

export type DebugEvent = 'dragon' | 'frostdragon' | 'stormdragon' | 'rival' | 'bloodmoon';

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
  /** Event feature flags at Run start (default: all on). */
  events?: EventSwitches;
  /** Run mode; the daily challenge disables the bought revive. */
  mode?: 'solo' | 'daily' | 'endless';
  /** Weapon picked for this Run (default Judgement). */
  weapon?: WeaponId;
  /** Heart Crack difficulty tier 0–3 (unlocked by beating Umbra). */
  crack?: number;
}

export type GuardianKind = 'inferno' | 'frost' | 'storm';
export type CompanionKind = GuardianKind | 'tri';
/** A Companion (tamed Guardian). `cd` main move, `dive` second move timers. */
export interface Pet { kind: CompanionKind; lv: number; cd: number; dive: number; x: number; y: number }
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
  /** Active Companion; up to `companion.stored` more wait in `petStore` (swap at Stage end). */
  pet: Pet | null;
  petStore: Pet[];
  /** Guardians defeated this Run (all three → fusion offer). */
  guardiansBeaten: GuardianKind[];
  clone: Clone | null;
  /** Awakening: done / declined for this Run; Links maxed at Stage start; full Stages each Link spent maxed. */
  awakened: boolean;
  awakenDeclined: boolean;
  linkStart: SkillId[];
  linkStages: Partial<Record<SkillId, number>>;
  /** Statuses this player leaves last × this (Vex). */
  statusMul: number;
  /** Holy Shield rotation. */
  shieldA: number;
  /** Benched skills keep their level and Evolution but do not fire and are not offered upgrades. */
  bench: BenchSkill[];
  /** Slippery floor: movement keeps momentum while > 0. */
  slip: number; slipGrip: number;
  vx: number; vy: number;
  /** Chilled: slower while > 0. */
  chill: number;
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
  /** King fight state (Kings and Umbra). */
  kg?: KingState;
  /** Burrowed/airborne: cannot be hit, deals no contact damage. */
  hide?: boolean;
  // Statuses (seconds left); frz is Frozen.
  burn?: number; shock?: number; pois?: number; gath?: number;
  /** Frost Aura stacks toward Frozen. */
  chill?: number;
  /** Poison damage per second (Toxic Burst). */
  poisDps?: number;
  /** Stunned (Twin Hawks): cannot move; bosses are slowed instead. */
  stun?: number;
  /** Holy Shield hit cooldown. */
  shc?: number;
  /** Superconduct: armour ignored while > 0. */
  armorOff?: number;
  /** Combo → clock time when it may hit this monster again. */
  ccd?: Partial<Record<ComboId, number>>;
}

export interface BenchSkill { id: SkillId; lv: number; evo: boolean }

export type KingMove = 'shadowBolts' | 'shadowMeteors' | 'slam' | 'split' | 'splash' | 'sandLine' | 'burrow' | 'quicksand' | 'boneFan' | 'raise' | 'crypt' | 'iceSpears' | 'iceFloor' | 'throne';

export interface KingState {
  phase: 1 | 2 | 3;
  cd: number;
  ultCd: number;
  /** Standing still while a move plays out. */
  lock: number;
  /** Relocate here when lock ends (leap / burrow). */
  land: [number, number] | null;
  /** Deferred second part of a move. */
  next: { k: KingMove; t: number } | null;
}

/** Dialogue beats (lines live in i18n: king.<enemy>.<beat>). */
export type SayBeat = 'arrive' | 'half' | 'heart' | 'defeat' | 'escape' | 'absorb';

export type RivalSkill = 'bolt' | 'lance' | 'nova' | 'meteor' | 'zap';

export interface Bolt {
  kind: 'bolt' | 'lance' | 'boom';
  x: number; y: number; vx: number; vy: number;
  life: number; dmg: number; pierce: number;
  hit: Set<Enemy>;
  col: string; rad: number; kb: number;
  a?: number;
  spd?: number; d?: number; range?: number; ret?: boolean; spin?: number;
  tag?: HitTag;
}

export type EffectType = 'nova' | 'meteor' | 'pbreath' | 'cyclone' | 'toxic' | 'laser' | 'hole' | 'judge' | 'chain' | 'shadowpass' | 'sigil' | 'hawk' | 'flask'
  | 'slash' | 'dome' | 'rain' | 'gale' | 'cauldron' | 'elixir' | 'icewall';

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
  /** Overrides the Skill tag of this effect type (pet dive, …). */
  tag?: HitTag;
  /** Counter (Cauldron puffs). */
  n?: number;
  /** Colour override (Mana Nova, Starfall, Judgement Pillar). */
  col?: string;
  /** Volatile Flask element. */
  el?: 'fire' | 'ice' | 'poison';
  /** Twin Hawks stun. */
  stun?: boolean;
}

/**
 * cone/circ/line/proj/ring as before; beam = line that damages at te (half width w);
 * pull = drags the player toward its centre during [te, te+du], core radius w hurts;
 * ice = slippery floor during [te, te+du]; safe = everything outside `pts` circles is hit at te.
 */
export type HazardKind = 'cone' | 'circ' | 'line' | 'proj' | 'ring' | 'beam' | 'pull' | 'ice' | 'safe' | 'bliz';

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
  /** Half width (beam) or core radius (pull). */
  w?: number;
  /** circ: spawn this enemy instead of dealing damage. */
  spawn?: EnemyId;
  /** safe: safe circles. */
  pts?: [number, number][];
  /** proj: bounces off the view edges. */
  bounce?: boolean;
  /** cone: chills the player (Frost Dragon). */
  chill?: number;
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
  | { kind: 'skill'; id: SkillId; toBench?: boolean }
  | { kind: 'pas'; id: PassiveId }
  | { kind: 'comp' }
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
  | { t: 'flash'; v: number; col?: string; max?: boolean; ult?: boolean }
  | { t: 'banner'; key: BannerKey; dur: number; big?: boolean; args?: Record<string, string | number> }
  | { t: 'dmg'; d: number }
  | { t: 'kill'; ttk: number }
  | { t: 'stageStart'; stage: number; special: boolean }
  | { t: 'stageClear'; stage: number; escaped: boolean }
  | { t: 'say'; who: EnemyId; beat: SayBeat; x: number; y: number }
  | { t: 'combo'; id: ComboId; x: number; y: number }
  | { t: 'weaponFound'; id: WeaponId }
  | { t: 'swapDenied' }
  | { t: 'spent'; what: 'reroll' | 'banish' | 'upgrade' | 'buySp' | 'revive' }
  | { t: 'victory' }
  | { t: 'gameOver' };

/** Banner texts are looked up by key in the game's text table. */
export type BannerKey =
  | 'stage' | 'bloodMoon' | 'intro.caster' | 'intro.charger' | 'intro.splitter' | 'intro.armor'
  | 'bossDown' | 'judgement' | 'swarm' | 'bossIncoming' | 'dragonOmen' | 'stageClear' | 'stageClearDragonFled'
  | 'stageClearRivalFled' | 'awakened' | 'weaponFound' | 'overtime' | 'kingEscaped' | 'umbraDown' | 'evolved' | 'secondWind' | 'dragonAppears' | 'dragonSummons' | 'rivalAppears'
  | 'rivalEscaped' | 'dragonTamed' | 'dragonPowerUp' | 'fused' | 'blizzard' | 'clonePowerUp' | 'shadowClone' | 'shadowShard';

export type SfxKey = 'hit' | 'crit' | 'boom' | 'zap' | 'nova' | 'lance' | 'laser' | 'lv' | 'hurt' | 'ult' | 'coin' | 'tick' | 'gem' | 'clear';

export interface SimState {
  tick: number;
  clock: number;
  seed: number;
  cfg: ResolvedConfig;
  /** Config versions used by this Run, in order. */
  configVersions: number[];
  eventSwitches: EventSwitches;
  /** Waiting for the next Stage start. */
  pending: { cfg?: ResolvedConfig; events?: EventSwitches };
  phase: Phase;
  hero: HeroId;
  meta: Meta;
  viewport: { w: number; h: number };
  debug: { event?: DebugEvent; god?: boolean };

  /** Chapter number (difficulty follows it). */
  stage: number;
  /** Realm of the current Chapter. */
  realm: RealmId;
  visited: RealmId[];
  /** Offered while phase === 'route'. */
  route: { chapter: number; choices: RealmId[] } | null;
  /** Overtime: the timer ended while the King lives. */
  overtime: boolean;
  /** How the last Stage ended. */
  lastEnd: 'clear' | 'escape' | null;
  /** Re-picks used for the current Chapter after an Escape. */
  repicks: number;
  chaptersCleared: number[];
  kingsKilled: number[];
  escapes: number;
  escapedKings: RealmId[];
  combos: number;
  revivesBought: number;
  victory: boolean;
  victoryTime: number;
  mode: 'solo' | 'daily' | 'endless';
  crack: number;
  /** Endless (after Umbra): the main Score is frozen in `main`; Endless scores from `endlessFrom`. */
  endless: boolean;
  main: { lines: ScoreLine[]; total: number } | null;
  endlessFrom: { kills: number; combos: number; escapes: number } | null;
  reviveEndless: boolean;
  /** Umbra's darkened heart: the renderer darkens all but a light around the player. */
  darkness: boolean;
  weapon: WeaponId;
  /** Weapons found this Run (kept forever; switchable at the next Stage end). */
  foundWeapons: WeaponId[];
  /** Kill charge still allowed (kills add at most killCap × the time rate). */
  ultBudget: number;
  /** Skill Points (King rewards, bought with Gold). */
  sp: number;
  /** Skills/passives banished for this Run. */
  banished: string[];
  /** The clear screen offers Awakening. */
  awakenOffer: boolean;
  /** Swaps made at this Stage end (cost doubles each time). */
  swaps: number;
  /** Gold taken from the wallet this Run (reported with the Run result). */
  walletSpent: number;
  bloodMoonShown: boolean;
  stageTime: number; stageDur: number;
  spawnAcc: number; waveT: number;
  bossSpawned: boolean;
  boss: Enemy | null;
  /** Double-King Stage: the King of the Realm the player skipped. */
  boss2: Enemy | null;
  doubleKing: boolean;
  /** The route choice not taken for this Chapter. */
  skipped: RealmId | null;
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
  /** Which Guardian this Blood Moon brings. */
  dragonKind: GuardianKind;
  /** All three Guardians beaten: the clear screen offers the Three-headed Dragon. */
  fuseOffer: boolean;
  rivalE: Enemy | null;
  seen: Set<string>;

  rng: Streams;
  events: SimEvent[];
}

