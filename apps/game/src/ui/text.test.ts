import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '@pixel-horde/i18n';
import { DEFAULT_RESOLVED, type ResolvedConfig } from '@pixel-horde/sim';
import { heroDesc } from './text';

const withHeroes = (heroes: Partial<ResolvedConfig['heroes']>): ResolvedConfig => ({ ...DEFAULT_RESOLVED, heroes: { ...DEFAULT_RESOLVED.heroes, ...heroes } });

describe('heroDesc', () => {
  afterEach(() => setLang('th'));

  it('reads the Hero bonuses from the config (built-in defaults)', () => {
    setLang('en');
    expect(heroDesc(DEFAULT_RESOLVED, 'mage')).toBe('+10% skill damage');
    expect(heroDesc(DEFAULT_RESOLVED, 'knight')).toBe('+40 max HP but 5% slower');
    expect(heroDesc(DEFAULT_RESOLVED, 'ranger')).toBe('12% faster, +30% EXP pickup range'); // Kit's HP bonus is 0: not shown
    expect(heroDesc(DEFAULT_RESOLVED, 'alchemist')).toBe('8% faster cooldowns, Statuses last 20% longer');
  });

  it('follows a published config, and shows Kit\'s HP only when it is non-zero', () => {
    const cfg = withHeroes({ ranger: { ...DEFAULT_RESOLVED.heroes.ranger, spd: 0.15, hp: 20 } });
    setLang('en');
    expect(heroDesc(cfg, 'ranger')).toBe('15% faster, +30% EXP pickup range, +20 max HP');
    setLang('th');
    expect(heroDesc(cfg, 'ranger')).toBe('เร็วขึ้น 15% ดูดของไกลขึ้น 30% HP +20');
    expect(heroDesc(DEFAULT_RESOLVED, 'ranger')).toBe('เร็วขึ้น 12% ดูดของไกลขึ้น 30%');
  });
});
