// Difficulty presets (Settings → Difficulty). A preset scales the active Balance Config by a few
// "knobs" instead of replacing numbers, so it keeps working on top of whatever the admin publishes.
// The knobs live in the Balance Config itself (`shared.presets`), so the admin tunes or hides each
// preset from Admin → Balance. Only `balanced` (the published config as is) is ranked.
import type { ResolvedConfig } from './schema';

export const PRESET_IDS = ['relaxed', 'easy', 'balanced', 'challenge', 'hard', 'blitz'] as const;
export type PresetId = (typeof PRESET_IDS)[number];
export const DEFAULT_PRESET: PresetId = 'balanced';
export const isPreset = (v: unknown): v is PresetId => typeof v === 'string' && (PRESET_IDS as readonly string[]).includes(v);

/** Multipliers (1 = unchanged) applied on top of the Balance Config, plus `on` (offered in Settings). */
export type PresetKnobs = ResolvedConfig['presets']['relaxed'];

const ONE: PresetKnobs = { on: 1, mobHp: 1, mobDmg: 1, bossHp: 1, bossDmg: 1, spawn: 1, xp: 1, stage: 1, warn: 1, kingPace: 1, hp: 1, speed: 1, hearts: 1, ultFill: 1, director: 1, gold: 1 };

/** Only the published config as is counts for the leaderboard. */
export const isRanked = (id: PresetId): boolean => id === 'balanced';

/** The knobs of a preset in this config (`balanced` never changes anything). */
export function presetKnobs(cfg: ResolvedConfig, id: PresetId): PresetKnobs {
  return id === 'balanced' ? ONE : { ...ONE, ...cfg.presets?.[id] };
}

/** Presets offered in Settings: Balanced always, the others unless the admin hid them. */
export function offeredPresets(cfg: ResolvedConfig): PresetId[] {
  return PRESET_IDS.filter((id) => id === 'balanced' || presetKnobs(cfg, id).on >= 1);
}

/** The preset a Run actually uses: a hidden one falls back to Balanced. */
export function effectivePreset(cfg: ResolvedConfig, id: PresetId): PresetId {
  return offeredPresets(cfg).includes(id) ? id : 'balanced';
}

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
  const pid = effectivePreset(cfg, id);
  if (pid === 'balanced') return cfg;
  const k = presetKnobs(cfg, pid), c = JSON.parse(JSON.stringify(cfg)) as ResolvedConfig;
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
