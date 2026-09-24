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

const shared = obj({
  maxAttackSlots: int(6, 1, 12, 'Attack skills a player can own'),
  stage: obj({
    durBase: sec(60, 'Stage 1 length (s)'), durPerStage: sec(20, 'Extra seconds per stage'), durMax: sec(150, 'Longest stage (s)'),
    bossAt: frac(0.55, 'Boss appears at this fraction of the stage'), bossHpGrowth: mul(1.25, 'Extra boss HP multiplier per stage'),
    clearHeal: frac(0.4, 'HP healed when starting the next stage'), clearDelay: sec(1.5, 'Pause between clear and the results screen (s)'),
    reviveHp: frac(0.5, 'HP of a downed player at the next stage'),
  }, 'Stage flow'),
  spawn: obj({
    base: pos(1.4, 'Spawns/s at stage start'), prog: pos(3.4, 'Extra spawns/s at stage end'), stageGrowth: frac(0.35, 'Spawn rate growth per stage'),
    perMate: mul(0.6, 'Spawn multiplier per extra living player'), cap: int(320, 10, 2000, 'Enemy cap'),
    eliteChance: frac(0.012, 'Elite chance per stage'),
    swarmFirst: sec(16, 'First swarm ring (s)'), swarmEvery: sec(18, 'Swarm ring interval (s)'), swarmEveryBloodMoon: sec(10, 'Swarm interval in Blood Moon (s)'),
    swarmBase: int(16, 0, 500, 'Enemies per swarm ring'), swarmPerStage: int(6, 0, 100, 'Extra ring enemies per stage'), swarmCap: int(340, 10, 2000, 'Enemy cap during swarm'),
    edge: pos(14, 'Spawn distance beyond the view edge'), ringEdge: pos(10, 'Swarm ring distance beyond the view edge'), despawn: mul(0.95, 'Recycle distance (× view diagonal)'),
  }, 'Spawner'),
  scaling: obj({
    hpGrowth: mul(1.5, 'Enemy HP × per stage'), hpProg: mul(0.7, 'Enemy HP + at stage end'), hpPerLv: frac(0.08, 'Enemy HP + per player level'),
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
  }, 'Director (adaptive pressure)'),
  player: obj({
    hp: pos(100, 'Base max HP'), spd: pos(62, 'Base speed'), pick: pos(26, 'Base pickup range'), crit: frac(0.08, 'Base crit chance'), critMul: mul(2, 'Base crit multiplier'),
    critCap: frac(0.5, 'Crit chance cap'), cdCap: frac(0.4, 'Cooldown reduction cap'), inv: sec(0.6, 'Invulnerability after a hit (s)'), contact: pos(5, 'Player hit radius'),
    dmgVariance: frac(0.12, 'Skill damage random ±'), kb: pos(40, 'Default knockback'), kbBoss: frac(0.1, 'Knockback × on bosses'), kbElite: frac(0.4, 'Knockback × on elites'),
    kbDecay: n(0.02, 0.0001, 1, 'Knockback left after 1 s'),
  }, 'Player'),
  xp: obj({ base: pos(5, 'XP to level: constant'), perLv: pos(4, 'XP to level: × level'), quad: pos(0.5, 'XP to level: × level²'), lateFrom: int(8, 0, 99, 'Late curve starts after level'), lateQuad: pos(1.4, 'Late curve: × (level − start)²') }, 'Level curve'),
  levelup: obj({ offers: int(3, 1, 6, 'Choices per level-up'), wUpgrade: mul(1.3, 'Weight: upgrade an owned skill'), wNew: mul(1.1, 'Weight: new skill'), wPassive: mul(0.8, 'Weight: passive') }, 'Level-up offers'),
  ult: obj({
    max: pos(80, 'Charge needed'), perKill: pos(1, 'Charge per kill'), perElite: pos(5, 'Charge per elite kill'), perBoss: pos(40, 'Charge per boss kill'),
    dmgBase: pos(160, 'Damage base'), dmgPerLv: pos(45, 'Damage per player level'), dmgGrowth: mul(1.45, 'Damage × per stage'),
    slow: sec(0.55, 'Slow-motion time (s)'), delay: sec(0.3, 'Strike delay (s)'), kb: pos(120, 'Knockback'),
  }, 'Ultimate (Judgement)'),
  streak: obj({ window: sec(2.2, 'Seconds between kills to keep the Kill Streak') }, 'Kill Streak'),
  loot: obj({
    coinChance: frac(0.08, 'Coin drop chance'), coin: pos(1, 'Coin value'), eliteCoin: pos(5, 'Elite coin value'), bossCoin: pos(50, 'Boss coin value'),
    heartChance: frac(0.012, 'Heart drop chance'), heartSmall: frac(0.3, 'Small heart heal (× max HP)'), heartBig: frac(0.5, 'Boss heart heal (× max HP)'),
    chestGold: pos(20, 'Gold when picking up a chest'), gemCap: int(380, 10, 5000, 'Gems on the ground before merging'),
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
    mage: obj({ cost: pos(0, 'Unlock price'), dmg: frac(0.15, 'Damage bonus') }),
    knight: obj({ cost: pos(0, 'Unlock price'), hp: pos(50, 'Max HP bonus'), spd: frac(0.08, 'Speed penalty') }),
    ranger: obj({ cost: pos(150, 'Unlock price'), spd: frac(0.15, 'Speed bonus'), pick: mul(0.3, 'Pickup range bonus') }),
    alchemist: obj({ cost: pos(300, 'Unlock price'), cd: frac(0.1, 'Cooldown reduction'), crit: frac(0.05, 'Crit chance bonus') }),
  }, 'Heroes'),
  secondWind: obj({ hp: frac(0.5, 'HP after revive'), inv: sec(2.5, 'Invulnerability (s)'), r: pos(110, 'Blast radius'), dmg: pos(150, 'Blast damage'), dmgGrowth: mul(1.45, 'Blast × per stage') }, 'Second Wind revive'),
  chest: obj({ p1: frac(0.5, 'Chance of ×1'), p2: frac(0.35, 'Chance of ×2 (rest is ×3)') }, 'Treasure chest wheel'),
  events: obj({
    bloodMoonFrom: int(2, 1, 99, 'First stage with Blood Moon'), bloodMoonChance: frac(0.1, 'Blood Moon chance'), bloodMoonPity: frac(0.06, 'Blood Moon chance + per miss'),
    bloodMoonSpawn: mul(2.3, 'Blood Moon spawn ×'), bloodMoonCoin: mul(2, 'Blood Moon coin ×'),
    dragonFrom: int(3, 1, 99, 'First stage with the dragon'), dragonChance: frac(0.25, 'Dragon chance inside Blood Moon'), dragonPity: frac(0.15, 'Dragon chance + per miss'),
    dragonWarnAt: frac(0.33, 'Dragon omen at stage fraction'), dragonAt: frac(0.42, 'Dragon arrives at stage fraction'),
    rivalChance: frac(0.25, 'Shadow Rival chance on normal stages'), rivalAt: frac(0.25, 'Rival arrives at stage fraction'),
  }, 'Special events'),
  dragon: obj({
    hp: pos(6000, 'HP at stage 1'), hpGrowth: mul(1.5, 'HP × per stage'), firstCd: sec(2, 'First attack delay (s)'), cdMin: sec(1.8, 'Attack interval min (s)'), cdMax: sec(2.6, 'Attack interval max (s)'),
    breathR: pos(100, 'Breath length'), breathArc: n(0.5, 0, 3.2, 'Breath half-angle (rad)'), breathWarn: sec(0.75, 'Breath warning (s)'), breathDur: sec(0.7, 'Breath duration (s)'), breathDmg: mul(0.45, 'Breath damage × per tick'),
    dashLen: pos(190, 'Dash warning length'), dashWarn: sec(0.65, 'Dash warning (s)'), dashTime: sec(0.5, 'Dash time (s)'), dashSpeed: pos(320, 'Dash speed'), dashDmg: mul(1.6, 'Dash contact damage ×'),
    rainCount: int(6, 0, 30, 'Fireballs per rain'), rainR: pos(18, 'Fireball radius'), rainWarn: sec(0.9, 'Fireball warning (s)'), rainDmg: mul(1.1, 'Fireball damage ×'),
    whelps: int(4, 0, 20, 'Whelps per summon'), whelpCap: int(6, 0, 50, 'Summon only below this many whelps'),
    gold: pos(100, 'Gold for taming'),
  }, 'Inferno Dragon'),
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
    far: pos(130, 'Approach when farther than this'), near: pos(90, 'Back off when nearer than this'), strafe: frac(0.6, 'Strafe speed ×'),
    fireRange: pos(210, 'Shooting range'), firstMin: sec(1, 'First shot min (s)'), firstMax: sec(2.5, 'First shot max (s)'), cdMin: sec(2.3, 'Shot interval min (s)'), cdMax: sec(3, 'Shot interval max (s)'),
    projSpeed: pos(95, 'Projectile speed'), projLife: sec(2.6, 'Projectile life (s)'), slow: frac(0.5, 'Speed kept while slowed'),
  }, 'Eye Caster'),
  charger: obj({
    range: pos(150, 'Charge trigger range'), warn: sec(0.6, 'Telegraph time (s)'), dash: sec(0.5, 'Dash time (s)'), speed: pos(230, 'Dash speed'), dmgMul: mul(1.5, 'Dash contact damage ×'),
    firstMin: sec(1.5, 'First charge min (s)'), firstMax: sec(3, 'First charge max (s)'), cdMin: sec(2.5, 'Charge interval min (s)'), cdMax: sec(3.5, 'Charge interval max (s)'), slow: frac(0.5, 'Speed kept while slowed'),
  }, 'Wild Boar'),
  splitter: obj({ minis: int(3, 0, 20, 'Minis on death'), spread: pos(10, 'Spawn spread'), push: pos(80, 'Push speed') }, 'Split Slime'),
  pet: obj({
    breathCd: pos(1.3, 'Breath interval (s)'), breathCdPerLv: pos(0.1, 'Breath interval − per pet level'), breathCdMin: pos(0.6, 'Breath interval minimum'),
    breathRange: pos(100, 'Breath targeting range'), breathR: pos(70, 'Breath length'), breathRPerLv: pos(6, 'Breath length per pet level'),
    breathDmg: pos(25, 'Breath damage base'), breathDmgPerLv: pos(8, 'Breath damage per player level'),
    dive: pos(5, 'Dive interval (s)'), divePerLv: pos(0.4, 'Dive interval − per pet level'), diveMin: pos(2.5, 'Dive interval minimum'),
    diveDmg: pos(120, 'Dive damage base'), diveDmgPerLv: pos(25, 'Dive damage per player level'), diveR: pos(26, 'Dive radius'),
    perPetLv: mul(0.4, 'Damage + per pet level'),
  }, 'Pet dragon'),
  clone: obj({ dmg: frac(0.35, 'Clone damage fraction'), dmgPerLv: frac(0.08, 'Clone damage + per clone level'), dmgMax: frac(0.6, 'Clone damage fraction cap') }, 'Shadow Clone'),
  skills,
  passives,
});

const enemy = (hp: number, spd: number, dmg: number, xp: number, r: number, name: string) =>
  obj({ hp: pos(hp, 'HP at stage 1'), spd: pos(spd, 'Speed'), dmg: pos(dmg, 'Contact damage'), xp: pos(xp, 'XP'), r: pos(r, 'Hit radius') }, name);

const lumora = obj({
  enemies: obj({
    slime: enemy(22, 24, 7, 1, 6, 'Slime'), bat: enemy(13, 44, 5, 1, 5, 'Bat'), ghost: enemy(38, 32, 9, 2, 6, 'Ghost'), mush: enemy(80, 19, 13, 3, 7, 'Mushroom'),
    boss: enemy(2200, 27, 22, 80, 16, 'King Slime'), sslime: enemy(26, 26, 8, 1, 6, 'Sand slime'), scorp: enemy(20, 46, 7, 1, 6, 'Scorpion'), mummy: enemy(70, 20, 12, 3, 7, 'Mummy'),
    skel: enemy(40, 34, 10, 2, 6, 'Skeleton'), islime: enemy(30, 24, 9, 1, 6, 'Ice slime'), ibat: enemy(18, 48, 7, 1, 5, 'Ice bat'), snowman: enemy(90, 18, 14, 3, 7, 'Snowman'),
    bossD: enemy(2200, 30, 22, 80, 16, 'Sand King'), bossC: enemy(2200, 27, 22, 80, 16, 'Bone King'), bossS: enemy(2200, 25, 22, 80, 16, 'Frost King'),
    dragon: enemy(6000, 44, 26, 200, 20, 'Inferno Dragon'), whelp: enemy(28, 66, 9, 2, 5, 'Whelp'), rival: enemy(1400, 56, 16, 60, 7, 'Shadow Rival'),
    caster: enemy(32, 30, 8, 2, 6, 'Eye Caster'), charger: enemy(55, 28, 12, 2, 7, 'Wild Boar'), splitter: enemy(70, 22, 10, 3, 10, 'Split Slime'), mini: enemy(12, 50, 5, 1, 5, 'Mini slime'),
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
