import { describe, expect, it } from 'vitest';
import { createSim, type SimState } from '@pixel-horde/sim';
import type { BalanceConfigInput } from '@pixel-horde/config';
import { edgePos, spawnStep } from '../packages/sim/src/systems/spawner';
import { startStage } from '../packages/sim/src/systems/progress';
import { asWritten, botOptions } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };
const DEG = Math.PI / 180;
/** Signed angle a − b in (−180°, 180°]. */
const diff = (a: number, b: number): number => { const d = ((a - b) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; return d; };

function fresh(patch: BalanceConfigInput): SimState {
  const config = asWritten(patch);
  const s = createSim(botOptions(7, { config, events: quiet })).view() as SimState;
  s.enemies = []; s.waveT = 1e9;
  return s;
}
/** Runs the spawner `secs` seconds with the player standing still; returns the angles (from the player) of new monsters. */
function spawnFor(s: SimState, secs: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < secs * 60; i++) {
    const n0 = s.enemies.length;
    spawnStep(s, 1 / 60);
    for (const e of s.enemies.slice(n0)) out.push(Math.atan2(e.y - s.P.y, e.x - s.P.x));
    s.enemies = [];
  }
  return out;
}

describe('wave fronts (spawn.frontShare)', () => {
  it('bring monsters from one side only while the front holds', () => {
    const s = fresh({ shared: { spawn: { frontShare: 1, frontArc: 60, frontEvery: 100 } } });
    const angles = spawnFor(s, 20);
    expect(angles.length).toBeGreaterThan(20);
    for (const a of angles) expect(Math.abs(diff(a, s.front.a))).toBeLessThanOrEqual(30 * DEG + 1e-9);
  });

  it('keep some monsters coming from anywhere with a share below 1', () => {
    const s = fresh({ shared: { spawn: { frontShare: 0.5, frontArc: 60, frontEvery: 100 } } });
    const angles = spawnFor(s, 30);
    const off = angles.filter((a) => Math.abs(diff(a, s.front.a)) > 30 * DEG).length / angles.length;
    expect(off).toBeGreaterThan(0.25); // half come from anywhere, 5/6 of those land outside the front
    expect(off).toBeLessThan(0.6);
  });

  it('move to another side by at least frontTurn', () => {
    const s = fresh({ shared: { spawn: { frontShare: 1, frontEvery: 1, frontTurn: 150 } } });
    spawnStep(s, 1 / 60);
    let prev = s.front.a, moves = 0;
    for (let i = 0; i < 60 * 20; i++) {
      spawnStep(s, 1 / 60); s.enemies = [];
      if (s.front.a !== prev) { expect(Math.abs(diff(s.front.a, prev))).toBeGreaterThanOrEqual(150 * DEG - 1e-9); prev = s.front.a; moves++; }
      expect(s.front.a).toBeGreaterThanOrEqual(0);
      expect(s.front.a).toBeLessThan(2 * Math.PI);
    }
    expect(moves).toBeGreaterThanOrEqual(19);
  });

  it('pause spawning for the quiet seconds after each move', () => {
    const s = fresh({ shared: { spawn: { frontShare: 1, frontEvery: 6, lull: 3, lullSpawn: 0 } } });
    expect(spawnFor(s, 2.9).length).toBe(0);
    expect(spawnFor(s, 3).length).toBeGreaterThan(0);
  });

  it('frontRecycle puts monsters left behind on the front even when few spawn there', () => {
    const s = fresh({ shared: { spawn: { frontShare: 0.01, frontArc: 40 } } });
    spawnStep(s, 1 / 60);
    for (let i = 0; i < 50; i++) {
      const [x, y] = edgePos(s, true);
      expect(Math.abs(diff(Math.atan2(y - s.P.y, x - s.P.x), s.front.a))).toBeLessThanOrEqual(20 * DEG + 1e-9);
    }
  });

  it('pincer swarms come as two arcs on the front\'s sides, leaving the front and the back open', () => {
    const s = fresh({ shared: { spawn: { frontShare: 1, frontEvery: 100, pincer: 1, pincerArc: 60, base: 0, prog: 0 } } });
    spawnStep(s, 1 / 60);
    s.enemies = []; s.waveT = 0;
    spawnStep(s, 1 / 60);
    const n = s.cfg.spawn.swarmBase + s.stage * s.cfg.spawn.swarmPerStage;
    expect(s.enemies.length).toBe(n);
    let left = 0, right = 0;
    for (const e of s.enemies) {
      const d = diff(Math.atan2(e.y - s.P.y, e.x - s.P.x), s.front.a);
      expect(Math.abs(Math.abs(d) - 90 * DEG)).toBeLessThanOrEqual(30 * DEG + 1e-9);
      if (d > 0) left++; else right++;
    }
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  it('full rings stay the default', () => {
    const s = fresh({});
    s.waveT = 0;
    spawnStep(s, 1 / 60);
    const angles = s.enemies.map((e) => Math.atan2(e.y - s.P.y, e.x - s.P.x)).sort((a, b) => a - b);
    const gaps = angles.map((a, i) => (i ? a - angles[i - 1] : a + 2 * Math.PI - angles[angles.length - 1]));
    expect(Math.max(...gaps)).toBeLessThan((2 * Math.PI) / angles.length + 1e-6);
  });
});

describe('Director stage reset', () => {
  it('eases the Director back toward its start at a new Stage', () => {
    const s = fresh({ shared: { director: { stageReset: 0.5 } } });
    s.dir.v = 2.4;
    startStage(s, 2);
    expect(s.dir.v).toBeCloseTo(1.7, 9);
  });

  it('keeps it by default', () => {
    const s = fresh({});
    s.dir.v = 2.4;
    startStage(s, 2);
    expect(s.dir.v).toBe(2.4);
  });
});
