import { describe, expect, it } from 'vitest';
import { BALANCE_PASSES, CHANGE_CATS, autoItems, catOfPath, groupItems, isChangeCat, listFields } from './index';

describe('changelog', () => {
  it('sorts Balance Config values into player-facing categories', () => {
    expect(catOfPath('shared.kings.splash.r')).toBe('boss');
    expect(catOfPath('worlds.lumora.enemies.umbra.hp')).toBe('boss');
    expect(catOfPath('worlds.lumora.enemies.slime.hp')).toBe('monster');
    expect(catOfPath('shared.skills.hawk.r')).toBe('skill');
    expect(catOfPath('shared.heroes.ranger.spd')).toBe('hero');
    expect(catOfPath('shared.spawn.base')).toBe('difficulty');
    expect(catOfPath('shared.loot.coinChance')).toBe('economy');
    expect(catOfPath('shared.coop.pickTime')).toBe('coop');
    for (const f of listFields()) expect(CHANGE_CATS).toContain(catOfPath(f.path));
  });

  it('writes a readable Thai line for a changed value', () => {
    const [i] = autoItems([{ path: 'shared.kings.splash.r', from: 140, to: 100 }]);
    expect(i.cat).toBe('boss');
    expect(i.th).toContain('140 → 100');
    expect(i.th).toContain('ลดลง');
    expect(i.th).not.toContain('shared.');
  });

  it('balance passes carry player-facing patch notes', () => {
    for (const p of BALANCE_PASSES) {
      expect(p.changelog.titleTh.length).toBeGreaterThan(5);
      expect(p.changelog.items.length).toBeGreaterThan(0);
      for (const i of p.changelog.items) { expect(isChangeCat(i.cat)).toBe(true); expect(i.th.length).toBeGreaterThan(5); expect(i.en.length).toBeGreaterThan(5); }
      expect(groupItems(p.changelog.items).map(([c]) => c)).toEqual(CHANGE_CATS.filter((c) => p.changelog.items.some((i) => i.cat === c)));
    }
  });
});
