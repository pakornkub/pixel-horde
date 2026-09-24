import { TAU, cos, hypot, ipow, sin } from '../core/fmath';
import { DEATH_COL } from '../data/enemies';
import type { Enemy, SimState } from '../types';
import { grantDragon, grantShadow } from './events';
import { banner, burst, flash, sfx, shake, text } from './fx';
import { gameOver } from './progress';
import { spawnEnemy } from './spawner';

/** ALL damage to enemies goes through here. */
export function hit(s: SimState, e: Enemy, base: number, col: string, kb?: number): void {
  if (e.dead) return;
  const P = s.P, R = s.rng.combat, pl = s.cfg.player;
  let d = base * P.dmgMul * R.range(1 - pl.dmgVariance, 1 + pl.dmgVariance);
  const cr = R.next() < P.crit;
  if (cr) d *= P.critMul;
  d = Math.max(1, Math.round(d));
  if (e.armor) {
    const raw = d;
    d = Math.max(1, d - e.armor);
    if (d < raw * 0.5) col = '#9aa4b8';
    burst(s, e.x, e.y - e.r, '#d0d6e0', 2, 40, 0.2, 0.3);
  }
  s.events.push({ t: 'dmg', d });
  e.hp -= d;
  e.flash = 0.08;
  const dx = e.x - P.x, dy = e.y - P.y, l = hypot(dx, dy) || 1, k = (kb == null ? pl.kb : kb) * (e.boss ? pl.kbBoss : e.elite ? pl.kbElite : 1);
  e.kx += (dx / l) * k;
  e.ky += (dy / l) * k;
  text(s, e.x, e.y - e.r * 1.2, d, col, cr, { jitter: true });
  sfx(s, cr ? 'crit' : 'hit');
  if (e.hp <= 0) killE(s, e);
}

export function killE(s: SimState, e: Enemy): void {
  const R = s.rng.loot, C = s.cfg, L = C.loot;
  s.events.push({ t: 'kill', ttk: s.clock - e.born });
  if (e.type === 'splitter') {
    const sp = C.splitter;
    for (let i = 0; i < sp.minis; i++) {
      const a = (i / sp.minis) * TAU;
      const m = spawnEnemy(s, 'mini', e.x + cos(a) * sp.spread, e.y + sin(a) * sp.spread, false);
      m.kx = cos(a) * sp.push;
      m.ky = sin(a) * sp.push;
    }
  }
  e.dead = true;
  s.kills++;
  s.stageKills++;
  s.streak++;
  s.streakT = C.streak.window;
  if (s.streak > s.maxStreak) s.maxStreak = s.streak;
  s.ult = Math.min(C.ult.max, s.ult + (e.boss ? C.ult.perBoss : e.elite ? C.ult.perElite : C.ult.perKill));
  burst(s, e.x, e.y, DEATH_COL[e.type], e.boss ? 80 : e.elite ? 24 : 9, e.boss ? 110 : 60, e.boss ? 1 : 0.45);
  const v = e.xp;
  if (e.type === 'dragon' || e.type === 'rival') {
    const isD = e.type === 'dragon';
    if (isD) { s.dragonE = null; grantDragon(s); } else { s.rivalE = null; grantShadow(s); }
    shake(s, 10); flash(s, 0.3, undefined, true); s.hitstop = 0.12; sfx(s, 'boom');
    burst(s, e.x, e.y, isD ? '#ffd23f' : '#b07cff', 40, 120, 0.9);
    for (let i = 0; i < L.eventGems; i++) s.gems.push({ kind: 'xp', x: e.x + R.range(-20, 20), y: e.y + R.range(-20, 20), v: Math.ceil(v / L.eventGems), mag: false });
    s.gems.push({ kind: 'heart', x: e.x, y: e.y, v: L.heartBig, mag: false });
    return;
  }
  if (e.boss) {
    shake(s, 10); flash(s, 0.35, '#ffffff'); s.hitstop = 0.12; sfx(s, 'boom');
    for (let i = 0; i < L.bossGems; i++) s.gems.push({ kind: 'xp', x: e.x + R.range(-20, 20), y: e.y + R.range(-20, 20), v: Math.ceil(v / L.bossGems), mag: false });
    s.gems.push({ kind: 'heart', x: e.x, y: e.y, v: L.heartBig, mag: false });
    s.gems.push({ kind: 'chest', x: e.x + 10, y: e.y, v: 0, mag: false });
    s.gems.push({ kind: 'coin', x: e.x - 10, y: e.y, v: L.bossCoin, mag: false });
    banner(s, 'bossDown', 1.6);
    s.boss = null;
    return;
  }
  if (R.next() < (e.elite ? 1 : L.coinChance)) s.gems.push({ kind: 'coin', x: e.x + R.range(-3, 3), y: e.y + R.range(-3, 3), v: (e.elite ? L.eliteCoin : L.coin) * (s.specialStage ? C.events.bloodMoonCoin : 1), mag: false });
  if (s.gems.length > L.gemCap) {
    const g = s.gems[R.int(s.gems.length)];
    if (g.kind === 'xp') { g.v += v; return; }
  }
  s.gems.push({ kind: 'xp', x: e.x, y: e.y, v, mag: false });
  if (R.next() < L.heartChance) s.gems.push({ kind: 'heart', x: e.x + 4, y: e.y, v: L.heartSmall, mag: false });
}

/** ALL damage to the player goes through here. */
export function hurtP(s: SimState, d: number): void {
  const P = s.P;
  if (P.down || P.inv > 0 || s.phase !== 'play') return;
  s.dir.lastHurt = s.clock;
  if (s.debug.god) return;
  const hv = s.cfg.scaling.hitVariance;
  d = Math.max(1, Math.round(d * s.rng.combat.range(1 - hv, 1 + hv)));
  P.hp -= d;
  P.inv = s.cfg.player.inv;
  shake(s, 5); flash(s, 0.2, '#ff2a3a'); sfx(s, 'hurt');
  text(s, P.x, P.y - 12, '-' + d, '#ff4b5c', d >= P.maxHp * 0.2, { hurt: true });
  if (P.hp <= 0) handleDown(s);
}

export function handleDown(s: SimState): boolean {
  const P = s.P, W = s.cfg.secondWind;
  if (P.revives > 0) {
    P.revives--;
    P.hp = Math.round(P.maxHp * W.hp);
    P.inv = W.inv;
    s.effects.push({ type: 'nova', x: P.x, y: P.y, R: W.r, t: 0, dur: 0.45, hit: new Set(), dmg: W.dmg * ipow(W.dmgGrowth, s.stage - 1) });
    banner(s, 'secondWind', 1.6, true);
    flash(s, 0.4, '#fff35c'); shake(s, 8); sfx(s, 'ult');
    return false;
  }
  P.hp = 0;
  gameOver(s);
  return true;
}
