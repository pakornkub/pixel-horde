// Outfits (ticket 51): piece stats add to the player's bonuses; a full set adds damage against its monsters.
import { describe, expect, it } from 'vitest';
import { createSim, outfitSet, outfitStats, type OutfitWear, type SimState } from '@pixel-horde/sim';
import { hit } from '../packages/sim/src/systems/combat';
import { spawnEnemy } from '../packages/sim/src/systems/spawner';
import { asWritten, botOptions } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };
function fresh(outfit?: OutfitWear) {
  const sim = createSim(botOptions(5, { debug: { god: true }, events: quiet, config: asWritten(), meta: { up: {}, outfit } }));
  const s = sim.view() as SimState;
  s.enemies = [];
  s.P.crit = 0; // no crits: exact damage
  return s;
}
const full = (set: 'ember' | 'frost' | 'storm' | 'shadow', lv: number): OutfitWear => ({ hat: { set, lv }, body: { set, lv }, cloak: { set, lv } });

describe('outfits', () => {
  it('pieces add damage, max HP and crit (additive, like Might / Vigor / Keen Eye)', () => {
    const plain = fresh(), worn = fresh({ hat: { set: 'ember', lv: 5 }, body: { set: 'frost', lv: 3 }, cloak: { set: 'storm', lv: 2 } });
    const O = plain.cfg.outfits;
    expect(worn.P.dmgMul - plain.P.dmgMul).toBeCloseTo(O.hatDmg * 5, 9);
    expect(worn.P.maxHp - plain.P.maxHp).toBe(O.bodyHp * 3);
    expect(worn.P.outfitSet).toBeNull(); // mixed sets: no set bonus
  });

  it('levels are capped at outfits.max; a set needs all three slots at level 1+', () => {
    const cfg = fresh().cfg;
    expect(outfitStats(cfg, { hat: { set: 'ember', lv: 99 } }).dmg).toBeCloseTo(cfg.outfits.hatDmg * cfg.outfits.max, 9);
    expect(outfitSet(cfg, { hat: { set: 'ember', lv: 2 }, body: { set: 'ember', lv: 1 } })).toBeNull();
    expect(outfitSet(cfg, { ...full('ember', 4), body: { set: 'ember', lv: 2 } })).toEqual({ set: 'ember', lv: 2 });
  });

  it('a full set adds damage against its own monsters only (Shadow: bosses)', () => {
    const dmgTo = (outfit: OutfitWear | undefined, prep: (e: ReturnType<typeof spawnEnemy>) => void, boss = false): number => {
      const s = fresh(outfit);
      const e = spawnEnemy(s, boss ? 'boss' : 'mush', 40, 0, false); e.hp = e.maxHp = 1e9; e.armor = 0;
      prep(e);
      s.rng.combat = { ...s.rng.combat, range: () => 1, next: () => 0.99 } as typeof s.rng.combat; // no variance, no crit
      hit(s, e, 1000, '#fff');
      return 1e9 - e.hp;
    };
    const burning = (e: { burn?: number }): void => { e.burn = 2; }, none = (): void => undefined;
    const cfg = fresh().cfg, bonus = 1 + cfg.outfits.setBase + cfg.outfits.setPerLv * 3;
    // same outfit, with vs without the set's target: exactly the set bonus
    expect(dmgTo(full('ember', 3), burning) / dmgTo(full('ember', 3), none)).toBeCloseTo(bonus, 2);
    expect(dmgTo(full('storm', 3), burning) / dmgTo(full('storm', 3), none)).toBeCloseTo(1, 2); // Storm ignores Burning
    expect(dmgTo(full('storm', 3), (e) => { (e as { shock?: number }).shock = 2; }) / dmgTo(full('storm', 3), none)).toBeCloseTo(bonus, 2);
    expect(dmgTo(full('frost', 3), (e) => { (e as { chill?: number }).chill = 1; }) / dmgTo(full('frost', 3), none)).toBeCloseTo(bonus, 2);
    expect(dmgTo(full('shadow', 3), none, true) / dmgTo(full('shadow', 3), none)).toBeCloseTo(bonus, 2);
    expect(dmgTo(undefined, none, true) / dmgTo(undefined, none)).toBeCloseTo(1, 2);
  });
});
