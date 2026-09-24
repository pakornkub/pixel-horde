import type { Enemy, SimState } from '../types';

export function nearest(s: SimState, x: number, y: number, max: number, skip?: Set<Enemy>): Enemy | null {
  let best: Enemy | null = null, bd = max * max;
  for (const e of s.enemies) {
    if (e.dead || e.hide || (skip && skip.has(e))) continue;
    const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

export function nearestN(s: SimState, n: number, max: number): Enemy[] {
  const P = s.P;
  return s.enemies
    .filter((e) => !e.dead && !e.hide)
    .map((e) => [e, (e.x - P.x) * (e.x - P.x) + (e.y - P.y) * (e.y - P.y)] as [Enemy, number])
    .filter((a) => a[1] < max * max)
    .sort((a, c) => a[1] - c[1])
    .slice(0, n)
    .map((a) => a[0]);
}

export function onScreen(s: SimState, e: { x: number; y: number }): boolean {
  return Math.abs(e.x - s.P.x) < s.viewport.w / 2 + 8 && Math.abs(e.y - s.P.y) < s.viewport.h / 2 + 8;
}

export const visibleEnemies = (s: SimState): Enemy[] => s.enemies.filter((e) => !e.dead && !e.hide && onScreen(s, e));

/** Players enemies can target (the player unless downed, plus living co-op mates on the host). */
export function aliveTargets(s: SimState): { x: number; y: number }[] {
  const t: { x: number; y: number }[] = s.P.down ? [] : [s.P];
  if (s.coop?.role === 'host') for (const m of s.coop.mates) if (!m.dn) t.push(m);
  return t;
}
