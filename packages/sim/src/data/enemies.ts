/** Static traits; HP/speed/damage/XP/radius come from the Balance Config (worlds.lumora.enemies). */
export interface EnemyType {
  boss?: boolean;
  /** Draw scale. */
  sc?: number;
  /** Has its own AI routine. */
  ai?: boolean;
}

export const ENEMY_IDS = ['slime', 'bat', 'ghost', 'mush', 'boss', 'sslime', 'scorp', 'mummy', 'skel', 'islime', 'ibat', 'snowman', 'bossD', 'bossC', 'bossS', 'dragon', 'whelp', 'rival', 'caster', 'charger', 'splitter', 'mini'] as const;
export type EnemyId = (typeof ENEMY_IDS)[number];

export const ET: Record<EnemyId, EnemyType> = {
  slime: {},
  bat: {},
  ghost: {},
  mush: {},
  boss: { boss: true },
  sslime: {},
  scorp: {},
  mummy: {},
  skel: {},
  islime: {},
  ibat: {},
  snowman: {},
  bossD: { boss: true },
  bossC: { boss: true },
  bossS: { boss: true },
  dragon: { boss: true, sc: 2, ai: true },
  whelp: {},
  rival: { boss: true, sc: 1, ai: true },
  caster: {},
  charger: {},
  splitter: { sc: 2 },
  mini: {},
};

/** Particle colour when an enemy dies (sent with kill events). */
export const DEATH_COL: Record<EnemyId, string> = {
  slime: '#6fd34e', bat: '#8a5ad6', ghost: '#e9f1ff', mush: '#e8434f', boss: '#4fa8ff', sslime: '#e0a040', scorp: '#d9822b',
  mummy: '#e8d9b0', skel: '#f0ece0', islime: '#8fd8ff', ibat: '#5cc8e8', snowman: '#ffffff', bossD: '#ff9a2a', bossC: '#d8d0ff',
  bossS: '#e6f6ff', dragon: '#ff8a3d', whelp: '#a8231d', rival: '#8a5ad6', caster: '#b03ad6', charger: '#8a5a3a', splitter: '#b36bff', mini: '#b36bff',
};
