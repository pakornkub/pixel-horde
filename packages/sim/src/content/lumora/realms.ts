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
  deepdark: { id: 'deepdark', theme: 2, pool: ['bat', 'archer', 'ghost'], king: 'bossC', element: 'dark', traits: ['ranged'], available: true },
  frostpeak: { id: 'frostpeak', theme: 3, pool: ['islime', 'ibat', 'snowman'], king: 'bossS', element: 'ice', traits: ['armored'], available: true },
  emberforge: { id: 'emberforge', theme: 5, pool: ['fbat', 'sala', 'lavarock'], king: 'bossE', element: 'fire', traits: ['fast', 'armored'], available: true },
  mirefen: { id: 'mirefen', theme: 6, pool: ['frog', 'spore', 'leech'], king: 'bossM', element: 'poison', traits: ['split', 'leech'], available: true },
  skyreach: { id: 'skyreach', theme: 7, pool: ['cloud', 'sbird', 'griffin'], king: 'bossK', element: 'lightning', traits: ['fast', 'charge'], available: true },
  tidehollow: { id: 'tidehollow', theme: 8, pool: ['jelly', 'sawfish', 'crab'], king: 'bossT', element: 'ice', traits: ['charge', 'armored'], available: true },
  gearspire: { id: 'gearspire', theme: 9, pool: ['spider', 'turret', 'mech'], king: 'bossG', element: 'lightning', traits: ['ranged', 'armored'], available: true },
  duskhold: { id: 'duskhold', theme: 10, pool: ['book', 'lantern', 'harmor'], king: 'bossL', element: 'dark', traits: ['ranged', 'split'], available: true },
  // Chapter 8: shadows of every Realm.
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
