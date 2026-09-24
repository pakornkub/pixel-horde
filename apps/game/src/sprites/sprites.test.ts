import { describe, expect, it } from 'vitest';
import { LUMORA, SPRITES } from './lumora';
import { formatRows, parseRows, validateRealm, validateSprite } from './types';

describe('sprite files', () => {
  it.each(LUMORA.map((r) => [r.realm, r] as const))('%s validates', (_n, realm) => {
    expect(validateRealm(realm)).toEqual([]);
  });

  it('every enemy and hero the game draws has a sprite', () => {
    for (const k of ['mage', 'knight', 'ranger', 'alchemist', 'pet', 'slime', 'bat', 'ghost', 'mush', 'boss', 'sslime', 'scorp', 'mummy', 'skel', 'islime', 'ibat', 'snowman', 'bossD', 'bossC', 'bossS', 'dragon', 'whelp', 'rival', 'caster', 'charger', 'splitter']) {
      expect(SPRITES[k], k).toBeDefined();
    }
  });

  it('rejects unequal rows and characters outside the palette', () => {
    const p = validateSprite('x', { frames: [['K..', 'KK', 'KzK']], pal: { K: '#000000' } });
    expect(p.map((x) => x.message)).toEqual(['row length 2, expected 3', "char 'z' is not in the palette"]);
    expect(validateSprite('y', { frames: [['K'], ['K', 'K']], pal: { K: '#000000' } })[0].message).toMatch(/expected 1/);
    expect(validateSprite('z', { frames: [['K']], pal: { K: 'red' } })[0].message).toMatch(/bad colour/);
  });

  it('copy-out rows paste back unchanged', () => {
    const rows = SPRITES.slime.frames[0];
    expect(parseRows(formatRows(rows))).toEqual(rows);
    expect(parseRows('"..KK..",\n  "KggK"\n')).toEqual(['..KK..', 'KggK']);
  });
});
