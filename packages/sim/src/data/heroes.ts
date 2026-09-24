import type { SkillId } from './skills';

export const HERO_IDS = ['mage', 'knight', 'ranger', 'alchemist'] as const;
export type HeroId = (typeof HERO_IDS)[number];

/** Starting skill per Hero; prices and bonuses live in the Balance Config (shared.heroes). */
export const HEROES: Record<HeroId, { start: SkillId }> = {
  mage: { start: 'bolt' },
  knight: { start: 'orbit' },
  ranger: { start: 'lance' },
  alchemist: { start: 'toxic' },
};

export const isHero = (k: unknown): k is HeroId => typeof k === 'string' && (HERO_IDS as readonly string[]).includes(k);
