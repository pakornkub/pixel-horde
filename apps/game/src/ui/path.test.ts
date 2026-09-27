import { describe, expect, it } from 'vitest';
import type { LevelOption, SimState } from '@pixel-horde/sim';
import { onHeroPath } from './path';

const view = (P: object): SimState => ({ P: { skills: {}, bench: [], ...P } }) as unknown as SimState;
const rec = (P: object, o: LevelOption): boolean => onHeroPath(view(P), o);

describe('Recommended tag (the Hero path)', () => {
  it('marks the Signature, every Link, every Awakened skill of this Hero and their Evolutions', () => {
    const lyra = { ch: 'mage' };
    for (const id of ['sigil', 'bolt', 'chain', 'hole', 'manaNova', 'timeWarp', 'starfall'] as const) expect(rec(lyra, { kind: 'skill', id })).toBe(true);
    expect(rec(lyra, { kind: 'evo', id: 'chain' })).toBe(true);
    expect(rec(lyra, { kind: 'skill', id: 'orbit' })).toBe(false); // Bram's Link
    expect(rec(lyra, { kind: 'skill', id: 'sacredBlades' })).toBe(false); // Bram's Awakened skill
    expect(rec(lyra, { kind: 'evo', id: 'orbit' })).toBe(false);
  });

  it('marks the passives that evolve the Signature or a Link the Hero already has', () => {
    expect(rec({ ch: 'mage' }, { kind: 'pas', id: 'might' })).toBe(true); // Arcane Sigil evolves with Might
    expect(rec({ ch: 'mage' }, { kind: 'pas', id: 'haste' })).toBe(false); // Bolt not taken yet
    expect(rec({ ch: 'mage', skills: { bolt: 2 } }, { kind: 'pas', id: 'haste' })).toBe(true);
    expect(rec({ ch: 'mage', bench: [{ id: 'chain', lv: 1, evo: false }] }, { kind: 'pas', id: 'crit' })).toBe(true);
    expect(rec({ ch: 'mage', skills: { orbit: 2 } }, { kind: 'pas', id: 'swift' })).toBe(false); // Orbit is not Lyra's Link
  });

  it('never marks filler cards', () => {
    expect(rec({ ch: 'knight' }, { kind: 'gold' } as LevelOption)).toBe(false);
  });
});
