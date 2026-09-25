import { describe, expect, it } from 'vitest';
import { parseBalanceConfig, resolveConfig } from '@pixel-horde/config';
import { createSim } from '@pixel-horde/sim';
import { botOptions, botStep } from './bot';

const weakKings = { worlds: { lumora: { enemies: { boss: { hp: 5 }, bossD: { hp: 5 }, bossC: { hp: 5 }, bossS: { hp: 5 } } } } };
const v7 = resolveConfig({ ...parseBalanceConfig({ ...weakKings, shared: { stage: { durBase: 20, durPerStage: 0 } } }), version: 7 });

describe('live Balance Config and event flags', () => {
  it('a new config version applies at the next Stage start, never mid-Stage', () => {
    const sim = createSim(botOptions(4, { debug: { god: true }, config: resolveConfig(parseBalanceConfig(weakKings)) }));
    let t = 0;
    for (; t < 600; t++) botStep(sim, t);
    sim.step({ mx: 0, my: 0 }, [{ type: 'setConfig', config: v7 }]);
    expect(sim.view().stageDur).toBe(60); // still the Stage-1 rules
    expect(sim.view().cfg.version).toBe(0);
    for (; sim.view().stage < 2 && t < 5000; t++) botStep(sim, t);
    expect(sim.view().stage).toBe(2);
    expect(sim.view().cfg.version).toBe(7);
    expect(sim.view().stageDur).toBe(20);
    expect(sim.view().configVersions).toEqual([0, 7]);
  });

  it('switched-off events never happen but keep the same random rolls', () => {
    const on = createSim(botOptions(5, { debug: { god: true } }));
    const off = createSim(botOptions(5, { debug: { god: true }, events: { bloodMoon: false, dragon: false, rival: false } }));
    let sawOn = false, sawOff = false;
    for (let t = 0; t < 60 * 60 * 6; t++) {
      botStep(on, t); botStep(off, t);
      sawOn ||= on.view().specialStage || on.view().rivalStage;
      sawOff ||= off.view().specialStage || off.view().rivalStage || off.view().dragonStage;
    }
    expect(sawOn).toBe(true);
    expect(sawOff).toBe(false);
  });
});
