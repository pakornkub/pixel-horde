// Co-op (tickets 41/42), host-authoritative as in the original game:
// - the HOST simulates the world. Guests' positions arrive as `mates` commands (monsters chase the
//   nearest player; spawns and boss HP scale with the team) and their damage as `remoteHits`.
// - a GUEST runs its own Hero and Skills against a mirror of the host's monsters and hazards
//   (`snap` commands ~15 Hz), queues its damage for the host and takes contact/hazard damage locally.
//   Team EXP, kills, Gold, King rewards and Guardians come from the host's counters.
import { ENEMY_IDS, type EnemyId } from '../data/enemies';
import { exp, hypot } from '../core/fmath';
import { REALMS } from '../content/lumora/realms';
import type { CoopRole, CoopState, Enemy, Gem, Hazard, HostPhase, HostSnap, MateWire, SimState } from '../types';
import { hit, hurtP, rollKingWeapon } from './combat';
import { grantShadow } from './events';
import { grantGuardian } from './guardians';
import { banner, burst, flash, sfx } from './fx';
import { choose, chestStop, gameOver, levelCheck, startStage } from './progress';
import { spawnEnemy } from './spawner';
import { stepStatuses } from './combos';
import { U } from './player';

export function initCoop(role: CoopRole, self: string): CoopState {
  return {
    role, self, mates: [], teamXp: 0, kingKills: 0, guardians: 0, lastGuardian: 'inferno', rivals: 0,
    teamGold: 0, teamChests: 0, healed: {}, guarded: {}, chooseT: 0, shieldT: 0, wasChoosing: false,
    reviveT: {}, revived: {}, revivedStage: [], hostPhase: 'play', out: {},
    last: { xp: 0, kc: 0, bk: 0, gd: 0, rk: 0, rv: 0, es: 0, st: 0, realm: null, ph: 'play', tg: 0, tc: 0, hl: 0, sg: 0 }, drops: [],
  };
}

export const isHost = (s: SimState): boolean => s.coop?.role === 'host';
export const isGuest = (s: SimState): boolean => s.coop?.role === 'guest';

/* ---------- enemy packing: 11 chars = id(3) type(1) flags(1) x(3) y(3), base64, relative to the host ---------- */
const A64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const AI: Record<string, number> = Object.fromEntries([...A64].map((c, i) => [c, i]));
const enc = (n: number, len: number): string => { let s = ''; for (let i = 0; i < len; i++) { s = A64[n & 63] + s; n >>= 6; } return s; };
const dec = (s: string, at: number, len: number): number => { let n = 0; for (let i = 0; i < len; i++) { const v = AI[s[at + i]]; if (v === undefined) return NaN; n = n * 64 + v; } return n; };
const OFF = 131072, MAXC = 262143;
/** Monsters per snapshot (keeps it under ~4 KB). */
export const SNAP_ENEMIES = 230;

export function packEnemies(list: readonly Enemy[], ox: number, oy: number): string {
  let s = '', n = 0;
  for (const e of list) {
    if (e.dead || e.hide) continue;
    if (n++ >= SNAP_ENEMIES) break;
    const x = Math.max(0, Math.min(MAXC, Math.round(e.x - ox) + OFF)), y = Math.max(0, Math.min(MAXC, Math.round(e.y - oy) + OFF));
    s += enc(e.id & MAXC, 3) + A64[ENEMY_IDS.indexOf(e.type)] + A64[(e.elite ? 1 : 0) + (e.armor ? 2 : 0)] + enc(x, 3) + enc(y, 3);
  }
  return s;
}

export interface PackedEnemy { id: number; type: EnemyId; elite: boolean; armored: boolean; x: number; y: number }
export function unpackEnemies(str: string, ox: number, oy: number): PackedEnemy[] {
  const out: PackedEnemy[] = [];
  if (typeof str !== 'string' || str.length > SNAP_ENEMIES * 11) return out;
  for (let i = 0; i + 11 <= str.length; i += 11) {
    const id = dec(str, i, 3), ti = AI[str[i + 3]], fl = AI[str[i + 4]], x = dec(str, i + 5, 3), y = dec(str, i + 8, 3);
    const type = ENEMY_IDS[ti];
    if (!Number.isFinite(id) || !type || fl === undefined || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ id, type, elite: (fl & 1) > 0, armored: (fl & 2) > 0, x: ox + x - OFF, y: oy + y - OFF });
  }
  return out;
}

/* ---------- shared drops: 7 chars = kind(1) x(3) y(3), relative to the host ---------- */
const GEM_KINDS: Gem['kind'][] = ['xp', 'coin', 'chest', 'heart', 'shield']; // append only: the index is the wire code
/** Drops per snapshot (the ones closest to a player first). */
export const SNAP_GEMS = 150;

function packGems(s: SimState, ox: number, oy: number): string {
  let list = s.gems;
  if (list.length > SNAP_GEMS) {
    const ps = [s.P, ...s.coop!.mates];
    const near = (g: Gem): number => Math.min(...ps.map((p) => Math.abs(p.x - g.x) + Math.abs(p.y - g.y)));
    list = [...list].sort((a, b) => near(a) - near(b)).slice(0, SNAP_GEMS);
  }
  let out = '';
  for (const g of list) {
    const k = GEM_KINDS.indexOf(g.kind);
    if (k < 0) continue; // a drop kind this build does not share yet
    const x = Math.max(0, Math.min(MAXC, Math.round(g.x - ox) + OFF)), y = Math.max(0, Math.min(MAXC, Math.round(g.y - oy) + OFF));
    out += A64[k] + enc(x, 3) + enc(y, 3);
  }
  return out;
}

export function unpackGems(str: unknown, ox: number, oy: number): Gem[] {
  const out: Gem[] = [];
  if (typeof str !== 'string' || str.length > SNAP_GEMS * 7) return out;
  for (let i = 0; i + 7 <= str.length; i += 7) {
    const kind = GEM_KINDS[AI[str[i]]], x = dec(str, i + 1, 3), y = dec(str, i + 4, 3);
    if (!kind || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({ kind, x: ox + x - OFF, y: oy + y - OFF, v: 0, mag: false });
  }
  return out;
}

/** A Shield pickup on this player (same as solo: the stronger absorb wins, the timer restarts). */
function giveGuard(s: SimState, v: number): void {
  const P = s.P;
  P.guard = Math.max(P.guard, Math.round(P.maxHp * v));
  P.guardT = s.cfg.loot.shieldDur;
  sfx(s, 'lv');
  s.events.push({ t: 'text', x: P.x, y: P.y - 12, v: '+' + P.guard, col: '#7fd4ff', cr: false });
}

const roundHeal = (h: Record<string, number>): Record<string, number> => Object.fromEntries(Object.entries(h).map(([k, v]) => [k, Math.round(v * 1000) / 1000]));

/**
 * Host, every tick (replaces stepGems in co-op): the drops are shared. Any standing player picks
 * them up (guests at their last reported position); EXP, Gold and chests go to the whole team,
 * a heart heals — and a Shield guards — the player who took it and allies close by.
 */
export function coopGems(s: SimState, dt: number): void {
  const c = s.coop!, P = s.P, L = s.cfg.loot, sh = s.cfg.shop, C = s.cfg.coop;
  const players = [
    { id: c.self, x: P.x, y: P.y, pick: P.pick, dn: P.down },
    ...c.mates.map((m) => ({ id: m.id, x: m.x, y: m.y, pick: m.pk || s.cfg.player.pick, dn: m.dn })),
  ].filter((p) => !p.dn);
  if (!players.length) return;
  for (const g of s.gems) {
    // fly to the closest player (the vacuum at the end of a Stage pulls everything to someone)
    let best = players[0], bd = Infinity;
    for (const p of players) { const d = hypot(p.x - g.x, p.y - g.y); if (d < bd) { bd = d; best = p; } }
    if (bd < best.pick) g.mag = true;
    if (g.mag) {
      const sp = Math.min(L.magnetMax, (g.sp = (g.sp || 60) + L.magnetAccel * dt)), l = bd || 1;
      g.x += ((best.x - g.x) / l) * sp * dt;
      g.y += ((best.y - g.y) / l) * sp * dt;
    }
    if (bd >= 7) continue;
    g.got = true;
    if (g.kind === 'xp') { c.teamXp += g.v; P.xp += g.v * (1 + sh.wisdom.per * U(s, 'wisdom')); sfx(s, 'gem'); }
    else if (g.kind === 'coin') {
      c.teamGold += g.v;
      const gg = Math.max(1, Math.round(g.v * (1 + sh.greed.per * U(s, 'greed'))));
      s.runGold += gg;
      sfx(s, 'coin');
      if (g.v >= 5) s.events.push({ t: 'text', x: g.x, y: g.y - 8, v: '+' + gg + 'G', col: '#ffd23f', cr: false });
    } else if (g.kind === 'chest') { c.teamChests++; s.chestQueue++; s.runGold += L.chestGold; }
    else if (g.kind === 'heart') {
      for (const p of players) {
        if (p !== best && hypot(p.x - best.x, p.y - best.y) > C.heartShare) continue;
        if (p.id === c.self) {
          const h = Math.round(P.maxHp * g.v);
          P.hp = Math.min(P.maxHp, P.hp + h);
          s.events.push({ t: 'text', x: P.x, y: P.y - 12, v: '+' + h, col: '#6fe36a', cr: false });
        } else c.healed[p.id] = (c.healed[p.id] || 0) + g.v;
      }
      burst(s, g.x, g.y, '#6fe36a', 8, 40, 0.35);
    } else if (g.kind === 'shield') {
      for (const p of players) {
        if (p !== best && hypot(p.x - best.x, p.y - best.y) > C.heartShare) continue;
        if (p.id === c.self) giveGuard(s, g.v);
        else c.guarded[p.id] = (c.guarded[p.id] || 0) + 1;
      }
      burst(s, g.x, g.y, '#7fd4ff', 8, 40, 0.35);
    }
  }
  s.gems = s.gems.filter((g) => !g.got);
  levelCheck(s);
}

/* ---------- players ---------- */
export function selfWire(s: SimState, name?: string): MateWire {
  const P = s.P;
  return {
    id: s.coop?.self ?? '', name, x: Math.round(P.x), y: Math.round(P.y), hp: Math.ceil(Math.max(0, P.hp)), mh: P.maxHp, lv: P.lv,
    dn: P.down, fc: P.face, mv: P.moving, hero: P.ch, sel: s.phase === 'levelup' || s.phase === 'chest', pet: P.pet?.kind ?? null,
    pk: Math.round(P.pick), sh: (s.coop?.shieldT ?? 0) > 0, gt: P.guardT > 0 && P.guard > 0,
  };
}

function mergeMates(s: SimState, list: readonly MateWire[]): void {
  const c = s.coop!, old = new Map(c.mates.map((m) => [m.id, m]));
  c.mates = list.filter((m) => m && m.id !== c.self && Number.isFinite(m.x) && Number.isFinite(m.y)).map((m) => {
    const o = old.get(m.id), far = !o || hypot(o.rx - m.x, o.ry - m.y) > 200;
    return { ...m, rx: far ? m.x : o.rx, ry: far ? m.y : o.ry };
  });
}

/** Host: latest guest presence. */
export function setMates(s: SimState, list: readonly MateWire[]): void { if (isHost(s)) mergeMates(s, list); }

/** Living players monsters can chase. */
export function targets(s: SimState): { x: number; y: number }[] {
  const t: { x: number; y: number }[] = [];
  if (!s.P.down) t.push(s.P);
  if (isHost(s)) for (const m of s.coop!.mates) if (!m.dn) t.push(m);
  return t;
}
export function nearestTarget(s: SimState, x: number, y: number): { x: number; y: number } {
  if (!isHost(s) || !s.coop!.mates.length) return s.P;
  let best: { x: number; y: number } = s.P, bd = Infinity;
  for (const t of targets(s)) { const d = (t.x - x) * (t.x - x) + (t.y - y) * (t.y - y); if (d < bd) { bd = d; best = t; } }
  return best;
}
export const extraPlayers = (s: SimState): number => (isHost(s) ? s.coop!.mates.length : 0);
export const aliveMates = (s: SimState): number => (isHost(s) ? s.coop!.mates.filter((m) => !m.dn).length : 0);
/** Boss / Guardian / Umbra HP multiplier for the team size. */
export const coopBossMul = (s: SimState): number => 1 + s.cfg.coop.bossHpPerMate * extraPlayers(s);

/* ---------- level-up / chest while the room keeps playing ---------- */
/** Co-op: this player is picking a level-up or spinning a chest (the world does not stop). */
export const choosing = (s: SimState): boolean => !!s.coop && (s.phase === 'levelup' || s.phase === 'chest');

/** Shield bubble on this player: picking right now, or the few seconds after (to get moving again). */
export const shielded = (s: SimState): boolean => choosing(s) || (!!s.coop && s.coop.shieldT > 0);

/**
 * Every tick in co-op: while choosing, the Hero stands still inside a shield bubble (no damage —
 * hurtP only hurts in 'play' — and monsters are pushed out) and a pick is made for them when time
 * runs out. The bubble stays `coop.shieldAfter` s after the choice (moving, still no damage).
 */
export function chooseStep(s: SimState, dt: number): void {
  const c = s.coop!, C = s.cfg.coop, P = s.P, now = choosing(s);
  if (c.wasChoosing && !now) c.shieldT = C.shieldAfter;
  c.wasChoosing = now;
  if (!now && c.shieldT > 0) c.shieldT = Math.max(0, c.shieldT - dt);
  if (!shielded(s)) return;
  for (const e of s.enemies) {
    if (e.dead || e.boss) continue;
    const dx = e.x - P.x, dy = e.y - P.y, l = hypot(dx, dy) || 1;
    if (l < C.shieldR + e.r) { const k = Math.min(C.shieldR + e.r - l, C.shieldPush * dt); e.x += (dx / l) * k; e.y += (dy / l) * k; }
  }
  if (!now) return;
  c.chooseT -= dt;
  if (c.chooseT > 0) return;
  c.chooseT = C.pickTime;
  if (s.phase === 'chest') chestStop(s);
  else if (s.levelUp) choose(s, s.rng.levelup.int(s.levelUp.options.length));
}

/* ---------- host ---------- */
export function applyRemoteHits(s: SimState, hits: readonly number[]): void {
  if (!isHost(s) || !Array.isArray(hits) || s.phase === 'over') return;
  const byId = new Map<number, Enemy>();
  for (const e of s.enemies) if (!e.dead) byId.set(e.id, e);
  for (let i = 0; i + 1 < hits.length && i < 1200; i += 2) {
    const e = byId.get(hits[i]), d = Number(hits[i + 1]);
    if (!e || e.dead || !Number.isFinite(d) || d === 0) continue;
    hit(s, e, Math.min(Math.abs(d), 1e7), '#8fdcff', 0, d < 0 ? { remote: true, raw: true } : { remote: true });
  }
}

/** Host, every tick: ally revives and the all-down end. */
export function hostStep(s: SimState, dt: number): void {
  if (!isHost(s) || (s.phase !== 'play' && !choosing(s))) return;
  const c = s.coop!, C = s.cfg.coop, P = s.P;
  const everyone = [{ id: c.self, x: P.x, y: P.y, dn: P.down }, ...c.mates.map((m) => ({ id: m.id, x: m.x, y: m.y, dn: m.dn }))];
  if (everyone.every((p) => p.dn)) { gameOver(s); return; }
  for (const d of everyone) {
    if (!d.dn || c.revivedStage.includes(d.id)) { delete c.reviveT[d.id]; continue; }
    const helper = everyone.some((a) => !a.dn && a.id !== d.id && hypot(a.x - d.x, a.y - d.y) < C.reviveRange);
    c.reviveT[d.id] = helper ? (c.reviveT[d.id] || 0) + dt : 0;
    if (c.reviveT[d.id] >= C.reviveTime) {
      delete c.reviveT[d.id];
      c.revivedStage.push(d.id);
      c.revived[d.id] = (c.revived[d.id] || 0) + 1;
      if (d.id === c.self) reviveSelf(s);
      else { const m = c.mates.find((x) => x.id === d.id); if (m) m.dn = false; }
    }
  }
}

function reviveSelf(s: SimState): void {
  const P = s.P;
  P.down = false;
  P.hp = Math.round(P.maxHp * s.cfg.coop.reviveHp);
  P.inv = 2;
  banner(s, 'secondWind', 1.6, true);
  flash(s, 0.3, '#8fdcff');
  sfx(s, 'lv');
}

export function hostPhaseOf(s: SimState): HostPhase {
  switch (s.phase) {
    case 'over': return 'over';
    case 'clear': case 'clearing': return 'clear';
    case 'route': return 'route';
    case 'victory': return 'victory';
    case 'pause': return 'pause';
    case 'revive': return 'wait';
    default: return 'play'; // level-ups and chests never stop the room
  }
}

const cleanHz = (h: Hazard): Hazard => {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(h)) if (v !== undefined && k !== 'hitP' && k !== 'tk') o[k] = typeof v === 'number' ? Math.round(v * 100) / 100 : v;
  return o as unknown as Hazard;
};

export function hostSnapshot(s: SimState, names: Record<string, string> = {}): HostSnap {
  const c = s.coop!, ox = Math.round(s.P.x), oy = Math.round(s.P.y);
  const bs: [string, number, number][] = [];
  const pct = (e: Enemy): number => Math.max(0, Math.round((e.hp / e.maxHp) * 1000) / 10);
  if (s.boss && !s.boss.dead) bs.push(['k', s.boss.id, pct(s.boss)]);
  if (s.boss2 && !s.boss2.dead) bs.push(['k2', s.boss2.id, pct(s.boss2)]);
  if (s.dragonE && !s.dragonE.dead) bs.push(['d', s.dragonE.id, pct(s.dragonE)]);
  if (s.rivalE && !s.rivalE.dead) bs.push(['r', s.rivalE.id, pct(s.rivalE)]);
  return {
    st: s.stage, realm: s.realm, t: Math.round(s.stageTime * 10), dur: s.stageDur, ph: hostPhaseOf(s), ox, oy,
    e: packEnemies(s.enemies, ox, oy), bs,
    xp: Math.round(c.teamXp), kc: s.kills, bk: c.kingKills, gd: c.guardians, gk: c.lastGuardian, rk: c.rivals, es: s.escapes,
    tg: c.teamGold, tc: c.teamChests, hl: roundHeal(c.healed), sg: { ...c.guarded }, g: packGems(s, ox, oy),
    hz: s.hz.slice(0, 60).map(cleanHz), sp: s.specialStage, dark: s.darkness, ot: s.overtime, le: s.lastEnd,
    pl: [{ ...selfWire(s, names[c.self]) }, ...c.mates.map((m) => ({ id: m.id, name: names[m.id] ?? m.name, x: m.x, y: m.y, hp: m.hp, mh: m.mh, lv: m.lv, dn: m.dn, fc: m.fc, mv: m.mv, hero: m.hero, sel: m.sel, sh: m.sh, gt: m.gt, pet: m.pet }))],
    rv: { ...c.revived }, route: s.phase === 'route' ? s.route : null, victory: s.victory,
  };
}

/* ---------- guest ---------- */
/** Guest: queue damage for the host instead of changing HP (Ultimate hits are sent negative). */
export function queueHit(s: SimState, e: Enemy, d: number, ult: boolean): void {
  const out = s.coop!.out;
  out[e.id] = (out[e.id] || 0) + (ult ? -d : d);
}

/** Guest: damage to send (and forget) — [enemyId, dmg, …]. */
export function takeHits(s: SimState): number[] {
  if (!isGuest(s)) return [];
  const out = s.coop!.out, a: number[] = [];
  for (const [id, d] of Object.entries(out)) a.push(Number(id), Math.round(d));
  s.coop!.out = {};
  return a;
}

export function applySnap(s: SimState, h: HostSnap): void {
  if (!isGuest(s) || !h || typeof h !== 'object') return;
  const c = s.coop!, L = c.last, P = s.P, E = s.cfg.economy;
  if (s.phase === 'over') return;
  // the host continued into Endless: so does this guest (Endless Score from here)
  if (s.phase === 'victory' && h.ph !== 'victory' && h.ph !== 'over') { s.endless = true; s.endlessFrom = { kills: s.kills, combos: s.combos, escapes: s.escapes }; s.phase = 'clear'; }
  // Stage change: the host started the next Chapter (or this is the first snapshot)
  if (h.st !== L.st || h.realm !== L.realm) {
    if (L.st && P.down === false) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * s.cfg.stage.clearHeal);
    s.realm = REALMS[h.realm] ? h.realm : s.realm;
    if (!s.visited.includes(s.realm)) s.visited.push(s.realm);
    c.revivedStage = [];
    const keep = s.phase === 'levelup' || s.phase === 'chest' ? s.phase : null;
    startStage(s, Math.max(1, Math.floor(h.st) || 1));
    if (keep) s.phase = keep;
    L.st = h.st; L.realm = h.realm;
  }
  s.stageTime = h.t / 10; s.stageDur = h.dur;
  s.specialStage = !!h.sp; s.darkness = !!h.dark;
  if (h.ot && !s.overtime) banner(s, 'overtime', 2, true);
  s.overtime = !!h.ot;
  // team counters → this player's own rewards
  const dx = h.xp - L.xp;
  if (dx > 0 && dx < 1e7) P.xp += dx * (1 + s.cfg.shop.wisdom.per * U(s, 'wisdom'));
  L.xp = h.xp;
  const dk = h.kc - L.kc;
  if (dk > 0 && dk < 5000) {
    s.kills += dk; s.stageKills += dk; s.streak += dk; s.streakT = s.cfg.streak.window;
    if (s.streak > s.maxStreak) s.maxStreak = s.streak;
  }
  L.kc = h.kc;
  // shared drops: whoever picked them up, the whole team gets the Gold, the chests and its share of hearts
  const tg = typeof h.tg === 'number' ? h.tg : L.tg, dg = tg - L.tg;
  if (dg > 0 && dg < 1e6) {
    const gg = Math.max(1, Math.round(dg * (1 + s.cfg.shop.greed.per * U(s, 'greed'))));
    s.runGold += gg;
    sfx(s, 'coin');
    if (dg >= 5) s.events.push({ t: 'text', x: P.x, y: P.y - 16, v: '+' + gg + 'G', col: '#ffd23f', cr: false });
  }
  L.tg = tg;
  const tc = typeof h.tc === 'number' ? h.tc : L.tc;
  for (let k = L.tc; k < tc && k - L.tc < 5; k++) { s.chestQueue++; s.runGold += s.cfg.loot.chestGold; }
  L.tc = tc;
  const hl = h.hl && typeof h.hl[c.self] === 'number' ? h.hl[c.self] : L.hl, dh = hl - L.hl;
  if (dh > 0 && dh < 50 && !P.down) {
    const add = Math.round(P.maxHp * dh);
    P.hp = Math.min(P.maxHp, P.hp + add);
    s.events.push({ t: 'text', x: P.x, y: P.y - 12, v: '+' + add, col: '#6fe36a', cr: false });
  }
  L.hl = hl;
  const sg = h.sg && typeof h.sg[c.self] === 'number' ? h.sg[c.self] : L.sg;
  if (sg > L.sg && sg - L.sg < 20 && !P.down) giveGuard(s, s.cfg.loot.shieldAbsorb);
  L.sg = sg;
  c.drops = unpackGems(h.g, h.ox, h.oy);
  for (let k = L.bk; k < h.bk && k - L.bk < 10; k++) {
    s.kingsKilled.push(s.stage);
    s.sp += E.kingSkillPoints;
    s.chestQueue += E.kingChest;
    s.runGold += s.cfg.stage.kingGold * s.stage;
    rollKingWeapon(s, s.realm);
    banner(s, 'bossDown', 1.6);
  }
  L.bk = h.bk;
  if (h.gd > L.gd && h.gd - L.gd < 5) for (let k = L.gd; k < h.gd; k++) grantGuardian(s, h.gk);
  L.gd = h.gd;
  if (h.rk > L.rk && h.rk - L.rk < 5) for (let k = L.rk; k < h.rk; k++) grantShadow(s);
  L.rk = h.rk;
  const es = typeof h.es === 'number' ? h.es : L.es;
  for (let k = L.es; k < es && k - L.es < 5; k++) { s.escapes++; if (s.realm) s.escapedKings.push(s.realm); }
  L.es = es;
  // ally revive
  const rv = (h.rv && h.rv[c.self]) || 0;
  if (rv > L.rv) { L.rv = rv; if (P.down) reviveSelf(s); }
  // players
  mergeMates(s, Array.isArray(h.pl) ? h.pl : []);
  // monsters
  mirrorEnemies(s, h);
  // hazards (keep our own "already hit" flags)
  const mine = new Map(s.hz.map((z) => [z.id, z]));
  s.hz = (Array.isArray(h.hz) ? h.hz : []).map((z) => { const o = mine.get(z.id); return o ? { ...z, hitP: o.hitP, tk: o.tk, done: o.done || z.done, fired: true } : { ...z, fired: true }; });
  // phase
  const was = L.ph;
  c.hostPhase = h.ph;
  L.ph = h.ph;
  if (h.ph === 'over') { gameOver(s); return; }
  if (h.ph === 'clear' && was !== 'clear') {
    if (h.le === 'clear') s.chaptersCleared.push(s.stage);
    s.lastEnd = h.le;
    s.hz = []; s.enemies = []; s.boss = s.boss2 = s.dragonE = s.rivalE = null;
    if (s.phase === 'play') { s.phase = 'clear'; banner(s, h.le === 'escape' ? 'kingEscaped' : 'stageClear', 1.5, true); sfx(s, 'clear'); }
  } else if (h.ph === 'clear' && s.phase === 'play') s.phase = 'clear'; // finished a level-up after the host cleared
  if (h.ph === 'route') { s.route = h.route; if (s.phase === 'clear' || s.phase === 'play') s.phase = 'route'; }
  if (h.ph === 'victory' && s.phase !== 'victory') { s.victory = true; if (s.phase === 'clear' || s.phase === 'play' || s.phase === 'route') s.phase = 'victory'; }
  if (h.ph === 'play' && (s.phase === 'clear' || s.phase === 'route' || s.phase === 'victory')) s.phase = 'play';
}

function mirrorEnemies(s: SimState, h: HostSnap): void {
  const list = unpackEnemies(h.e, h.ox, h.oy), mine = new Map(s.enemies.map((e) => [e.id, e])), seen = new Set<number>();
  const next: Enemy[] = [];
  for (const p of list) {
    seen.add(p.id);
    let e = mine.get(p.id);
    if (!e || e.type !== p.type) {
      const eid = s.eid;
      e = spawnEnemy(s, p.type, p.x, p.y, p.elite);
      s.enemies.pop(); // spawnEnemy adds it; the mirror list is rebuilt below
      s.eid = eid;
      e.id = p.id;
      e.hp = e.maxHp = 1e12; // guests never know monster HP; the host decides deaths
    }
    e.tx = p.x; e.ty = p.y;
    e.armor = p.armored ? e.armor || 1 : 0;
    next.push(e);
  }
  for (const e of s.enemies) if (!seen.has(e.id) && !e.dead && Math.abs(e.x - s.P.x) < s.viewport.w && Math.abs(e.y - s.P.y) < s.viewport.h) burst(s, e.x, e.y, '#ffffff', 5, 50, 0.35);
  s.enemies = next;
  const find = (id: number): Enemy | null => next.find((e) => e.id === id) ?? null;
  const hadKing = !!s.boss;
  s.boss = s.boss2 = s.dragonE = s.rivalE = null;
  for (const [role, id, pct] of Array.isArray(h.bs) ? h.bs : []) {
    const e = find(id);
    if (!e) continue;
    e.hp = pct; e.maxHp = 100;
    if (role === 'k') s.boss = e; else if (role === 'k2') s.boss2 = e; else if (role === 'd') s.dragonE = e; else if (role === 'r') s.rivalE = e;
  }
  if (!hadKing && s.boss) { s.events.push({ t: 'kingIntro', realm: s.realm, x: s.boss.x, y: s.boss.y }); banner(s, 'bossIncoming', 2, false, { dir: '' }); }
}

/** Guest, every tick: glide monsters toward the host's positions; contact damage hits only this player. */
export function guestEnemies(s: SimState, dt: number, live: boolean): void {
  const P = s.P, k = 1 - exp(-14 * dt), contact = s.cfg.player.contact;
  for (const e of s.enemies) {
    if (e.tx !== undefined) {
      if (Math.abs(e.tx - e.x) > 200 || Math.abs(e.ty! - e.y) > 200) { e.x = e.tx; e.y = e.ty!; }
      e.x += (e.tx - e.x) * k; e.y += (e.ty! - e.y) * k;
    }
    e.flash -= dt; e.slowT -= dt; e.frz -= dt; e.oc -= dt; e.ph += dt * 8;
    stepStatuses(e, dt);
    if (live && !P.down && !e.hide && P.inv <= 0 && hypot(P.x - e.x, P.y - e.y) < e.r + contact) {
      hurtP(s, e.dmg * (e.dmgMul || 1));
      if (s.phase === 'over') return;
    }
  }
}

/** Mates' smoothed render positions (called by the sim every tick). */
export function smoothMates(s: SimState, dt: number): void {
  if (!s.coop) return;
  const k = 1 - exp(-14 * dt);
  for (const m of s.coop.mates) { m.rx += (m.x - m.rx) * k; m.ry += (m.y - m.ry) * k; }
}
