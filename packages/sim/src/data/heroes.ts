import { NECRO_SKILLS, SKILL_IDS, type LineId, type SkillId } from './skills';

export const HERO_IDS = ['mage', 'knight', 'ranger', 'alchemist', 'necromancer'] as const;
export type HeroId = (typeof HERO_IDS)[number];

/** Signature Skill per Hero (the starting skill); prices and bonuses live in the Balance Config (shared.heroes). */
export const HEROES: Record<HeroId, { start: SkillId; name: string }> = {
  mage: { start: 'sigil', name: 'Lyra' },
  knight: { start: 'shield', name: 'Bram' },
  ranger: { start: 'hawk', name: 'Kit' },
  alchemist: { start: 'flask', name: 'Vex' },
  necromancer: { start: 'soulRise', name: 'Mora' },
};

export const isHero = (k: unknown): k is HeroId => typeof k === 'string' && (HERO_IDS as readonly string[]).includes(k);

/** Heroes the shop offers only after the account has won a Run (Mora, ticket 57). */
export const AFTER_WIN: readonly HeroId[] = ['necromancer'];

/** Skill Lines: the three general Skills that count as Links for each Hero (Awakening, ticket 24). */
export const SKILL_LINES: Record<HeroId, [SkillId, SkillId, SkillId]> = {
  mage: ['bolt', 'chain', 'hole'],
  knight: ['orbit', 'lance', 'nova'],
  ranger: ['boomer', 'cyclone', 'meteor'],
  alchemist: ['toxic', 'frost', 'laser'],
  necromancer: ['soulDrain', 'bonePrison', 'wailSkull'],
};

/** The Signature Skill. Never leaves its slot. */
export const signatureOf = (h: HeroId): SkillId => HEROES[h].start;

/** General Skills this Hero can be offered: Mora's three Links go to the other Heroes only with `heroes.necromancer.pool` 1. */
export const generalSkills = (h: HeroId, pool: number): readonly SkillId[] =>
  pool || h === 'necromancer' ? SKILL_IDS : SKILL_IDS.filter((id) => !NECRO_SKILLS.includes(id));

/** Awakened form and its three Skill Line skills (the first one listed last is the survival skill). */
export const AWAKENING: Record<HeroId, { form: string; line: [LineId, LineId, LineId] }> = {
  mage: { form: 'archmage', line: ['manaNova', 'timeWarp', 'starfall'] },
  knight: { form: 'paladin', line: ['sacredBlades', 'judgePillar', 'aegisDome'] },
  ranger: { form: 'stormhunter', line: ['arrowRain', 'galeStep', 'thunderHawk'] },
  alchemist: { form: 'grandAlchemist', line: ['cauldron', 'transmute', 'elixirRain'] },
  necromancer: { form: 'lich', line: ['boneSpear', 'soulfire', 'boneWard'] },
};
