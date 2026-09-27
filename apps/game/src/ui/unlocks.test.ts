import { describe, expect, it } from 'vitest';
import { t } from '@pixel-horde/i18n';
import { unlocksOf, unlockText, type WinFacts } from './unlocks';

const win = (f: Partial<WinFacts> = {}): WinFacts => ({ firstWin: false, crack: 0, crackMaxBefore: 0, maxTier: 3, weapons: [], umbraGold: 500, ach: [], ...f });
const kinds = (f: Partial<WinFacts>): string[] => unlocksOf(win(f)).map((u) => u.k);

describe('Unlocked page after beating Umbra', () => {
  it('first win: Heart Crack 1, Endless, Umbra\'s Weapon and new achievements', () => {
    const u = unlocksOf(win({ firstWin: true, weapons: ['glacierLance'], ach: ['heartKeeper'] }));
    expect(u).toEqual([{ k: 'crack', n: 1, max: 3 }, { k: 'endless' }, { k: 'weapon', id: 'glacierLance' }, { k: 'ach', id: 'heartKeeper' }]);
  });

  it('Gold instead of a Weapon when the collection is complete', () => {
    expect(kinds({ firstWin: true })).toEqual(['crack', 'endless', 'gold']);
    expect(kinds({ umbraGold: 0 })).not.toContain('gold');
  });

  it('a later win on the highest tier so far opens the next tier, and nothing that was already open', () => {
    expect(unlocksOf(win({ crack: 1, crackMaxBefore: 1 }))[0]).toEqual({ k: 'crack', n: 2, max: 3 });
    expect(kinds({ crack: 0, crackMaxBefore: 2 })).toEqual(['gold']); // replaying an easier tier unlocks nothing new
    expect(kinds({ crack: 1, crackMaxBefore: 2 })).not.toContain('endless');
  });

  it('the top tier comes from the config (Heart Crack 1–10 with pass 2026-09e)', () => {
    expect(unlocksOf(win({ crack: 3, crackMaxBefore: 3, maxTier: 10 }))[0]).toEqual({ k: 'crack', n: 4, max: 10 });
    expect(unlocksOf(win({ crack: 10, crackMaxBefore: 10, maxTier: 10 }))[0]).toEqual({ k: 'crackTop', n: 10 });
  });

  it('post-win features show only on the first win and only when the build has them', () => {
    const hero = { id: 'necromancer', name: 'Mora', cost: 2000 };
    expect(kinds({ firstWin: true, special: true, hero })).toEqual(['crack', 'endless', 'special', 'hero', 'gold']);
    expect(kinds({ firstWin: true })).not.toContain('special');
    expect(kinds({ crack: 1, crackMaxBefore: 1, special: true, hero })).toEqual(['crack', 'gold']);
  });

  it('more than two new achievements fold into one line, so the buttons stay on screen', () => {
    const ach = ['firstKing', 'chapter4', 'crater', 'heartKeeper'];
    expect(unlocksOf(win({ ach })).filter((u) => u.k === 'achs' || u.k === 'ach')).toEqual([{ k: 'achs', ids: ach }]);
    expect(kinds({ ach: ach.slice(0, 2) }).filter((k) => k === 'ach')).toHaveLength(2);
    expect(unlockText({ k: 'achs', ids: ach })).toContain(t('ach.heartKeeper.name')); // the one with a Title is named
  });

  it('every line has text with its numbers filled in', () => {
    const u = unlocksOf(win({ firstWin: true, special: true, hero: { id: 'necromancer', name: 'Mora', cost: 2000 }, ach: ['heartKeeper'] })).concat(unlocksOf(win({ ach: ['firstKing', 'chapter4', 'crater'] })));
    for (const x of u) expect(unlockText(x)).not.toMatch(/^unlock\.|\{/);
  });
});
