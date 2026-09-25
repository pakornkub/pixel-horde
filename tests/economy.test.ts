import { describe, expect, it } from 'vitest';
import { createSim, reviveCost, scoreOf, type SimState } from '@pixel-horde/sim';
import { hurtP, killE } from '../packages/sim/src/systems/combat';
import { spawnEnemy } from '../packages/sim/src/systems/spawner';
import { botOptions } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };
function fresh(extra: Parameters<typeof botOptions>[1] = {}) {
  const sim = createSim(botOptions(6, { events: quiet, ...extra }));
  const s = sim.view() as SimState;
  const step = (cmds: Parameters<typeof sim.step>[1] = []) => sim.step({ mx: 0, my: 0 }, cmds);
  return { sim, s, step };
}
const levelUp = (s: SimState): void => {
  s.phase = 'levelup';
  s.pendingLv = 1;
  s.levelUp = { options: [{ kind: 'skill', id: 'chain' }, { kind: 'pas', id: 'might' }, { kind: 'skill', id: 'nova' }], chest: false, lv: 2 };
};

describe('King rewards', () => {
  it('a King kill gives a Skill Point, one chest (the wheel, no chest item) and 50 × Chapter Gold + the chest Gold', () => {
    const { s } = fresh();
    s.stage = 3;
    const k = spawnEnemy(s, 'boss', 30, 0, false);
    s.boss = k;
    const gems = s.gems.length;
    killE(s, k);
    expect(s.sp).toBe(1);
    expect(s.chestQueue).toBe(1);
    expect(s.gems.slice(gems).some((g) => g.kind === 'chest')).toBe(false);
    const coin = s.gems.slice(gems).find((g) => g.kind === 'coin');
    expect(coin?.v).toBe(50 * 3 + s.cfg.loot.chestGold);
  });
});

describe('Skill Points', () => {
  it('reroll costs 1 and redraws the offers', () => {
    const { s, step } = fresh();
    levelUp(s);
    s.sp = 1;
    const before = JSON.stringify(s.levelUp!.options);
    step([{ type: 'reroll' }]);
    expect(s.sp).toBe(0);
    expect(JSON.stringify(s.levelUp!.options)).not.toBe(before);
    step([{ type: 'reroll' }]); // no points left: nothing happens
    expect(s.sp).toBe(0);
  });

  it('banish costs 1 and the Skill never comes back this Run', async () => {
    const { buildOptions } = await import('../packages/sim/src/systems/progress');
    const { s, step } = fresh();
    levelUp(s);
    s.sp = 1;
    step([{ type: 'banish', index: 0 }]);
    expect(s.sp).toBe(0);
    expect(s.banished).toEqual(['chain']);
    for (let i = 0; i < 300; i++) for (const o of buildOptions(s)) expect(o.kind === 'skill' && o.id === 'chain').toBe(false);
  });

  it('+1 level costs 2 and respects the max level', () => {
    const { s, step } = fresh();
    s.phase = 'clear';
    s.sp = 5;
    step([{ type: 'spUpgrade', id: 'sigil' }]);
    expect(s.P.skills.sigil).toBe(2);
    expect(s.sp).toBe(3);
    s.P.skills.sigil = s.cfg.skills.sigil.max;
    step([{ type: 'spUpgrade', id: 'sigil' }]);
    expect(s.sp).toBe(3);
  });

  it('Gold buys Skill Points at 30 × Chapter at Stage end', () => {
    const { s, step } = fresh({ meta: { up: {}, wallet: 100 } });
    s.phase = 'clear';
    s.stage = 2;
    s.runGold = 40;
    step([{ type: 'buySp' }]);
    expect(s.sp).toBe(1);
    expect(s.runGold).toBe(0);
    expect(s.walletSpent).toBe(20);
    step([{ type: 'buySp' }]);
    expect(s.sp).toBe(2);
    expect(s.walletSpent).toBe(80);
  });
});

describe('Bought revive', () => {
  it('is offered on death once per Run for 75 × Chapter Gold and cuts the Score by 15%', () => {
    const { s, step } = fresh();
    s.stage = 2;
    s.runGold = 500;
    s.kills = 1000;
    s.P.inv = 0; s.P.revives = 0;
    hurtP(s, 1e6);
    expect(s.phase).toBe('revive');
    const full = scoreOf(s);
    step([{ type: 'revive' }]);
    expect(s.phase).toBe('play');
    expect(s.runGold).toBe(500 - reviveCost(s));
    expect(s.P.hp).toBeGreaterThan(0);
    expect(scoreOf(s)).toBe(full - Math.round(full * 0.15));
    s.P.inv = 0;
    hurtP(s, 1e6);
    expect(s.phase).toBe('over'); // only once per Run
  });

  it('Second Wind comes first; no offer when Gold is short or in the daily challenge', () => {
    const a = fresh();
    a.s.P.revives = 1; a.s.runGold = 500; a.s.P.inv = 0;
    hurtP(a.s, 1e6);
    expect(a.s.phase).toBe('play');
    const b = fresh();
    b.s.runGold = 10; b.s.P.inv = 0; b.s.P.revives = 0;
    hurtP(b.s, 1e6);
    expect(b.s.phase).toBe('over');
    const c = fresh({ mode: 'daily' });
    c.s.runGold = 500; c.s.P.inv = 0; c.s.P.revives = 0;
    hurtP(c.s, 1e6);
    expect(c.s.phase).toBe('over');
  });

  it('giving up ends the Run', () => {
    const { s, step } = fresh();
    s.runGold = 500; s.P.inv = 0; s.P.revives = 0;
    hurtP(s, 1e6);
    step([{ type: 'giveUp' }]);
    expect(s.phase).toBe('over');
  });
});
