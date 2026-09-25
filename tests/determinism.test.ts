import { describe, expect, it } from 'vitest';
import { runReplay, scoreOf } from '@pixel-horde/sim';
import { botOptions, runBot } from './bot';

describe('determinism', () => {
  it('same seed + same inputs gives the same hash sequence', () => {
    const a = runBot(botOptions(42), 3 * 3600).sim;
    const b = runBot(botOptions(42), 3 * 3600).sim;
    expect(a.replay().hashes).toEqual(b.replay().hashes);
    expect(a.hash()).toBe(b.hash());
  });

  it('different seeds diverge', () => {
    const a = runBot(botOptions(1), 600).sim.replay().hashes;
    const b = runBot(botOptions(2), 600).sim.replay().hashes;
    expect(a).not.toEqual(b);
  });

  it('a recorded replay reproduces the run exactly', () => {
    const live = runBot(botOptions(7, { debug: { event: 'dragon' } }), 4 * 3600).sim;
    const rec = live.replay();
    const again = runReplay(JSON.parse(JSON.stringify(rec)));
    expect(again.replay().hashes).toEqual(rec.hashes);
    expect(scoreOf(again.view())).toBe(live.score());
  });

  it('records a hash every 60 ticks', () => {
    const r = runBot(botOptions(9), 600).sim.replay();
    expect(r.hashes.length).toBe(Math.floor(r.ticks / 60));
  });
});
