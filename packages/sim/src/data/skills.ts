import type { ResolvedConfig } from '@pixel-horde/config';
// Skill, passive and evolution gameplay data (numbers only; names/descriptions live in the game UI).

export const SKILL_IDS = ['bolt', 'orbit', 'chain', 'nova', 'meteor', 'frost', 'lance', 'boomer', 'cyclone', 'toxic', 'laser', 'hole'] as const;
export type SkillId = (typeof SKILL_IDS)[number];
export const PASSIVE_IDS = ['might', 'haste', 'swift', 'vital', 'magnet', 'crit'] as const;
export type PassiveId = (typeof PASSIVE_IDS)[number];

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

type Lin = { base: number; perLv: number; min?: number; max?: number };
type Step = { base: number; every: number; offset: number };
function lin(c: Lin, lv: number): number {
  let v = c.base + lv * c.perLv;
  if (c.min !== undefined) v = Math.max(c.min, v);
  if (c.max !== undefined) v = Math.min(c.max, v);
  return v;
}
const step = (c: Step, lv: number): number => c.base + Math.floor((lv - c.offset) / c.every);

export const skillMax = (cfg: ResolvedConfig, id: SkillId): number => cfg.skills[id].max;
export const passiveMax = (cfg: ResolvedConfig, id: PassiveId): number => cfg.passives.max[id];

const EMPTY: SkillStats = { dmg: 0, cd: 0, n: 0, r: 0, pierce: 0, jumps: 0, spd: 0, range: 0, dur: 0, len: 0, boom: 0, freeze: false, twin: false };

/** Stats of a skill at a level, optionally evolved (numbers from the Balance Config). */
export function skillStats(cfg: ResolvedConfig, id: SkillId, lv: number, evo: boolean): SkillStats {
  const K = cfg.skills;
  const s: SkillStats = { ...EMPTY };
  switch (id) {
    case 'bolt': { const c = K.bolt; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.n = step(c.n, lv); s.pierce = step(c.pierce, lv); if (evo) { s.n += c.evo.nAdd; s.cd *= c.evo.cdMul; s.pierce += c.evo.pierceAdd; s.dmg *= c.evo.dmgMul; } break; }
    case 'orbit': { const c = K.orbit; s.dmg = lin(c.dmg, lv); s.n = lin(c.n, lv); s.r = lin(c.r, lv); s.spd = lin(c.spd, lv); if (evo) { s.n = c.evo.nSet; s.r *= c.evo.rMul; s.dmg *= c.evo.dmgMul; s.spd *= c.evo.spdMul; } break; }
    case 'chain': { const c = K.chain; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.jumps = lin(c.jumps, lv); if (evo) { s.jumps = Math.round(s.jumps * c.evo.jumpsMul); s.dmg *= c.evo.dmgMul; } break; }
    case 'nova': { const c = K.nova; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.r = lin(c.r, lv); if (evo) { s.dmg *= c.evo.dmgMul; s.r *= c.evo.rMul; s.cd *= c.evo.cdMul; } break; }
    case 'meteor': { const c = K.meteor; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.n = lin(c.n, lv); s.r = lin(c.r, lv); if (evo) { s.n = Math.round(s.n * c.evo.nMul); s.r *= c.evo.rMul; s.dmg *= c.evo.dmgMul; } break; }
    case 'frost': { const c = K.frost; s.dmg = lin(c.dmg, lv); s.r = lin(c.r, lv); if (evo) { s.dmg *= c.evo.dmgMul; s.r *= c.evo.rMul; s.freeze = true; } break; }
    case 'lance': { const c = K.lance; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.n = step(c.n, lv); if (evo) { s.n += c.evo.nAdd; s.dmg *= c.evo.dmgMul; } break; }
    case 'boomer': { const c = K.boomer; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.n = step(c.n, lv); s.range = lin(c.range, lv); if (evo) { s.n *= c.evo.nMul; s.dmg *= c.evo.dmgMul; } break; }
    case 'cyclone': { const c = K.cyclone; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.n = step(c.n, lv); s.r = lin(c.r, lv); s.dur = lin(c.dur, lv); if (evo) { s.r *= c.evo.rMul; s.n += c.evo.nAdd; s.dmg *= c.evo.dmgMul; } break; }
    case 'toxic': { const c = K.toxic; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.n = step(c.n, lv); s.r = lin(c.r, lv); s.dur = lin(c.dur, lv); if (evo) { s.r *= c.evo.rMul; s.dmg *= c.evo.dmgMul; } break; }
    case 'laser': { const c = K.laser; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.len = lin(c.len, lv); s.dur = c.dur; if (evo) { s.twin = true; s.dmg *= c.evo.dmgMul; } break; }
    case 'hole': { const c = K.hole; s.dmg = lin(c.dmg, lv); s.boom = lin(c.boom, lv); s.cd = lin(c.cd, lv); s.r = lin(c.r, lv); if (evo) { s.boom *= c.evo.boomMul; s.r *= c.evo.rMul; } break; }
  }
  if (evo) s.dmg = Math.round(s.dmg);
  return s;
}

/** Element of a hit (Realm resistances; Combo triggers). 'arcane' = Arcane Bolt (Catalyst). */
export type HitElement = 'fire' | 'ice' | 'lightning' | 'poison' | 'dark' | 'arcane';
export type StatusId = 'frozen' | 'gathered' | 'burning' | 'shocked' | 'poisoned';
export type ComboId = 'shatter' | 'firestorm' | 'overload' | 'superconduct' | 'toxicBurst' | 'grinder' | 'catalyst';
export const COMBO_IDS: ComboId[] = ['shatter', 'firestorm', 'overload', 'superconduct', 'toxicBurst', 'grinder', 'catalyst'];

/** What a hit carries: element, heavy (Shatter), sweeper (Grinder), Status it leaves. */
export interface HitTag { el?: HitElement; heavy?: boolean; sweep?: boolean; applies?: 'burning' | 'shocked' | 'poisoned'; combo?: boolean }

export const SKILL_TAGS: Record<SkillId, HitTag> = {
  bolt: { el: 'arcane' },
  orbit: { sweep: true },
  chain: { el: 'lightning', applies: 'shocked' },
  nova: { el: 'fire', applies: 'burning' },
  meteor: { el: 'fire', heavy: true, applies: 'burning' },
  frost: { el: 'ice' },
  lance: { heavy: true },
  boomer: { sweep: true },
  cyclone: { sweep: true },
  toxic: { el: 'poison', applies: 'poisoned' },
  laser: { el: 'lightning', applies: 'shocked' },
  hole: { el: 'dark' },
};
/** Black Hole's collapse is a heavy hit. */
export const HOLE_BOOM: HitTag = { el: 'dark', heavy: true };
/** Pet fire dragon: fire that leaves Burning (counts as the owner's Skill). */
export const PET_FIRE: HitTag = { el: 'fire', applies: 'burning' };
export const PET_DIVE: HitTag = { el: 'fire', heavy: true, applies: 'burning' };
/** Damage dealt by a Combo itself never starts another Combo. */
export const COMBO_HIT: HitTag = { combo: true };

/** Status each Skill leaves on monsters (Frost Aura freezes by stacking; pulls gather). */
export const SKILL_STATUS: Partial<Record<SkillId, StatusId>> = {
  frost: 'frozen', cyclone: 'gathered', hole: 'gathered', nova: 'burning', meteor: 'burning', chain: 'shocked', laser: 'shocked', toxic: 'poisoned',
};

/** The Combo a hit with `tag` starts on a monster carrying `status`, if any (catalyst: any Status). */
export function comboOf(status: StatusId, tag: HitTag): ComboId | null {
  if (tag.heavy && status === 'frozen') return 'shatter';
  if (tag.el === 'lightning' && status === 'frozen') return 'superconduct';
  if (tag.el === 'fire' && status === 'gathered') return 'firestorm';
  if (tag.el === 'fire' && status === 'shocked') return 'overload';
  if (tag.el === 'fire' && status === 'poisoned') return 'toxicBurst';
  if (tag.sweep && status === 'gathered') return 'grinder';
  if (tag.el === 'arcane') return 'catalyst';
  return null;
}

/** Combos two Skills make together (either one leaving the Status, the other triggering). */
export function combosBetween(a: SkillId, b: SkillId): ComboId[] {
  const out: ComboId[] = [];
  const sa = SKILL_STATUS[a], sb = SKILL_STATUS[b];
  const tb = b === 'hole' ? HOLE_BOOM : SKILL_TAGS[b], ta = a === 'hole' ? HOLE_BOOM : SKILL_TAGS[a];
  if (sa) { const c = comboOf(sa, tb); if (c) out.push(c); }
  if (sb) { const c = comboOf(sb, ta); if (c && !out.includes(c)) out.push(c); }
  return out;
}
