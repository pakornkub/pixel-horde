// Balance Config: every tunable gameplay number, with default, allowed range and description.
// The same schema types the sim, validates at load, generates Admin forms and validates publishes.
import { z } from 'zod';

/** A number with default, inclusive range and description. */
export const n = (def: number, min: number, max: number, desc: string) =>
  z.number().min(min).max(max).default(def).describe(desc);
/** Positive amount; range 0 .. max(10, def*10). */
const pos = (def: number, desc: string) => n(def, 0, Math.max(10, Math.abs(def) * 10), desc);
/** Fraction / probability in 0..1. */
const frac = (def: number, desc: string) => n(def, 0, 1, desc);
/** Multiplier 0..10. */
const mul = (def: number, desc: string) => n(def, 0, 10, desc);
/** Seconds 0..600. */
const sec = (def: number, desc: string) => n(def, 0, 600, desc);
const int = (def: number, min: number, max: number, desc: string) => n(def, min, max, desc).pipe(z.number().int());
const obj = <T extends z.ZodRawShape>(shape: T, desc?: string) => {
  const o = z.object(shape).prefault({} as never);
  return desc ? o.describe(desc) : o;
};

/** value(lv) = clamp(base + perLv·lv, min, max) */
const lin = (base: number, perLv: number, desc: string, min?: number, max?: number) =>
  obj({
    base: n(base, -1e6, 1e6, 'Value before levels'),
    perLv: n(perLv, -1e4, 1e4, 'Added per skill level'),
    min: min !== undefined ? n(min, -1e6, 1e6, 'Lower limit') : z.number().min(-1e6).max(1e6).optional().describe('Lower limit'),
    max: max !== undefined ? n(max, -1e6, 1e6, 'Upper limit') : z.number().min(-1e6).max(1e6).optional().describe('Upper limit'),
  }, desc);
/** value(lv) = base + floor((lv − offset) / every) */
const step = (base: number, every: number, offset: number, desc: string) =>
  obj({ base: n(base, 0, 100, 'Value at level offset'), every: n(every, 1, 20, 'Levels per +1'), offset: n(offset, 0, 20, 'Level offset') }, desc);

const evo = <T extends z.ZodRawShape>(shape: T) => obj(shape, 'Changes applied when the skill evolves');

const skills = obj({
  bolt: obj({
    max: int(8, 1, 20, 'Max level'),
    dmg: lin(16, 7, 'Damage'), cd: lin(0.85, -0.07, 'Cooldown (s)', 0.25), n: step(1, 2, 1, 'Bolts per cast'), pierce: step(0, 3, 0, 'Enemies pierced'),
    range: pos(200, 'Targeting range'), speed: pos(200, 'Projectile speed'), life: sec(1.1, 'Projectile life (s)'), kb: pos(35, 'Knockback'),
    evo: evo({ nAdd: pos(2, 'Extra bolts'), cdMul: mul(0.7, 'Cooldown multiplier'), pierceAdd: pos(1, 'Extra pierce'), dmgMul: mul(1.2, 'Damage multiplier') }),
  }),
  orbit: obj({
    max: int(6, 1, 20, 'Max level'),
    dmg: lin(10, 6, 'Damage'), n: lin(1, 1, 'Blades', undefined, 6), r: lin(30, 2, 'Orbit radius'), spd: lin(3, 0.35, 'Spin speed (rad/s)'),
    hitCd: sec(0.32, 'Per-enemy hit cooldown (s)'), kb: pos(55, 'Knockback'),
    evo: evo({ nSet: pos(8, 'Blades when evolved'), rMul: mul(1.3, 'Radius multiplier'), dmgMul: mul(1.4, 'Damage multiplier'), spdMul: mul(1.2, 'Spin multiplier') }),
  }),
  chain: obj({
    max: int(7, 1, 20, 'Max level'),
    dmg: lin(28, 14, 'Damage'), cd: lin(2.4, -0.18, 'Cooldown (s)', 0.9), jumps: lin(3, 2, 'Jumps'),
    range: pos(150, 'First target range'), jumpRange: pos(75, 'Jump range'), kb: pos(25, 'Knockback'),
    evo: evo({ jumpsMul: mul(1.6, 'Jumps multiplier (rounded)'), dmgMul: mul(1.5, 'Damage multiplier') }),
  }),
  nova: obj({
    max: int(7, 1, 20, 'Max level'),
    dmg: lin(30, 16, 'Damage'), cd: lin(3.4, -0.25, 'Cooldown (s)', 1.2), r: lin(55, 10, 'Radius'), dur: sec(0.38, 'Expansion time (s)'), kb: pos(90, 'Knockback'),
    evo: evo({ dmgMul: mul(1.6, 'Damage multiplier'), rMul: mul(1.35, 'Radius multiplier'), cdMul: mul(0.75, 'Cooldown multiplier') }),
  }),
  meteor: obj({
    max: int(7, 1, 20, 'Max level'),
    dmg: lin(80, 40, 'Damage'), cd: lin(4.2, -0.3, 'Cooldown (s)', 1.6), n: lin(2, 1, 'Meteors per cast'), r: lin(20, 2, 'Blast radius'),
    delay: sec(0.55, 'Fall time (s)'), stagger: sec(0.11, 'Delay between meteors (s)'), kb: pos(70, 'Knockback'),
    evo: evo({ nMul: mul(1.6, 'Meteors multiplier (rounded)'), rMul: mul(1.35, 'Radius multiplier'), dmgMul: mul(1.3, 'Damage multiplier') }),
  }),
  frost: obj({
    max: int(6, 1, 20, 'Max level'),
    dmg: lin(6, 5, 'Damage per tick'), r: lin(32, 6, 'Aura radius'), tick: sec(0.4, 'Damage interval (s)'), slow: frac(0.5, 'Speed kept by slowed enemies (Frost Aura, Toxic Pool)'), kb: pos(6, 'Knockback'),
    evo: evo({ dmgMul: mul(1.6, 'Damage multiplier'), rMul: mul(1.3, 'Radius multiplier') }),
  }),
  lance: obj({
    max: int(7, 1, 20, 'Max level'),
    dmg: lin(40, 18, 'Damage'), cd: lin(1.7, -0.13, 'Cooldown (s)', 0.6), n: step(1, 3, 0, 'Lances per cast'),
    range: pos(220, 'Trigger range'), speed: pos(280, 'Projectile speed'), life: sec(0.9, 'Projectile life (s)'), spread: n(0.22, 0, 3, 'Fan spread (rad)'), kb: pos(20, 'Knockback'),
    aim: n(0, 0, 200, 'Aim at the thickest crowd (monsters within this radius of each other) in range; 0 = the way the Hero faces'),
    evo: evo({ nAdd: pos(2, 'Extra lances'), dmgMul: mul(1.5, 'Damage multiplier') }),
  }),
  boomer: obj({
    max: int(7, 1, 20, 'Max level'),
    dmg: lin(22, 10, 'Damage'), cd: lin(2, -0.15, 'Cooldown (s)', 0.8), n: step(1, 2, 1, 'Discs per cast'), range: lin(80, 6, 'Throw distance'),
    target: pos(180, 'Targeting range'), speed: pos(170, 'Disc speed'), kb: pos(30, 'Knockback'),
    evo: evo({ nMul: mul(2, 'Discs multiplier'), dmgMul: mul(1.35, 'Damage multiplier') }),
  }),
  cyclone: obj({
    max: int(6, 1, 20, 'Max level'),
    dmg: lin(12, 6, 'Damage per tick'), cd: lin(5, -0.35, 'Cooldown (s)', 2.2), n: step(1, 2, 0, 'Cyclones per cast'), r: lin(16, 2, 'Radius'), dur: lin(2.4, 0.3, 'Duration (s)'),
    speed: pos(48, 'Drift speed'), tick: sec(0.25, 'Damage interval (s)'), pull: pos(55, 'Pull speed'),
    evo: evo({ rMul: mul(1.4, 'Radius multiplier'), nAdd: pos(1, 'Extra cyclones'), dmgMul: mul(1.3, 'Damage multiplier') }),
  }),
  toxic: obj({
    max: int(6, 1, 20, 'Max level'),
    dmg: lin(8, 5, 'Damage per tick'), cd: lin(3.6, -0.3, 'Cooldown (s)', 1.5), n: step(1, 2, 0, 'Pools per cast'), r: lin(16, 2, 'Radius'), dur: lin(3, 0.4, 'Duration (s)'),
    tick: sec(0.3, 'Damage interval (s)'),
    evo: evo({ rMul: mul(1.35, 'Radius multiplier'), dmgMul: mul(1.6, 'Damage multiplier') }),
  }),
  laser: obj({
    max: int(6, 1, 20, 'Max level'),
    dmg: lin(45, 20, 'Damage'), cd: lin(6, -0.5, 'Cooldown (s)', 2.6), len: lin(100, 12, 'Beam length'), dur: sec(0.9, 'Sweep time (s)'), width: n(0.12, 0, 1, 'Beam half-width (rad)'), kb: pos(50, 'Knockback'),
    evo: evo({ dmgMul: mul(1.35, 'Damage multiplier') }),
  }),
  hole: obj({
    max: int(5, 1, 20, 'Max level'),
    dmg: lin(6, 3, 'Damage per tick'), boom: lin(140, 70, 'Collapse damage'), cd: lin(9, -0.8, 'Cooldown (s)', 4.5), r: lin(45, 6, 'Radius'),
    dur: sec(1.9, 'Lifetime (s)'), tick: sec(0.2, 'Damage interval (s)'), pull: pos(150, 'Pull speed'), minTargets: int(3, 1, 50, 'Visible enemies needed'), kb: pos(140, 'Collapse knockback'),
    evo: evo({ boomMul: mul(2, 'Collapse multiplier'), rMul: mul(1.2, 'Radius multiplier') }),
  }),
  // Signature Skills (ticket 23): one per Hero, always in the locked slot
  sigil: obj({
    max: int(7, 1, 20, 'Max level'),
    dmg: lin(9, 5, 'Damage per tick'), cd: lin(3.2, -0.2, 'Cooldown (s)', 1.6), r: lin(34, 4, 'Radius'), dur: lin(2.6, 0.2, 'Lasts (s)'),
    tick: sec(0.35, 'Damage interval (s)'),
    evo: evo({ rMul: mul(1.35, 'Radius multiplier'), n: int(2, 1, 5, 'Sigils per cast') }),
    awk: obj({
      nAdd: int(0, 0, 4, 'Extra sigils per cast'), rMul: mul(1, 'Radius ×'), durMul: mul(1, 'Lasts ×'),
      spd: pos(30, 'Drift speed toward the thickest crowd'), pull: pos(22, 'Pull speed toward the sigil centre (Gathered)'),
      trail: sec(0.3, 'Leaves a trail mark every (s)'), trailDur: sec(1.4, 'Trail mark lasts (s)'),
      trailR: frac(0.35, 'Trail mark radius × sigil radius'), trailMul: frac(0.5, 'Trail mark damage × sigil damage'),
      echo: frac(0.5, 'Mana Nova also bursts from each sigil at this damage ×'),
      warpChill: frac(1, 'Time Warp: chance each tick adds a frost stack to a monster inside (3 stacks = Frozen)'),
    }, 'Archmage (Awakened, awaken.form 1): Wandering Sigils; Starfall aims at them, Time Warp freezes'),
  }, 'Lyra: Arcane Sigil'),
  shield: obj({
    max: int(6, 1, 20, 'Max level'),
    dmg: lin(8, 5, 'Bash damage'), n: lin(1, 0.4, 'Shields', 1, 3), r: lin(24, 1.5, 'Orbit radius'), spd: lin(2.2, 0.2, 'Turn speed'),
    hitCd: sec(0.4, 'Hit interval per enemy (s)'), kb: pos(90, 'Knockback'), block: pos(7, 'Projectile block radius'),
    size: pos(6, 'Hit size of a shield (added to the monster radius)'),
    bashCd: sec(0, 'Shield Bash: every this many seconds the shields swing out and back (0 = never)'),
    bashMul: mul(2, 'Shield Bash: orbit radius × at the widest'), bashDur: sec(0.6, 'Shield Bash: out-and-back time (s)'),
    evo: evo({ n: int(3, 1, 6, 'Shields'), heal: pos(3, 'HP healed per blocked projectile'), absorb: frac(0.15, 'Damage taken × (1 − this)') }),
    awk: obj({
      n: int(3, 1, 8, 'Outer shields'), rMul: mul(1.7, 'Outer ring radius × the inner ring'),
      cd: sec(3, 'The outer shields are thrown every (s)'), flight: sec(0.3, 'Flight time each way (s)'),
      dmgMul: mul(3, 'Slam damage × Bash damage'), r: pos(30, 'Slam radius'), pull: pos(16, 'A slam pulls monsters this far toward its centre (Gathered)'),
      hold: sec(2.5, 'Monsters a slam gathers stay Gathered this long (s)'),
      domeMul: mul(2, 'Aegis Dome shield burst damage × Bash damage'), domeR: pos(80, 'Aegis Dome shield burst radius'),
    }, 'Paladin (Awakened, awaken.form 1): Judgement Shields; Sacred Blades aim at crowds, Judgement Pillar burns on the slam'),
  }, 'Bram: Holy Shield'),
  hawk: obj({
    max: int(7, 1, 20, 'Max level'),
    dmg: lin(34, 16, 'Dive damage'), cd: lin(2.2, -0.14, 'Cooldown (s)', 0.9), range: pos(230, 'Hunting range'), flight: sec(0.35, 'Dive time (s)'), kb: pos(40, 'Knockback'),
    r: n(0, 0, 200, 'Dive splash radius: monsters this close to the prey are hit too (0 = prey only)'),
    guardN: int(0, 0, 50, 'Monsters this close to Kit that make the Hawk defend: it dives the nearest one instead of the biggest (0 = never)'),
    guardR: pos(40, 'Hawk defend radius around Kit'),
    evo: evo({ n: int(2, 1, 4, 'Hawks'), stun: sec(0.8, 'Stun (s); bosses are slowed') }),
    awk: obj({
      n: int(5, 1, 12, 'Hawks in the flock'), dmgMul: mul(0.6, 'Damage × per hawk'), r: pos(16, 'Splash radius of each dive'),
      galePull: pos(40, 'Gale Step blades pull monsters toward them (Gathered)'),
      shockMul: mul(1.5, 'Thunder Hawk damage × on Shocked monsters'), shockJump: mul(1.6, 'Thunder Hawk jump range × toward Shocked monsters'),
    }, 'Stormhunter (Awakened, awaken.form 1): Hawk Flock; Arrow Rain turns to fire arrows on its prey'),
  }, 'Kit: Hawk Companion'),
  flask: obj({
    max: int(7, 1, 20, 'Max level'),
    dmg: lin(22, 11, 'Splash damage'), cd: lin(2.6, -0.16, 'Cooldown (s)', 1.1), r: lin(22, 2, 'Splash radius'), flight: sec(0.45, 'Throw time (s)'), range: pos(190, 'Throw range'),
    evo: evo({ n: int(2, 1, 4, 'Flasks per throw'), dmgMul: mul(1.2, 'Damage multiplier') }),
    awk: obj({
      rMul: mul(1.6, 'Giant flask splash radius ×'), dmgMul: mul(1.5, 'Giant flask damage ×'),
      shards: int(6, 1, 16, 'Small flasks it bursts into'), spread: pos(36, 'How far the small flasks fly'), shardFlight: sec(0.35, 'Small flask flight (s)'),
      shardR: frac(0.7, 'Small flask radius ×'), shardMul: frac(0.5, 'Small flask damage ×'),
      spreadR: pos(40, 'Transmute: a monster dying with a Status in the circle passes it to others this close'),
    }, 'Grand Alchemist (Awakened, awaken.form 1): Giant Flask; the Cauldron lands on it, Elixir Rain readies the next'),
  }, 'Vex: Volatile Flask'),
  // Skill Line skills (tickets 24–25): unlocked by Awakening, no Evolution, stronger than general Skills
  manaNova: obj({ max: int(8, 1, 20, 'Max level'), dmg: lin(26, 13, 'Damage'), cd: lin(1.6, -0.08, 'Cooldown (s)', 0.8), r: lin(60, 6, 'Wave radius'), dur: sec(0.5, 'Wave time (s)'), kb: pos(50, 'Knockback') }, 'Lyra line: Mana Nova'),
  timeWarp: obj({ max: int(8, 1, 20, 'Max level'), r: lin(70, 8, 'Radius (monsters inside are slowed like Frost Aura)'), dmg: lin(4, 3, 'Damage per tick'), tick: sec(0.5, 'Damage interval (s)') }, 'Lyra line (survival): Time Warp'),
  starfall: obj({ max: int(8, 1, 20, 'Max level'), dmg: lin(90, 42, 'Damage per star'), cd: lin(3.6, -0.22, 'Cooldown (s)', 1.4), n: lin(3, 1, 'Stars'), r: lin(22, 2, 'Radius'), delay: sec(0.6, 'Fall time (s)'), stagger: sec(0.08, 'Between stars (s)'), kb: pos(60, 'Knockback') }, 'Lyra line: Starfall'),
  sacredBlades: obj({ max: int(8, 1, 20, 'Max level'), dmg: lin(60, 26, 'Damage'), cd: lin(1.4, -0.07, 'Cooldown (s)', 0.7), r: lin(70, 6, 'Reach'), arc: n(0.9, 0.1, 3.2, 'Half arc (rad)'), dur: sec(0.25, 'Swing time (s)'), kb: pos(90, 'Knockback') }, 'Bram line: Sacred Blades'),
  judgePillar: obj({ max: int(8, 1, 20, 'Max level'), dmg: lin(220, 110, 'Damage'), cd: lin(4, -0.25, 'Cooldown (s)', 1.8), r: pos(18, 'Radius'), delay: sec(0.5, 'Warning (s)'), kb: pos(40, 'Knockback') }, 'Bram line: Judgement Pillar'),
  aegisDome: obj({ max: int(8, 1, 20, 'Max level'), cd: lin(20, -1, 'Cooldown (s)', 12), dur: lin(2, 0.15, 'Invulnerable (s)'), r: pos(40, 'Dome radius'), kb: pos(160, 'Push-out knockback') }, 'Bram line (survival): Aegis Dome'),
  arrowRain: obj({ max: int(8, 1, 20, 'Max level'), dmg: lin(12, 6, 'Damage per volley'), cd: lin(3.2, -0.2, 'Cooldown (s)', 1.5), r: lin(40, 4, 'Radius'), dur: lin(2, 0.15, 'Lasts (s)'), tick: sec(0.2, 'Volley interval (s)'), range: pos(200, 'Range') }, 'Kit line: Arrow Rain'),
  galeStep: obj({ max: int(8, 1, 20, 'Max level'), dmg: lin(14, 7, 'Damage'), every: n(0.3, 0.05, 2, 'Blade every (s) while walking'), dur: lin(1.4, 0.1, 'Blade lasts (s)'), r: pos(10, 'Blade radius') }, 'Kit line (survival): Gale Step'),
  thunderHawk: obj({ max: int(8, 1, 20, 'Max level'), dmg: lin(40, 18, 'Damage'), cd: lin(2.4, -0.14, 'Cooldown (s)', 1.1), jumps: lin(4, 1, 'Chain jumps'), range: pos(200, 'Range'), jumpRange: pos(80, 'Jump range'), kb: pos(20, 'Knockback') }, 'Kit line: Thunder Hawk'),
  cauldron: obj({ max: int(8, 1, 20, 'Max level'), dmg: lin(10, 6, 'Damage per puff'), cd: lin(7, -0.4, 'Cooldown (s)', 4), r: lin(40, 4, 'Radius'), dur: lin(4, 0.3, 'Lasts (s)'), tick: sec(0.5, 'Puff interval (s)') }, 'Vex line: Cauldron'),
  transmute: obj({ max: int(8, 1, 20, 'Max level'), r: lin(60, 6, 'Radius'), chance: lin(0.12, 0.03, 'Chance a monster dying inside becomes a big EXP crystal', 0, 0.6), xp: lin(8, 3, 'EXP of that crystal') }, 'Vex line: Transmute (EXP, never Gold)'),
  elixirRain: obj({ max: int(8, 1, 20, 'Max level'), cd: lin(14, -0.8, 'Cooldown (s)', 7), heal: lin(0.08, 0.015, 'Heal × max HP'), cdCut: lin(0.6, 0.1, 'Seconds taken off every Skill cooldown') }, 'Vex line (survival): Elixir Rain'),
}, 'Attack skills: level formulas and evolutions');

const passives = obj({
  max: obj({ might: int(5, 1, 20, 'Might max level'), haste: int(5, 1, 20, 'Haste max level'), swift: int(5, 1, 20, 'Swift max level'), vital: int(5, 1, 20, 'Vitality max level'), magnet: int(4, 1, 20, 'Magnet max level'), crit: int(5, 1, 20, 'Keen Eye max level') }),
  mightDmg: frac(0.2, 'Might: damage per level'),
  hasteCd: frac(0.08, 'Haste: cooldown reduction per level'),
  swiftSpd: frac(0.12, 'Swift Boots: speed per level'),
  vitalHp: pos(30, 'Vitality: max HP per level'),
  vitalHeal: pos(30, 'Vitality: instant heal on pick'),
  magnetPick: mul(0.5, 'Magnet: pickup range per level'),
  keenCrit: frac(0.07, 'Keen Eye: crit chance per level'),
  keenCritMul: mul(0.2, 'Keen Eye: crit multiplier per level'),
}, 'Passive skills');

/** Base difficulty (ticket 48): multipliers on the numbers written in this config, applied by resolveConfig. */
const difficulty = obj({
  mobHp: mul(0.6, 'Normal monster HP ×'), mobDmg: mul(0.45, 'Normal monster damage ×'),
  bossHp: mul(0.55, 'King, Guardian, Rival and Umbra HP ×'), bossDmg: mul(0.45, 'King, Guardian, Rival and Umbra damage ×'),
  spawn: mul(0.85, 'Spawn rate and swarm size ×'), xp: mul(1.3, 'EXP gained ×'),
  warn: mul(1.4, 'Boss move warning time ×'), kingPace: mul(1.35, 'Pause between King moves ×'),
  hp: mul(1.3, 'Player max HP ×'), hearts: mul(2, 'Heart drop chance ×'),
  ultFill: mul(0.8, 'Ultimate charge time ×'), director: mul(0.75, 'Director maximum ×'),
  gold: mul(0.2, 'Gold earned in a Run × (coins, chests, Kings, Rival, Gold bags, Umbra bonus)'),
}, 'Base difficulty: multipliers on the numbers in this config (1 = as written)');

const shared = obj({
  maxAttackSlots: int(4, 1, 12, 'Attack slots, including the Signature Skill'),
  passiveSlots: int(3, 1, 6, 'Passive slots'),
  bench: obj({
    start: int(1, 0, 6, 'Bench slots at the start of a Run'),
    growAt1: int(2, 1, 20, 'Bench +1 once this Chapter is behind you'),
    growAt2: int(4, 1, 20, 'Bench +1 once this Chapter is behind you'),
    swapBase: pos(20, 'Swap cost: Gold × Chapter'),
    discard: int(1, 0, 1, 'Stage end: Bench skills can be removed for free (1) or not (0)'),
    passives: int(1, 0, 1, 'Full passive slots: new passives go to the Bench and swap at the Stage end (1) or are not offered (0)'),
    swapGrowth: mul(2, 'Each further swap in the same Stage end costs × this'),
  }, 'Bench and Stage-end swaps'),
  stage: obj({
    durBase: sec(60, 'Stage 1 length (s)'), durPerStage: sec(20, 'Extra seconds per stage'), durMax: sec(150, 'Longest stage (s)'),
    bossAt: frac(0.55, 'Boss appears at this fraction of the stage'), bossHpGrowth: mul(1.25, 'Extra boss HP multiplier per stage'),
    clearHeal: frac(0.4, 'HP healed when starting the next stage'), clearDelay: sec(1.5, 'Pause between clear and the results screen (s)'),
    reviveHp: frac(0.5, 'HP of a downed player at the next stage'),
    chapters: int(8, 1, 20, 'Chapters in a Run (the last one is the Heart Crater)'),
    overtime: sec(45, 'Overtime after the timer while the King lives (s)'),
    enrageSpd: mul(1.3, 'King speed × in overtime'),
    enrageDmg: mul(1.3, 'King damage × in overtime'),
    overtimeSpawn: mul(1.5, 'Spawn rate × in overtime'),
    escapeRepicks: int(1, 0, 5, 'Re-picks of the same Chapter after an Escape'),
    kingGold: pos(50, 'King reward Gold × Chapter'),
    umbraEscapeHp: frac(0.15, 'Umbra HP + per King that escaped'),
    bloodMoonRevealAt: frac(0.1, 'Blood Moon reveals itself at this fraction of the Stage'),
  }, 'Stage flow'),
  spawn: obj({
    base: pos(1.4, 'Spawns/s at stage start'), prog: pos(3.4, 'Extra spawns/s at stage end'), stageGrowth: frac(0.35, 'Spawn rate growth per stage'),
    perMate: mul(0.6, 'Spawn multiplier per extra living player'), cap: int(320, 10, 2000, 'Enemy cap'),
    eliteChance: frac(0.012, 'Elite chance per stage'),
    swarmFirst: sec(16, 'First swarm ring (s)'), swarmEvery: sec(18, 'Swarm ring interval (s)'), swarmEveryBloodMoon: sec(10, 'Swarm interval in Blood Moon (s)'),
    swarmBase: int(16, 0, 500, 'Enemies per swarm ring'), swarmPerStage: int(6, 0, 100, 'Extra ring enemies per stage'), swarmCap: int(340, 10, 2000, 'Enemy cap during swarm'),
    capMobile: int(240, 10, 2000, 'Enemy cap on phones/tablets'), swarmCapMobile: int(260, 10, 2000, 'Enemy cap during swarm on phones/tablets'),
    edge: pos(14, 'Spawn distance beyond the view edge'), ringEdge: pos(10, 'Swarm ring distance beyond the view edge'), despawn: mul(0.95, 'Recycle distance (× view diagonal)'),
    // Wave fronts: most monsters come from one side at a time, which moves every few seconds (0 = all around)
    frontShare: frac(0, 'Share of monsters that come from the wave front instead of anywhere around (0 = all around)'),
    frontArc: n(100, 10, 360, 'Wave front width (degrees)'),
    frontEvery: n(9, 1, 120, 'Seconds before the wave front moves to another side'),
    frontTurn: n(90, 0, 180, 'The next wave front turns at least this many degrees'),
    lull: sec(0, 'Quiet seconds each time the wave front moves (0 = none)'),
    lullSpawn: frac(0.35, 'Spawn rate × during the quiet seconds'),
    frontRecycle: int(0, 0, 1, 'Monsters left far behind reappear on the wave front (1) or anywhere around (0)'),
    pincer: int(0, 0, 1, 'Swarms on normal Stages come as two arcs from the wave front\'s sides (1) or a full ring (0)'),
    pincerArc: n(100, 10, 180, 'Width of each swarm arc (degrees)'),
  }, 'Spawner'),
  scaling: obj({
    hpGrowth: mul(1.5, 'Enemy HP × per stage'), hpProg: mul(0.7, 'Enemy HP + at stage end'), hpPerLv: frac(0.08, 'Enemy HP + per player level'),
    lvCapBase: n(0, 0, 100, 'Highest player level the monster formulas count at the start of Chapter 1 (0 with lvCapPerCh 0 = no cap)'),
    lvCapPerCh: n(0, 0, 50, 'That counted-level cap grows by this much over each Chapter; levels above it add no monster HP, damage or armor'),
    hpDirBase: mul(0.85, 'Enemy HP Director base'), hpDirK: mul(0.15, 'Enemy HP per Director point'),
    dmgGrowth: mul(1.18, 'Enemy damage × per stage'), dmgProg: mul(0.5, 'Enemy damage + at stage end'), dmgPerLv: frac(0.015, 'Enemy damage + per player level'),
    spdPerStage: frac(0.04, 'Enemy speed + per stage'), spdJitter: frac(0.1, 'Enemy speed random ±'),
    eliteHp: mul(7, 'Elite HP ×'), eliteSpd: mul(0.85, 'Elite speed ×'), eliteDmg: mul(1.6, 'Elite damage ×'), eliteXp: mul(6, 'Elite XP ×'), eliteR: mul(2, 'Elite size ×'),
    armorFrom: int(3, 1, 99, 'First stage with armored enemies'), armorChance: frac(0.03, 'Armor chance'), armorChancePerStage: frac(0.015, 'Armor chance per stage'),
    armorBase: pos(10, 'Armor (flat reduction) at stage 1'), armorGrowth: mul(1.4, 'Armor × per stage'), armorPerLv: frac(0.05, 'Armor + per player level'),
    hitVariance: frac(0.15, 'Enemy hit damage random ±'), wobble: frac(0.5, 'Path wobble (rad)'),
  }, 'Enemy scaling'),
  director: obj({
    start: n(1, 0, 5, 'Starting value'), min: n(0.7, 0, 5, 'Minimum'), max: n(2.4, 0, 5, 'Maximum'),
    rise: pos(0.06, 'Rise per second while cruising'), riseHp: frac(0.75, 'Cruising: HP above this fraction'), riseCalm: sec(6, 'Cruising: seconds without being hurt'),
    drop: pos(0.2, 'Drop per second while struggling'), dropHp: frac(0.4, 'Struggling: HP below this fraction'),
    hurtDrop: pos(0.03, 'Drop per second right after a hit'), hurtWindow: sec(2, 'Seconds counted as right after a hit'),
    stageReset: frac(0, 'A new Stage moves the Director this share of the way back to its starting value (0 = keeps it)'),
  }, 'Director (adaptive pressure)'),
  player: obj({
    hp: pos(100, 'Base max HP'), spd: pos(62, 'Base speed'), pick: pos(26, 'Base pickup range'), crit: frac(0.08, 'Base crit chance'), critMul: mul(2, 'Base crit multiplier'),
    critCap: frac(0.5, 'Crit chance cap'), cdCap: frac(0.4, 'Cooldown reduction cap'), inv: sec(0.6, 'Invulnerability after a hit (s)'), contact: pos(5, 'Player hit radius'),
    dmgVariance: frac(0.12, 'Skill damage random ±'), kb: pos(40, 'Default knockback'), kbBoss: frac(0.1, 'Knockback × on bosses'), kbElite: frac(0.4, 'Knockback × on elites'),
    kbDecay: n(0.02, 0.0001, 1, 'Knockback left after 1 s'),
  }, 'Player'),
  xp: obj({ base: pos(5, 'XP to level: constant'), perLv: pos(4, 'XP to level: × level'), quad: pos(0.5, 'XP to level: × level²'), lateFrom: int(8, 0, 99, 'Late curve starts after level'), lateQuad: pos(1.4, 'Late curve: × (level − start)²') }, 'Level curve'),
  levelup: obj({ offers: int(3, 1, 6, 'Choices per level-up'), wUpgrade: mul(1.3, 'Weight: upgrade an owned skill'), wNew: mul(1.1, 'Weight: new skill'), wPassive: mul(0.8, 'Weight: passive'), wSignature: mul(1.25, 'Weight × for upgrading the Signature Skill') }, 'Level-up offers'),
  overflow: obj({
    dmg: frac(0.04, 'Limit Break: damage + per pick'),
    hp: frac(0.05, 'Limit Break: max HP + (share) per pick'),
    spd: frac(0.03, 'Limit Break: move speed + per pick'),
    crit: frac(0.02, 'Limit Break: crit chance + per pick (the crit cap still applies)'),
    max: int(10, 0, 50, 'Limit Break: picks of each bonus per Run'),
    gold: pos(25, 'Gold bag: Gold × Chapter'),
    wLb: mul(1, 'Weight: each Limit Break bonus'),
    wTrain: mul(1, 'Weight: train one Bench entry (+1 level), per entry'),
    wGold: mul(0.8, 'Weight: Gold bag'),
    wHeal: mul(0.8, 'Weight: Recover (only offered when HP is not full)'),
  }, 'Fillers when too few upgrades are left (level-up / chest)'),
  ult: obj({
    max: pos(80, 'Charge needed'), fill: sec(60, 'Seconds to fill from time alone'),
    killCap: mul(1, 'Kills can add at most this × the time rate (1 = at most twice as fast)'),
    perKill: pos(1, 'Charge per kill'), perElite: pos(5, 'Charge per elite kill'), perBoss: pos(20, 'Charge per boss kill'),
    mobHp: mul(1.5, 'Damage = this × the Chapter\'s normal monster HP (no Might/Power/crit)'),
    bossCap: frac(0.08, 'At most this × a King\'s or Guardian\'s max HP per Ultimate'), umbraCap: frac(0.05, 'At most this × Umbra\'s max HP per Ultimate'),
    slow: sec(0.55, 'Slow-motion time (s)'), delay: sec(0.3, 'Strike delay (s)'), kb: pos(120, 'Knockback'),
  }, 'Ultimate (Judgement)'),
  streak: obj({ window: sec(2.2, 'Seconds between kills to keep the Kill Streak'), popupEvery: int(25, 5, 1000, 'Show a "×N KO!" popup every N kills of a streak') }, 'Kill Streak'),
  coop: obj({
    bossHpPerMate: frac(0.6, 'Boss / Guardian / Umbra HP + per extra player'),
    goldPerKill: frac(0.1, 'Not used any more (guests pick up shared Gold drops); kept so older versions stay valid'),
    heartShare: pos(60, 'Shared drops: a heart also heals allies this close to the player who took it'),
    pickTime: sec(10, 'Level-up / chest: seconds to choose before a pick is made for you (the room keeps playing)'),
    shieldR: pos(40, 'Shield bubble radius while choosing (monsters are pushed out)'),
    shieldPush: pos(220, 'Shield bubble push speed'),
    shieldAfter: sec(5, 'Shield stays this long after choosing (s): time to get moving again, still no damage'),
    choosingSkills: int(1, 0, 1, 'Skills, Companion and Shadow Clone keep attacking while their player chooses a level-up / chest (1) or stop (0)'),
    xpShareK: n(0, 0, 2, 'EXP per pickup for each player = 1 / (1 + this × other players); 0 = everyone gets it all'),
    goldSplit: int(0, 0, 1, 'Gold goes to a team pot (who picked what is shown) split evenly at each Stage end, and a dropped chest to whoever takes it (1); or everyone gets every pickup (0)'),
    reviveTime: sec(3, 'Seconds standing next to a downed ally to revive them'), reviveRange: pos(22, 'Ally revive distance'),
    reviveHp: frac(0.3, 'HP after an ally revive'),
    voteTime: sec(15, 'Route vote time (s); the host breaks ties'), clearWait: sec(30, 'Stage-end: wait for everyone to be ready at most (s)'),
    hostLost: sec(5, 'Guests leave when no snapshot arrives for this long (s)'),
  }, 'Co-op'),
  tutorial: obj({ kingHp: frac(0.8, 'King HP × in the account\'s very first Greenvale'), spawn: frac(0.8, 'Spawn rate × in that first Greenvale') }, 'First Run (easier Greenvale)'),
  fx: obj({
    particles: int(900, 50, 5000, 'Particle cap (desktop)'), particlesMobile: int(500, 50, 5000, 'Particle cap (phones/tablets)'),
    lowFps: int(45, 10, 60, 'Suggest lowering effects when FPS stays under this'), lowFpsSecs: sec(8, 'Seconds of low FPS before the suggestion'),
    kingSlowmo: sec(1.1, 'Slow-motion after a King dies (real seconds)'), slowmoScale: frac(0.35, 'Game speed during that slow motion'),
    zoom: mul(1.3, 'Camera zoom for Evolution/Awakening/fusion'), zoomTime: sec(1, 'Zoom moment length (s)'), introTime: sec(2.4, 'King intro card length (s)'),
  }, 'Presentation (client only; never changes the simulation)'),
  loot: obj({
    coinChance: frac(0.08, 'Coin drop chance'), coin: pos(1, 'Coin value'), eliteCoin: pos(5, 'Elite coin value'), bossCoin: pos(50, 'Boss coin value'),
    heartChance: frac(0.012, 'Heart drop chance'), heartSmall: frac(0.3, 'Small heart heal (× max HP)'), heartBig: frac(0.5, 'Boss heart heal (× max HP)'),
    shieldChance: frac(0.004, 'Shield drop chance (normal monster)'), shieldElite: frac(0.15, 'Shield drop chance (elite monster)'),
    shieldAbsorb: frac(0.3, 'Shield absorbs this much damage (× max HP)'), shieldDur: sec(10, 'Shield lasts (s)'),
    chestGold: pos(20, 'Gold when picking up a chest'),
    kingChestItem: int(0, 0, 1, 'Kings also drop a chest item (1: two chests per King) or only open the wheel (0)'), gemCap: int(380, 10, 5000, 'Gems on the ground before merging'),
    bossGems: int(14, 1, 100, 'XP gems a boss drops'), eventGems: int(10, 1, 100, 'XP gems a dragon/rival drops'),
    magnetAccel: pos(400, 'Gem pull acceleration'), magnetMax: pos(320, 'Gem pull max speed'),
  }, 'Drops and pickups'),
  shop: obj({
    costGrowth: mul(1.6, 'Price × per level'),
    power: obj({ max: int(10, 0, 50, 'Max level'), base: pos(30, 'Base price'), per: frac(0.08, 'Damage per level') }),
    vigor: obj({ max: int(10, 0, 50, 'Max level'), base: pos(25, 'Base price'), per: pos(15, 'Max HP per level') }),
    speed: obj({ max: int(5, 0, 50, 'Max level'), base: pos(40, 'Base price'), per: frac(0.04, 'Speed per level') }),
    greed: obj({ max: int(5, 0, 50, 'Max level'), base: pos(50, 'Base price'), per: frac(0.15, 'Gold per level') }),
    wisdom: obj({ max: int(5, 0, 50, 'Max level'), base: pos(50, 'Base price'), per: frac(0.1, 'XP per level') }),
    revive: obj({ max: int(1, 0, 5, 'Max level'), base: pos(400, 'Base price') }),
  }, 'Permanent shop'),
  heroes: obj({
    mage: obj({ cost: pos(0, 'Unlock price'), dmg: frac(0.1, 'Skill damage bonus') }, 'Lyra'),
    knight: obj({ cost: pos(0, 'Unlock price'), hp: pos(40, 'Max HP bonus'), spd: frac(0.05, 'Speed penalty') }, 'Bram'),
    ranger: obj({ cost: pos(500, 'Unlock price'), spd: frac(0.12, 'Speed bonus'), pick: mul(0.3, 'Pickup range bonus'), hp: n(0, 0, 200, 'Max HP bonus') }, 'Kit'),
    alchemist: obj({ cost: pos(1000, 'Unlock price'), cd: frac(0.08, 'Cooldown reduction'), status: frac(0.2, 'Statuses last longer by') }, 'Vex'),
  }, 'Heroes'),
  secondWind: obj({ hp: frac(0.5, 'HP after revive'), inv: sec(2.5, 'Invulnerability (s)'), r: pos(110, 'Blast radius'), dmg: pos(150, 'Blast damage'), dmgGrowth: mul(1.45, 'Blast × per stage') }, 'Second Wind revive'),
  chest: obj({ p1: frac(0.5, 'Chance of ×1'), p2: frac(0.35, 'Chance of ×2 (rest is ×3)') }, 'Treasure chest wheel'),
  events: obj({
    bloodMoonFrom: int(2, 1, 99, 'First stage with Blood Moon'), bloodMoonChance: frac(0.1, 'Blood Moon chance'), bloodMoonPity: frac(0.06, 'Blood Moon chance + per miss'),
    bloodMoonSpawn: mul(2.3, 'Blood Moon spawn ×'), bloodMoonCoin: mul(2, 'Blood Moon coin ×'),
    dragonFrom: int(3, 1, 99, 'First stage with the dragon'), dragonChance: frac(0.25, 'Dragon chance inside Blood Moon'), dragonPity: frac(0.15, 'Dragon chance + per miss'),
    dragonWarnAt: frac(0.33, 'Dragon omen at stage fraction'), dragonAt: frac(0.42, 'Dragon arrives at stage fraction'),
    doubleKingFrom: int(4, 1, 20, 'Double-King Stages from this Chapter'), doubleKingChance: frac(0.1, 'Double-King Stage chance (never announced)'), doubleKingHp: frac(0.7, 'Each King\'s HP × on a double-King Stage'),
    rivalChance: frac(0.25, 'Shadow Rival chance on normal stages'), rivalAt: frac(0.25, 'Rival arrives at stage fraction'),
    lastChapter: int(7, 1, 99, 'Last Chapter with special events (the finale has none)'),
  }, 'Special events'),
  dragon: obj({
    hp: pos(6000, 'HP at stage 1'), hpGrowth: mul(1.5, 'HP × per stage'), firstCd: sec(2, 'First attack delay (s)'), cdMin: sec(1.8, 'Attack interval min (s)'), cdMax: sec(2.6, 'Attack interval max (s)'),
    breathR: pos(100, 'Breath length'), breathArc: n(0.5, 0, 3.2, 'Breath half-angle (rad)'), breathWarn: sec(0.75, 'Breath warning (s)'), breathDur: sec(0.7, 'Breath duration (s)'), breathDmg: mul(0.45, 'Breath damage × per tick'),
    dashLen: pos(190, 'Dash warning length'), dashWarn: sec(0.65, 'Dash warning (s)'), dashTime: sec(0.5, 'Dash time (s)'), dashSpeed: pos(320, 'Dash speed'), dashDmg: mul(1.6, 'Dash contact damage ×'),
    rainCount: int(6, 0, 30, 'Fireballs per rain'), rainR: pos(18, 'Fireball radius'), rainWarn: sec(0.9, 'Fireball warning (s)'), rainDmg: mul(1.1, 'Fireball damage ×'),
    whelps: int(4, 0, 20, 'Whelps per summon'), whelpCap: int(6, 0, 50, 'Summon only below this many whelps'),
  }, 'Inferno Dragon (Guardian)'),
  guardians: obj({
    pityBloodMoon: mul(2, 'After the first Guardian: Blood Moon chance × in a Realm whose element matches a missing one'),
    pityDragon: frac(0.6, 'After the first Guardian: Guardian chance in such a Blood Moon'),
    frost: obj({
      hp: pos(6000, 'HP at stage 1'), hpGrowth: mul(1.5, 'HP × per stage'), firstCd: sec(2, 'First attack delay (s)'), cdMin: sec(1.9, 'Attack interval min (s)'), cdMax: sec(2.7, 'Attack interval max (s)'),
      breathR: pos(100, 'Ice breath length'), breathArc: n(0.55, 0, 3.2, 'Ice breath half-angle (rad)'), breathWarn: sec(0.75, 'Warning (s)'), breathDur: sec(0.7, 'Duration (s)'), breathDmg: mul(0.4, 'Damage × per tick'),
      chill: sec(1.2, 'Player chilled by the breath (s)'),
      ringR: pos(110, 'Ice pillar ring radius'), ringDur: sec(1.2, 'Ring travel time (s)'), ringDmg: mul(1.2, 'Ring damage ×'),
      blizDur: sec(4, 'Blizzard length (s)'), blizWarn: sec(1, 'Blizzard warning (s)'), blizFreeze: sec(0.9, 'Standing still this long freezes you (s)'), blizDmg: mul(0.9, 'Freeze damage ×'),
    }, 'Frost Dragon (Guardian)'),
    storm: obj({
      hp: pos(5500, 'HP at stage 1'), hpGrowth: mul(1.5, 'HP × per stage'), firstCd: sec(2, 'First attack delay (s)'), cdMin: sec(1.7, 'Attack interval min (s)'), cdMax: sec(2.5, 'Attack interval max (s)'),
      rows: int(4, 1, 12, 'Lightning rows'), rowGap: pos(34, 'Distance between rows'), rowWarn: sec(0.9, 'Row warning (s)'), rowDmg: mul(1.1, 'Row damage ×'),
      balls: int(3, 1, 10, 'Bouncing orbs'), ballSpeed: pos(90, 'Orb speed'), ballLife: sec(5, 'Orb life (s)'), ballDmg: mul(0.9, 'Orb damage ×'),
      dashLen: pos(280, 'Dash warning length'), dashWarn: sec(0.6, 'Dash warning (s)'), dashTime: sec(0.45, 'Dash time (s)'), dashSpeed: pos(440, 'Dash speed'), dashDmg: mul(1.5, 'Dash contact damage ×'),
    }, 'Storm Dragon (Guardian)'),
  }, 'Blood Moon Guardians'),
  status: obj({
    frostStacks: int(3, 1, 20, 'Frost Aura ticks needed to freeze a monster'),
    frozen: sec(1.5, 'Frozen (s); bosses are only slowed'),
    gatherLinger: sec(1, 'Gathered lasts this long after the pull ends (s)'),
    burning: sec(3, 'Burning (s)'), shocked: sec(2, 'Shocked (s)'), poisoned: sec(4, 'Poisoned (s)'),
  }, 'Statuses left by Skills'),
  combos: obj({
    cooldown: sec(1, 'The same Combo can hit the same monster again after (s)'),
    shatter: mul(2.5, 'Shatter: Frozen + heavy hit, damage ×'), shatterShards: frac(0.3, 'Shatter: ice shards hit nearby for × the hit'), shatterR: pos(28, 'Shatter shard radius'),
    firestormR: pos(40, 'Firestorm: fire spreads this far through a Gathered pack'), firestorm: frac(0.5, 'Firestorm: spread damage × the hit'),
    overload: mul(1.5, 'Overload: Shocked + fire, explosion × the hit'), overloadR: pos(30, 'Overload radius'),
    superconduct: sec(5, 'Superconduct: Frozen + lightning, armour removed for (s)'),
    toxicBurst: mul(2, 'Toxic Burst: Poisoned + fire, remaining poison damage ×'), toxicBurstR: pos(35, 'Toxic Burst radius'),
    grinder: mul(1.5, 'Grinder: Gathered + sweeper, damage ×'),
    catalyst: mul(1.5, 'Catalyst: Arcane Bolt on any Status, damage ×'),
  }, 'Combos'),
  realms: obj({
    resist: frac(0.5, 'Damage × from the element a Realm resists'),
    armorMul: mul(2, 'Armoured Realms: armour chance ×'), armorFrom: int(2, 1, 20, 'Armoured Realms: armour from this Chapter'),
    fastSpd: mul(1.1, 'Fast Realms: fast monsters speed ×'),
  }, 'Realm traits and resistances'),
  weapons: obj({
    drop: frac(0.05, 'A King drops its Realm\'s Weapon (if not owned yet)'),
    umbraGold: pos(500, 'Gold for beating Umbra when every Weapon is owned'),
    root: sec(2, 'Thornwhip: monsters rooted (s)'),
    execute: frac(0.2, 'Bone Scythe: normal monsters below this HP fraction are reaped'),
    freeze: sec(2, 'Glacier Lance: monsters frozen (s); bosses slowed'),
    crashKb: mul(2.5, 'Magma Maul: knockback × (and Burning)'),
    plagueDps: frac(0.12, 'Plague Censer: Poisoned damage per second × the strike'),
    push: pos(420, 'Coral Trident: push toward the screen edge'),
    turretDur: sec(8, 'Gear Cannon: turret lasts (s)'), turretEvery: sec(0.35, 'Gear Cannon: seconds between shots'), turretDmg: frac(0.1, 'Gear Cannon: shot damage × the strike'),
    harvestHeal: frac(0.01, 'Lich Tome: HP healed per monster hit (× max HP)'), harvestHealMax: frac(0.25, 'Lich Tome: most HP healed per Ultimate (× max HP)'), harvestPull: pos(260, 'Lich Tome: pull toward you'),
  }, 'Weapons (change only the Ultimate)'),
  economy: obj({
    kingSkillPoints: int(1, 0, 10, 'Skill Points per King killed'),
    kingChest: int(1, 0, 5, 'Chest wheels per King killed'),
    spShop: int(0, 0, 1, 'Stage end: Skill Points can be bought for Gold (1) or not (0)'),
    spCost: pos(30, 'Buy 1 Skill Point at Stage end: Gold × Chapter'),
    reroll: int(1, 0, 10, 'Skill Points: reroll the level-up offers'),
    banish: int(1, 0, 10, 'Skill Points: banish a Skill/passive from this Run'),
    upgrade: int(2, 0, 10, 'Skill Points: +1 level to a chosen attack Skill'),
    revive: pos(75, 'Bought revive: Gold × Chapter (once per Run, −15% Score)'),
    reviveHp: frac(0.5, 'HP after a bought revive'),
    reviveInv: sec(2.5, 'Invulnerable after a bought revive (s)'),
  }, 'In-Run economy'),
  umbra: obj({
    phase2: frac(0.66, 'Umbra: stolen King ultimates below this HP'),
    phase3: frac(0.33, 'Umbra: darkened heart below this HP (the screen goes dark)'),
    ultCdMul3: frac(0.6, 'Ultimate cooldown × in the darkened-heart phase'),
    lightR: pos(70, 'Light radius around the player in the dark'),
    bolts: int(7, 1, 30, 'Shadow bolts per fan'), boltSpread: n(0.2, 0, 1.5, 'Angle between bolts (rad)'), boltSpeed: pos(120, 'Shadow bolt speed'), boltDmg: mul(0.8, 'Shadow bolt damage ×'),
    meteors: int(5, 1, 30, 'Shadow meteors'), meteorR: pos(20, 'Shadow meteor radius'), meteorWarn: sec(1, 'Shadow meteor warning (s)'), meteorDmg: mul(1.2, 'Shadow meteor damage ×'),
  }, 'Umbra, the final King'),
  endless: obj({
    hpGrowth: mul(1.1, 'Extra monster HP × per Chapter beyond the last'),
    dmgGrowth: mul(1.05, 'Extra monster damage × per Chapter beyond the last'),
  }, 'Endless mode (after Umbra)'),
  heartCrack: obj({
    hp1: mul(1.25, 'Tier 1: monster HP ×'), dmg1: mul(1.15, 'Tier 1: monster damage ×'), spawn1: mul(1.15, 'Tier 1: spawn rate ×'),
    hp2: mul(1.5, 'Tier 2: monster HP ×'), dmg2: mul(1.3, 'Tier 2: monster damage ×'), spawn2: mul(1.3, 'Tier 2: spawn rate ×'),
    hp3: mul(1.8, 'Tier 3: monster HP ×'), dmg3: mul(1.45, 'Tier 3: monster damage ×'), spawn3: mul(1.45, 'Tier 3: spawn rate ×'),
  }, 'Heart Crack difficulty tiers (unlocked by beating Umbra)'),
  awaken: obj({
    links: int(2, 1, 3, 'Max-level Links needed (consumed unless keep is 1)'),
    stages: int(1, 1, 5, 'Full Stages the Links must have been max level and equipped'),
    sigDmg: mul(1.3, 'Awakened Signature Skill damage ×'),
    grant: int(0, 0, 3, 'Skill Line skills given right away when Awakening (in listed order, into free attack slots)'),
    grantLv: int(1, 1, 8, 'Level of the Skill Line skills given at Awakening'),
    wLine: mul(1, 'Level-up offer weight × for Skill Line skills after Awakening'),
    keep: int(0, 0, 1, 'Awakening keeps the Links equipped (1) or consumes them (0)'),
    slots: int(0, 0, 2, 'Extra attack slots after Awakening'),
    form: int(0, 0, 1, 'Awakened Signature takes a new form and the Skill Line skills combo with it (1), or it only hits harder (0)'),
    mark: sec(1.5, 'Skill Line skills aim at the Awakened Signature\'s latest strike when it is this recent (s)'),
  }, 'Awakening'),
  kings: obj({
    firstCd: sec(1.6, 'First move after a King arrives (s)'),
    cdMin: sec(2.4, 'Shortest pause between King moves (s)'), cdMax: sec(3.4, 'Longest pause between King moves (s)'),
    phaseAt: frac(0.5, 'HP fraction where a King enters phase 2 (ultimate unlocked)'),
    ultCd: sec(10, 'Ultimate cooldown (s)'), ultFirst: sec(1.5, 'Delay before the first ultimate after phase 2 starts (s)'),
    ultWarn: sec(1.2, 'Ultimate warning time (s)'), overtimeUltMul: frac(0.5, 'Ultimate cooldown × during overtime (ultimate also allowed in phase 1)'),
    umbraUltDmg: frac(0.7, 'Umbra using a defeated King\'s ultimate: damage ×'),
    slam: obj({ warn: sec(0.9, 'Warning (s)'), r: pos(26, 'Radius'), dmg: mul(1.2, 'Damage × King contact damage') }, 'King Slime: leap slam'),
    split: obj({ n: int(4, 1, 20, 'Slimes spawned'), warn: sec(0.7, 'Warning (s)'), r: pos(40, 'Spawn ring radius') }, 'King Slime: split off slimes'),
    splash: obj({ r: pos(140, 'Wave radius'), dur: sec(1.1, 'Wave travel time (s)'), land: pos(36, 'Landing radius'), dmg: mul(1.6, 'Damage ×') }, 'King Slime ultimate: Royal Splash'),
    sandLine: obj({ len: pos(240, 'Length'), w: pos(12, 'Half width'), warn: sec(0.8, 'Warning (s)'), dmg: mul(1.2, 'Damage ×') }, 'Sand King: sandstorm line'),
    burrow: obj({ warn: sec(1.0, 'Warning (s)'), r: pos(30, 'Radius'), dmg: mul(1.4, 'Damage ×') }, 'Sand King: burrow and burst out under the player'),
    quicksand: obj({ r: pos(120, 'Pull radius'), core: pos(20, 'Damaging core radius'), dur: sec(3, 'Pull time (s)'), pull: pos(34, 'Pull speed'), dmg: mul(0.6, 'Core damage × per tick'), coins: int(6, 0, 30, 'Fake coins'), coinR: pos(16, 'Coin blast radius'), coinDmg: mul(1.0, 'Coin damage ×') }, 'Sand King ultimate: Quicksand Vault'),
    boneFan: obj({ n: int(5, 1, 20, 'Bones'), spread: n(0.22, 0, 1.5, 'Angle between bones (rad)'), len: pos(170, 'Warning line length'), warn: sec(0.6, 'Warning (s)'), dmg: mul(0.9, 'Damage ×') }, 'Bone King: bone fan'),
    raise: obj({ n: int(5, 1, 20, 'Skeletons'), r: pos(70, 'Ring radius around the player'), warn: sec(0.9, 'Warning (s)') }, 'Bone King: raise skeletons around the player'),
    crypt: obj({ r: pos(62, 'Cage radius'), n: int(14, 6, 40, 'Bone pillars'), gap: int(2, 1, 6, 'Missing pillars (the way out)'), spotR: pos(12, 'Pillar radius'), dmg: mul(1.2, 'Pillar damage ×'), centerR: pos(50, 'Final blast radius'), centerDelay: sec(0.7, 'Final blast after the pillars (s)'), centerDmg: mul(2, 'Final blast damage ×') }, 'Bone King ultimate: Lonely Crypt'),
    iceSpears: obj({ n: int(3, 1, 9, 'Spears'), spread: n(0.3, 0, 1.5, 'Angle between spears (rad)'), len: pos(220, 'Warning line length'), warn: sec(0.7, 'Warning (s)'), dmg: mul(1.1, 'Damage ×') }, 'Frost King: three ice spears'),
    iceFloor: obj({ r: pos(70, 'Radius'), warn: sec(0.8, 'Warning (s)'), dur: sec(5, 'Lasts (s)'), slip: n(2.5, 0.2, 20, 'Grip on ice (higher = less slippery)') }, 'Frost King: slippery ice floor'),
    throne: obj({ spots: int(3, 1, 6, 'Safe circles'), spotR: pos(24, 'Safe circle radius'), spread: pos(80, 'Safe circles distance from the player'), dmg: mul(2.2, 'Damage × outside a safe circle'), chill: sec(1.5, 'Chill after being caught (s)'), chillSpd: frac(0.5, 'Speed × while chilled') }, 'Frost King ultimate: Absolute Throne'),
    quake: obj({ warn: sec(0.8, 'Warning (s)'), r: pos(130, 'Wave radius'), dur: sec(1.0, 'Wave travel time (s)'), dmg: mul(1.2, 'Damage ×') }, 'Magma King: ground-slam ring wave'),
    lavaDrops: obj({ n: int(8, 1, 30, 'Drops'), r: pos(60, 'Ring radius around the player'), spot: pos(16, 'Drop radius'), warn: sec(0.9, 'Warning (s)'), gap: sec(0.08, 'Between drops (s)'), dmg: mul(1.1, 'Damage ×') }, 'Magma King: lava drops in a ring'),
    eruption: obj({ waves: int(3, 1, 8, 'Waves'), n: int(12, 1, 40, 'Circles per wave'), spot: pos(22, 'Circle radius'), gap: sec(0.7, 'Between waves (s)'), dmg: mul(1.3, 'Damage ×') }, 'Magma King ultimate: ERUPTION!!'),
    spit: obj({ r: pos(110, 'Cone length'), spread: n(0.45, 0.1, 1.5, 'Half angle (rad)'), warn: sec(0.8, 'Warning (s)'), dur: sec(0.6, 'Spray time (s)'), dmg: mul(0.5, 'Damage × per tick') }, 'Bog Queen: poison spit cone'),
    frogs: obj({ n: int(4, 1, 20, 'Frogs'), r: pos(60, 'Ring radius around the player'), warn: sec(0.9, 'Warning (s)') }, 'Bog Queen: call poison frogs'),
    gossip: obj({ spotR: pos(38, 'Safe pool radius'), dmg: mul(2, 'Damage × outside the safe pool') }, 'Bog Queen ultimate: Gossip Swamp'),
    trail: obj({ n: int(5, 1, 12, 'Strikes'), r: pos(18, 'Strike radius'), warn: sec(0.7, 'First warning (s)'), gap: sec(0.22, 'Between strikes (s)'), lead: pos(0.35, 'How far ahead it aims (s of movement)'), dmg: mul(1.1, 'Damage ×') }, 'Storm King: lightning on your footsteps'),
    swoop: obj({ len: pos(200, 'Length'), w: pos(12, 'Half width'), warn: sec(0.8, 'Warning (s)'), dmg: mul(1.3, 'Damage ×') }, 'Storm King: straight swoop'),
    grid: obj({ step: pos(44, 'Grid spacing'), r: pos(18, 'Strike radius'), gap: sec(0.9, 'Second half after (s)'), dmg: mul(1.4, 'Damage ×') }, 'Storm King ultimate: Look, I Can Fly!'),
    tideWave: obj({ r: pos(120, 'Cone length'), spread: n(0.55, 0.1, 1.5, 'Half angle (rad)'), warn: sec(0.8, 'Warning (s)'), dur: sec(0.4, 'Wave time (s)'), dmg: mul(0.7, 'Damage × per tick') }, 'Tide Queen: pushing wave cone'),
    bubbles: obj({ n: int(5, 1, 20, 'Bubbles'), spread: n(0.3, 0, 1.5, 'Angle between bubbles (rad)'), speed: pos(55, 'Bubble speed'), warn: sec(0.6, 'Warning (s)'), dmg: mul(1, 'Damage ×') }, 'Tide Queen: slow bubbles'),
    siren: obj({ r: pos(140, 'Pull radius'), core: pos(22, 'Core radius'), dur: sec(2.2, 'Pull time (s)'), pull: pos(30, 'Pull speed'), dmg: mul(0.5, 'Core damage × per tick'), wave: pos(150, 'Wave radius'), waveDur: sec(1.2, 'Wave travel time (s)'), waveDmg: mul(1.5, 'Wave damage ×') }, 'Tide Queen ultimate: Siren Song'),
    laser: obj({ len: pos(260, 'Length'), w: pos(8, 'Half width'), warn: sec(0.8, 'Warning (s)'), dmg: mul(1.3, 'Damage ×') }, 'Golem King: straight laser'),
    turrets: obj({ n: int(2, 1, 8, 'Turrets'), r: pos(50, 'Distance from the King'), warn: sec(0.9, 'Warning (s)') }, 'Golem King: deploy turrets'),
    purge: obj({ n: int(12, 3, 36, 'Laser positions in the sweep'), step: sec(0.16, 'Time between positions (s)'), len: pos(240, 'Length'), w: pos(9, 'Half width'), dmg: mul(1.4, 'Damage ×') }, 'Golem King ultimate: PROTOCOL: PURGE'),
    soulSpiral: obj({ n: int(10, 3, 40, 'Soul bolts'), speed: pos(80, 'Bolt speed'), warn: sec(0.6, 'Warning (s)'), gap: sec(0.05, 'Between bolts (s)'), dmg: mul(0.9, 'Damage ×') }, 'Lich Queen: soul spiral'),
    swap: obj({ warn: sec(0.8, 'Warning (s)'), r: pos(26, 'Arrival blast radius'), dmg: mul(1.1, 'Damage ×') }, 'Lich Queen: swap places with a monster'),
    requiem: obj({ n: int(12, 3, 40, 'Books around you'), r: pos(120, 'Circle radius'), speed: pos(95, 'Page speed'), gap: sec(0.06, 'Between books (s)'), dmg: mul(1.1, 'Damage ×') }, 'Lich Queen ultimate: Requiem'),
  }, 'King moves: two telegraphed moves, ultimate below phaseAt HP'),
  rival: obj({
    hp: pos(1400, 'HP at stage 1'), hpGrowth: mul(1.5, 'HP × per stage'), life: sec(35, 'Seconds before it escapes'), skills: int(3, 1, 5, 'Skills it uses (of 5)'),
    gold: pos(40, 'Gold for defeating it'), cloneChance: frac(0.35, 'Chance to get the clone outright'), shards: int(3, 1, 10, 'Shards for a guaranteed clone'),
    keepFar: pos(90, 'Approach when farther than this'), keepNear: pos(60, 'Back off when nearer than this'), slow: frac(0.6, 'Speed kept while slowed'), frozen: frac(0.3, 'Speed kept while frozen'),
    lvEvery: int(2, 1, 20, 'Stages per rival skill level'),
    bolt: obj({ cd: pos(1.9, 'Interval (s)'), cdPerLv: pos(0.1, 'Interval − per level'), cdMin: pos(0.9, 'Interval minimum'), speed: pos(110, 'Shot speed'), dmg: mul(0.6, 'Damage ×'), spread: n(0.25, 0, 3, 'Fan spread (rad)') }, 'Rival bolt'),
    lance: obj({ cd: pos(3.2, 'Interval (s)'), cdPerLv: pos(0.15, 'Interval − per level'), cdMin: pos(1.6, 'Interval minimum'), len: pos(220, 'Warning length'), warn: sec(0.5, 'Warning (s)'), dmg: mul(1, 'Damage ×'), speed: pos(260, 'Lance speed') }, 'Rival lance'),
    nova: obj({ cd: pos(4, 'Interval (s)'), cdPerLv: pos(0.2, 'Interval − per level'), cdMin: pos(2, 'Interval minimum'), range: pos(110, 'Only when the player is this close'), r: pos(80, 'Ring radius'), rPerLv: pos(8, 'Ring radius per level'), dur: sec(0.7, 'Ring expansion (s)') }, 'Rival nova'),
    meteor: obj({ cd: pos(4.6, 'Interval (s)'), cdPerLv: pos(0.2, 'Interval − per level'), cdMin: pos(2.6, 'Interval minimum'), r: pos(16, 'Blast radius'), warn: sec(1, 'Warning (s)'), dmg: mul(1.2, 'Damage ×') }, 'Rival meteor'),
    zap: obj({ cd: pos(3, 'Interval (s)'), cdPerLv: pos(0.15, 'Interval − per level'), cdMin: pos(1.4, 'Interval minimum'), r: pos(10, 'Strike radius'), warn: sec(0.5, 'Warning (s)'), dmg: mul(0.9, 'Damage ×') }, 'Rival lightning'),
  }, 'Shadow Rival'),
  caster: obj({
    on: int(0, 0, 1, 'Normal monsters shoot (1) or just walk (0); King-summoned turrets always shoot'),
    far: pos(130, 'Approach when farther than this'), near: pos(90, 'Back off when nearer than this'), strafe: frac(0.6, 'Strafe speed ×'),
    fireRange: pos(210, 'Shooting range'), firstMin: sec(1, 'First shot min (s)'), firstMax: sec(2.5, 'First shot max (s)'), cdMin: sec(2.3, 'Shot interval min (s)'), cdMax: sec(3, 'Shot interval max (s)'),
    projSpeed: pos(95, 'Projectile speed'), projLife: sec(2.6, 'Projectile life (s)'), slow: frac(0.5, 'Speed kept while slowed'),
  }, 'Eye Caster'),
  charger: obj({
    on: int(0, 0, 1, 'Normal monsters charge (1) or just walk (0)'),
    range: pos(150, 'Charge trigger range'), warn: sec(0.6, 'Telegraph time (s)'), dash: sec(0.5, 'Dash time (s)'), speed: pos(230, 'Dash speed'), dmgMul: mul(1.5, 'Dash contact damage ×'),
    firstMin: sec(1.5, 'First charge min (s)'), firstMax: sec(3, 'First charge max (s)'), cdMin: sec(2.5, 'Charge interval min (s)'), cdMax: sec(3.5, 'Charge interval max (s)'), slow: frac(0.5, 'Speed kept while slowed'),
  }, 'Wild Boar'),
  hop: obj({ every: sec(1.1, 'Seconds between hops'), time: sec(0.28, 'Hop length (s)'), speed: pos(150, 'Hop speed') }, 'Poison frog hops'),
  leech: obj({ heal: frac(1, 'HP the Giant leech regains × the damage it deals') }, 'Giant leech'),
  splitter: obj({ minis: int(3, 0, 20, 'Minis on death'), spread: pos(10, 'Spawn spread'), push: pos(80, 'Push speed') }, 'Split Slime'),
  pet: obj({
    breathCd: pos(1.3, 'Breath interval (s)'), breathCdPerLv: pos(0.1, 'Breath interval − per pet level'), breathCdMin: pos(0.6, 'Breath interval minimum'),
    breathRange: pos(100, 'Breath targeting range'), breathR: pos(70, 'Breath length'), breathRPerLv: pos(6, 'Breath length per pet level'),
    breathDmg: pos(25, 'Breath damage base'), breathDmgPerLv: pos(8, 'Breath damage per player level'),
    dive: pos(5, 'Dive interval (s)'), divePerLv: pos(0.4, 'Dive interval − per pet level'), diveMin: pos(2.5, 'Dive interval minimum'),
    diveDmg: pos(120, 'Dive damage base'), diveDmgPerLv: pos(25, 'Dive damage per player level'), diveR: pos(26, 'Dive radius'),
    perPetLv: mul(0.4, 'Damage + per pet level'),
  }, 'Companion: Inferno (breath; dive bomb from level 3)'),
  companion: obj({
    maxLv: int(5, 1, 10, 'Max Companion level'), secondAt: int(3, 1, 10, 'Second move from this level'), growAt: int(5, 1, 10, 'Grown form at this level'),
    growMul: mul(1.5, 'Grown form: main move size ×'),
    spCost: int(2, 0, 10, 'Skill Points for +1 Companion level'), again: int(2, 0, 5, 'Levels for defeating the same Guardian again'),
    wLevel: mul(0.9, 'Level-up offer weight: Companion grows stronger'),
    stored: int(2, 0, 5, 'Stored Companions (besides the active one)'),
    frost: obj({ breathCd: sec(1.5, 'Ice breath interval (s)'), breathR: pos(65, 'Ice breath length'), breathDmg: pos(18, 'Damage base'), breathDmgPerLv: pos(6, 'Damage per player level'), chill: int(2, 1, 10, 'Frost stacks per breath'),
      wallCd: sec(6, 'Ice wall interval (s)'), wallLen: pos(70, 'Ice wall length'), wallDur: sec(3, 'Ice wall lasts (s)'), wallDmg: pos(30, 'Ice wall damage per touch') }, 'Companion: Frost'),
    storm: obj({ strikeCd: sec(1.4, 'Lightning strike interval (s)'), strikeDmg: pos(40, 'Damage base'), strikeDmgPerLv: pos(12, 'Damage per player level'), strikeR: pos(16, 'Strike radius'),
      chainCd: sec(4, 'Chain lightning interval (s)'), chainDmg: pos(30, 'Chain damage base'), jumps: int(4, 1, 20, 'Chain jumps') }, 'Companion: Storm'),
    tri: obj({ breathCd: sec(1.2, 'Tri-Breath interval (s)'), breathR: pos(80, 'Tri-Breath length'), breathDmg: pos(30, 'Tri-Breath damage base per element'), breathDmgPerLv: pos(9, 'Damage per player level') }, 'Three-headed Dragon'),
  }, 'Companions'),
  clone: obj({ dmg: frac(0.35, 'Clone damage fraction'), dmgPerLv: frac(0.08, 'Clone damage + per clone level'), dmgMax: frac(0.6, 'Clone damage fraction cap') }, 'Shadow Clone'),
  score: obj({
    chapter: pos(1000, 'Per Chapter cleared × Chapter number'),
    king: pos(500, 'Per King killed × Chapter number'),
    kill: pos(1, 'Per monster'),
    combo: pos(5, 'Per elemental Combo'),
    victory: pos(20000, 'Beating Umbra'),
    fastBase: pos(1500, 'Fast finish: seconds budget'),
    fastMul: pos(10, 'Fast finish: points per second under the budget'),
    escape: pos(3000, 'Minus per King that escaped'),
    revivePenalty: frac(0.15, 'Share of the Score lost when buying a revive'),
  }, 'Arcade Score'),
  antiCheat: obj({
    minTimeFactor: frac(0.9, 'Real play time needed ≥ this × the length of the Stages cleared'),
    goldBase: pos(1500, 'Gold ceiling for Chapter 1 (per Run)'),
    goldGrowth: n(1.35, 1, 5, 'Gold ceiling × per extra Chapter'),
    killsPerSecond: pos(15, 'Kill ceiling per second of real play'),
    killsPerChapter: pos(500, 'Extra kills allowed per Chapter reached'),
    coopKillsPerMate: n(0, 0, 3, 'Co-op: kill ceiling × (1 + this × each other player in the room); the team kill counter is shared'),
    coopGoldPerMate: n(0, 0, 3, 'Co-op: Gold ceiling × (1 + this × each other player in the room)'),
    maxSubmitsPerHour: int(30, 1, 1000, 'Run submissions per player per hour'),
    minSecondsBetweenStarts: sec(5, 'Minimum seconds between two start_run calls'),
    legacyGoldCap: pos(50000, 'Most Gold a one-time legacy save upload may bring'),
  }, 'Anti-cheat tier 0 (server checks)'),
  skills,
  passives,
  difficulty,
});

const enemy = (hp: number, spd: number, dmg: number, xp: number, r: number, name: string) =>
  obj({ hp: pos(hp, 'HP at stage 1'), spd: pos(spd, 'Speed'), dmg: pos(dmg, 'Contact damage'), xp: pos(xp, 'XP'), r: pos(r, 'Hit radius') }, name);

const lumora = obj({
  enemies: obj({
    slime: enemy(22, 24, 7, 1, 6, 'Slime'), bat: enemy(13, 44, 5, 1, 5, 'Bat'), ghost: enemy(38, 32, 9, 2, 6, 'Ghost'), mush: enemy(80, 19, 13, 3, 7, 'Mushroom'),
    boss: enemy(2200, 27, 22, 80, 16, 'King Slime'), sslime: enemy(26, 26, 8, 1, 6, 'Sand slime'), scorp: enemy(20, 46, 7, 1, 6, 'Scorpion'), mummy: enemy(70, 20, 12, 3, 7, 'Mummy'),
    skel: enemy(40, 34, 10, 2, 6, 'Skeleton'), islime: enemy(30, 24, 9, 1, 6, 'Ice slime'), ibat: enemy(18, 48, 7, 1, 5, 'Ice bat'), snowman: enemy(90, 18, 14, 3, 7, 'Snowman'),
    bossD: enemy(2200, 30, 22, 80, 16, 'Sand King'), bossC: enemy(2200, 27, 22, 80, 16, 'Bone King'), bossS: enemy(2200, 25, 22, 80, 16, 'Frost King'),
    dragon: enemy(6000, 44, 26, 200, 20, 'Inferno Dragon'), frostDragon: enemy(6000, 40, 24, 200, 20, 'Frost Dragon'), stormDragon: enemy(5500, 50, 22, 200, 20, 'Storm Dragon'), whelp: enemy(28, 66, 9, 2, 5, 'Whelp'), rival: enemy(1400, 56, 16, 60, 7, 'Shadow Rival'),
    umbra: enemy(9000, 30, 30, 300, 18, 'Umbra (placeholder)'),
    caster: enemy(32, 30, 8, 2, 6, 'Eye Caster'), charger: enemy(55, 28, 12, 2, 7, 'Wild Boar'), splitter: enemy(70, 22, 10, 3, 10, 'Split Slime'), mini: enemy(12, 50, 5, 1, 5, 'Mini slime'),
    archer: enemy(34, 30, 9, 2, 6, 'Skeleton Archer'),
    fbat: enemy(16, 50, 7, 1, 5, 'Fire bat'), sala: enemy(28, 52, 9, 2, 6, 'Salamander'), lavarock: enemy(110, 16, 16, 3, 8, 'Lava rock'), bossE: enemy(2300, 24, 24, 80, 15, 'Magma King'),
    frog: enemy(30, 30, 9, 1, 6, 'Poison frog'), spore: enemy(60, 20, 10, 2, 7, 'Spore cap'), sporelet: enemy(12, 42, 5, 1, 4, 'Sporelet'), leech: enemy(95, 18, 12, 3, 8, 'Giant leech'), bossM: enemy(2200, 26, 22, 80, 15, 'Bog Queen'),
    cloud: enemy(22, 30, 7, 1, 6, 'Cloud wisp'), sbird: enemy(16, 58, 7, 1, 5, 'Storm bird'), griffin: enemy(70, 30, 13, 3, 7, 'Griffin chick'), bossK: enemy(2100, 32, 22, 80, 15, 'Storm King'),
    jelly: enemy(24, 22, 8, 1, 6, 'Jellyfish'), sawfish: enemy(50, 30, 12, 2, 7, 'Sawfish'), crab: enemy(120, 16, 15, 3, 8, 'Armor crab'), bossT: enemy(2300, 26, 22, 80, 15, 'Tide Queen'),
    spider: enemy(18, 52, 7, 1, 5, 'Iron spider'), turret: enemy(60, 1, 10, 2, 7, 'Turret'), mech: enemy(120, 18, 15, 3, 8, 'Clockwork soldier'), bossG: enemy(2500, 22, 24, 80, 15, 'Golem King'),
    book: enemy(26, 34, 8, 2, 6, 'Flying tome'), lantern: enemy(34, 30, 9, 2, 6, 'Lantern ghost'), harmor: enemy(100, 20, 14, 3, 8, 'Haunted armor'), bossL: enemy(2200, 28, 22, 80, 15, 'Lich Queen'),
  }, 'Enemy base stats'),
}, 'World Lumora');

/**
 * shared: rules for every World. worlds.<id>: World content numbers.
 * Resolving a World = shared ∪ worlds[id] (see resolveConfig).
 */
export const BalanceConfigSchema = z.object({
  version: z.number().int().min(0).default(0).describe('Published version (0 = built-in defaults)'),
  shared,
  worlds: obj({ lumora }),
});

export type BalanceConfig = z.infer<typeof BalanceConfigSchema>;
export type BalanceConfigInput = z.input<typeof BalanceConfigSchema>;
export type SharedConfig = BalanceConfig['shared'];
export type WorldId = keyof BalanceConfig['worlds'];
export type WorldConfig = BalanceConfig['worlds'][WorldId];
/** What the sim reads: shared rules plus one World's content. */
export type ResolvedConfig = SharedConfig & WorldConfig & { version: number; world: WorldId };
