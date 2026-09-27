// What beating Umbra unlocked (ticket 55): pure rules for the ending's "Unlocked" page.
import { t } from '@pixel-horde/i18n';
import type { WeaponId } from '@pixel-horde/sim';

/** One line on the "Unlocked" page. */
export type Unlock =
  | { k: 'crack'; n: number; max: number }
  | { k: 'crackTop'; n: number }
  | { k: 'endless' }
  | { k: 'special' }
  | { k: 'hero'; id: string; name: string; cost: number }
  | { k: 'weapon'; id: WeaponId }
  | { k: 'gold'; n: number }
  | { k: 'ach'; id: string };

export interface WinFacts {
  /** The account had never won before this Run (no Heart Crack tier, no Hero in heroesWon). */
  firstWin: boolean;
  /** Heart Crack tier this Run was played on, the highest unlocked before it, and the config's top tier. */
  crack: number; crackMaxBefore: number; maxTier: number;
  /** Weapons found in the Heart Crater (Umbra's), or the Gold it gave when the collection was complete. */
  weapons: WeaponId[]; umbraGold: number;
  /** Achievements this Run earns (not owned before). */
  ach: string[];
  /** Opened by the first win: the special shop (ticket 56) and, once the build has it, a Hero sold after the first win (57). */
  special?: boolean;
  hero?: { id: string; name: string; cost: number } | null;
}

/** Only what this win really unlocked: a first win opens Endless (and the post-win features), every win may open the next Heart Crack. */
export function unlocksOf(f: WinFacts): Unlock[] {
  const out: Unlock[] = [];
  const next = f.crack + 1;
  if (next <= f.maxTier && next > f.crackMaxBefore) out.push({ k: 'crack', n: next, max: f.maxTier });
  else if (f.crack >= f.maxTier) out.push({ k: 'crackTop', n: f.crack });
  if (f.firstWin) {
    out.push({ k: 'endless' });
    if (f.special) out.push({ k: 'special' });
    if (f.hero) out.push({ k: 'hero', ...f.hero });
  }
  for (const id of f.weapons) out.push({ k: 'weapon', id });
  if (!f.weapons.length && f.umbraGold > 0) out.push({ k: 'gold', n: f.umbraGold });
  for (const id of f.ach) out.push({ k: 'ach', id });
  return out;
}

export function unlockText(u: Unlock): string {
  switch (u.k) {
    case 'crack': return t('unlock.crack', { n: u.n, max: u.max });
    case 'crackTop': return t('unlock.crackTop', { n: u.n });
    case 'endless': return t('unlock.endless');
    case 'special': return t('unlock.special');
    case 'hero': return t('unlock.hero', { name: u.name, cost: u.cost.toLocaleString('en-US') });
    case 'weapon': return t('unlock.weapon', { name: t(`weapon.${u.id}.name`) });
    case 'gold': return t('unlock.gold', { n: u.n.toLocaleString('en-US') });
    case 'ach': return t('unlock.ach', { name: t(`ach.${u.id}.name`) });
  }
}
