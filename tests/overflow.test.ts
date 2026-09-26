import { describe, expect, it } from 'vitest';
import { createSim, goldBag, type LevelOption, type SimState, type SkillId } from '@pixel-horde/sim';
import { buildOptions, choose, openLevelUp, reroll } from '../packages/sim/src/systems/progress';
import { recompute } from '../packages/sim/src/systems/player';
import { botOptions } from './bot';

/** Every equipped Skill and passive at max level, the Bench full: nothing left to upgrade. */
function maxed(): SimState {
  const s = createSim(botOptions(2, { meta: { up: {}, wallet: 0 } })).view() as SimState;
  const four = ['bolt', 'chain', 'nova', 'meteor'] as SkillId[];
  s.P.skills = Object.fromEntries(four.map((k) => [k, s.cfg.skills[k].max]));
  s.P.pas = { might: s.cfg.passives.max.might, haste: s.cfg.passives.max.haste, swift: s.cfg.passives.max.swift };
  s.P.evo = Object.fromEntries(four.map((k) => [k, true]));
  s.P.bench = [{ id: 'frost', lv: 2, evo: false }];
  recompute(s);
  return s;
}

const kinds = (o: LevelOption[]): string[] => o.map((x) => ('id' in x ? x.kind + ':' + x.id : x.kind));

function pick(s: SimState, want: (o: LevelOption) => boolean): LevelOption {
  for (let i = 0; i < 400; i++) {
    s.pendingLv = 1;
    openLevelUp(s);
    const idx = s.levelUp!.options.findIndex(want);
    if (idx >= 0) { const o = s.levelUp!.options[idx]; choose(s, idx); return o; }
  }
  throw new Error('never offered');
}

describe('fillers once the upgrades run out (ticket 47)', () => {
  it('offers 3 different fillers instead of a lone Recover', () => {
    const s = maxed();
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const o = buildOptions(s);
      expect(o).toHaveLength(3);
      expect(new Set(kinds(o)).size).toBe(3);
      expect(o.every((x) => ['lb', 'train', 'gold', 'heal'].includes(x.kind))).toBe(true);
      kinds(o).forEach((k) => seen.add(k));
    }
    // full HP: no Recover; every Limit Break, the Bench entry and the Gold bag show up
    expect([...seen].sort()).toEqual(['gold', 'lb:crit', 'lb:dmg', 'lb:hp', 'lb:spd', 'train:frost']);
    s.P.hp = 1;
    expect(Array.from({ length: 200 }, () => kinds(buildOptions(s))).flat()).toContain('heal');
  });

  it('fills the rest of a short offer after the real upgrades', () => {
    const s = maxed();
    s.P.skills.bolt = s.cfg.skills.bolt.max - 1;
    for (let i = 0; i < 50; i++) {
      const o = buildOptions(s);
      expect(o[0]).toEqual({ kind: 'skill', id: 'bolt' });
      expect(o.slice(1).every((x) => ['lb', 'train', 'gold', 'heal'].includes(x.kind))).toBe(true);
    }
  });

  it('Limit Break stacks additively, raises max HP with current HP, stops at its max and at the crit cap', () => {
    const s = maxed(), O = s.cfg.overflow;
    const dmg = s.P.dmgMul;
    pick(s, (o) => o.kind === 'lb' && o.id === 'dmg');
    pick(s, (o) => o.kind === 'lb' && o.id === 'dmg');
    expect(s.P.dmgMul).toBeCloseTo(dmg + 2 * O.dmg);
    const hp = s.P.maxHp, cur = s.P.hp - 10;
    s.P.hp = cur;
    pick(s, (o) => o.kind === 'lb' && o.id === 'hp');
    expect(s.P.maxHp).toBe(Math.round(hp * (1 + O.hp)));
    expect(s.P.hp).toBe(cur + s.P.maxHp - hp);
    s.P.lb = { ...s.P.lb, dmg: O.max };
    s.P.crit = s.cfg.player.critCap;
    const all = Array.from({ length: 200 }, () => kinds(buildOptions(s))).flat();
    expect(all).not.toContain('lb:dmg');
    expect(all).not.toContain('lb:crit');
    expect(all).toContain('lb:spd');
  });

  it('training raises a Bench entry until its max; a Gold bag pays Gold × Chapter', () => {
    const s = maxed();
    pick(s, (o) => o.kind === 'train');
    expect(s.P.bench[0].lv).toBe(3);
    s.P.bench[0].lv = s.cfg.skills.frost.max;
    expect(Array.from({ length: 200 }, () => kinds(buildOptions(s))).flat()).not.toContain('train:frost');
    s.stage = 4; // the Bench grows to 2: fill it with a maxed passive
    s.P.bench.push({ id: 'crit', lv: s.cfg.passives.max.crit, evo: false, pas: true });
    const g = s.runGold;
    pick(s, (o) => o.kind === 'gold');
    expect(s.runGold - g).toBe(goldBag(s));
    expect(goldBag(s)).toBe(Math.round(s.cfg.overflow.gold * 4));
  });

  it('a reroll draws a new set of fillers', () => {
    const s = maxed();
    s.sp = 50;
    s.pendingLv = 1;
    openLevelUp(s);
    const sets = new Set<string>();
    for (let i = 0; i < 20; i++) { sets.add(kinds(s.levelUp!.options).sort().join()); reroll(s); }
    expect(sets.size).toBeGreaterThan(1);
  });

  it('with every weight at 0 it still offers Recover', () => {
    const s = maxed();
    s.cfg = { ...s.cfg, overflow: { ...s.cfg.overflow, wLb: 0, wTrain: 0, wGold: 0, wHeal: 0 } };
    expect(buildOptions(s)).toEqual([{ kind: 'heal' }]);
  });
});
