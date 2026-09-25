// Shield pickup: a rare drop that soaks damage (× max HP) for a few seconds; all damage still goes through hurtP().
import { describe, expect, it } from 'vitest';
import { createSim, type SimState } from '@pixel-horde/sim';
import { hurtP, killE } from '../packages/sim/src/systems/combat';
import { spawnEnemy } from '../packages/sim/src/systems/spawner';
import { botOptions } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };
function fresh() {
  const sim = createSim(botOptions(9, { events: quiet }));
  const s = sim.view() as SimState;
  s.enemies = [];
  return { sim, s, step: (n = 1) => { for (let i = 0; i < n; i++) sim.step({ mx: 0, my: 0 }, []); } };
}

describe('Shield pickup', () => {
  it('picking it up gives a shield of shieldAbsorb × max HP for shieldDur seconds', () => {
    const { s, step } = fresh();
    const L = s.cfg.loot;
    s.gems.push({ kind: 'shield', x: s.P.x, y: s.P.y, v: L.shieldAbsorb, mag: false });
    step();
    expect(s.P.guard).toBe(Math.round(s.P.maxHp * L.shieldAbsorb));
    expect(s.P.guardT).toBeGreaterThan(L.shieldDur - 0.1);
  });

  it('soaks damage before HP, then the rest goes to HP', () => {
    const { s } = fresh();
    s.P.guard = 30; s.P.guardT = 10;
    const hp = s.P.hp;
    hurtP(s, 10);
    expect(s.P.hp).toBe(hp);
    expect(s.P.guard).toBeLessThan(30);
    s.P.inv = 0;
    hurtP(s, 100);
    expect(s.P.guard).toBe(0);
    expect(s.P.guardT).toBe(0);
    expect(s.P.hp).toBeLessThan(hp);
  });

  it('runs out after shieldDur seconds', () => {
    const { s, step } = fresh();
    s.P.guard = 30; s.P.guardT = s.cfg.loot.shieldDur;
    step(Math.ceil(s.cfg.loot.shieldDur * 60) + 2);
    expect(s.P.guardT).toBeLessThanOrEqual(0);
    expect(s.P.guard).toBe(0);
  });

  it('elite monsters drop it at shieldElite (here: always)', () => {
    const { s } = fresh();
    s.cfg.loot.heartChance = 0; s.cfg.loot.shieldElite = 1;
    const e = spawnEnemy(s, 'slime', 30, 0, true);
    killE(s, e);
    expect(s.gems.some((g) => g.kind === 'shield')).toBe(true);
  });
});
