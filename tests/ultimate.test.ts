import { describe, expect, it } from 'vitest';
import { WEAPON_IDS, createSim, weaponKey, type SimEvent, type SimState, type WeaponId } from '@pixel-horde/sim';
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

describe('Weapon forge (ticket 56)', () => {
  /** Fires the Ultimate at one tough monster; returns it right after the strike lands. */
  function forgedStrike(weapon: WeaponId, forge: Record<string, number>, hpFrac = 1) {
    const { s, step } = fresh({ weapon, meta: { up: {}, weapons: WEAPON_IDS.map((w) => weaponKey(w)), forge } });
    s.P.skills = {};
    const mob = spawnEnemy(s, 'mush', 30, 0, false); mob.maxHp = 1e9; mob.hp = 1e9 * hpFrac; mob.armor = 0;
    s.ult = s.cfg.ult.max;
    step(1, [{ type: 'ult' }]);
    for (let i = 0; i < 60 && mob.hp === 1e9 * hpFrac && !mob.dead; i++) step();
    return { s, mob };
  }

  it('levels stretch the Weapon\'s own effect and add Ultimate damage (level 0 = unchanged)', () => {
    const plain = forgedStrike('thornwhip', {}), forged = forgedStrike('thornwhip', { thornwhip: 4 });
    expect(forged.mob.stun! - plain.mob.stun!).toBeCloseTo(plain.s.cfg.weapons.root * plain.s.cfg.forge.thornwhip * 4, 5);
    const hitPlain = 1e9 - plain.mob.hp, hitForged = 1e9 - forged.mob.hp;
    expect(hitPlain).toBe(Math.round(plain.s.cfg.ult.mobHp * chapterMobHp(plain.s)));
    expect(hitForged / hitPlain).toBeCloseTo(1 + plain.s.cfg.forge.dmg * 4, 1); // both hits are rounded
  });

  it('Gear Cannon and Plague Censer follow-ups use the unforged strike: level 5 stays within ×2 in total', () => {
    const total = (weapon: WeaponId, lv: number): number => {
      const { s, step } = fresh({ weapon, meta: { up: {}, weapons: WEAPON_IDS.map((w) => weaponKey(w)), forge: { [weapon]: lv } } });
      s.P.skills = {};
      const mob = spawnEnemy(s, 'mush', 30, 0, false); mob.hp = mob.maxHp = 1e9; mob.armor = 0; mob.spd = 0;
      s.ult = s.cfg.ult.max;
      step(20 * 60, [{ type: 'ult' }]); // strike + every turret shot / all the poison
      return 1e9 - mob.hp;
    };
    for (const w of ['gearCannon', 'plagueCenser'] as const) {
      const ratio = total(w, 5) / total(w, 0);
      expect(ratio, w).toBeGreaterThan(1.3); // the forge still helps
      expect(ratio, w).toBeLessThanOrEqual(2.05);
    }
    // Plague's poison is only read by Toxic Burst, so check it directly: only the Censer's own forge effect scales it
    const pois = (lv: number): number => forgedStrike('plagueCenser', { plagueCenser: lv }).mob.poisDps!;
    const cfg = forgedStrike('plagueCenser', {}).s.cfg;
    expect(pois(5) / pois(0)).toBeCloseTo(1 + cfg.forge.plagueCenser * 5, 5);
  });

  it('Plague Censer poison on a King is based on the capped strike (Toxic Burst stays under the cap)', () => {
    const { s, step } = fresh({ weapon: 'plagueCenser', meta: { up: {}, weapons: [weaponKey('plagueCenser')], forge: { plagueCenser: 5 } } });
    s.P.skills = {}; s.stage = 8;
    const king = spawnEnemy(s, 'boss', -30, 0, false); king.hp = king.maxHp = 500; // small: the strike is above the cap
    s.ult = s.cfg.ult.max;
    step(1, [{ type: 'ult' }]);
    for (let i = 0; i < 60 && !king.poisDps; i++) step();
    const C = s.cfg, capped = (C.ult.bossCap + C.forge.bossCap * 5) * 500;
    expect(C.ult.mobHp * chapterMobHp(s)).toBeGreaterThan(capped);
    expect(king.poisDps).toBeCloseTo(capped * C.weapons.plagueDps * (1 + C.forge.plagueCenser * 5), 6);
  });

  it('raises the boss cap: a King takes 8% + 1% per level', () => {
    const hitKing = (lv: number): number => {
      const { s, step } = fresh({ weapon: 'judgement', meta: { up: {}, forge: { judgement: lv } } });
      s.P.skills = {}; s.stage = 8;
      const king = spawnEnemy(s, 'boss', -30, 0, false); king.hp = king.maxHp = 5000;
      s.ult = s.cfg.ult.max;
      step(60, [{ type: 'ult' }]);
      return 5000 - king.hp;
    };
    expect(hitKing(0)).toBe(400);
    expect(hitKing(5)).toBe(650);
  });

  it('Judgement: forged levels stun the monsters that survive', () => {
    expect(forgedStrike('judgement', {}).mob.stun ?? 0).toBe(0);
    const f = forgedStrike('judgement', { judgement: 3 });
    expect(f.mob.stun).toBeCloseTo(f.s.cfg.forge.judgement * 3 - 1 / 60, 5); // one tick has already run down
  });

  it('Bone Scythe: a higher reap threshold, and the level is capped at the config max', () => {
    expect(forgedStrike('boneScythe', {}, 0.3).mob.dead).toBe(false); // 30% HP is above the 20% threshold
    expect(forgedStrike('boneScythe', { boneScythe: 5 }, 0.3).mob.dead).toBe(true); // 20% × 1.75 = 35%
    const over = forgedStrike('thornwhip', { thornwhip: 99 }), max = forgedStrike('thornwhip', { thornwhip: over.s.cfg.forge.max });
    expect(over.mob.stun).toBe(max.mob.stun);
  });
});
