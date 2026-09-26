import type { ResolvedConfig } from '@pixel-horde/config';
// Skill, passive and evolution gameplay data (numbers only; names/descriptions live in the game UI).

/** The 12 general Skills any Hero can pick. */
export const SKILL_IDS = ['bolt', 'orbit', 'chain', 'nova', 'meteor', 'frost', 'lance', 'boomer', 'cyclone', 'toxic', 'laser', 'hole'] as const;
/** Signature Skills: one per Hero, in the locked slot, never offered to other Heroes. */
export const SIGNATURE_IDS = ['sigil', 'shield', 'hawk', 'flask'] as const;
export type SignatureId = (typeof SIGNATURE_IDS)[number];
/** Skill Line skills: unlocked by the Hero's Awakening; no Evolution. */
export const LINE_IDS = ['manaNova', 'timeWarp', 'starfall', 'sacredBlades', 'judgePillar', 'aegisDome', 'arrowRain', 'galeStep', 'thunderHawk', 'cauldron', 'transmute', 'elixirRain'] as const;
export type LineId = (typeof LINE_IDS)[number];
export type SkillId = (typeof SKILL_IDS)[number] | SignatureId | LineId;
export const ALL_SKILL_IDS: SkillId[] = [...SKILL_IDS, ...SIGNATURE_IDS, ...LINE_IDS];
export const isLine = (id: SkillId): id is LineId => (LINE_IDS as readonly string[]).includes(id);
export const isSignature = (id: SkillId): id is SignatureId => (SIGNATURE_IDS as readonly string[]).includes(id);
export const PASSIVE_IDS = ['might', 'haste', 'swift', 'vital', 'magnet', 'crit'] as const;
export type PassiveId = (typeof PASSIVE_IDS)[number];

/** Max-level skill + this passive (level >= 1) unlocks the skill's evolution. Line skills have none. */
export const EVO_PASSIVE: Partial<Record<SkillId, PassiveId>> = {
  bolt: 'haste', orbit: 'swift', chain: 'crit', nova: 'might', meteor: 'vital', frost: 'magnet',
  lance: 'crit', boomer: 'magnet', cyclone: 'haste', toxic: 'vital', laser: 'swift', hole: 'might',
  sigil: 'might', shield: 'vital', hawk: 'swift', flask: 'haste',
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
  /** Aegis: blocked projectiles heal, damage taken reduced. */
  absorb: boolean;
  /** Twin Hawks stun. */
  stun: boolean;
  /** Smart Flask picks the element that combos. */
  smart: boolean;
}

type Lin = { base: number; perLv: number; min?: number; max?: number };
type Step = { base: number; every: number; offset: number };
function lin(c: Lin, lv: number): number {
  let v = c.base + lv * c.perLv;
  if (c.min !== undefined) v = Math.max(c.min, v);
  if (c.max !== undefined) v = Math.min(c.max, v);
  return v;
}
/** A level formula from the Balance Config at a level. */
export const linAt = (c: Lin, lv: number): number => lin(c, lv);
const step = (c: Step, lv: number): number => c.base + Math.floor((lv - c.offset) / c.every);

export const skillMax = (cfg: ResolvedConfig, id: SkillId): number => cfg.skills[id].max;
export const passiveMax = (cfg: ResolvedConfig, id: PassiveId): number => cfg.passives.max[id];

const EMPTY: SkillStats = { dmg: 0, cd: 0, n: 0, r: 0, pierce: 0, jumps: 0, spd: 0, range: 0, dur: 0, len: 0, boom: 0, freeze: false, twin: false, absorb: false, stun: false, smart: false };

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
    case 'sigil': { const c = K.sigil; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.r = lin(c.r, lv); s.dur = lin(c.dur, lv); s.n = 1; if (evo) { s.r *= c.evo.rMul; s.n = c.evo.n; } break; }
    case 'shield': { const c = K.shield; s.dmg = lin(c.dmg, lv); s.n = Math.floor(lin(c.n, lv)); s.r = lin(c.r, lv); s.spd = lin(c.spd, lv); if (evo) { s.n = c.evo.n; s.absorb = true; } break; }
    case 'hawk': { const c = K.hawk; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.n = 1; s.range = c.range; s.r = c.r; if (evo) { s.n = c.evo.n; s.stun = true; } break; }
    case 'flask': { const c = K.flask; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.r = lin(c.r, lv); s.n = 1; s.range = c.range; if (evo) { s.n = c.evo.n; s.dmg *= c.evo.dmgMul; s.smart = true; } break; }
    case 'manaNova': { const c = K.manaNova; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.r = lin(c.r, lv); s.dur = c.dur; break; }
    case 'timeWarp': { const c = K.timeWarp; s.dmg = lin(c.dmg, lv); s.r = lin(c.r, lv); break; }
    case 'starfall': { const c = K.starfall; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.n = Math.floor(lin(c.n, lv)); s.r = lin(c.r, lv); break; }
    case 'sacredBlades': { const c = K.sacredBlades; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.r = lin(c.r, lv); s.dur = c.dur; break; }
    case 'judgePillar': { const c = K.judgePillar; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.r = c.r; break; }
    case 'aegisDome': { const c = K.aegisDome; s.cd = lin(c.cd, lv); s.dur = lin(c.dur, lv); s.r = c.r; break; }
    case 'arrowRain': { const c = K.arrowRain; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.r = lin(c.r, lv); s.dur = lin(c.dur, lv); s.range = c.range; break; }
    case 'galeStep': { const c = K.galeStep; s.dmg = lin(c.dmg, lv); s.dur = lin(c.dur, lv); s.r = c.r; break; }
    case 'thunderHawk': { const c = K.thunderHawk; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.jumps = Math.floor(lin(c.jumps, lv)); s.range = c.range; break; }
    case 'cauldron': { const c = K.cauldron; s.dmg = lin(c.dmg, lv); s.cd = lin(c.cd, lv); s.r = lin(c.r, lv); s.dur = lin(c.dur, lv); break; }
    case 'transmute': { const c = K.transmute; s.r = lin(c.r, lv); break; }
    case 'elixirRain': { const c = K.elixirRain; s.cd = lin(c.cd, lv); break; }
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
export interface HitTag { el?: HitElement; heavy?: boolean; sweep?: boolean; applies?: 'burning' | 'shocked' | 'poisoned'; combo?: boolean;
  /** Ultimate: fixed damage (no Might/Power/crit/variance), capped on bosses, starts no Combo. */
  raw?: boolean;
  /** Co-op host: damage a guest already calculated (applied as is). */
  remote?: boolean }

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
  sigil: {},
  shield: { sweep: true },
  hawk: { heavy: true },
  flask: {},
  manaNova: {},
  timeWarp: {},
  starfall: { heavy: true },
  sacredBlades: { heavy: true, sweep: true },
  judgePillar: { heavy: true },
  aegisDome: {},
  arrowRain: {},
  galeStep: { sweep: true },
  thunderHawk: { el: 'lightning', applies: 'shocked' },
  cauldron: {},
  transmute: {},
  elixirRain: {},
};
/** Volatile Flask: the element of each flask decides its tag. */
export const FLASK_TAGS: Record<'fire' | 'ice' | 'poison', HitTag> = {
  fire: { el: 'fire', applies: 'burning' },
  ice: { el: 'ice' },
  poison: { el: 'poison', applies: 'poisoned' },
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

/** Every hit tag a Skill can carry (Black Hole's pull and collapse, each Volatile Flask element). */
export function hitTagsOf(id: SkillId): HitTag[] {
  return id === 'hole' ? [SKILL_TAGS.hole, HOLE_BOOM] : id === 'flask' ? Object.values(FLASK_TAGS) : [SKILL_TAGS[id]];
}
/** Every Status a Skill can leave on monsters. */
export function statusesOf(id: SkillId): StatusId[] {
  const out: StatusId[] = [];
  for (const s of [SKILL_STATUS[id], ...hitTagsOf(id).map((x) => x.applies)]) if (s && !out.includes(s)) out.push(s);
  return out;
}

/** Combos two Skills make together (either one leaving the Status, the other triggering). */
export function combosBetween(a: SkillId, b: SkillId): ComboId[] {
  const out: ComboId[] = [];
  const add = (from: SkillId, by: SkillId): void => {
    for (const s of statusesOf(from)) for (const tag of hitTagsOf(by)) { const c = comboOf(s, tag); if (c && !out.includes(c)) out.push(c); }
  };
  add(a, b); add(b, a);
  return out;
}
