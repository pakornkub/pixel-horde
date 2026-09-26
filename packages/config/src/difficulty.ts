// Base difficulty (ticket 48): the old "Relaxed" preset became the game itself. One Balance Config group,
// `shared.difficulty`, scales the numbers written in the rest of the config; resolveConfig applies it, so the
// sim, the website and every published version (older ones get the defaults) play the same way.
// All 1 = the numbers exactly as written. Harder play comes from Heart Crack tiers, not from here.
import type { ResolvedConfig } from './schema';

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

/** The config with `difficulty` applied, as a new object (the input is never changed). */
export function applyDifficulty(cfg: ResolvedConfig): ResolvedConfig {
  const k = cfg.difficulty, c = JSON.parse(JSON.stringify(cfg)) as ResolvedConfig;
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
  for (const block of [c.kings, c.dragon, c.guardians, c.rival, c.umbra]) scaleKeys(block, /^(warn|ultWarn|.*Warn)$/, k.warn);
  c.kings.cdMin *= k.kingPace; c.kings.cdMax *= k.kingPace; c.kings.ultCd *= k.kingPace;
  c.player.hp = Math.round(c.player.hp * k.hp);
  c.loot.heartChance = clamp(c.loot.heartChance * k.hearts, 0, 1);
  c.ult.fill *= k.ultFill;
  c.director.max = Math.max(c.director.min, c.director.max * k.director);
  return c;
}
