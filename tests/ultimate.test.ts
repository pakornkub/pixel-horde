import { describe, expect, it } from 'vitest';
import { WEAPON_IDS, createSim, weaponKey, type SimEvent, type SimState } from '@pixel-horde/sim';
import { killE } from '../packages/sim/src/systems/combat';
import { chapterMobHp, spawnEnemy } from '../packages/sim/src/systems/spawner';
import { asWritten, botOptions } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };
function fresh(extra: Parameters<typeof botOptions>[1] = {}) {
  const sim = createSim(botOptions(8, { debug: { god: true }, events: quiet, config: asWritten(), ...extra }));
  const s = sim.view() as SimState;
  s.spawnAcc = -1e9; s.waveT = 1e9; s.enemies = [];
  const step = (n = 1, cmds: Parameters<typeof sim.step>[1] = []): SimEvent[] => { const ev: SimEvent[] = []; for (let i = 0; i < n; i++) { s.spawnAcc = -1e9; ev.push(...sim.step({ mx: 0, my: 0 }, i ? [] : cmds)); } return ev; };
  return { sim, s, step };
}

describe('Ultimate charge', () => {
  it('fills from time alone in 60 s', () => {
    const { s, step } = fresh();
    s.P.skills = {};
    step(59 * 60);
    expect(s.ult).toBeLessThan(s.cfg.ult.max);
    step(2 * 60);
    expect(s.ult).toBe(s.cfg.ult.max);
  });

  it('kills can at most double the rate (never full before ~30 s)', () => {
    const { s, step } = fresh();
    s.P.skills = {};
    let t = 0;
    for (; t < 60 * 60 && s.ult < s.cfg.ult.max; t++) {
      for (let k = 0; k < 20; k++) killE(s, spawnEnemy(s, 'slime', 300, 300, false)); // an absurd kill rate
      step();
    }
    expect(t / 60).toBeGreaterThan(29);
    expect(t / 60).toBeLessThan(31.5);
  });
});

describe('Ultimate damage', () => {
  function strike(extra: Parameters<typeof botOptions>[1] = {}, prep?: (s: SimState) => void) {
    const { s, step } = fresh(extra);
    s.P.skills = {};
    prep?.(s);
    const mob = spawnEnemy(s, 'mush', 30, 0, false); mob.hp = mob.maxHp = 1e9; mob.armor = 0;
    const king = spawnEnemy(s, 'boss', -30, 0, false); king.hp = king.maxHp = 5000;
    s.ult = s.cfg.ult.max;
    const expected = s.cfg.ult.mobHp * chapterMobHp(s);
    step(60, [{ type: 'ult' }]);
    return { s, mob, king, expected };
  }

  it('is 1.5 × the Chapter\'s monster HP and ignores Might, Power and crits', () => {
    const plain = strike();
    const strong = strike({ meta: { up: { power: 10 } } }, (s) => { s.P.pas = { might: 5, crit: 5 }; s.P.dmgMul = 10; s.P.crit = 1; });
    expect(1e9 - plain.mob.hp).toBe(Math.round(plain.expected));
    expect(1e9 - strong.mob.hp).toBe(1e9 - plain.mob.hp);
  });

  it('takes at most 8% of a King and 5% of Umbra', () => {
    const { king } = strike({}, (s) => { s.stage = 8; });
    expect(5000 - king.hp).toBe(400); // 8% cap below the uncapped hit
    const u = fresh();
    u.s.P.skills = {};
    const umbra = spawnEnemy(u.s, 'umbra', 20, 0, false); umbra.hp = umbra.maxHp = 10000;
    u.s.stage = 8; u.s.ult = u.s.cfg.ult.max;
    u.step(60, [{ type: 'ult' }]);
    expect(10000 - umbra.hp).toBe(500);
  });
});

describe('Weapons', () => {
  it('change only the Ultimate: Sunblade burns, Glacier Lance freezes, Thornwhip roots', () => {
    const burn = fresh({ weapon: 'sunblade' });
    const m1 = spawnEnemy(burn.s, 'mush', 30, 0, false); m1.hp = m1.maxHp = 1e9;
    burn.s.P.skills = {}; burn.s.ult = burn.s.cfg.ult.max;
    burn.step(60, [{ type: 'ult' }]);
    expect(m1.burn).toBeGreaterThan(0);
    const ice = fresh({ weapon: 'glacierLance' });
    const m2 = spawnEnemy(ice.s, 'mush', 30, 0, false); m2.hp = m2.maxHp = 1e9;
    ice.s.P.skills = {}; ice.s.ult = ice.s.cfg.ult.max;
    ice.step(60, [{ type: 'ult' }]);
    expect(m2.frz).toBeGreaterThan(0);
    const root = fresh({ weapon: 'thornwhip' });
    const m3 = spawnEnemy(root.s, 'mush', 30, 0, false); m3.hp = m3.maxHp = 1e9;
    root.s.P.skills = {}; root.s.ult = root.s.cfg.ult.max;
    root.step(60, [{ type: 'ult' }]);
    expect(m3.stun).toBeGreaterThan(0);
    expect(root.s.P.dmgMul).toBe(fresh().s.P.dmgMul);
  });

  it('Kings drop their Realm\'s Weapon at 5% only when not owned; a found Weapon can be picked at Stage end', () => {
    let drops = 0;
    for (let i = 0; i < 400; i++) {
      const { s } = fresh({ seed: 1000 + i });
      const k = spawnEnemy(s, 'boss', 10, 0, false);
      s.boss = k;
      killE(s, k);
      drops += s.foundWeapons.length;
    }
    expect(drops).toBeGreaterThan(5);
    expect(drops).toBeLessThan(40);
    const owned = fresh({ meta: { up: {}, weapons: [weaponKey('thornwhip')] } });
    for (let i = 0; i < 200; i++) { const k = spawnEnemy(owned.s, 'boss', 10, 0, false); owned.s.boss = k; killE(owned.s, k); }
    expect(owned.s.foundWeapons).toEqual([]);
    const { s, step } = fresh();
    s.foundWeapons = ['thornwhip'];
    step(1, [{ type: 'weapon', id: 'thornwhip' }]);
    expect(s.weapon).toBe('judgement'); // only at Stage end
    s.phase = 'clear';
    step(1, [{ type: 'weapon', id: 'thornwhip' }]);
    expect(s.weapon).toBe('thornwhip');
    step(1, [{ type: 'weapon', id: 'sunblade' }]); // not found this Run
    expect(s.weapon).toBe('thornwhip');
    step(1, [{ type: 'weapon', id: 'judgement' }]); // back to the default
    expect(s.weapon).toBe('judgement');
    const col = fresh({ meta: { up: {}, weapons: [weaponKey('sunblade')] } });
    col.s.foundWeapons = ['thornwhip']; col.s.phase = 'clear';
    col.step(1, [{ type: 'weapon', id: 'sunblade' }]); // from the collection
    expect(col.s.weapon).toBe('sunblade');
  });

  it('beating Umbra always gives a missing Weapon, or 500 Gold when the collection is complete', () => {
    const a = fresh();
    const u = spawnEnemy(a.s, 'umbra', 10, 0, false);
    killE(a.s, u);
    expect(a.s.foundWeapons.length).toBe(1);
    const all = WEAPON_IDS.filter((w) => w !== 'judgement').map((w) => weaponKey(w));
    const b = fresh({ meta: { up: {}, weapons: all } });
    const gold = b.s.runGold;
    killE(b.s, spawnEnemy(b.s, 'umbra', 10, 0, false));
    expect(b.s.foundWeapons).toEqual([]);
    expect(b.s.runGold).toBe(gold + 500);
  });
});
