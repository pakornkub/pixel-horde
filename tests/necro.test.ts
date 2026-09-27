// Ticket 57: Mora (Necromancer): Soul Rise Skeletons, her three Links, the Lich and Bone Ward.
import { describe, expect, it } from 'vitest';
import { parseBalanceConfig, resolveConfig } from '@pixel-horde/config';
import { NECRO_SKILLS, createSim, type Enemy, type HeroId, type SimState } from '@pixel-horde/sim';
import { hurtP } from '../packages/sim/src/systems/combat';
import { buildOptions } from '../packages/sim/src/systems/progress';
import { spawnEnemy } from '../packages/sim/src/systems/spawner';
import { botOptions } from './bot';

const cfg = (patch: object = {}) => resolveConfig(parseBalanceConfig({ shared: { player: { dmgVariance: 0, crit: 0 }, ...patch } }));

function hero(h: HeroId, config = cfg(), god = true) {
  const sim = createSim(botOptions(3, { hero: h, config, debug: { god }, events: { bloodMoon: false, dragon: false, rival: false } }));
  const s = sim.view() as SimState;
  s.spawnAcc = -1e9; s.waveT = 1e9;
  s.enemies = [];
  const mob = (x: number, y: number, hp = 1e6): Enemy => { const e = spawnEnemy(s, 'mush', x, y, false); e.hp = e.maxHp = hp; e.spd = 0; e.armor = 0; e.dmg = 0; return e; };
  const run = (secs: number): void => { for (let i = 0; i < secs * 60; i++) { s.spawnAcc = -1e9; sim.step({ mx: 0, my: 0 }); } };
  return { sim, s, mob, run };
}
const skels = (s: SimState) => s.effects.filter((f) => f.type === 'skel');

describe('Mora (ticket 57)', () => {
  it('starts with Soul Rise and 10 less max HP than Lyra', () => {
    const mora = hero('necromancer').s, lyra = hero('mage').s;
    expect(Object.keys(mora.P.skills)).toEqual(['soulRise']);
    expect(mora.P.maxHp).toBe(lyra.P.maxHp - mora.cfg.heroes.necromancer.hp);
  });

  it('Soul Rise raises Skeletons (never more than the cap) that walk to monsters and hurt them', () => {
    const { s, mob, run } = hero('necromancer');
    const e = mob(50, 0);
    run(12);
    const K = s.cfg.skills.soulRise;
    expect(skels(s).length).toBeGreaterThan(0);
    expect(skels(s).length).toBeLessThanOrEqual(Math.floor(K.army.base + K.army.perLv));
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('Skeletons chasing the same monster keep apart', () => {
    const { s, mob, run } = hero('necromancer');
    s.P.skills.soulRise = s.cfg.skills.soulRise.max; s.P.evo.soulRise = true;
    mob(40, 0);
    run(6);
    const sk = skels(s);
    expect(sk.length).toBeGreaterThan(2);
    let closest = Infinity;
    for (const a of sk) for (const b of sk) if (a !== b) closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));
    expect(closest).toBeGreaterThan(s.cfg.skills.soulRise.space * 0.5);
  });

  it('Bone Legion: a crumbling Skeleton bursts', () => {
    const { s, mob, run } = hero('necromancer');
    s.P.skills.soulRise = s.cfg.skills.soulRise.max; s.P.evo.soulRise = true;
    const far = mob(0, 70, 1e6);
    run(2);
    const sk = skels(s)[0];
    expect(sk.boom).toBeGreaterThan(0);
    far.x = sk.x + 5; far.y = sk.y; // right beside it when it crumbles
    const hp = far.hp;
    sk.dur = sk.t; // time is up
    run(0.05);
    expect(far.hp).toBeLessThan(hp);
  });

  it('Bone Ward: a Skeleton close by takes the hit instead', () => {
    const { s, mob, run } = hero('necromancer', cfg(), false);
    s.P.skills.boneWard = 1;
    mob(40, 0);
    run(4);
    expect(skels(s).length).toBeGreaterThan(0);
    for (const f of skels(s)) { f.x = s.P.x + 5; f.y = s.P.y; }
    s.P.inv = 0; s.P.cds.boneWard = 0;
    const hp = s.P.hp, before = skels(s).filter((f) => !f.fired).length;
    hurtP(s, 30);
    expect(s.P.hp).toBe(hp);
    expect(skels(s).filter((f) => !f.fired).length).toBe(before - 1);
    s.P.inv = 0;
    hurtP(s, 30); // on cooldown now
    expect(s.P.hp).toBeLessThan(hp);
  });

  it('Wailing Skulls home in and freeze; Bone Prison gathers; Soul Drain heals on a kill', () => {
    const { s, mob, run } = hero('necromancer');
    s.P.skills = { soulRise: 1, wailSkull: 7 };
    const e = mob(80, 30);
    let froze = false;
    for (let i = 0; i < 16; i++) { run(0.25); froze ||= e.frz > 0; }
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(froze).toBe(true);

    const b = hero('necromancer');
    b.s.P.skills = { soulRise: 1, bonePrison: 1 };
    const crowd = [b.mob(60, 0), b.mob(66, 4), b.mob(62, -5)];
    b.run(1.5);
    expect(crowd.some((m) => (m.gath || 0) > 0)).toBe(true);

    const d = hero('necromancer');
    d.s.P.skills = { soulRise: 1, soulDrain: 6 };
    d.s.P.hp = 20;
    d.mob(40, 0, 30);
    d.run(3);
    expect(d.s.P.hp).toBeGreaterThan(20);
  });

  it('her Links go to the other Heroes only with heroes.necromancer.pool 1', () => {
    const offered = (h: HeroId, pool: number): Set<string> => {
      const { s } = hero(h, cfg({ heroes: { necromancer: { pool } } }));
      const out = new Set<string>();
      for (let i = 0; i < 400; i++) for (const o of buildOptions(s)) if (o.kind === 'skill') out.add(o.id);
      return out;
    };
    for (const id of NECRO_SKILLS) {
      expect(offered('mage', 0).has(id)).toBe(false);
      expect(offered('mage', 1).has(id)).toBe(true);
      expect(offered('necromancer', 0).has(id)).toBe(true);
    }
  });

  it('Lich: Frost Wraiths freeze and Bone Spear flies at their latest freeze', () => {
    const { s, mob, run } = hero('necromancer', cfg({ awaken: { form: 1 } }));
    s.P.skills = { soulRise: 7, boneSpear: 4 }; s.P.evo.soulRise = true; s.P.awakened = true;
    const e = mob(40, 0);
    run(8);
    expect(skels(s).every((f) => f.awk)).toBe(true);
    expect(s.comboCounts.shatter || 0).toBeGreaterThan(0);
    expect(e.hp).toBeLessThan(e.maxHp);
  });
});
