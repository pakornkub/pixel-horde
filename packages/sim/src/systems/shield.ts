// Holy Shield (Bram's Signature): shields circle the player, bash monsters and block
// monster projectiles. Aegis (evolved) heals on every block. Shield Bash (`bashCd`) swings the
// ring out and back; the Paladin (Awakened, `awaken.form`) adds an outer ring whose shields are
// thrown at crowds (see `sshield` in skills.ts).
import { PI, TAU, cos, hypot, sin } from '../core/fmath';
import { skillStats } from '../data/skills';
import type { Hazard, SimState } from '../types';
import { burst } from './fx';

/** The Awakened Signature takes its new form (`awaken.form`). */
export const awkForm = (s: SimState): boolean => !!s.cfg.awaken.form && s.P.awakened;

/** Orbit radius × right now: 1, or up to `bashMul` during a Shield Bash. */
export function bashScale(s: SimState): number {
  const K = s.cfg.skills.shield, b = s.P.bashT || 0;
  return b > 0 && K.bashDur > 0 ? 1 + (K.bashMul - 1) * sin(PI * Math.min(1, b / K.bashDur)) : 1;
}

/** Every shield in orbit: [x, y, outer (1) or inner (0)]. Thrown outer shields are not in orbit. */
export function shieldPoints(s: SimState): [number, number, number][] {
  const P = s.P, lv = P.skills.shield;
  if (!lv || P.down) return [];
  const t = skillStats(s.cfg, 'shield', lv, !!P.evo.shield), out: [number, number, number][] = [], r = t.r * bashScale(s);
  for (let i = 0; i < t.n; i++) {
    const a = P.shieldA + (i * TAU) / t.n;
    out.push([P.x + cos(a) * r, P.y + sin(a) * r * 0.8, 0]);
  }
  if (awkForm(s)) {
    const A = s.cfg.skills.shield.awk, ro = r * A.rMul;
    let thrown = 0;
    for (const f of s.effects) if (f.type === 'sshield') thrown |= 1 << f.n!;
    for (let i = 0; i < A.n; i++) {
      if (thrown & (1 << i)) continue;
      const a = outerAngle(s, i);
      out.push([P.x + cos(a) * ro, P.y + sin(a) * ro * 0.8, 1]);
    }
  }
  return out;
}

/** Angle of outer shield `i` (the outer ring turns the other way). */
export const outerAngle = (s: SimState, i: number): number => -s.P.shieldA * 0.8 + (i * TAU) / s.cfg.skills.shield.awk.n;

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
