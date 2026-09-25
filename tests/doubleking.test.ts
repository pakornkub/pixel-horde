import { describe, expect, it } from 'vitest';
import { parseBalanceConfig, resolveConfig } from '@pixel-horde/config';
import { REALMS, createSim, type SimEvent, type SimState } from '@pixel-horde/sim';
import { killE } from '../packages/sim/src/systems/combat';
import { botOptions } from './bot';

const always = resolveConfig(parseBalanceConfig({ shared: { events: { doubleKingChance: 1 } } }));
const quiet = { bloodMoon: false, dragon: false, rival: false };

/** Jump to the route choice of `chapter`, pick the first Realm and run until the Kings arrive. */
function toChapter(chapter: number, config = always) {
  const sim = createSim(botOptions(9, { debug: { god: true }, events: quiet, config }));
  const s = sim.view() as SimState;
  const events: SimEvent[] = [];
  s.stage = chapter - 1; s.phase = 'clear'; s.lastEnd = 'clear';
  sim.step({ mx: 0, my: 0 }, [{ type: 'next' }]);
  expect(s.phase).toBe('route');
  const choices = [...s.route!.choices];
  sim.step({ mx: 0, my: 0 }, [{ type: 'route', index: 0 }]);
  for (let i = 0; i < 200 * 60 && !s.boss; i++) {
    const ph: string = s.phase;
    const cmds = ph === 'levelup' ? [{ type: 'pick' as const, index: 0 }] : ph === 'chest' ? [{ type: 'chestStop' as const }] : [];
    events.push(...sim.step({ mx: 0, my: 0 }, cmds));
  }
  return { sim, s, choices, events };
}

describe('double-King Stages', () => {
  it('bring the King of the skipped Realm in Chapters 4–7, both at 70% HP', () => {
    const { s, choices } = toChapter(5);
    expect(s.skipped).toBe(choices[1]);
    expect(s.doubleKing).toBe(true);
    expect(s.boss2?.type).toBe(REALMS[choices[1]].king);
    expect(s.boss!.maxHp).toBeCloseTo(s.boss2!.maxHp);
  });

  it('never happen before Chapter 4 or in the Heart Crater', () => {
    expect(toChapter(3).s.doubleKing).toBe(false);
    const late = createSim(botOptions(9, { debug: { god: true }, events: quiet, config: always }));
    const s = late.view() as SimState;
    s.stage = 7; s.phase = 'clear'; s.lastEnd = 'clear';
    late.step({ mx: 0, my: 0 }, [{ type: 'next' }]);
    expect(s.realm).toBe('crater');
    expect(s.doubleKing).toBe(false);
  });

  it('happen at the configured chance (10% by default)', () => {
    let n = 0;
    for (let seed = 0; seed < 200; seed++) {
      const sim = createSim(botOptions(seed, { events: quiet }));
      const s = sim.view() as SimState;
      s.stage = 4; s.phase = 'clear'; s.lastEnd = 'clear';
      sim.step({ mx: 0, my: 0 }, [{ type: 'next' }]);
      sim.step({ mx: 0, my: 0 }, [{ type: 'route', index: 0 }]);
      if (s.doubleKing) n++;
    }
    expect(n).toBeGreaterThan(8);
    expect(n).toBeLessThan(35);
  });

  it('both Kings pay out and the Stage needs both dead', () => {
    const { sim, s } = toChapter(4);
    const [a, b] = [s.boss!, s.boss2!];
    killE(s, a);
    expect(s.kingsKilled).toEqual([4]);
    s.chestQueue = 0; s.pendingLv = 0; s.pendingChest = 0; s.phase = 'play'; // skip the reward screens for this check
    s.stageTime = s.stageDur; s.hitstop = 0;
    sim.step({ mx: 0, my: 0 });
    expect(s.overtime).toBe(true); // one King still stands
    killE(s, b);
    expect(s.kingsKilled).toEqual([4, 4]);
    expect(s.sp).toBe(2);
  });

  it('both Kings escape (two Escapes, two strengthening shards for Umbra)', () => {
    const { sim, s, choices } = toChapter(6);
    s.stageTime = s.stageDur + s.cfg.stage.overtime;
    s.overtime = true;
    for (let i = 0; i < 3; i++) sim.step({ mx: 0, my: 0 });
    expect(s.escapes).toBe(2);
    expect(s.escapedKings).toEqual([choices[0], choices[1]]);
  });
});
