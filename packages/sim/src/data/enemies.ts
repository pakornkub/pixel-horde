export interface EnemyType {
  hp: number;
  spd: number;
  dmg: number;
  xp: number;
  r: number;
  boss?: boolean;
  /** Draw scale. */
  sc?: number;
  /** Has its own AI routine. */
  ai?: boolean;
}

export const ENEMY_IDS = ['slime', 'bat', 'ghost', 'mush', 'boss', 'sslime', 'scorp', 'mummy', 'skel', 'islime', 'ibat', 'snowman', 'bossD', 'bossC', 'bossS', 'dragon', 'whelp', 'rival', 'caster', 'charger', 'splitter', 'mini'] as const;
export type EnemyId = (typeof ENEMY_IDS)[number];

export const ET: Record<EnemyId, EnemyType> = {
  slime: { hp: 22, spd: 24, dmg: 7, xp: 1, r: 6 },
  bat: { hp: 13, spd: 44, dmg: 5, xp: 1, r: 5 },
  ghost: { hp: 38, spd: 32, dmg: 9, xp: 2, r: 6 },
  mush: { hp: 80, spd: 19, dmg: 13, xp: 3, r: 7 },
  boss: { hp: 2200, spd: 27, dmg: 22, xp: 80, r: 16, boss: true },
  sslime: { hp: 26, spd: 26, dmg: 8, xp: 1, r: 6 },
  scorp: { hp: 20, spd: 46, dmg: 7, xp: 1, r: 6 },
  mummy: { hp: 70, spd: 20, dmg: 12, xp: 3, r: 7 },
  skel: { hp: 40, spd: 34, dmg: 10, xp: 2, r: 6 },
  islime: { hp: 30, spd: 24, dmg: 9, xp: 1, r: 6 },
  ibat: { hp: 18, spd: 48, dmg: 7, xp: 1, r: 5 },
  snowman: { hp: 90, spd: 18, dmg: 14, xp: 3, r: 7 },
  bossD: { hp: 2200, spd: 30, dmg: 22, xp: 80, r: 16, boss: true },
  bossC: { hp: 2200, spd: 27, dmg: 22, xp: 80, r: 16, boss: true },
  bossS: { hp: 2200, spd: 25, dmg: 22, xp: 80, r: 16, boss: true },
  dragon: { hp: 6000, spd: 44, dmg: 26, xp: 200, r: 20, boss: true, sc: 2, ai: true },
  whelp: { hp: 28, spd: 66, dmg: 9, xp: 2, r: 5 },
  rival: { hp: 1400, spd: 56, dmg: 16, xp: 60, r: 7, boss: true, sc: 1, ai: true },
  caster: { hp: 32, spd: 30, dmg: 8, xp: 2, r: 6 },
  charger: { hp: 55, spd: 28, dmg: 12, xp: 2, r: 7 },
  splitter: { hp: 70, spd: 22, dmg: 10, xp: 3, r: 10, sc: 2 },
  mini: { hp: 12, spd: 50, dmg: 5, xp: 1, r: 5 },
};

/** Particle colour when an enemy dies (sent with kill events). */
export const DEATH_COL: Record<EnemyId, string> = {
  slime: '#6fd34e', bat: '#8a5ad6', ghost: '#e9f1ff', mush: '#e8434f', boss: '#4fa8ff', sslime: '#e0a040', scorp: '#d9822b',
  mummy: '#e8d9b0', skel: '#f0ece0', islime: '#8fd8ff', ibat: '#5cc8e8', snowman: '#ffffff', bossD: '#ff9a2a', bossC: '#d8d0ff',
  bossS: '#e6f6ff', dragon: '#ff8a3d', whelp: '#a8231d', rival: '#8a5ad6', caster: '#b03ad6', charger: '#8a5a3a', splitter: '#b36bff', mini: '#b36bff',
};
