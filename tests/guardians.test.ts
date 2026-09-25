import { describe, expect, it } from 'vitest';
import { createSim, type HazardKind, type SimState } from '@pixel-horde/sim';
import { killE } from '../packages/sim/src/systems/combat';
import { grantGuardian, guardianPity, pickGuardian, petStep } from '../packages/sim/src/systems/guardians';
import { spawnEnemy } from '../packages/sim/src/systems/spawner';
import { botOptions } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };
const fresh = (extra: Parameters<typeof botOptions>[1] = {}) => {
  const sim = createSim(botOptions(21, { debug: { god: true }, events: quiet, ...extra }));
  return { sim, s: sim.view() as SimState };
};

describe('Guardians', () => {
  it('are favoured by the Realm element; after the first one, missing ones become likelier', () => {
    const { s } = fresh();
    s.realm = 'frostpeak';
    expect(pickGuardian(s)).toBe('frost');
    expect(guardianPity(s)).toBe(false); // no Guardian yet
    s.P.guardiansBeaten = ['inferno'];
    expect(guardianPity(s)).toBe(true); // Frostpeak matches the missing Frost Dragon
    s.P.guardiansBeaten = ['inferno', 'frost'];
    expect(guardianPity(s)).toBe(false);
    s.realm = 'greenvale';
    for (let i = 0; i < 20; i++) expect(pickGuardian(s)).toBe('storm'); // only the missing one
  });

  it('the Frost Dragon\'s blizzard freezes a player who stops moving', () => {
    const sim = createSim(botOptions(21, { debug: { event: 'frostdragon' }, events: quiet }));
    const s = sim.view() as SimState;
    s.spawnAcc = -1e9; s.waveT = 1e9;
    s.dragonKind = 'frost';
    const hurt: number[] = [];
    for (let i = 0; i < 60 * 60 && s.phase !== 'over'; i++) {
      const ph: string = s.phase;
      const hp = s.P.hp;
      sim.step({ mx: 0, my: 0 }, ph === 'levelup' ? [{ type: 'pick', index: 0 }] : ph === 'chest' ? [{ type: 'chestStop' }] : []);
      if (s.hz.some((h) => h.k === 'bliz' && h.t > h.te!) && s.P.hp < hp) hurt.push(i);
      s.P.hp = Math.max(s.P.hp, 50);
      if (hurt.length) break;
    }
    expect(s.dragonE?.type ?? 'frostDragon').toBe('frostDragon');
    expect(hurt.length).toBeGreaterThan(0);
  });

  it('the Storm Dragon uses lightning rows, bouncing orbs and a dash', () => {
    const { sim, s } = fresh({ debug: { god: true, event: 'stormdragon' } });
    const kinds = new Set<HazardKind>();
    let bounce = false;
    for (let i = 0; i < 90 * 60; i++) {
      const ph: string = s.phase;
      sim.step({ mx: 0, my: 0 }, ph === 'levelup' ? [{ type: 'pick', index: 0 }] : ph === 'chest' ? [{ type: 'chestStop' }] : []);
      if (s.dragonE) s.dragonE.hp = s.dragonE.maxHp;
      for (const h of s.hz) { kinds.add(h.k); if (h.bounce) bounce = true; }
      if (kinds.has('beam') && bounce && kinds.has('line')) break;
    }
    expect(kinds.has('beam') && bounce && kinds.has('line')).toBe(true);
  });
});

describe('Companions', () => {
  it('a defeated Guardian becomes a Companion (no Gold); beating it again gives +2 levels; max 5', () => {
    const { s } = fresh();
    s.dragonKind = 'storm';
    const d = spawnEnemy(s, 'stormDragon', 20, 0, false);
    s.dragonE = d;
    const gold = s.runGold;
    killE(s, d);
    expect(s.P.pet).toMatchObject({ kind: 'storm', lv: 1 });
    expect(s.runGold).toBe(gold);
    grantGuardian(s, 'storm');
    expect(s.P.pet!.lv).toBe(3);
    grantGuardian(s, 'storm'); grantGuardian(s, 'storm');
    expect(s.P.pet!.lv).toBe(5);
  });

  it('1 active + 2 stored, swapped at Stage end', () => {
    const { sim, s } = fresh();
    grantGuardian(s, 'inferno'); grantGuardian(s, 'frost'); grantGuardian(s, 'storm');
    expect(s.P.pet!.kind).toBe('inferno');
    expect(s.P.petStore.map((p) => p.kind)).toEqual(['frost', 'storm']);
    s.phase = 'clear';
    sim.step({ mx: 0, my: 0 }, [{ type: 'companion', index: 1 }]);
    expect(s.P.pet!.kind).toBe('storm');
    expect(s.P.petStore.map((p) => p.kind)).toEqual(['frost', 'inferno']);
  });

  it('levels via the level-up card and 2 Skill Points', () => {
    const { sim, s } = fresh();
    grantGuardian(s, 'frost');
    s.phase = 'levelup'; s.pendingLv = 1;
    s.levelUp = { options: [{ kind: 'comp' }], chest: false, lv: 2 };
    sim.step({ mx: 0, my: 0 }, [{ type: 'pick', index: 0 }]);
    expect(s.P.pet!.lv).toBe(2);
    s.phase = 'clear'; s.sp = 2;
    sim.step({ mx: 0, my: 0 }, [{ type: 'spCompanion' }]);
    expect(s.P.pet!.lv).toBe(3);
    expect(s.sp).toBe(0);
  });

  it('unlocks the second move at level 3', () => {
    const { s } = fresh();
    s.enemies = [];
    for (let i = 0; i < 6; i++) { const e = spawnEnemy(s, 'mush', 30 + i * 5, 0, false); e.hp = e.maxHp = 1e6; e.spd = 0; }
    grantGuardian(s, 'inferno');
    const dives = () => s.effects.filter((f) => f.type === 'meteor').length;
    for (let i = 0; i < 600; i++) { petStep(s, 1 / 60); s.clock += 1 / 60; }
    expect(dives()).toBe(0);
    s.P.pet!.lv = 3;
    for (let i = 0; i < 600; i++) { petStep(s, 1 / 60); s.clock += 1 / 60; }
    expect(dives()).toBeGreaterThan(0);
  });

  it('all three Guardians in one Run offer fusion: level = average rounded up, at least 3', () => {
    const { sim, s } = fresh();
    grantGuardian(s, 'inferno'); grantGuardian(s, 'frost'); grantGuardian(s, 'storm');
    s.P.pet!.lv = 5; s.P.petStore[0].lv = 2; s.P.petStore[1].lv = 1; // average 2.67 → 3
    s.bossSpawned = true; s.boss = null; s.stageTime = s.stageDur;
    for (let i = 0; i < 300 && s.phase !== 'clear'; i++) { const ph: string = s.phase; sim.step({ mx: 0, my: 0 }, ph === 'levelup' ? [{ type: 'pick', index: 0 }] : ph === 'chest' ? [{ type: 'chestStop' }] : []); }
    expect(s.fuseOffer).toBe(true);
    sim.step({ mx: 0, my: 0 }, [{ type: 'fuse', accept: true }]);
    expect(s.P.pet).toMatchObject({ kind: 'tri', lv: 3 });
    expect(s.P.petStore).toEqual([]);
  });
});
