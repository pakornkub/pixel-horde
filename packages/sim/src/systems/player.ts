import { ipow } from '../core/fmath';
import { HEROES, type HeroId } from '../data/heroes';
import type { ShopId } from '../data/shop';
import type { Meta, Player, SimState } from '../types';

export const CD_CAP = 0.4;
export const CRIT_CAP = 0.5;

export function xpNeed(lv: number): number {
  return Math.floor(5 + lv * 4 + lv * lv * 0.5 + ipow(Math.max(0, lv - 8), 2) * 1.4);
}

export const shopLv = (meta: Meta, id: ShopId): number => meta.up[id] || 0;
export const U = (s: SimState, id: ShopId): number => shopLv(s.meta, id);

export function newPlayer(ch: HeroId): Player {
  return {
    ch, x: 0, y: 0, hp: 100, maxHp: 100, spd: 62, lv: 1, xp: 0, need: xpNeed(1), inv: 0, face: 1, dx: 1, dy: 0,
    moving: false, anim: 0, down: false,
    skills: { [HEROES[ch].start]: 1 }, pas: {}, evo: {}, revives: 0, cds: {},
    dmgMul: 1, cdMul: 1, cdRed: 0, crit: 0.08, critMul: 2.5, pick: 26, orbitA: 0, pet: null, clone: null, shards: 0,
  };
}

/** Additive bonuses with caps. */
export function recompute(s: SimState): void {
  const P = s.P, p = P.pas, c = P.ch;
  P.dmgMul = 1 + 0.2 * (p.might || 0) + 0.08 * U(s, 'power') + (c === 'mage' ? 0.15 : 0);
  P.cdRed = Math.min(CD_CAP, 0.08 * (p.haste || 0) + (c === 'alchemist' ? 0.1 : 0));
  P.cdMul = 1 - P.cdRed;
  P.crit = Math.min(CRIT_CAP, 0.08 + 0.07 * (p.crit || 0) + (c === 'alchemist' ? 0.05 : 0));
  P.critMul = 2 + 0.2 * (p.crit || 0);
  P.spd = 62 * (1 + 0.12 * (p.swift || 0) + 0.04 * U(s, 'speed') + (c === 'ranger' ? 0.15 : 0) - (c === 'knight' ? 0.08 : 0));
  P.maxHp = 100 + 30 * (p.vital || 0) + 15 * U(s, 'vigor') + (c === 'knight' ? 50 : 0);
  P.pick = 26 * (1 + 0.5 * (p.magnet || 0) + (c === 'ranger' ? 0.3 : 0));
}
