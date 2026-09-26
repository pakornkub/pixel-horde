import { describe, expect, it } from 'vitest';
import { parseSettings } from './settings';

describe('device settings', () => {
  it('defaults from the browser language and sensible values', () => {
    const s = parseSettings(null, ['en-US']);
    expect(s).toMatchObject({ lang: 'en', shake: 'full', vibrate: true, ultFlash: true, effects: 'all', numbers: 'all', view: 'near', tips: true, preset: 'balanced' });
    expect(parseSettings({ preset: 'blitz' }, ['th']).preset).toBe('blitz');
    expect(parseSettings({ preset: 'godlike' }, ['th']).preset).toBe('balanced');
    expect(parseSettings({}, ['th']).lang).toBe('th');
  });
  it('keeps valid stored values and repairs invalid ones', () => {
    const s = parseSettings({ lang: 'th', music: 0.3, sfx: 5, shake: 'light', effects: 'nope', tipsSeen: ['move', 3] }, ['en']);
    expect(s.lang).toBe('th');
    expect(s.music).toBe(0.3);
    expect(s.sfx).toBe(0.8);
    expect(s.shake).toBe('light');
    expect(s.effects).toBe('all');
    expect(s.tipsSeen).toEqual(['move']);
    expect(parseSettings({ view: 'farthest' }, ['en']).view).toBe('farthest');
    expect(parseSettings({ view: 3 }, ['en']).view).toBe('near');
  });
});
