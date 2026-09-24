import type { SkillId } from './skills';

export const HERO_IDS = ['mage', 'knight', 'ranger', 'alchemist'] as const;
export type HeroId = (typeof HERO_IDS)[number];

export const HEROES: Record<HeroId, { start: SkillId; cost: number }> = {
  mage: { start: 'bolt', cost: 0 },
  knight: { start: 'orbit', cost: 0 },
  ranger: { start: 'lance', cost: 150 },
  alchemist: { start: 'toxic', cost: 300 },
};

export const isHero = (k: unknown): k is HeroId => typeof k === 'string' && (HERO_IDS as readonly string[]).includes(k);
