// Meta progression, kept in localStorage (`pixelhorde-meta`, `pixelhorde-best`) as the offline save.
import { HEROES, isHero, SHOP_IDS, type HeroId, type Meta, type ShopId } from '@pixel-horde/sim';

export interface MetaSave {
  gold: number;
  up: Partial<Record<ShopId, number>>;
  owned: HeroId[];
  ch: HeroId;
}

function load(): MetaSave {
  let m: Partial<MetaSave> | null = null;
  try { m = JSON.parse(localStorage.getItem('pixelhorde-meta') || 'null'); } catch { /* ignore */ }
  if (!m || typeof m !== 'object' || !m.up || typeof m.up !== 'object') m = { gold: 0, up: {} };
  const up: Partial<Record<ShopId, number>> = {};
  for (const id of SHOP_IDS) { const v = Number(m.up![id]); if (v > 0) up[id] = Math.floor(v); }
  return {
    gold: Math.max(0, Number(m.gold) || 0),
    up,
    owned: Array.isArray(m.owned) ? m.owned.filter(isHero) : [],
    ch: isHero(m.ch) ? m.ch : 'mage',
  };
}

export const META: MetaSave = load();

export function saveMeta(): void {
  try { localStorage.setItem('pixelhorde-meta', JSON.stringify(META)); } catch { /* ignore */ }
}

export const U = (id: ShopId): number => META.up[id] || 0;
export const ownsHero = (k: HeroId): boolean => HEROES[k].cost === 0 || META.owned.includes(k);
export const simMeta = (): Meta => ({ up: { ...META.up } });

export interface Best { stage: number; kills: number }
export function getBest(): Best | null {
  try { return JSON.parse(localStorage.getItem('pixelhorde-best') || 'null'); } catch { return null; }
}
export function setBest(o: Best): void {
  try { localStorage.setItem('pixelhorde-best', JSON.stringify(o)); } catch { /* ignore */ }
}
