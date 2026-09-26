// ?debug=bloodmoon must force a Blood Moon on the very first Stage, the way the browser starts a Run:
// the account's first Run (tutorial Greenvale) with the live event switches, even when those are off.
import { describe, expect, it } from 'vitest';
import { createSim, type SimOptions } from '@pixel-horde/sim';
import { parseDebug } from '../apps/game/src/debug';

const browserRun = (search: string, bloodMoonSwitch = true): SimOptions => ({
  seed: 1, hero: 'mage', weapon: 'judgement', firstRun: true,
  meta: { up: {}, wallet: 0, weapons: [] }, viewport: { w: 338, h: 190 },
  events: { bloodMoon: bloodMoonSwitch, dragon: bloodMoonSwitch, rival: bloodMoonSwitch },
  debug: parseDebug(search),
});

/** Plays Stage 1 standing still (upgrades picked at once) until `until` seconds of Stage time. */
function play(opts: SimOptions, until: number): { spawned: number; bannerAt: number; special: boolean[] } {
  const sim = createSim(opts);
  let bannerAt = -1;
  const special: boolean[] = [];
  for (let t = 0; sim.view().stageTime < until && t < 60 * 120; t++) {
    const v = sim.view();
    const events = sim.step({ mx: 0, my: 0 }, v.phase === 'levelup' ? [{ type: 'pick', index: 0 }] : v.phase === 'chest' ? [{ type: 'chestStop' }] : []);
    if (bannerAt < 0 && events.some((e) => e.t === 'banner' && e.key === 'bloodMoon')) bannerAt = sim.view().stageTime;
    special.push(sim.view().specialStage);
  }
  return { spawned: sim.view().eid - 1, bannerAt, special };
}

describe('?debug=bloodmoon', () => {
  it('forces a Blood Moon from the first Stage: red tint flag all Stage, banner at the reveal point, more spawns', () => {
    const moon = play(browserRun('?offline&debug=god,bloodmoon'), 30);
    const plain = play(browserRun('?offline&debug=god'), 30);
    expect(moon.special.every(Boolean)).toBe(true);
    expect(plain.special.some(Boolean)).toBe(false);
    // never announced in advance: the banner comes at 10% of the 60 s Stage, not at the start
    expect(moon.bannerAt).toBeGreaterThanOrEqual(6);
    expect(moon.bannerAt).toBeLessThan(6.1);
    expect(plain.bannerAt).toBe(-1);
    expect(moon.spawned).toBeGreaterThan(plain.spawned * 1.5);
  });

  it('still forces it when the live Blood Moon switch is off', () => {
    const moon = play(browserRun('?debug=bloodmoon', false), 10);
    expect(moon.special.every(Boolean)).toBe(true);
    expect(moon.bannerAt).toBeGreaterThan(0);
  });
});
