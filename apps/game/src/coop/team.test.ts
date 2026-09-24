import { describe, expect, it } from 'vitest';
import { createTeam } from './team';

describe('co-op Stage-end decisions', () => {
  it('continues when everyone is ready, or after the wait', () => {
    const t = createTeam(30, 15);
    t.enter('clear', 'H');
    t.setReady('H');
    expect(t.tick(1, ['H', 'A'])).toBeNull();
    t.setReady('A');
    expect(t.tick(0.1, ['H', 'A'])).toEqual({ k: 'next' });
    t.enter('other', 'H');
    t.enter('clear', 'H');
    expect(t.tick(29, ['H', 'A'])).toBeNull();
    expect(t.tick(1.5, ['H', 'A'])).toEqual({ k: 'next' });
  });

  it('route vote: majority wins, ties go to the host, time runs out', () => {
    const t = createTeam(30, 15);
    t.enter('route', 'H');
    t.vote('H', 0); t.vote('A', 1); t.vote('B', 1);
    expect(t.tick(0.1, ['H', 'A', 'B'])).toEqual({ k: 'route', index: 1 });
    t.enter('other', 'H'); t.enter('route', 'H');
    t.vote('H', 1); t.vote('A', 0);
    expect(t.tick(0.1, ['H', 'A'])).toEqual({ k: 'route', index: 1 }); // tie → host
    t.enter('other', 'H'); t.enter('route', 'H');
    t.vote('A', 1);
    expect(t.tick(10, ['H', 'A'])).toBeNull();
    expect(t.tick(6, ['H', 'A'])).toEqual({ k: 'route', index: 1 }); // the host did not vote
  });
});
