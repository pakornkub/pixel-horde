import type { ResolvedConfig } from '@pixel-horde/config';
import { ipow } from '../core/fmath';

export const SHOP_IDS = ['power', 'vigor', 'speed', 'greed', 'wisdom', 'revive'] as const;
export type ShopId = (typeof SHOP_IDS)[number];

export const shopMax = (cfg: ResolvedConfig, id: ShopId): number => cfg.shop[id].max;

/** Price of the next level. */
export function shopCost(cfg: ResolvedConfig, id: ShopId, level: number): number {
  return Math.round(cfg.shop[id].base * ipow(cfg.shop.costGrowth, level));
}

/** Chest wheel cells. */
export const WHEEL = [1, 2, 1, 3, 1, 2, 1, 2] as const;
