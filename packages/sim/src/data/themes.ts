import type { EnemyId } from './enemies';

export interface ThemeRules {
  key: 'grass' | 'desert' | 'cave' | 'snow';
  pool: [EnemyId, EnemyId, EnemyId];
  boss: EnemyId;
}

/** Themes cycle every 4 stages. Visuals (tiles, names) live in the game app. */
export const THEMES: ThemeRules[] = [
  { key: 'grass', pool: ['slime', 'bat', 'mush'], boss: 'boss' },
  { key: 'desert', pool: ['sslime', 'scorp', 'mummy'], boss: 'bossD' },
  { key: 'cave', pool: ['bat', 'ghost', 'skel'], boss: 'bossC' },
  { key: 'snow', pool: ['islime', 'ibat', 'snowman'], boss: 'bossS' },
];

export const themeIndex = (stage: number): number => (stage - 1) % THEMES.length;
