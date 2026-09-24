// Lumora's Realms (World content). Difficulty follows the Chapter number; a Realm decides its
// mobs, its King, its traits and the element its mobs resist. `available` = content exists.
import type { EnemyId } from '../../data/enemies';

export const REALM_IDS = ['greenvale', 'sunscar', 'deepdark', 'frostpeak', 'emberforge', 'mirefen', 'skyreach', 'tidehollow', 'gearspire', 'duskhold', 'crater'] as const;
export type RealmId = (typeof REALM_IDS)[number];
export type Element = 'fire' | 'ice' | 'lightning' | 'poison' | 'dark';
export type Trait = 'fast' | 'armored' | 'ranged' | 'split' | 'charge' | 'leech';

export interface Realm {
  id: RealmId;
  /** Visual theme index in the game (tiles, names). */
  theme: number;
  pool: [EnemyId, EnemyId, EnemyId];
  king: EnemyId;
  element: Element | null;
  traits: Trait[];
  available: boolean;
}

export const REALMS: Record<RealmId, Realm> = {
  greenvale: { id: 'greenvale', theme: 0, pool: ['slime', 'bat', 'mush'], king: 'boss', element: null, traits: [], available: true },
  sunscar: { id: 'sunscar', theme: 1, pool: ['sslime', 'scorp', 'mummy'], king: 'bossD', element: null, traits: ['fast', 'armored'], available: true },
  deepdark: { id: 'deepdark', theme: 2, pool: ['bat', 'ghost', 'skel'], king: 'bossC', element: 'dark', traits: ['ranged'], available: true },
  frostpeak: { id: 'frostpeak', theme: 3, pool: ['islime', 'ibat', 'snowman'], king: 'bossS', element: 'ice', traits: ['armored'], available: true },
  // Content for these arrives with tickets 35–38; until then they are never offered.
  emberforge: { id: 'emberforge', theme: 0, pool: ['slime', 'bat', 'mush'], king: 'boss', element: 'fire', traits: ['fast', 'armored'], available: false },
  mirefen: { id: 'mirefen', theme: 0, pool: ['slime', 'bat', 'mush'], king: 'boss', element: 'poison', traits: ['split', 'leech'], available: false },
  skyreach: { id: 'skyreach', theme: 0, pool: ['slime', 'bat', 'mush'], king: 'boss', element: 'lightning', traits: ['fast', 'charge'], available: false },
  tidehollow: { id: 'tidehollow', theme: 0, pool: ['slime', 'bat', 'mush'], king: 'boss', element: 'ice', traits: ['charge', 'armored'], available: false },
  gearspire: { id: 'gearspire', theme: 0, pool: ['slime', 'bat', 'mush'], king: 'boss', element: 'lightning', traits: ['ranged', 'armored'], available: false },
  duskhold: { id: 'duskhold', theme: 0, pool: ['slime', 'bat', 'mush'], king: 'boss', element: 'dark', traits: ['ranged', 'split'], available: false },
  // Chapter 8: shadows of every Realm; placeholder Umbra until ticket 29.
  crater: { id: 'crater', theme: 4, pool: ['skel', 'ghost', 'scorp'], king: 'umbra', element: null, traits: ['ranged', 'fast'], available: true },
};

/** Skills that have the advantage against a trait (shown on the route screen). */
export const TRAIT_ADVICE: Record<Trait, string[]> = {
  fast: ['nova', 'frost', 'orbit', 'cyclone'],
  armored: ['meteor', 'lance', 'hole'],
  ranged: ['lance', 'bolt', 'chain'],
  split: ['nova', 'cyclone', 'toxic'],
  charge: ['frost', 'orbit'],
  leech: ['bolt', 'lance'],
};

/** Realms that can be offered on the route (everything but Greenvale and the Heart Crater). */
export const ROUTE_REALMS: RealmId[] = REALM_IDS.filter((r) => r !== 'greenvale' && r !== 'crater');

export function adviceFor(realm: Realm): string[] {
  const out: string[] = [];
  for (const t of realm.traits) for (const s of TRAIT_ADVICE[t]) if (!out.includes(s)) out.push(s);
  return out.slice(0, 4);
}
