// Game facts derived from packages/sim for the website (so the pages follow the game code).
import {
  AWAKENING, COMBO_IDS, EVO_PASSIVE, FLASK_TAGS, HERO_IDS, HOLE_BOOM, LINE_IDS, SIGNATURE_IDS, SKILL_IDS, SKILL_LINES, SKILL_STATUS, SKILL_TAGS,
  comboOf, signatureOf, type ComboId, type HeroId, type HitTag, type SkillId, type StatusId,
} from '@pixel-horde/sim';

export type Kind = 'general' | 'signature' | 'line';
export const ALL: SkillId[] = [...SKILL_IDS, ...SIGNATURE_IDS, ...LINE_IDS];
export const kindOf = (id: SkillId): Kind =>
  (SIGNATURE_IDS as readonly string[]).includes(id) ? 'signature' : (LINE_IDS as readonly string[]).includes(id) ? 'line' : 'general';

/** One way a skill hits: its tag and the Status it leaves. Flasks and Black Hole hit in more than one way. */
export interface Variant { tag: HitTag; status?: StatusId }
export function variants(id: SkillId): Variant[] {
  if (id === 'flask') return Object.values(FLASK_TAGS).map((t) => ({ tag: t, status: t.applies }));
  if (id === 'hole') return [{ tag: SKILL_TAGS.hole, status: 'gathered' }, { tag: HOLE_BOOM, status: 'gathered' }];
  const tag = SKILL_TAGS[id];
  return [{ tag, status: SKILL_STATUS[id] ?? tag.applies }];
}

export const elementsOf = (id: SkillId): string[] => [...new Set(variants(id).map((v) => v.tag.el).filter((e): e is NonNullable<HitTag['el']> => !!e))];
export const statusesOf = (id: SkillId): StatusId[] => [...new Set(variants(id).map((v) => v.status).filter((x): x is StatusId => !!x))];
export const isHeavy = (id: SkillId): boolean => variants(id).some((v) => v.tag.heavy);
export const isSweep = (id: SkillId): boolean => variants(id).some((v) => v.tag.sweep);

/** What a Combo needs from the triggering hit (for explanations). */
export const TRIGGER: Record<ComboId, 'heavy' | 'sweep' | 'fire' | 'lightning' | 'arcane'> = {
  shatter: 'heavy', superconduct: 'lightning', firestorm: 'fire', overload: 'fire', toxicBurst: 'fire', grinder: 'sweep', catalyst: 'arcane',
};
/** The Status a Combo consumes ('any' = Catalyst). */
export const NEEDS: Record<ComboId, StatusId | 'any'> = {
  shatter: 'frozen', superconduct: 'frozen', firestorm: 'gathered', overload: 'shocked', toxicBurst: 'poisoned', grinder: 'gathered', catalyst: 'any',
};
export const COMBO_COL: Record<ComboId, string> = {
  shatter: '#bfe6ff', firestorm: '#ff8a3d', overload: '#fff35c', superconduct: '#8fdcff', toxicBurst: '#b6f24a', grinder: '#d8f3e0', catalyst: '#ff5cf4',
};
export const STATUS_COL: Record<StatusId, string> = { frozen: '#9fd8ff', gathered: '#d8f3e0', burning: '#ff8a3d', shocked: '#fff35c', poisoned: '#b6f24a' };
export const STATUS_IDS: StatusId[] = ['frozen', 'gathered', 'burning', 'shocked', 'poisoned'];
export { COMBO_IDS };

export interface ComboHow { combo: ComboId; from: SkillId; to: SkillId; status: StatusId }
/** Every Combo two different skills make together, either one leaving the Status. */
export function pairCombos(a: SkillId, b: SkillId): ComboHow[] {
  if (a === b) return [];
  const out: ComboHow[] = [];
  for (const [x, y] of [[a, b], [b, a]] as const) {
    for (const vx of variants(x)) {
      if (!vx.status) continue;
      for (const vy of variants(y)) {
        const c = comboOf(vx.status, vy.tag);
        if (c && !out.some((o) => o.combo === c)) out.push({ combo: c, from: x, to: y, status: vx.status });
      }
    }
  }
  return out;
}

/** Skills that can leave a Status / trigger a Combo. */
export const leavers = (st: StatusId): SkillId[] => ALL.filter((id) => statusesOf(id).includes(st));
export function triggers(c: ComboId): SkillId[] {
  const need = TRIGGER[c];
  return ALL.filter((id) => variants(id).some((v) => (need === 'heavy' ? v.tag.heavy : need === 'sweep' ? v.tag.sweep : v.tag.el === need)));
}

/** Which Hero a skill belongs to, and how. */
export function ownerOf(id: SkillId): { hero: HeroId; how: 'sig' | 'link' | 'awaken' }[] {
  const out: { hero: HeroId; how: 'sig' | 'link' | 'awaken' }[] = [];
  for (const h of HERO_IDS) {
    if (signatureOf(h) === id) out.push({ hero: h, how: 'sig' });
    if (SKILL_LINES[h].includes(id)) out.push({ hero: h, how: 'link' });
    if ((AWAKENING[h].line as SkillId[]).includes(id)) out.push({ hero: h, how: 'awaken' });
  }
  return out;
}

export const evoPassive = (id: SkillId) => EVO_PASSIVE[id];
