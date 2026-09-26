// Difficulty presets (Settings → Difficulty). A preset scales the active Balance Config by a few
// "knobs" instead of replacing numbers, so it keeps working on top of whatever the admin publishes.
// Only `balanced` (the published config as is) is ranked; the others are unranked practice/fun.
import type { ResolvedConfig } from './schema';

export const PRESET_IDS = ['relaxed', 'easy', 'balanced', 'challenge', 'hard', 'blitz'] as const;
export type PresetId = (typeof PRESET_IDS)[number];
export const DEFAULT_PRESET: PresetId = 'balanced';
export const isPreset = (v: unknown): v is PresetId => typeof v === 'string' && (PRESET_IDS as readonly string[]).includes(v);

/** Multipliers (1 = unchanged) applied on top of the Balance Config. */
export interface PresetKnobs {
  /** Normal monster HP / contact damage. */
  mobHp: number; mobDmg: number;
  /** Kings, Guardians, Shadow Rival, Umbra: HP / damage of body and moves. */
  bossHp: number; bossDmg: number;
  /** Spawn rate and swarm ring size. */
  spawn: number;
  /** EXP gained (the level curve is divided by this). */
  xp: number;
  /** Stage length (timer, overtime). */
  stage: number;
  /** Warning time of telegraphed boss moves (higher = easier to dodge). */
  warn: number;
  /** Pause between King moves (higher = calmer Kings). */
  kingPace: number;
  /** Player max HP, move speed, heart drop chance. */
  hp: number; speed: number; hearts: number;
  /** Ultimate charge time (lower = more often). */
  ultFill: number;
  /** Director ceiling (how far it may raise the pressure). */
  director: number;
  /** Gold earned in the Run. */
  gold: number;
}

const ONE: PresetKnobs = { mobHp: 1, mobDmg: 1, bossHp: 1, bossDmg: 1, spawn: 1, xp: 1, stage: 1, warn: 1, kingPace: 1, hp: 1, speed: 1, hearts: 1, ultFill: 1, director: 1, gold: 1 };

export interface Preset { id: PresetId; ranked: boolean; knobs: PresetKnobs }

export const PRESETS: Record<PresetId, Preset> = {
  // เพลินๆ: story mode — enjoy the Realms and the builds, deaths are rare
  relaxed: { id: 'relaxed', ranked: false, knobs: { ...ONE, mobHp: 0.6, mobDmg: 0.45, bossHp: 0.55, bossDmg: 0.45, spawn: 0.85, xp: 1.3, warn: 1.4, kingPace: 1.35, hp: 1.3, hearts: 2, ultFill: 0.8, director: 0.75, gold: 0.5 } },
  // ง่าย: forgiving, for learning the Kings
  easy: { id: 'easy', ranked: false, knobs: { ...ONE, mobHp: 0.8, mobDmg: 0.7, bossHp: 0.75, bossDmg: 0.7, spawn: 0.9, xp: 1.15, warn: 1.2, kingPace: 1.15, hp: 1.15, hearts: 1.5, ultFill: 0.9, director: 0.85, gold: 0.75 } },
  // สมดุล: the published Balance Config, unchanged (ranked)
  balanced: { id: 'balanced', ranked: true, knobs: ONE },
  // ท้าทาย: a step up for players who clear Umbra
  challenge: { id: 'challenge', ranked: false, knobs: { ...ONE, mobHp: 1.2, mobDmg: 1.2, bossHp: 1.2, bossDmg: 1.15, spawn: 1.15, warn: 0.9, kingPace: 0.9, hearts: 0.8, gold: 1.15 } },
  // ยาก: punishing — every mistake costs
  hard: { id: 'hard', ranked: false, knobs: { ...ONE, mobHp: 1.45, mobDmg: 1.45, bossHp: 1.4, bossDmg: 1.35, spawn: 1.3, xp: 0.9, warn: 0.8, kingPace: 0.8, hearts: 0.6, ultFill: 1.15, director: 1.1, gold: 1.3 } },
  // เทพไว: short, dense Stages, fast levels and a faster Hero — a quick power fantasy
  blitz: { id: 'blitz', ranked: false, knobs: { ...ONE, stage: 0.6, spawn: 1.6, xp: 1.8, mobHp: 0.9, bossHp: 0.7, speed: 1.15, ultFill: 0.6, gold: 0.8 } },
};

/** Monsters that use the boss knobs (Kings, Guardians, Rival, Umbra). */
const BIG = /^(boss.*|umbra|dragon|frostDragon|stormDragon|rival)$/;

/** Scale every number under `o` whose key matches `re` (telegraph warnings). */
function scaleKeys(o: unknown, re: RegExp, k: number): void {
  if (!o || typeof o !== 'object') return;
  for (const [key, v] of Object.entries(o as Record<string, unknown>)) {
    if (typeof v === 'number' && re.test(key)) (o as Record<string, number>)[key] = v * k;
    else scaleKeys(v, re, k);
  }
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** A new config with the preset's knobs applied (`balanced` returns the config itself). */
export function applyPreset(cfg: ResolvedConfig, id: PresetId): ResolvedConfig {
  const p = PRESETS[id];
  if (!p || p.knobs === ONE) return cfg;
  const k = p.knobs, c = JSON.parse(JSON.stringify(cfg)) as ResolvedConfig;
  for (const [name, e] of Object.entries(c.enemies)) {
    const big = BIG.test(name);
    e.hp *= big ? k.bossHp : k.mobHp;
    e.dmg *= big ? k.bossDmg : k.mobDmg;
  }
  // event bosses take their HP from their own blocks
  c.dragon.hp *= k.bossHp; c.guardians.frost.hp *= k.bossHp; c.guardians.storm.hp *= k.bossHp; c.rival.hp *= k.bossHp;
  c.spawn.base *= k.spawn; c.spawn.prog *= k.spawn;
  c.spawn.swarmBase = Math.round(c.spawn.swarmBase * k.spawn); c.spawn.swarmPerStage = Math.round(c.spawn.swarmPerStage * k.spawn);
  c.xp.base /= k.xp; c.xp.perLv /= k.xp; c.xp.quad /= k.xp; c.xp.lateQuad /= k.xp;
  c.stage.durBase = Math.round(c.stage.durBase * k.stage); c.stage.durPerStage = Math.round(c.stage.durPerStage * k.stage);
  c.stage.durMax = Math.round(c.stage.durMax * k.stage); c.stage.overtime = Math.round(c.stage.overtime * Math.max(k.stage, 1));
  for (const block of [c.kings, c.dragon, c.guardians, c.rival, c.umbra]) scaleKeys(block, /^(warn|ultWarn|.*Warn)$/, k.warn);
  c.kings.cdMin *= k.kingPace; c.kings.cdMax *= k.kingPace; c.kings.ultCd *= k.kingPace;
  c.player.hp = Math.round(c.player.hp * k.hp); c.player.spd *= k.speed;
  c.loot.heartChance = clamp(c.loot.heartChance * k.hearts, 0, 1);
  c.ult.fill *= k.ultFill;
  c.director.max = Math.max(c.director.min, c.director.max * k.director);
  c.loot.coinChance = clamp(c.loot.coinChance * k.gold, 0, 1); c.loot.eliteCoin *= k.gold; c.loot.bossCoin *= k.gold; c.loot.chestGold *= k.gold; c.stage.kingGold *= k.gold; c.rival.gold *= k.gold;
  return c;
}
