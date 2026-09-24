import { ipow } from '../core/fmath';
export const SHOP_IDS = ['power', 'vigor', 'speed', 'greed', 'wisdom', 'revive'] as const;
export type ShopId = (typeof SHOP_IDS)[number];

export const SHOP: Record<ShopId, { max: number; base: number }> = {
  power: { max: 10, base: 30 },
  vigor: { max: 10, base: 25 },
  speed: { max: 5, base: 40 },
  greed: { max: 5, base: 50 },
  wisdom: { max: 5, base: 50 },
  revive: { max: 1, base: 400 },
};

/** Price of the next level. */
export function shopCost(id: ShopId, level: number): number {
  return Math.round(SHOP[id].base * ipow(1.6, level));
}

/** Chest wheel cells; result weights 1:50% 2:35% 3:15%. */
export const WHEEL = [1, 2, 1, 3, 1, 2, 1, 2] as const;
