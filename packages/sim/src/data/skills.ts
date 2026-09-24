// Skill, passive and evolution gameplay data (numbers only; names/descriptions live in the game UI).

export const SKILL_IDS = ['bolt', 'orbit', 'chain', 'nova', 'meteor', 'frost', 'lance', 'boomer', 'cyclone', 'toxic', 'laser', 'hole'] as const;
export type SkillId = (typeof SKILL_IDS)[number];
export const PASSIVE_IDS = ['might', 'haste', 'swift', 'vital', 'magnet', 'crit'] as const;
export type PassiveId = (typeof PASSIVE_IDS)[number];

export const SKILL_MAX: Record<SkillId, number> = {
  bolt: 8, orbit: 6, chain: 7, nova: 7, meteor: 7, frost: 6, lance: 7, boomer: 7, cyclone: 6, toxic: 6, laser: 6, hole: 5,
};
export const PASSIVE_MAX: Record<PassiveId, number> = { might: 5, haste: 5, swift: 5, vital: 5, magnet: 4, crit: 5 };

/** Max-level skill + this passive (level >= 1) unlocks the skill's evolution. */
export const EVO_PASSIVE: Record<SkillId, PassiveId> = {
  bolt: 'haste', orbit: 'swift', chain: 'crit', nova: 'might', meteor: 'vital', frost: 'magnet',
  lance: 'crit', boomer: 'magnet', cyclone: 'haste', toxic: 'vital', laser: 'swift', hole: 'might',
};

export interface SkillStats {
  dmg: number;
  cd: number;
  n: number;
  r: number;
  pierce: number;
  jumps: number;
  spd: number;
  range: number;
  dur: number;
  len: number;
  boom: number;
  freeze: boolean;
  twin: boolean;
}

function base(id: SkillId, lv: number): Partial<SkillStats> {
  switch (id) {
    case 'bolt': return { dmg: 16 + lv * 7, cd: Math.max(0.25, 0.85 - lv * 0.07), n: 1 + Math.floor((lv - 1) / 2), pierce: Math.floor(lv / 3) };
    case 'orbit': return { dmg: 10 + lv * 6, n: Math.min(6, lv + 1), r: 30 + lv * 2, spd: 3 + lv * 0.35 };
    case 'chain': return { dmg: 28 + lv * 14, cd: Math.max(0.9, 2.4 - lv * 0.18), jumps: 3 + lv * 2 };
    case 'nova': return { dmg: 30 + lv * 16, cd: Math.max(1.2, 3.4 - lv * 0.25), r: 55 + lv * 10 };
    case 'meteor': return { dmg: 80 + lv * 40, cd: Math.max(1.6, 4.2 - lv * 0.3), n: 2 + lv, r: 20 + lv * 2 };
    case 'frost': return { dmg: 6 + lv * 5, r: 32 + lv * 6 };
    case 'lance': return { dmg: 40 + lv * 18, cd: Math.max(0.6, 1.7 - lv * 0.13), n: 1 + Math.floor(lv / 3) };
    case 'boomer': return { dmg: 22 + lv * 10, cd: Math.max(0.8, 2 - lv * 0.15), n: 1 + Math.floor((lv - 1) / 2), range: 80 + lv * 6 };
    case 'cyclone': return { dmg: 12 + lv * 6, cd: Math.max(2.2, 5 - lv * 0.35), n: 1 + Math.floor(lv / 2), r: 16 + lv * 2, dur: 2.4 + lv * 0.3 };
    case 'toxic': return { dmg: 8 + lv * 5, cd: Math.max(1.5, 3.6 - lv * 0.3), n: 1 + Math.floor(lv / 2), r: 16 + lv * 2, dur: 3 + lv * 0.4 };
    case 'laser': return { dmg: 45 + lv * 20, cd: Math.max(2.6, 6 - lv * 0.5), len: 100 + lv * 12, dur: 0.9 };
    case 'hole': return { dmg: 6 + lv * 3, boom: 140 + lv * 70, cd: Math.max(4.5, 9 - lv * 0.8), r: 45 + lv * 6 };
  }
}

const EMPTY: SkillStats = { dmg: 0, cd: 0, n: 0, r: 0, pierce: 0, jumps: 0, spd: 0, range: 0, dur: 0, len: 0, boom: 0, freeze: false, twin: false };

/** Stats of a skill at a level, optionally evolved. */
export function skillStats(id: SkillId, lv: number, evo: boolean): SkillStats {
  const s: SkillStats = { ...EMPTY, ...base(id, lv) };
  if (!evo) return s;
  switch (id) {
    case 'bolt': s.n += 2; s.cd *= 0.7; s.pierce += 1; s.dmg *= 1.2; break;
    case 'orbit': s.n = 8; s.r *= 1.3; s.dmg *= 1.4; s.spd *= 1.2; break;
    case 'chain': s.jumps = Math.round(s.jumps * 1.6); s.dmg *= 1.5; break;
    case 'nova': s.dmg *= 1.6; s.r *= 1.35; s.cd *= 0.75; break;
    case 'meteor': s.n = Math.round(s.n * 1.6); s.r *= 1.35; s.dmg *= 1.3; break;
    case 'frost': s.dmg *= 1.6; s.r *= 1.3; s.freeze = true; break;
    case 'lance': s.n += 2; s.dmg *= 1.5; break;
    case 'boomer': s.n *= 2; s.dmg *= 1.35; break;
    case 'cyclone': s.r *= 1.4; s.n += 1; s.dmg *= 1.3; break;
    case 'toxic': s.r *= 1.35; s.dmg *= 1.6; break;
    case 'laser': s.twin = true; s.dmg *= 1.35; break;
    case 'hole': s.boom *= 2; s.r *= 1.2; break;
  }
  s.dmg = Math.round(s.dmg);
  return s;
}
