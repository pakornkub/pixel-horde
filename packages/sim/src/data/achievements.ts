// Achievements (ticket 32): ~30 in five groups, evaluated from a Run's facts plus lifetime
// totals. The server re-evaluates the same rules in SQL (supabase: grant_achievements); a shared
// fixture test keeps both in step. Some grant a Title (shown next to the name).
import type { ComboId } from './skills';
import type { EnemyId } from './enemies';
import type { HeroId } from './heroes';

export type AchievementGroup = 'story' | 'heroes' | 'combos' | 'dragons' | 'challenge';

export interface RunFacts {
  hero: HeroId; victory: boolean; chapter: number; escapes: number; kingsKilled: number; kills: number; maxStreak: number;
  time: number; victoryTime: number; revivesBought: number; awakened: boolean; crack: number; endlessChapter: number;
  combos: Partial<Record<ComboId, number>>; guardians: string[]; fused: boolean; companionMax: number; doubleKings: number;
  killsByType: Partial<Record<EnemyId, number>>;
}
/** Lifetime totals kept on the server (meta_progress.stats) and cached locally. */
export interface Lifetime { heroesWon: string[]; combos: Partial<Record<ComboId, number>> }

export interface Achievement { id: string; group: AchievementGroup; title?: string; test: (f: RunFacts, life: Lifetime) => boolean }

const won = (h: HeroId) => (f: RunFacts): boolean => f.victory && f.hero === h;

export const ACHIEVEMENTS: Achievement[] = [
  // story
  { id: 'firstKing', group: 'story', test: (f) => f.kingsKilled >= 1 },
  { id: 'chapter4', group: 'story', test: (f) => f.chapter >= 4 },
  { id: 'crater', group: 'story', test: (f) => f.chapter >= 8 },
  { id: 'heartKeeper', group: 'story', title: 'Heart Keeper', test: (f) => f.victory },
  { id: 'kingslayer', group: 'story', title: 'Kingslayer', test: (f) => f.victory && f.escapes === 0 },
  { id: 'endless12', group: 'story', test: (f) => f.endlessChapter >= 12 },
  // heroes
  { id: 'winLyra', group: 'heroes', test: won('mage') },
  { id: 'winBram', group: 'heroes', test: won('knight') },
  { id: 'winKit', group: 'heroes', test: won('ranger') },
  { id: 'winVex', group: 'heroes', test: won('alchemist') },
  { id: 'legend', group: 'heroes', title: 'Legend of Lumora', test: (_f, l) => ['mage', 'knight', 'ranger', 'alchemist'].every((h) => l.heroesWon.includes(h)) },
  { id: 'awakened', group: 'heroes', test: (f) => f.awakened },
  // combos
  { id: 'firstCombo', group: 'combos', test: (f) => Object.values(f.combos).some((n) => (n || 0) > 0) },
  { id: 'allCombos', group: 'combos', title: 'Alchemist of Chaos', test: (f) => Object.values(f.combos).filter((n) => (n || 0) > 0).length >= 7 },
  { id: 'combos100', group: 'combos', test: (f) => Object.values(f.combos).reduce((a: number, n) => a + (n || 0), 0) >= 100 },
  { id: 'iceBreaker', group: 'combos', title: 'Ice Breaker', test: (_f, l) => (l.combos.shatter || 0) >= 1000 },
  { id: 'overload200', group: 'combos', test: (_f, l) => (l.combos.overload || 0) >= 200 },
  { id: 'firestorm200', group: 'combos', test: (_f, l) => (l.combos.firestorm || 0) >= 200 },
  // dragons
  { id: 'firstGuardian', group: 'dragons', test: (f) => f.guardians.length >= 1 },
  { id: 'frostTamed', group: 'dragons', test: (f) => f.guardians.includes('frost') },
  { id: 'stormTamed', group: 'dragons', test: (f) => f.guardians.includes('storm') },
  { id: 'allGuardians', group: 'dragons', test: (f) => f.guardians.length >= 3 },
  { id: 'dragonTamer', group: 'dragons', title: 'Dragon Tamer', test: (f) => f.fused },
  { id: 'companion5', group: 'dragons', test: (f) => f.companionMax >= 5 },
  // challenges
  { id: 'crack1', group: 'challenge', test: (f) => f.victory && f.crack >= 1 },
  { id: 'crack3', group: 'challenge', title: 'Heartbreaker', test: (f) => f.victory && f.crack >= 3 },
  { id: 'swift', group: 'challenge', title: 'Swift', test: (f) => f.victory && f.victoryTime > 0 && f.victoryTime < 15 * 60 },
  { id: 'noRevive', group: 'challenge', test: (f) => f.victory && f.revivesBought === 0 },
  { id: 'streak500', group: 'challenge', test: (f) => f.maxStreak >= 500 },
  { id: 'doubleKing', group: 'challenge', test: (f) => f.doubleKings >= 1 },
];

/** Lifetime totals after adding a Run. */
export function addToLifetime(l: Lifetime, f: RunFacts): Lifetime {
  const combos = { ...l.combos };
  for (const [k, n] of Object.entries(f.combos)) combos[k as ComboId] = (combos[k as ComboId] || 0) + (n || 0);
  const heroesWon = f.victory && !l.heroesWon.includes(f.hero) ? [...l.heroesWon, f.hero] : l.heroesWon;
  return { heroesWon, combos };
}

/** Achievements this Run unlocks (not counting ones already owned). */
export function newAchievements(f: RunFacts, before: Lifetime, owned: readonly string[]): string[] {
  const life = addToLifetime(before, f);
  return ACHIEVEMENTS.filter((a) => !owned.includes(a.id) && a.test(f, life)).map((a) => a.id);
}
