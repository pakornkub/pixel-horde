import { describe, expect, it } from 'vitest';
import { createSim, type SimState } from '@pixel-horde/sim';
import { botOptions, botStep } from './bot';

describe('checkpoints (suspend / resume)', () => {
  it('resuming a Stage-start checkpoint replays that Stage identically', () => {
    const opts = botOptions(31, { debug: { god: true } });
    const a = createSim(opts);
    let t = 0;
    for (; t < 60 * 60 * 4 && a.view().stage < 2; t++) botStep(a, t);
    expect(a.view().stage).toBe(2);
    // the checkpoint was taken at the start of Chapter 2, before any tick of it ran
    const cp = a.checkpoint();
    expect(cp.chapter).toBe(2);
    const b = createSim({ ...opts, resume: cp.data });
    expect((b.view() as SimState).stage).toBe(2);
    expect(b.view().stageTime).toBe(0);
    expect(b.checkpoint().hash).toBe(cp.hash);
    // continue both from the Stage start with the same inputs: identical states
    const a2 = createSim({ ...opts, resume: cp.data });
    for (let i = 0; i < 60 * 40; i++) { botStep(a2, t + i); botStep(b, t + i); }
    expect(b.hash()).toBe(a2.hash());
    expect(b.view().kills).toBe(a2.view().kills);
  });

  it('carries the whole Run: Skills, Gold, Score parts, RNG streams', () => {
    const opts = botOptions(32, { debug: { god: true } });
    const a = createSim(opts);
    for (let t = 0; t < 60 * 60 * 4 && a.view().stage < 2; t++) botStep(a, t);
    const b = createSim({ ...opts, resume: a.checkpoint().data });
    const va = createSim({ ...opts, resume: a.checkpoint().data }).view(), vb = b.view();
    expect(vb.P.skills).toEqual(va.P.skills);
    expect(vb.runGold).toBe(va.runGold);
    expect(vb.kingsKilled).toEqual(va.kingsKilled);
    expect(vb.rng.loot.state()).toEqual(va.rng.loot.state());
    expect(a.checkpoint().data.length).toBeLessThan(60000);
  });

  it('a different Stage start gives a different hash', () => {
    const a = createSim(botOptions(33, { debug: { god: true } }));
    const h1 = a.checkpoint().hash;
    for (let t = 0; t < 60 * 60 * 4 && a.view().stage < 2; t++) botStep(a, t);
    expect(a.checkpoint().hash).not.toBe(h1);
  });
});
