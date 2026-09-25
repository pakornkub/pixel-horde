// Statuses and Combos (ticket 22). A hit's tag (element, heavy, sweeper) meets the Statuses
// already on a monster; matching pairs fire a Combo, at most once per second per monster.
import { hypot } from '../core/fmath';
import { COMBO_HIT, type ComboId, type HitTag } from '../data/skills';
import type { Enemy, SimState } from '../types';
import { hit } from './combat';
import { burst } from './fx';

export interface ComboResult { mul: number; after: (() => void)[] }

const hasStatus = (e: Enemy): boolean => (e.frz || 0) > 0 || (e.gath || 0) > 0 || (e.burn || 0) > 0 || (e.shock || 0) > 0 || (e.pois || 0) > 0;

function aoe(s: SimState, x: number, y: number, r: number, dmg: number, col: string, skip: Enemy | null, each?: (o: Enemy) => void): void {
  for (const o of s.enemies) {
    if (o.dead || o === skip || hypot(o.x - x, o.y - y) > r + o.r) continue;
    each?.(o);
    hit(s, o, dmg, col, 20, COMBO_HIT);
  }
  burst(s, x, y, col, 16, 80, 0.45);
}

/** Checks every Combo a hit can start on `e`; returns the damage multiplier and follow-up blasts. */
export function combosFor(s: SimState, e: Enemy, base: number, tag: HitTag): ComboResult {
  const C = s.cfg.combos, now = s.clock, out: ComboResult = { mul: 1, after: [] };
  const ready = (id: ComboId): boolean => (e.ccd?.[id] ?? -1) <= now;
  const go = (id: ComboId): void => {
    (e.ccd ??= {})[id] = now + C.cooldown;
    s.combos++;
    s.comboCounts[id] = (s.comboCounts[id] || 0) + 1;
    s.events.push({ t: 'combo', id, x: e.x, y: e.y });
  };
  const x = e.x, y = e.y;
  if (tag.el === 'arcane' && hasStatus(e) && ready('catalyst')) { out.mul *= C.catalyst; go('catalyst'); }
  if (tag.sweep && (e.gath || 0) > 0 && ready('grinder')) { out.mul *= C.grinder; go('grinder'); }
  if (tag.heavy && e.frz > 0 && ready('shatter')) {
    out.mul *= C.shatter;
    e.frz = 0;
    go('shatter');
    out.after.push(() => aoe(s, x, y, C.shatterR, base * C.shatterShards, '#bfe6ff', e));
  }
  if (tag.el === 'lightning' && e.frz > 0 && ready('superconduct')) { e.armorOff = C.superconduct; go('superconduct'); }
  if (tag.el === 'fire') {
    if ((e.shock || 0) > 0 && ready('overload')) {
      e.shock = 0;
      go('overload');
      out.after.push(() => aoe(s, x, y, C.overloadR, base * C.overload, '#fff35c', null));
    }
    if ((e.gath || 0) > 0 && ready('firestorm')) {
      go('firestorm');
      const burnFor = s.cfg.status.burning;
      out.after.push(() => aoe(s, x, y, C.firestormR, base * C.firestorm, '#ff8a3d', e, (o) => { o.burn = burnFor; }));
    }
    if ((e.pois || 0) > 0 && ready('toxicBurst')) {
      const dmg = (e.poisDps || 0) * e.pois! * C.toxicBurst;
      e.pois = 0;
      go('toxicBurst');
      out.after.push(() => aoe(s, x, y, C.toxicBurstR, dmg, '#b6f24a', null));
    }
  }
  return out;
}

/** Frost Aura tick: stacks toward Frozen; bosses are only slowed. */
export function chillTick(s: SimState, e: Enemy): void {
  const S = s.cfg.status;
  if (e.frz > 0) return;
  e.chill = (e.chill || 0) + 1;
  if (e.chill < S.frostStacks) return;
  e.chill = 0;
  if (e.boss) e.slowT = Math.max(e.slowT, S.frozen);
  else { e.frz = S.frozen * s.P.statusMul; burst(s, e.x, e.y, '#dff4ff', 6, 30, 0.4); }
}

export function stepStatuses(e: Enemy, dt: number): void {
  if (e.burn) e.burn -= dt;
  if (e.shock) e.shock -= dt;
  if (e.pois) e.pois -= dt;
  if (e.gath) e.gath -= dt;
  if (e.armorOff) e.armorOff -= dt;
  if (e.stun) e.stun -= dt;
  if (e.shc) e.shc -= dt;
}
