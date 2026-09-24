import { describe, expect, it } from 'vitest';
import { createSim } from '@pixel-horde/sim';
import { botOptions, botStep, runBot } from './bot';

const MIN = 60 * 60;

describe('headless bot runs', () => {
  it.each([1, 2, 3, 4])('seed %i plays 8 minutes without exceptions and progresses stages (god mode)', (seed) => {
    const { sim } = runBot(botOptions(seed, { debug: { god: true } }), 8 * MIN);
    const v = sim.view();
    expect(v.stage).toBeGreaterThanOrEqual(4);
    expect(v.P.lv).toBeGreaterThan(10);
    expect(v.kills).toBeGreaterThan(500);
  });

  it.each([5, 6])('seed %i plays until death or 10 minutes without exceptions', (seed) => {
    const { sim, ticks } = runBot(botOptions(seed), 10 * MIN);
    const v = sim.view();
    expect(ticks).toBeGreaterThan(20 * 60);
    expect(['over', 'play', 'levelup', 'chest', 'clearing', 'clear']).toContain(v.phase);
    expect(Number.isFinite(v.P.x) && Number.isFinite(v.P.y)).toBe(true);
  });

  it('forced dragon: hazards appear, hit the player, and taming grants a pet', () => {
    const sim = createSim(botOptions(11, { debug: { event: 'dragon' } }));
    let sawHazard = false, hurtByHazard = false;
    for (let t = 0; t < 3 * MIN && sim.view().phase !== 'over'; t++) {
      const before = sim.view().P.hp;
      botStep(sim, t);
      const v = sim.view();
      if (v.hz.length) sawHazard = true;
      if (v.dragonE && v.P.hp < before && v.hz.length) hurtByHazard = true;
    }
    expect(sawHazard).toBe(true);
    expect(hurtByHazard).toBe(true);
    const god = runBot(botOptions(1, { debug: { god: true, event: 'dragon' } }), 8 * MIN).sim.view();
    expect(god.P.pet).not.toBeNull();
  });

  it('forced rival grants shards or a shadow clone', () => {
    const v = runBot(botOptions(1, { debug: { god: true, event: 'rival' } }), 8 * MIN).sim.view();
    expect(v.P.clone !== null || v.P.shards > 0).toBe(true);
  });

  it('blood moon doubles coins and queues a bonus chest', () => {
    const plain = runBot(botOptions(1, { debug: { god: true } }), 5 * MIN).sim.view().runGold;
    const moon = runBot(botOptions(1, { debug: { god: true, event: 'bloodmoon' } }), 5 * MIN).sim.view().runGold;
    expect(moon).toBeGreaterThan(plain);
  });

  it('a stage clears only when its timer ends and the next stage is longer', () => {
    const sim = createSim(botOptions(3, { debug: { god: true } }));
    let clearedAt = -1;
    for (let t = 0; t < 2 * MIN; t++) {
      botStep(sim, t);
      if (clearedAt < 0 && sim.view().phase === 'clearing') clearedAt = sim.view().stageTime;
    }
    expect(clearedAt).toBeGreaterThanOrEqual(60);
    expect(sim.view().stage).toBe(2);
    expect(sim.view().stageDur).toBe(80);
  });
});

describe('Balance Config drives the sim', () => {
  it('a shorter stage length clears earlier', async () => {
    const { parseBalanceConfig, resolveConfig } = await import('@pixel-horde/config');
    const config = resolveConfig(parseBalanceConfig({ shared: { stage: { durBase: 20 } } }));
    const sim = createSim(botOptions(3, { debug: { god: true }, config }));
    expect(sim.view().stageDur).toBe(20);
    let cleared = false;
    for (let t = 0; t < 30 * 60 && !cleared; t++) { botStep(sim, t); cleared = sim.view().phase === 'clearing'; }
    expect(cleared).toBe(true);
  });
});
