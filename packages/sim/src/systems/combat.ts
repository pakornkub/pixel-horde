import { TAU, cos, hypot, ipow, sin } from '../core/fmath';
import { DEATH_COL } from '../data/enemies';
import { ULT_MAX, type Enemy, type SimState } from '../types';
import { grantDragon, grantShadow } from './events';
import { banner, burst, flash, sfx, shake, text } from './fx';
import { gameOver } from './progress';
import { spawnEnemy } from './spawner';

/** ALL damage to enemies goes through here. */
export function hit(s: SimState, e: Enemy, base: number, col: string, kb?: number): void {
  if (e.dead) return;
  const P = s.P, R = s.rng.combat;
  let d = base * P.dmgMul * R.range(0.88, 1.12);
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
  const dx = e.x - P.x, dy = e.y - P.y, l = hypot(dx, dy) || 1, k = (kb == null ? 40 : kb) * (e.boss ? 0.1 : e.elite ? 0.4 : 1);
  e.kx += (dx / l) * k;
  e.ky += (dy / l) * k;
  text(s, e.x, e.y - e.r * 1.2, d, col, cr, { jitter: true });
  sfx(s, cr ? 'crit' : 'hit');
  if (e.hp <= 0) killE(s, e);
}

export function killE(s: SimState, e: Enemy): void {
  const R = s.rng.loot;
  s.events.push({ t: 'kill', ttk: s.clock - e.born });
  if (e.type === 'splitter') {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      const m = spawnEnemy(s, 'mini', e.x + cos(a) * 10, e.y + sin(a) * 10, false);
      m.kx = cos(a) * 80;
      m.ky = sin(a) * 80;
    }
  }
  e.dead = true;
  s.kills++;
  s.stageKills++;
  s.streak++;
  s.streakT = 2.2;
  if (s.streak > s.maxStreak) s.maxStreak = s.streak;
  s.ult = Math.min(ULT_MAX, s.ult + (e.boss ? 40 : e.elite ? 5 : 1));
  burst(s, e.x, e.y, DEATH_COL[e.type], e.boss ? 80 : e.elite ? 24 : 9, e.boss ? 110 : 60, e.boss ? 1 : 0.45);
  const v = e.xp;
  if (e.type === 'dragon' || e.type === 'rival') {
    const isD = e.type === 'dragon';
    if (isD) { s.dragonE = null; grantDragon(s); } else { s.rivalE = null; grantShadow(s); }
    shake(s, 10); flash(s, 0.3, undefined, true); s.hitstop = 0.12; sfx(s, 'boom');
    burst(s, e.x, e.y, isD ? '#ffd23f' : '#b07cff', 40, 120, 0.9);
    for (let i = 0; i < 10; i++) s.gems.push({ kind: 'xp', x: e.x + R.range(-20, 20), y: e.y + R.range(-20, 20), v: Math.ceil(v / 10), mag: false });
    s.gems.push({ kind: 'heart', x: e.x, y: e.y, v: 0.5, mag: false });
    return;
  }
  if (e.boss) {
    shake(s, 10); flash(s, 0.35, '#ffffff'); s.hitstop = 0.12; sfx(s, 'boom');
    for (let i = 0; i < 14; i++) s.gems.push({ kind: 'xp', x: e.x + R.range(-20, 20), y: e.y + R.range(-20, 20), v: Math.ceil(v / 14), mag: false });
    s.gems.push({ kind: 'heart', x: e.x, y: e.y, v: 0.5, mag: false });
    s.gems.push({ kind: 'chest', x: e.x + 10, y: e.y, v: 0, mag: false });
    s.gems.push({ kind: 'coin', x: e.x - 10, y: e.y, v: 50, mag: false });
    banner(s, 'bossDown', 1.6);
    s.boss = null;
    return;
  }
  if (R.next() < (e.elite ? 1 : 0.08)) s.gems.push({ kind: 'coin', x: e.x + R.range(-3, 3), y: e.y + R.range(-3, 3), v: (e.elite ? 5 : 1) * (s.specialStage ? 2 : 1), mag: false });
  if (s.gems.length > 380) {
    const g = s.gems[R.int(s.gems.length)];
    if (g.kind === 'xp') { g.v += v; return; }
  }
  s.gems.push({ kind: 'xp', x: e.x, y: e.y, v, mag: false });
  if (R.next() < 0.012) s.gems.push({ kind: 'heart', x: e.x + 4, y: e.y, v: 0.3, mag: false });
}

/** ALL damage to the player goes through here. */
export function hurtP(s: SimState, d: number): void {
  const P = s.P;
  if (P.down || P.inv > 0 || s.phase !== 'play') return;
  s.dir.lastHurt = s.clock;
  if (s.debug.god) return;
  d = Math.max(1, Math.round(d * s.rng.combat.range(0.85, 1.15)));
  P.hp -= d;
  P.inv = 0.6;
  shake(s, 5); flash(s, 0.2, '#ff2a3a'); sfx(s, 'hurt');
  text(s, P.x, P.y - 12, '-' + d, '#ff4b5c', d >= P.maxHp * 0.2, { hurt: true });
  if (P.hp <= 0) handleDown(s);
}

export function handleDown(s: SimState): boolean {
  const P = s.P;
  if (P.revives > 0) {
    P.revives--;
    P.hp = Math.round(P.maxHp * 0.5);
    P.inv = 2.5;
    s.effects.push({ type: 'nova', x: P.x, y: P.y, R: 110, t: 0, dur: 0.45, hit: new Set(), dmg: 150 * ipow(1.45, s.stage - 1) });
    banner(s, 'secondWind', 1.6, true);
    flash(s, 0.4, '#fff35c'); shake(s, 8); sfx(s, 'ult');
    return false;
  }
  P.hp = 0;
  gameOver(s);
  return true;
}
