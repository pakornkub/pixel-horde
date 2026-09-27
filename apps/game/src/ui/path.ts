// Which level-up cards follow the Hero's own path (the "Recommended" tag on level-up and chest cards).
import { AWAKENING, EVO_PASSIVE, SKILL_LINES, signatureOf, type LevelOption, type SimState, type SkillId } from '@pixel-horde/sim';

/** Cards on the Hero's own path get a "Recommended" tag: the Signature, its Links, its Awakened skills, their
 *  Evolutions, and the passives that evolve the Signature or an owned Link. */
export function onHeroPath(v: Readonly<SimState>, o: LevelOption): boolean {
  const P = v.P, sig = signatureOf(P.ch), links: SkillId[] = SKILL_LINES[P.ch];
  const path = (id: SkillId): boolean => id === sig || links.includes(id) || (AWAKENING[P.ch].line as SkillId[]).includes(id);
  if (o.kind === 'evo' || o.kind === 'skill') return path(o.id);
  if (o.kind !== 'pas') return false;
  const owned = new Set<SkillId>([sig, ...(Object.keys(P.skills) as SkillId[]), ...P.bench.filter((b) => !b.pas).map((b) => b.id as SkillId)]);
  return [sig, ...links].some((id) => owned.has(id) && EVO_PASSIVE[id] === o.id);
}
