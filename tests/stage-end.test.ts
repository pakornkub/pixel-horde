// Stage-end rewards: chests and level-ups still waiting when a Stage ends (the King's chest that
// the vacuum brings in, the Blood Moon bonus chest) open before the Stage-end screen, never at the
// start of the next Stage.
import { describe, expect, it } from 'vitest';
import { parseBalanceConfig, resolveConfig } from '@pixel-horde/config';
import { createSim, type Command, type SimState } from '@pixel-horde/sim';
import { botOptions } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };
const cfg = resolveConfig(parseBalanceConfig({ shared: { stage: { durBase: 8 } } }));

function toClearing() {
  const sim = createSim(botOptions(7, { events: quiet, debug: { god: true }, config: cfg }));
  const v = (): SimState => sim.view() as SimState;
  for (let i = 0; i < 60 * 90 && v().phase !== 'clearing'; i++) {
    const cmds: Command[] = [];
    if (v().phase === 'levelup') cmds.push({ type: 'pick', index: 0 });
    if (v().phase === 'chest') cmds.push({ type: 'chestStop' });
    if (v().boss) v().boss!.hp = 0.1; // let the King die so the Stage clears on time
    sim.step({ mx: 0, my: 0 }, cmds);
  }
  expect(v().phase).toBe('clearing');
  return { sim, v };
}

describe('Stage-end rewards', () => {
  it('a chest still waiting opens (with its picks) before the clear screen, then the clear screen shows', () => {
    const { sim, v } = toClearing();
    v().chestQueue = 1;
    for (let i = 0; i < 60 * 8 && v().phase === 'clearing'; i++) sim.step({ mx: 0, my: 0 });
    expect(v().phase).toBe('chest');
    sim.step({ mx: 0, my: 0 }, [{ type: 'chestStop' }]);
    for (let i = 0; i < 10 && v().phase === 'levelup'; i++) sim.step({ mx: 0, my: 0 }, [{ type: 'pick', index: 0 }]);
    for (let i = 0; i < 30 && v().phase === 'clearing'; i++) sim.step({ mx: 0, my: 0 });
    expect(v().phase).toBe('clear');
    expect(v().stage).toBe(1);
    expect(v().chestQueue + v().pendingChest + v().pendingLv).toBe(0);
    // the next Stage starts straight into play, with no leftover chest
    sim.step({ mx: 0, my: 0 }, [{ type: 'next' }]);
    for (let i = 0; i < 5 && v().phase === 'route'; i++) sim.step({ mx: 0, my: 0 }, [{ type: 'route', index: 0 }]);
    sim.step({ mx: 0, my: 0 });
    expect(v().stage).toBe(2);
    expect(v().phase).toBe('play');
  });

  it('the Blood Moon bonus chest comes at the end of the Blood Moon Stage', () => {
    const sim = createSim(botOptions(7, { events: quiet, debug: { god: true }, config: cfg }));
    const v = (): SimState => sim.view() as SimState;
    v().specialStage = true;
    let sawChestAtEnd = false;
    for (let i = 0; i < 60 * 120 && v().phase !== 'clear'; i++) {
      const cmds: Command[] = [];
      if (v().phase === 'levelup') cmds.push({ type: 'pick', index: 0 });
      if (v().phase === 'chest') { if (v().pickReturn) sawChestAtEnd = true; cmds.push({ type: 'chestStop' }); }
      if (v().boss) v().boss!.hp = 0.1;
      sim.step({ mx: 0, my: 0 }, cmds);
    }
    expect(v().phase).toBe('clear');
    expect(sawChestAtEnd).toBe(true);
  });
});
