import { describe, expect, it } from 'vitest';
import { parseBalanceConfig, resolveConfig } from '@pixel-horde/config';
import { HEROES, createSim, signatureOf, type Enemy, type HeroId, type SimEvent, type SimState } from '@pixel-horde/sim';
import { addHz } from '../packages/sim/src/systems/events';
import { spawnEnemy } from '../packages/sim/src/systems/spawner';
import { botOptions } from './bot';

const config = resolveConfig(parseBalanceConfig({ shared: { player: { dmgVariance: 0, crit: 0 } } }));

function hero(h: HeroId) {
  const sim = createSim(botOptions(3, { hero: h, config, debug: { god: true }, events: { bloodMoon: false, dragon: false, rival: false } }));
  const s = sim.view() as SimState;
  s.spawnAcc = -1e9; s.waveT = 1e9; // no spawns: tests place their own monsters
  s.enemies = [];
  const mob = (x: number, y: number, hp = 1e6): Enemy => { const e = spawnEnemy(s, 'mush', x, y, false); e.hp = e.maxHp = hp; e.spd = 0; e.armor = 0; return e; };
  const run = (secs: number): SimEvent[] => { const ev: SimEvent[] = []; for (let i = 0; i < secs * 60; i++) { s.spawnAcc = -1e9; ev.push(...sim.step({ mx: 0, my: 0 })); } return ev; };
  return { sim, s, mob, run };
}

describe('Signature Skills', () => {
  it('each Hero starts with their Signature Skill, and it is never offered to others', async () => {
    const { buildOptions } = await import('../packages/sim/src/systems/progress');
    for (const h of Object.keys(HEROES) as HeroId[]) {
      const { s } = hero(h);
      expect(Object.keys(s.P.skills)).toEqual([signatureOf(h)]);
      const other = (['sigil', 'shield', 'hawk', 'flask'] as const).filter((k) => k !== signatureOf(h));
      for (let i = 0; i < 200; i++) for (const o of buildOptions(s)) if (o.kind === 'skill') expect(other).not.toContain(o.id);
    }
  });

  it('the Signature Skill is offered a little more often than another owned Skill', async () => {
    const { buildOptions } = await import('../packages/sim/src/systems/progress');
    const { s } = hero('mage');
    s.P.skills = { sigil: 1, chain: 1 };
    let sig = 0, chain = 0;
    for (let i = 0; i < 3000; i++) for (const o of buildOptions(s)) { if (o.kind === 'skill' && o.id === 'sigil') sig++; if (o.kind === 'skill' && o.id === 'chain') chain++; }
    expect(sig).toBeGreaterThan(chain);
  });

  it('Arcane Sigil hurts monsters standing in it', () => {
    const { s, mob, run } = hero('mage');
    const e = mob(10, 0);
    run(4);
    expect(e.hp).toBeLessThan(e.maxHp);
    expect(s.effects.some((f) => f.type === 'sigil') || e.hp < e.maxHp).toBe(true);
  });

  it('Holy Shield blocks monster projectiles; Aegis heals on a block', () => {
    const { s, run } = hero('knight');
    s.P.skills.shield = 6; s.P.evo.shield = true; s.P.hp = 50;
    // a slow bullet crossing the shield ring from outside
    for (let i = 0; i < 8; i++) addHz(s, { k: 'proj', x: 60, y: (i - 4) * 6, vx: -40, vy: 0, r: 3, d: 10, life: 4, c: 3 });
    run(3);
    expect(s.P.hp).toBeGreaterThan(50);
    expect(s.hz.filter((h) => h.k === 'proj').length).toBe(0);
  });

  it('Hawk Companion dives at the biggest monster; Twin Hawks stun', () => {
    const { s, mob, run } = hero('ranger');
    const small = mob(60, 0, 100), big = mob(-60, 0, 5000);
    run(1.5);
    expect(big.hp).toBeLessThan(5000);
    expect(small.hp).toBe(100);
    s.P.evo.hawk = true;
    const small2 = mob(0, 70, 2000);
    let stunned = false;
    for (let i = 0; i < 4 * 60 && !stunned; i++) { run(1 / 60); stunned = (small2.stun || 0) > 0 || (small.stun || 0) > 0; }
    expect(stunned).toBe(true); // two hawks: the second one hunts the next-biggest monster
    expect(big.slowT).toBeDefined();
  });

  it('the hawk\'s dive splash (skills.hawk.r) also hits monsters next to its prey', () => {
    const { s, mob, run } = hero('ranger');
    const big = mob(-60, 0, 5000), beside = mob(-60, 12, 100), far = mob(60, 0, 100);
    run(1.5);
    expect(beside.hp).toBe(100); // no splash by default
    s.cfg = { ...s.cfg, skills: { ...s.cfg.skills, hawk: { ...s.cfg.skills.hawk, r: 20 } } };
    s.P.cds.hawk = 0;
    run(1.5);
    expect(big.hp).toBeLessThan(5000);
    expect(beside.hp).toBeLessThan(100);
    expect(far.hp).toBe(100);
  });

  it('with skills.hawk.guardN the Hawk defends Kit: once that many monsters are close it dives the nearest', () => {
    const { s, mob, run } = hero('ranger');
    const big = mob(-150, 0, 5000);
    const ring = [0, 1, 2, 3].map((i) => mob(i < 2 ? 20 + i * 8 : -20 - (i - 2) * 8, 10, 300));
    run(1.5);
    expect(big.hp).toBeLessThan(5000); // off by default: still hunts the biggest
    expect(ring.every((e) => e.hp === 300)).toBe(true);
    s.cfg = { ...s.cfg, skills: { ...s.cfg.skills, hawk: { ...s.cfg.skills.hawk, guardN: 4, guardR: 40 } } };
    const bigHp = big.hp;
    s.P.cds.hawk = 0;
    run(1.5);
    expect(ring.some((e) => e.hp < 300)).toBe(true);
    expect(big.hp).toBe(bigHp);
    for (const e of ring) e.dead = true; // the crowd is gone: back to the biggest
    s.P.cds.hawk = 0;
    run(1.5);
    expect(big.hp).toBeLessThan(bigHp);
  });

  it('heroes.ranger.hp adds to Kit\'s max HP only', () => {
    const cfg = resolveConfig(parseBalanceConfig({ shared: { heroes: { ranger: { hp: 20 } } } }));
    const hp = (h: HeroId, c = config) => (createSim(botOptions(3, { hero: h, config: c })).view() as SimState).P.maxHp;
    expect(hp('ranger', cfg)).toBe(hp('ranger') + 20);
    expect(hp('mage', cfg)).toBe(hp('mage'));
  });

  it('Volatile Flask leaves Statuses; Smart Flask picks fire on a Gathered pack', () => {
    const { s, mob, run } = hero('alchemist');
    const e = mob(50, 0);
    let seen = false;
    for (let i = 0; i < 10 && !seen; i++) { run(1); seen = (e.burn || 0) > 0 || (e.pois || 0) > 0 || e.frz > 0 || (e.chill || 0) > 0; }
    expect(seen).toBe(true);
    s.P.evo.flask = true; s.P.skills.flask = 7;
    const g = mob(-50, 0);
    let fired = false;
    for (let i = 0; i < 60 * 6 && !fired; i++) {
      g.gath = 5;
      const ev = run(1 / 60);
      fired = ev.some((x) => x.t === 'combo' && x.id === 'firestorm');
    }
    expect(fired).toBe(true);
  });

  it('Vex\'s Statuses last 20% longer', () => {
    const { s } = hero('alchemist');
    expect(s.P.statusMul).toBeCloseTo(1.2);
    expect(hero('mage').s.P.statusMul).toBe(1);
  });
});
