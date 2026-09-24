// Holy Shield (Bram's Signature): shields circle the player, bash monsters and block
// monster projectiles. Aegis (evolved) heals on every block.
import { TAU, cos, hypot, sin } from '../core/fmath';
import { skillStats } from '../data/skills';
import type { Hazard, SimState } from '../types';
import { burst } from './fx';

export function shieldPoints(s: SimState): [number, number][] {
  const P = s.P, lv = P.skills.shield;
  if (!lv || P.down) return [];
  const t = skillStats(s.cfg, 'shield', lv, !!P.evo.shield), out: [number, number][] = [];
  for (let i = 0; i < t.n; i++) {
    const a = P.shieldA + (i * TAU) / t.n;
    out.push([P.x + cos(a) * t.r, P.y + sin(a) * t.r * 0.8]);
  }
  return out;
}

/** True (and the projectile is gone) when a shield catches it. */
export function shieldBlocks(s: SimState, h: Hazard): boolean {
  const pts = shieldPoints(s);
  if (!pts.length) return false;
  const K = s.cfg.skills.shield;
  for (const [x, y] of pts) {
    if (hypot(h.x - x, h.y - y) < K.block + (h.r || 0)) {
      h.life = 0;
      h.hitP = true;
      burst(s, x, y, '#fff8c0', 8, 50, 0.3);
      if (s.P.evo.shield) s.P.hp = Math.min(s.P.maxHp, s.P.hp + K.evo.heal);
      return true;
    }
  }
  return false;
}
