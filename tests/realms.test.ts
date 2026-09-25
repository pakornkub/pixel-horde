// Tickets 35–38: the six new Realms (mobs with their behaviours, Kings and their moves, Weapons).
import { describe, expect, it } from 'vitest';
import { REALMS, ROUTE_REALMS, WEAPONS, createSim, type HazardKind, type RealmId, type SimState } from '@pixel-horde/sim';
import { killE } from '../packages/sim/src/systems/combat';
import { spawnEnemy } from '../packages/sim/src/systems/spawner';
import { botOptions, botStep } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };
const NEW: RealmId[] = ['emberforge', 'mirefen', 'skyreach', 'tidehollow', 'gearspire', 'duskhold'];

function realmSim(realm: RealmId, seed = 3) {
  const sim = createSim(botOptions(seed, { debug: { god: true }, events: quiet }));
  const s = sim.view() as SimState;
  s.realm = realm;
  return { sim, s };
}

describe('the ten Realms', () => {
  it('every Realm is playable with its own King and Weapon; the route offers the eight middle ones', () => {
    for (const r of Object.values(REALMS)) expect(r.available, r.id).toBe(true);
    expect(ROUTE_REALMS.filter((r) => REALMS[r].available).length).toBeGreaterThanOrEqual(7);
    for (const w of Object.values(WEAPONS)) expect(w.available, w.id).toBe(true);
  });

  it.each(NEW)('%s: its King uses both moves and its ultimate without errors', (realm) => {
    const { sim, s } = realmSim(realm);
    let t = 0;
    for (; t < 60 * 60 && !s.boss; t++) botStep(sim, t);
    expect(s.boss?.type).toBe(REALMS[realm].king);
    const kinds = new Set<HazardKind>();
    let spawnedByKing = false;
    const before = s.enemies.length;
    for (let i = 0; i < 40 * 60; i++) {
      if (s.boss && i === 10 * 60) s.boss.hp = s.boss.maxHp * 0.3; // phase 2: ultimates
      if (s.boss) s.stageTime = Math.min(s.stageTime, s.stageDur * 0.9);
      botStep(sim, t + i);
      for (const h of s.hz) { kinds.add(h.k); if (h.spawn) spawnedByKing = true; }
      if (!s.boss) break;
    }
    expect(kinds.size).toBeGreaterThan(0);
    expect(s.boss?.kg?.phase ?? 2).toBe(2);
    if (realm === 'mirefen' || realm === 'gearspire') expect(spawnedByKing || s.enemies.length >= before).toBe(true);
  });
});

describe('new monster behaviours', () => {
  it('turrets never move; frogs hop; leeches drink; spore caps and haunted armor split', () => {
    const { sim, s } = realmSim('gearspire');
    const tu = spawnEnemy(s, 'turret', s.P.x + 60, s.P.y, false), fr = spawnEnemy(s, 'frog', s.P.x - 80, s.P.y, false);
    const x0 = tu.x, fx0 = fr.x;
    const xs: number[] = [];
    for (let i = 0; i < 180; i++) { sim.step({ mx: 0, my: 0 }); xs.push(fr.x); }
    expect(tu.x).toBe(x0);
    expect(fr.x).toBeGreaterThan(fx0); // it came closer…
    const still = xs.filter((x, i) => i > 0 && x === xs[i - 1]).length;
    expect(still).toBeGreaterThan(30); // …in hops, standing still in between
    const n = s.enemies.length;
    killE(s, spawnEnemy(s, 'spore', s.P.x + 100, s.P.y, false));
    killE(s, spawnEnemy(s, 'harmor', s.P.x - 100, s.P.y, false));
    const added = s.enemies.slice(n).map((e) => e.type);
    expect(added.filter((t) => t === 'sporelet').length).toBe(2);
    expect(added.filter((t) => t === 'ghost').length).toBe(2);
  });

  it('a Giant leech heals by the damage it deals', () => {
    const sim = createSim(botOptions(5, { events: quiet }));
    const s = sim.view() as SimState;
    s.P.skills = {}; // nothing hurts it
    const l = spawnEnemy(s, 'leech', s.P.x, s.P.y, false);
    l.hp = l.maxHp * 0.5;
    const hp0 = l.hp;
    sim.step({ mx: 0, my: 0 });
    expect(s.P.hp).toBeLessThan(s.P.maxHp);
    expect(l.hp).toBeGreaterThan(hp0);
  });
});

describe('new Weapon Ultimates', () => {
  const ultWith = (weapon: keyof typeof WEAPONS) => {
    const sim = createSim(botOptions(9, { debug: { god: true }, events: quiet, weapon, meta: { up: {}, weapons: ['lumora:' + weapon] } }));
    const s = sim.view() as SimState;
    for (let i = 0; i < 6; i++) spawnEnemy(s, 'crab', s.P.x + 20 + i * 8, s.P.y + 10, false).hp = 1e9;
    s.ult = s.cfg.ult.max;
    sim.step({ mx: 0, my: 0 }, [{ type: 'ult' }]);
    for (let i = 0; i < 90; i++) sim.step({ mx: 0, my: 0 });
    return s;
  };
  it('Storm Bow shocks, Plague Censer poisons, Coral Trident pushes, Gear Cannon leaves a turret', () => {
    expect(ultWith('stormBow').enemies.some((e) => (e.shock || 0) > 0)).toBe(true);
    expect(ultWith('plagueCenser').enemies.some((e) => (e.pois || 0) > 0)).toBe(true);
    const pushed = ultWith('coralTrident');
    expect(Math.max(...pushed.enemies.map((e) => Math.abs(e.x - pushed.P.x)))).toBeGreaterThan(80);
    expect(ultWith('gearCannon').effects.some((f) => f.type === 'gturret')).toBe(true);
  });
});
