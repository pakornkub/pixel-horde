import type { ResolvedConfig } from '@pixel-horde/config';
import { ipow } from '../core/fmath';
import { HEROES, type HeroId } from '../data/heroes';
import type { ShopId } from '../data/shop';
import type { Meta, Player, SimState } from '../types';

export function xpNeed(cfg: ResolvedConfig, lv: number): number {
  const x = cfg.xp;
  return Math.floor(x.base + lv * x.perLv + lv * lv * x.quad + ipow(Math.max(0, lv - x.lateFrom), 2) * x.lateQuad);
}

export const shopLv = (meta: Meta, id: ShopId): number => meta.up[id] || 0;
export const U = (s: SimState, id: ShopId): number => shopLv(s.meta, id);

export function newPlayer(cfg: ResolvedConfig, ch: HeroId): Player {
  const p = cfg.player;
  return {
    ch, x: 0, y: 0, hp: p.hp, maxHp: p.hp, spd: p.spd, lv: 1, xp: 0, need: xpNeed(cfg, 1), inv: 0, face: 1, dx: 1, dy: 0,
    moving: false, anim: 0, down: false,
    skills: { [HEROES[ch].start]: 1 }, pas: {}, evo: {}, revives: 0, cds: {},
    dmgMul: 1, cdMul: 1, cdRed: 0, crit: p.crit, critMul: 2.5, pick: p.pick, orbitA: 0, pet: null, petStore: [], guardiansBeaten: [], clone: null, shards: 0,
    bench: [], awakened: false, awakenDeclined: false, linkStart: [], linkStages: {}, statusMul: 1, shieldA: 0, slip: 0, slipGrip: 1, vx: 0, vy: 0, chill: 0,
  };
}

/** Additive bonuses with caps. */
export function recompute(s: SimState): void {
  const P = s.P, p = P.pas, c = P.ch, C = s.cfg, ps = C.passives, h = C.heroes, pl = C.player, sh = C.shop;
  P.dmgMul = 1 + ps.mightDmg * (p.might || 0) + sh.power.per * U(s, 'power') + (c === 'mage' ? h.mage.dmg : 0);
  P.cdRed = Math.min(pl.cdCap, ps.hasteCd * (p.haste || 0) + (c === 'alchemist' ? h.alchemist.cd : 0));
  P.cdMul = 1 - P.cdRed;
  P.crit = Math.min(pl.critCap, pl.crit + ps.keenCrit * (p.crit || 0));
  P.statusMul = 1 + (c === 'alchemist' ? h.alchemist.status : 0);
  P.critMul = pl.critMul + ps.keenCritMul * (p.crit || 0);
  P.spd = pl.spd * (1 + ps.swiftSpd * (p.swift || 0) + sh.speed.per * U(s, 'speed') + (c === 'ranger' ? h.ranger.spd : 0) - (c === 'knight' ? h.knight.spd : 0));
  P.maxHp = pl.hp + ps.vitalHp * (p.vital || 0) + sh.vigor.per * U(s, 'vigor') + (c === 'knight' ? h.knight.hp : 0);
  P.pick = pl.pick * (1 + ps.magnetPick * (p.magnet || 0) + (c === 'ranger' ? h.ranger.pick : 0));
}
