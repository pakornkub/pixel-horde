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

/** Skill Lines: the three general Skills that count as Links for each Hero (Awakening, ticket 24). */
export const SKILL_LINES: Record<HeroId, [SkillId, SkillId, SkillId]> = {
  mage: ['bolt', 'chain', 'hole'],
  knight: ['orbit', 'lance', 'nova'],
  ranger: ['boomer', 'cyclone', 'meteor'],
  alchemist: ['toxic', 'frost', 'laser'],
};

/** The Signature Skill (until ticket 23: the Hero's starting skill). Never leaves its slot. */
export const signatureOf = (h: HeroId): SkillId => HEROES[h].start;
