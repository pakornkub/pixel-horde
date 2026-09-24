import type { SkillId } from './skills';

export const HERO_IDS = ['mage', 'knight', 'ranger', 'alchemist'] as const;
export type HeroId = (typeof HERO_IDS)[number];

/** Signature Skill per Hero (the starting skill); prices and bonuses live in the Balance Config (shared.heroes). */
export const HEROES: Record<HeroId, { start: SkillId; name: string }> = {
  mage: { start: 'sigil', name: 'Lyra' },
  knight: { start: 'shield', name: 'Bram' },
  ranger: { start: 'hawk', name: 'Kit' },
  alchemist: { start: 'flask', name: 'Vex' },
};

export const isHero = (k: unknown): k is HeroId => typeof k === 'string' && (HERO_IDS as readonly string[]).includes(k);

/** Skill Lines: the three general Skills that count as Links for each Hero (Awakening, ticket 24). */
export const SKILL_LINES: Record<HeroId, [SkillId, SkillId, SkillId]> = {
  mage: ['bolt', 'chain', 'hole'],
  knight: ['orbit', 'lance', 'nova'],
  ranger: ['boomer', 'cyclone', 'meteor'],
  alchemist: ['toxic', 'frost', 'laser'],
};

/** The Signature Skill. Never leaves its slot. */
export const signatureOf = (h: HeroId): SkillId => HEROES[h].start;
