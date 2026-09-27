// Outfits (ticket 51, owner 2026-09-27): gear bought in the special shop after the first win. Three slots, four element
// sets; each piece has levels 1..outfits.max. The slot decides the stat (hat damage, body max HP, cloak crit); wearing
// all three pieces of one set adds damage against the monsters of its element (Shadow: bosses).
import type { ResolvedConfig } from '@pixel-horde/config';
import { ipow } from '../core/fmath';
import type { Enemy } from '../types';

export const OUTFIT_SETS = ['ember', 'frost', 'storm', 'shadow'] as const;
export type OutfitSet = (typeof OUTFIT_SETS)[number];
export const OUTFIT_SLOTS = ['hat', 'body', 'cloak'] as const;
export type OutfitSlot = (typeof OUTFIT_SLOTS)[number];
/** What a player wears: a set and that piece's level per slot. */
export type OutfitWear = Partial<Record<OutfitSlot, { set: OutfitSet; lv: number }>>;

export const isOutfitSet = (k: unknown): k is OutfitSet => typeof k === 'string' && (OUTFIT_SETS as readonly string[]).includes(k);
export const isOutfitSlot = (k: unknown): k is OutfitSlot => typeof k === 'string' && (OUTFIT_SLOTS as readonly string[]).includes(k);
/** Piece levels live in meta_progress.shop under this key, so account merges keep the higher level. */
export const outfitKey = (set: OutfitSet, slot: OutfitSlot): string => `outfit:${set}:${slot}`;

/** Price of the next level of a piece (level 0 → 1 buys it). */
export function outfitCost(cfg: ResolvedConfig, level: number): number {
  return Math.round(cfg.outfits.base * ipow(cfg.outfits.growth, level));
}

const lvOf = (cfg: ResolvedConfig, wear: OutfitWear | undefined, slot: OutfitSlot): number =>
  Math.max(0, Math.min(cfg.outfits.max, Math.floor(wear?.[slot]?.lv || 0)));

/** The full set worn (all three slots from one set, each at level ≥ 1) and its lowest piece level. */
export function outfitSet(cfg: ResolvedConfig, wear: OutfitWear | undefined): { set: OutfitSet; lv: number } | null {
  const set = wear?.hat?.set;
  if (!set || !isOutfitSet(set)) return null;
  let lv = Infinity;
  for (const slot of OUTFIT_SLOTS) {
    if (wear?.[slot]?.set !== set) return null;
    lv = Math.min(lv, lvOf(cfg, wear, slot));
  }
  return lv >= 1 ? { set, lv } : null;
}

/** Additive bonuses of the worn pieces, plus the set bonus (damage × against its monsters). */
export function outfitStats(cfg: ResolvedConfig, wear: OutfitWear | undefined): { dmg: number; hp: number; crit: number; set: OutfitSet | null; setDmg: number } {
  const O = cfg.outfits, full = outfitSet(cfg, wear);
  return {
    dmg: O.hatDmg * lvOf(cfg, wear, 'hat'),
    hp: O.bodyHp * lvOf(cfg, wear, 'body'),
    crit: O.cloakCrit * lvOf(cfg, wear, 'cloak'),
    set: full ? full.set : null,
    setDmg: full ? O.setBase + O.setPerLv * full.lv : 0,
  };
}

/** Is this monster one the set's bonus applies to? */
export function outfitTarget(set: OutfitSet, e: Enemy): boolean {
  if (set === 'ember') return (e.burn || 0) > 0;
  if (set === 'frost') return e.frz > 0 || (e.chill || 0) > 0;
  if (set === 'storm') return (e.shock || 0) > 0;
  return !!e.boss;
}
