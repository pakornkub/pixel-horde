import type { Trait } from '../content/lumora/realms';

/** Static traits; HP/speed/damage/XP/radius come from the Balance Config (worlds.lumora.enemies). */
export interface EnemyType {
  boss?: boolean;
  /** Draw scale. */
  sc?: number;
  /** Has its own AI routine. */
  ai?: boolean;
  /** Counter-play trait (route screen advice; Realm traits boost matching mobs). */
  trait?: Trait;
}

export const ENEMY_IDS = ['slime', 'bat', 'ghost', 'mush', 'boss', 'sslime', 'scorp', 'mummy', 'skel', 'islime', 'ibat', 'snowman', 'bossD', 'bossC', 'bossS', 'dragon', 'frostDragon', 'stormDragon', 'whelp', 'rival', 'umbra', 'caster', 'charger', 'splitter', 'mini',
  // tickets 35–38: Skeleton Archer and the six new Realms (mob, mob, mob, King)
  'archer',
  'fbat', 'sala', 'lavarock', 'bossE',
  'frog', 'spore', 'sporelet', 'leech', 'bossM',
  'cloud', 'sbird', 'griffin', 'bossK',
  'jelly', 'sawfish', 'crab', 'bossT',
  'spider', 'turret', 'mech', 'bossG',
  'book', 'lantern', 'harmor', 'bossL'] as const;
export type EnemyId = (typeof ENEMY_IDS)[number];

export const ET: Record<EnemyId, EnemyType> = {
  slime: {},
  bat: { trait: 'fast' },
  ghost: {},
  mush: {},
  boss: { boss: true, sc: 1 },
  sslime: {},
  scorp: { trait: 'fast' },
  mummy: { trait: 'armored' },
  skel: {},
  islime: {},
  ibat: { trait: 'fast' },
  snowman: { trait: 'armored' },
  bossD: { boss: true, sc: 1 },
  bossC: { boss: true, sc: 1 },
  bossS: { boss: true, sc: 1 },
  dragon: { boss: true, sc: 2, ai: true },
  frostDragon: { boss: true, sc: 2, ai: true },
  stormDragon: { boss: true, sc: 2, ai: true },
  whelp: { trait: 'fast' },
  rival: { boss: true, sc: 1, ai: true },
  umbra: { boss: true, sc: 3 },
  caster: { trait: 'ranged' },
  charger: { trait: 'charge' },
  splitter: {sc: 2, trait: 'split' },
  mini: { trait: 'split' },
  archer: { trait: 'ranged' },
  fbat: { trait: 'fast' }, sala: { trait: 'fast' }, lavarock: { trait: 'armored' }, bossE: { boss: true, sc: 1 },
  frog: {}, spore: { trait: 'split' }, sporelet: { trait: 'split' }, leech: { trait: 'leech' }, bossM: { boss: true, sc: 1 },
  cloud: {}, sbird: { trait: 'fast' }, griffin: { trait: 'charge' }, bossK: { boss: true, sc: 1 },
  jelly: {}, sawfish: { trait: 'charge' }, crab: { trait: 'armored' }, bossT: { boss: true, sc: 1 },
  spider: { trait: 'fast' }, turret: { trait: 'ranged' }, mech: { trait: 'armored' }, bossG: { boss: true, sc: 1 },
  book: { trait: 'ranged' }, lantern: { trait: 'ranged' }, harmor: { trait: 'split' }, bossL: { boss: true, sc: 1 },
};

/** Ranged monsters (Eye Caster behaviour): `still` never moves, `shots` per volley, `spin` rotates volleys (rad). */
export interface RangedKind { still?: boolean; shots: number; spread: number; spin?: number; col: number }
export const RANGED: Partial<Record<EnemyId, RangedKind>> = {
  caster: { shots: 1, spread: 0, col: 3 },
  archer: { shots: 1, spread: 0, col: 4 },
  turret: { still: true, shots: 2, spread: 0.18, col: 2 },
  lantern: { shots: 1, spread: 0, col: 1 },
  book: { shots: 3, spread: 2.09, spin: 0.6, col: 1 },
};
/** Charging monsters (Wild Boar behaviour). */
export const CHARGERS: ReadonlySet<EnemyId> = new Set<EnemyId>(['charger', 'sawfish', 'griffin']);
/** Monsters that split when they die: into what, how many (null = config splitter.minis). */
export const SPLITS: Partial<Record<EnemyId, [EnemyId, number | null]>> = { splitter: ['mini', null], spore: ['sporelet', 2], harmor: ['ghost', 2] };

/** Particle colour when an enemy dies (sent with kill events). */
export const DEATH_COL: Record<EnemyId, string> = {
  slime: '#6fd34e', bat: '#8a5ad6', ghost: '#e9f1ff', mush: '#e8434f', boss: '#4fa8ff', sslime: '#e0a040', scorp: '#d9822b',
  mummy: '#e8d9b0', skel: '#f0ece0', islime: '#8fd8ff', ibat: '#5cc8e8', snowman: '#ffffff', bossD: '#ff9a2a', bossC: '#d8d0ff',
  bossS: '#e6f6ff', dragon: '#ff8a3d', frostDragon: '#9fd8ff', stormDragon: '#fff35c', whelp: '#a8231d', rival: '#8a5ad6', umbra: '#3a1f66', caster: '#b03ad6', charger: '#8a5a3a', splitter: '#b36bff', mini: '#b36bff',
  archer: '#f0ece0',
  fbat: '#ff6a2a', sala: '#ff8a3d', lavarock: '#5a3a3a', bossE: '#ff4b1f',
  frog: '#8fce6a', spore: '#c98fd8', sporelet: '#c98fd8', leech: '#6b3a5a', bossM: '#6f8f3a',
  cloud: '#e6f0ff', sbird: '#fff35c', griffin: '#d8a84f', bossK: '#8fdcff',
  jelly: '#ff9ad8', sawfish: '#5c8fbf', crab: '#e8543c', bossT: '#3fbfbf',
  spider: '#8a94a8', turret: '#c7ced9', mech: '#6a7488', bossG: '#b8c0cc',
  book: '#b07cff', lantern: '#ffd23f', harmor: '#6a6a8a', bossL: '#b07cff',
};
