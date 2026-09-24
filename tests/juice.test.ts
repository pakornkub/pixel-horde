// Ticket 39: presentation events and device caps.
import { describe, expect, it } from 'vitest';
import { parseBalanceConfig, resolveConfig } from '@pixel-horde/config';
import { createSim, type SimEvent, type SimState } from '@pixel-horde/sim';
import { stageClear } from '../packages/sim/src/systems/progress';
import { botOptions } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };
// fast spawns and small caps so the cap is what limits the horde
const flood = resolveConfig(parseBalanceConfig({ shared: { spawn: { base: 14, cap: 60, swarmCap: 70, capMobile: 30, swarmCapMobile: 35 } } }));

function run(sim: ReturnType<typeof createSim>, ticks: number): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const ph: string = sim.view().phase;
    const cmds = ph === 'levelup' ? [{ type: 'pick' as const, index: 0 }] : ph === 'chest' ? [{ type: 'chestStop' as const }] : [];
    out.push(...sim.step({ mx: 0, my: 0 }, cmds));
  }
  return out;
}

describe('juice & performance', () => {
  it('phones and tablets use the lower monster cap', () => {
    const peak = (mobile: boolean): number => {
      const sim = createSim(botOptions(4, { debug: { god: true }, events: quiet, config: flood, mobile }));
      let max = 0;
      for (let i = 0; i < 12 * 60; i++) { run(sim, 1); max = Math.max(max, sim.view().enemies.length); }
      return max;
    };
    const c = flood.spawn;
    expect(peak(false)).toBeGreaterThan(c.capMobile);
    expect(peak(false)).toBeLessThanOrEqual(c.swarmCap);
    expect(peak(true)).toBeLessThanOrEqual(c.swarmCapMobile);
  });

  it('kill events carry position and type; streak popups every N kills', () => {
    const sim = createSim(botOptions(5, { debug: { god: true }, events: quiet }));
    const ev = run(sim, 90 * 60);
    const kills = ev.filter((e) => e.t === 'kill');
    expect(kills.length).toBeGreaterThan(0);
    const k = kills[0] as Extract<SimEvent, { t: 'kill' }>;
    expect(typeof k.x).toBe('number');
    expect(typeof k.type).toBe('string');
    const every = sim.view().cfg.streak.popupEvery;
    for (const e of ev) if (e.t === 'streak') expect(e.n % every).toBe(0);
  });

  it('announces the King with an intro event', () => {
    const sim = createSim(botOptions(6, { debug: { god: true }, events: quiet }));
    const s = sim.view() as SimState;
    const ev: SimEvent[] = [];
    for (let i = 0; i < 200 * 60 && !s.boss; i++) ev.push(...run(sim, 1));
    const intro = ev.find((e) => e.t === 'kingIntro') as Extract<SimEvent, { t: 'kingIntro' }> | undefined;
    expect(intro?.realm).toBe(s.realm);
  });

  it('the Stage end vacuums every pickup to the player', () => {
    const sim = createSim(botOptions(7, { debug: { god: true }, events: quiet }));
    const s = sim.view() as SimState;
    s.gems.push({ kind: 'coin', x: s.P.x + 150, y: s.P.y, v: 1, mag: false }, { kind: 'xp', x: s.P.x - 150, y: s.P.y, v: 1, mag: false });
    stageClear(s);
    expect(s.gems.every((g) => g.mag)).toBe(true);
  });
});
