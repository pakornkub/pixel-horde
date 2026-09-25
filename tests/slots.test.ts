import { describe, expect, it } from 'vitest';
import { PASSIVE_IDS, SKILL_IDS, benchSize, createSim, swapCost, type SimState, type SkillId } from '@pixel-horde/sim';
import { botOptions } from './bot';

function fresh(wallet = 0): { sim: ReturnType<typeof createSim>; s: SimState } {
  const sim = createSim(botOptions(2, { meta: { up: {}, wallet } }));
  return { sim, s: sim.view() as SimState };
}

/** Collect every option offered over many level-ups without choosing (rolls re-drawn each time). */
async function offers(s: SimState, n = 300) {
  const { buildOptions } = await import('../packages/sim/src/systems/progress');
  const all = [];
  for (let i = 0; i < n; i++) all.push(...buildOptions(s));
  return all;
}

describe('Skill slots v2 and the Bench', () => {
  it('offers new Skills freely while an attack slot is free', async () => {
    const { s } = fresh();
    const o = await offers(s);
    expect(o.some((x) => x.kind === 'skill' && !s.P.skills[x.id] && !x.toBench)).toBe(true);
  });

  it('with 4 attack skills, new Skills go to the Bench only while it has room; benched Skills are never offered', async () => {
    const { s } = fresh();
    const four = ['bolt', 'chain', 'nova', 'meteor'] as SkillId[];
    s.P.skills = Object.fromEntries(four.map((k) => [k, 1]));
    let o = await offers(s);
    const news = o.filter((x) => x.kind === 'skill' && !four.includes(x.id));
    expect(news.length).toBeGreaterThan(0);
    expect(news.every((x) => x.kind === 'skill' && x.toBench)).toBe(true);
    s.P.bench = [{ id: 'frost', lv: 3, evo: false }];
    expect(benchSize(s)).toBe(1);
    o = await offers(s);
    expect(o.some((x) => x.kind === 'skill' && !four.includes(x.id))).toBe(false);
    expect(o.some((x) => x.kind === 'skill' && x.id === 'frost')).toBe(false);
  });

  it('new passives only while a passive slot is free', async () => {
    const { s } = fresh();
    s.P.pas = { might: 1, haste: 1, swift: 1 };
    const o = await offers(s);
    expect(o.some((x) => x.kind === 'pas' && !['might', 'haste', 'swift'].includes(x.id))).toBe(false);
    expect(o.some((x) => x.kind === 'pas')).toBe(true);
    expect(PASSIVE_IDS.length).toBeGreaterThan(3);
  });

  it('picking a Bench offer puts the Skill on the Bench at level 1', () => {
    const { sim, s } = fresh();
    s.P.skills = { bolt: 1, chain: 1, nova: 1, meteor: 1 };
    s.phase = 'levelup';
    s.pendingLv = 1;
    s.levelUp = { options: [{ kind: 'skill', id: 'frost', toBench: true }], chest: false, lv: 2 };
    sim.step({ mx: 0, my: 0 }, [{ type: 'pick', index: 0 }]);
    expect(s.P.bench).toEqual([{ id: 'frost', lv: 1, evo: false }]);
    expect(s.P.skills.frost).toBeUndefined();
  });

  it('the Bench grows once Chapters 2 and 4 are behind the player', () => {
    const { s } = fresh();
    const at = (n: number) => { s.stage = n; return benchSize(s); };
    expect([at(1), at(2), at(3), at(4), at(5), at(8)]).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('Stage-end swaps cost 20 × Chapter, double each time, and draw on this Run\'s Gold before the wallet', () => {
    const { sim, s } = fresh(200);
    s.phase = 'clear';
    s.stage = 3;
    s.runGold = 70;
    s.P.skills = { bolt: 5, chain: 2 };
    s.P.evo = { chain: true };
    s.P.bench = [{ id: 'frost', lv: 4, evo: false }];
    expect(swapCost(s)).toBe(60);
    sim.step({ mx: 0, my: 0 }, [{ type: 'swap', bench: 0, slot: 'chain' }]);
    expect(s.P.skills).toEqual({ bolt: 5, frost: 4 });
    expect(s.P.bench).toEqual([{ id: 'chain', lv: 2, evo: true }]);
    expect(s.runGold).toBe(10);
    expect(s.walletSpent).toBe(0);
    expect(swapCost(s)).toBe(120);
    sim.step({ mx: 0, my: 0 }, [{ type: 'swap', bench: 0, slot: 'frost' }]);
    expect(s.runGold).toBe(0);
    expect(s.walletSpent).toBe(110);
    expect(s.P.evo.chain).toBe(true);
  });

  it('a swap is refused when Gold is short, outside the clear screen, or for the Signature Skill', () => {
    const { sim, s } = fresh(0);
    s.P.skills = { sigil: 1, chain: 1 };
    s.P.bench = [{ id: 'frost', lv: 1, evo: false }];
    s.runGold = 1000;
    sim.step({ mx: 0, my: 0 }, [{ type: 'swap', bench: 0, slot: 'chain' }]); // phase play
    expect(s.P.bench[0].id).toBe('frost');
    s.phase = 'clear';
    sim.step({ mx: 0, my: 0 }, [{ type: 'swap', bench: 0, slot: 'sigil' }]); // Signature (Lyra)
    expect(s.P.skills.sigil).toBe(1);
    s.runGold = 5;
    const ev = sim.step({ mx: 0, my: 0 }, [{ type: 'swap', bench: 0, slot: 'chain' }]);
    expect(ev.some((e) => e.t === 'swapDenied')).toBe(true);
    expect(s.P.skills.chain).toBe(1);
    expect(SKILL_IDS.length).toBe(12);
  });
});
