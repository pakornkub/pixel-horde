import { describe, expect, it } from 'vitest';
import { createSim, type HeroId, type SimState, type SkillId } from '@pixel-horde/sim';
import { spawnEnemy } from '../packages/sim/src/systems/spawner';
import { botOptions } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };

/** A few seconds with a Shadow Clone, the given Skills and five tough monsters; counts what the clone cast. */
function cloneRun(hero: HeroId, skills: Partial<Record<SkillId, number>>, every: number, secs = 6) {
  const sim = createSim(botOptions(7, { hero, debug: { god: true }, events: quiet }));
  const s = sim.view() as SimState;
  s.cfg = { ...s.cfg, clone: { ...s.cfg.clone, every } };
  s.spawnAcc = -1e9; s.waveT = 1e9; s.enemies = [];
  s.P.skills = { ...skills };
  s.P.clone = { lv: 1, x: s.P.x, y: s.P.y };
  for (let i = 0; i < 5; i++) { const e = spawnEnemy(s, 'mush', 30 + i * 8, (i - 2) * 8, false); e.hp = e.maxHp = 1e7; e.armor = 0; } // they keep walking in, as a real crowd does
  let casts = 0;
  const seen = new Set<object>();
  for (let i = 0; i < secs * 60; i++) {
    s.spawnAcc = -1e9;
    sim.step({ mx: 0, my: 0 });
    for (const x of [...s.bolts, ...s.effects]) if (x.cl && !seen.has(x)) { seen.add(x); casts++; }
  }
  return { s, casts };
}

describe('Shadow Clone', () => {
  it('old rule (clone.every 0): a Signature-only build gets a clone that never casts', () => {
    expect(cloneRun('mage', { sigil: 3 }, 0).casts).toBe(0);
  });

  it.each([
    ['mage', { sigil: 3 }], ['knight', { shield: 3 }], ['ranger', { hawk: 3 }], ['alchemist', { flask: 3 }],
    ['mage', { orbit: 3, frost: 3, cyclone: 3, toxic: 3, laser: 3, hole: 3 }],
    ['mage', { manaNova: 3, timeWarp: 3, starfall: 3 }],
  ] as [HeroId, Partial<Record<SkillId, number>>][])('%s %j: the clone copies the Skills one at a time', (hero, skills) => {
    const { casts } = cloneRun(hero, skills, 1);
    expect(casts).toBeGreaterThan(2);
    expect(casts).toBeLessThan(40); // one Skill per second, not every cast of every Skill
  });

  it('copies each owned Skill at random, never the helper Skills', () => {
    const sim = createSim(botOptions(9, { hero: 'knight', debug: { god: true }, events: quiet }));
    const s = sim.view() as SimState;
    s.cfg = { ...s.cfg, clone: { ...s.cfg.clone, every: 0.5 } };
    s.spawnAcc = -1e9; s.waveT = 1e9; s.enemies = [];
    s.P.skills = { lance: 3, nova: 3, aegisDome: 3 };
    s.P.clone = { lv: 1, x: s.P.x, y: s.P.y };
    for (let i = 0; i < 5; i++) { const e = spawnEnemy(s, 'mush', 20 + i * 6, 0, false); e.hp = e.maxHp = 1e7; }
    const kinds = new Set<string>();
    const seen = new Set<object>();
    for (let i = 0; i < 20 * 60; i++) {
      s.spawnAcc = -1e9;
      sim.step({ mx: 0, my: 0 });
      for (const b of s.bolts) if (b.cl && !seen.has(b)) { seen.add(b); kinds.add(b.kind); }
      for (const f of s.effects) if (f.cl && !seen.has(f)) { seen.add(f); kinds.add(f.type); }
    }
    expect(kinds.has('lance')).toBe(true);
    expect(kinds.has('nova')).toBe(true);
    expect(kinds.has('dome')).toBe(false); // Aegis Dome only protects the player
  });
});
