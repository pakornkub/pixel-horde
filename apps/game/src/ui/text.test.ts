import { afterEach, describe, expect, it } from 'vitest';
import { setLang, t } from '@pixel-horde/i18n';
import { DEFAULT_RESOLVED, type ResolvedConfig } from '@pixel-horde/sim';
import { formDesc, heroDesc, skillDescIn } from './text';

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

describe('Hawk text (guard + Hawk Gust)', () => {
  afterEach(() => setLang('th'));
  const K = DEFAULT_RESOLVED.skills;
  const withHawk = (hawk: Partial<typeof K.hawk>): ResolvedConfig => ({ ...DEFAULT_RESOLVED, skills: { ...K, hawk: { ...K.hawk, ...hawk } } });
  const live = withHawk({ guardN: 3, gustKb: 70, gustStun: 0.6 });

  it('keeps the old text while guard and gust are off (built-in defaults)', () => {
    setLang('en');
    expect(skillDescIn(DEFAULT_RESOLVED, 'hawk', false)).toBe('A hawk dives at the biggest monster nearby');
    expect(formDesc(DEFAULT_RESOLVED, 'hawk')).not.toMatch(/gust/);
    expect(skillDescIn(withHawk({ guardN: 3 }), 'hawk', false)).not.toMatch(/gust/); // guard alone has no gust to tell about
  });

  it('tells about defending and the gust once the config has them, before and after Awakening', () => {
    for (const l of ['en', 'th'] as const) {
      setLang(l);
      expect(skillDescIn(live, 'hawk', false)).toBe(t('skill.hawk.descGuard'));
      expect(formDesc(live, 'hawk')).toBe(t('awk.hawk.descGuard', { n: live.skills.hawk.awk.n }));
    }
    setLang('en');
    expect(skillDescIn(live, 'hawk', false)).toMatch(/crowded.*nearest.*gust.*stuns.*not bosses/);
    expect(formDesc(live, 'hawk')).toContain(`${live.skills.hawk.awk.n} storm hawks`);
  });

  it('leaves other Signatures alone', () => {
    setLang('en');
    expect(skillDescIn(live, 'sigil', false)).toBe(skillDescIn(DEFAULT_RESOLVED, 'sigil', false));
  });
});
