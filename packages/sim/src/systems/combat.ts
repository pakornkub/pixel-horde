import { TAU, cos, hypot, ipow, sin } from '../core/fmath';
import { DEATH_COL, SPLITS } from '../data/enemies';
import { linAt, type HitTag } from '../data/skills';
import { WEAPONS, weaponKey, weaponOfRealm, type WeaponId } from '../data/weapons';
import { REALMS, type RealmId } from '../content/lumora/realms';
import { combosFor } from './combos';
import type { Enemy, SimState } from '../types';
import { grantShadow } from './events';
import { grantGuardian } from './guardians';
import { banner, burst, flash, sfx, shake, text } from './fx';
import { say } from './kings';
import { gameOver, offerRevive } from './progress';
import { spawnEnemy } from './spawner';
import { isGuest, isHost, queueHit } from './coop';

/** ALL damage to enemies goes through here. */
export function hit(s: SimState, e: Enemy, base: number, col: string, kb?: number, tag?: HitTag): void {
  if (e.dead || e.hide) return;
  const P = s.P, R = s.rng.combat, pl = s.cfg.player;
  let after: (() => void)[] | null = null;
  if (tag?.remote) return remoteHit(s, e, base, !!tag.raw);
  if (tag?.raw) return rawHit(s, e, base, col, kb, tag);
  if (tag && !tag.combo) {
    const c = combosFor(s, e, base, tag);
    if (c.after.length) after = c.after;
    base *= c.mul;
    // Realm mobs and Kings resist their Realm's element (event bosses do not)
    if (tag.el && tag.el === REALMS[s.realm].element && !NO_RESIST.has(e.type)) base *= s.cfg.realms.resist;
  }
  let d = base * P.dmgMul * R.range(1 - pl.dmgVariance, 1 + pl.dmgVariance);
  const cr = R.next() < P.crit;
  if (cr) d *= P.critMul;
  d = Math.max(1, Math.round(d));
  if (e.armor && !((e.armorOff || 0) > 0)) {
    const raw = d;
    d = Math.max(1, d - e.armor);
    if (d < raw * 0.5) col = '#9aa4b8';
    burst(s, e.x, e.y - e.r, '#d0d6e0', 2, 40, 0.2, 0.3);
  }
  s.events.push({ t: 'dmg', d });
  const guest = isGuest(s);
  if (guest) queueHit(s, e, d, false); else e.hp -= d;
  e.flash = 0.08;
  const dx = e.x - P.x, dy = e.y - P.y, l = hypot(dx, dy) || 1, k = (kb == null ? pl.kb : kb) * (e.boss ? pl.kbBoss : e.elite ? pl.kbElite : 1);
  e.kx += (dx / l) * k;
  e.ky += (dy / l) * k;
  text(s, e.x, e.y - e.r * 1.2, d, col, cr, { jitter: true });
  sfx(s, cr ? 'crit' : 'hit');
  if (tag?.applies && e.hp > 0) {
    const S = s.cfg.status, m = P.statusMul;
    if (tag.applies === 'burning') e.burn = S.burning * m;
    else if (tag.applies === 'shocked') e.shock = S.shocked * m;
    else { e.pois = S.poisoned * m; e.poisDps = d / s.cfg.skills.toxic.tick; }
  }
  if (!guest && e.hp <= 0) killE(s, e);
  if (after) for (const f of after) f();
}

/** Co-op host: a guest's hit, already calculated on the guest (Ultimate hits still capped on bosses). */
function remoteHit(s: SimState, e: Enemy, d: number, ult: boolean): void {
  const U = s.cfg.ult;
  if (ult && e.boss) d = Math.min(d, e.maxHp * (e.type === 'umbra' ? U.umbraCap : U.bossCap));
  d = Math.max(1, Math.round(d));
  s.events.push({ t: 'dmg', d });
  e.hp -= d;
  e.flash = 0.08;
  if (e.hp <= 0) killE(s, e);
}

const NO_RESIST = new Set(['dragon', 'frostDragon', 'stormDragon', 'whelp', 'rival']);

/** King reward: a small chance of that Realm's Weapon (only ones not owned yet). */
export function rollKingWeapon(s: SimState, realm: RealmId): void {
  const w = weaponOfRealm(realm);
  if (w && !ownsWeapon(s, w.id) && s.rng.loot.next() < s.cfg.weapons.drop) findWeapon(s, w.id);
}

const ownsWeapon = (s: SimState, id: WeaponId): boolean => (s.meta.weapons || []).includes(weaponKey(id)) || s.foundWeapons.includes(id);
function findWeapon(s: SimState, id: WeaponId): void {
  s.foundWeapons.push(id);
  s.events.push({ t: 'weaponFound', id });
  banner(s, 'weaponFound', 2.6, true, { id });
}

/** Ultimate damage: fixed, capped on Kings/Guardians (Umbra lower), leaves the Weapon's Status. */
function rawHit(s: SimState, e: Enemy, base: number, col: string, kb: number | undefined, tag: HitTag): void {
  const U = s.cfg.ult;
  let d = base;
  const guest = isGuest(s);
  if (e.boss && !guest) d = Math.min(d, e.maxHp * (e.type === 'umbra' ? U.umbraCap : U.bossCap)); // guests: the host caps it
  d = Math.max(1, Math.round(d));
  s.events.push({ t: 'dmg', d });
  if (guest) queueHit(s, e, d, true); else e.hp -= d;
  e.flash = 0.08;
  const P = s.P, dx = e.x - P.x, dy = e.y - P.y, l = hypot(dx, dy) || 1, k = (kb ?? 0) * (e.boss ? s.cfg.player.kbBoss : 1);
  e.kx += (dx / l) * k; e.ky += (dy / l) * k;
  text(s, e.x, e.y - e.r * 1.2, d, col, false, { jitter: true });
  if (tag.applies === 'burning' && e.hp > 0) e.burn = s.cfg.status.burning * P.statusMul;
  if (!guest && e.hp <= 0) killE(s, e);
}

export function killE(s: SimState, e: Enemy): void {
  const R = s.rng.loot, C = s.cfg, L = C.loot;
  s.events.push({ t: 'kill', ttk: s.clock - e.born, x: e.x, y: e.y, type: e.type, boss: e.boss, elite: e.elite });
  const split = SPLITS[e.type];
  if (split) {
    const sp = C.splitter, n = split[1] ?? sp.minis;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const m = spawnEnemy(s, split[0], e.x + cos(a) * sp.spread, e.y + sin(a) * sp.spread, false);
      m.kx = cos(a) * sp.push;
      m.ky = sin(a) * sp.push;
    }
  }
  e.dead = true;
  // Transmute (Vex line): monsters dying in the circle may become a big EXP crystal — never Gold
  const tm = s.P.skills.transmute;
  if (tm && !e.boss) {
    const c = C.skills.transmute;
    if (hypot(e.x - s.P.x, e.y - s.P.y) < linAt(c.r, tm) && R.next() < linAt(c.chance, tm)) {
      s.gems.push({ kind: 'xp', x: e.x, y: e.y, v: Math.round(linAt(c.xp, tm) * s.stage), mag: false });
      burst(s, e.x, e.y, '#ff5cf4', 10, 50, 0.4);
    }
  }
  s.kills++;
  s.killsByType[e.type] = (s.killsByType[e.type] || 0) + 1;
  s.stageKills++;
  s.streak++;
  s.streakT = C.streak.window;
  if (s.streak > s.maxStreak) s.maxStreak = s.streak;
  if (s.streak % C.streak.popupEvery === 0) s.events.push({ t: 'streak', n: s.streak });
  { // kills add charge only within the budget (at most killCap × the time rate)
    const add = Math.min(s.ultBudget, e.boss ? C.ult.perBoss : e.elite ? C.ult.perElite : C.ult.perKill);
    s.ultBudget -= add;
    s.ult = Math.min(C.ult.max, s.ult + add);
  }
  burst(s, e.x, e.y, DEATH_COL[e.type], e.boss ? 80 : e.elite ? 24 : 9, e.boss ? 110 : 60, e.boss ? 1 : 0.45);
  const v = e.xp;
  if (e === s.dragonE || e.type === 'rival') {
    const isD = e === s.dragonE;
    if (isD) { s.dragonE = null; grantGuardian(s, s.dragonKind); if (isHost(s)) { s.coop!.guardians++; s.coop!.lastGuardian = s.dragonKind; } }
    else { s.rivalE = null; say(s, e, 'defeat'); grantShadow(s); if (isHost(s)) s.coop!.rivals++; }
    shake(s, 10); flash(s, 0.3, undefined, true); s.hitstop = 0.12; sfx(s, 'boom');
    burst(s, e.x, e.y, isD ? '#ffd23f' : '#b07cff', 40, 120, 0.9);
    for (let i = 0; i < L.eventGems; i++) s.gems.push({ kind: 'xp', x: e.x + R.range(-20, 20), y: e.y + R.range(-20, 20), v: Math.ceil(v / L.eventGems), mag: false });
    s.gems.push({ kind: 'heart', x: e.x, y: e.y, v: L.heartBig, mag: false });
    return;
  }
  if (e.boss) {
    const kingRealm = e === s.boss ? s.realm : e === s.boss2 ? s.skipped : null;
    if (kingRealm) {
      s.kingsKilled.push(s.stage);
      // King reward: Skill Point(s) and the chest wheel (Gold drops below)
      s.sp += C.economy.kingSkillPoints;
      s.chestQueue += C.economy.kingChest;
      rollKingWeapon(s, kingRealm);
      if (isHost(s)) s.coop!.kingKills++;
    }
    if (e.type === 'umbra') {
      // beating Umbra always gives a missing Weapon (or Gold when the collection is complete)
      const w = Object.values(WEAPONS).find((x) => x.available && x.realm && !ownsWeapon(s, x.id));
      if (w) findWeapon(s, w.id); else s.runGold += C.weapons.umbraGold;
    }
    if (e.kg) say(s, e, 'defeat');
    if (e.type === 'umbra') { s.victory = true; s.victoryTime = s.totalTime; s.darkness = false; }
    shake(s, 10); flash(s, 0.35, '#ffffff'); s.hitstop = 0.12; sfx(s, 'boom');
    for (let i = 0; i < L.bossGems; i++) s.gems.push({ kind: 'xp', x: e.x + R.range(-20, 20), y: e.y + R.range(-20, 20), v: Math.ceil(v / L.bossGems), mag: false });
    s.gems.push({ kind: 'heart', x: e.x, y: e.y, v: L.heartBig, mag: false });
    // one chest per boss: the wheel above (kingChest); the chest item's Gold rides on the boss coin
    s.gems.push({ kind: 'coin', x: e.x - 10, y: e.y, v: (kingRealm ? C.stage.kingGold * s.stage : L.bossCoin) + L.chestGold, mag: false });
    banner(s, e.type === 'umbra' ? 'umbraDown' : 'bossDown', 1.6, e.type === 'umbra');
    if (e === s.boss) s.boss = null;
    if (e === s.boss2) s.boss2 = null;
    return;
  }
  if (R.next() < (e.elite ? 1 : L.coinChance)) s.gems.push({ kind: 'coin', x: e.x + R.range(-3, 3), y: e.y + R.range(-3, 3), v: (e.elite ? L.eliteCoin : L.coin) * (s.specialStage ? C.events.bloodMoonCoin : 1), mag: false });
  if (s.gems.length > L.gemCap) {
    const g = s.gems[R.int(s.gems.length)];
    if (g.kind === 'xp') { g.v += v; return; }
  }
  s.gems.push({ kind: 'xp', x: e.x, y: e.y, v, mag: false });
  // one roll decides heart or shield, so adding the shield did not shift any other random draw
  const r = R.next();
  if (r < L.heartChance) s.gems.push({ kind: 'heart', x: e.x + 4, y: e.y, v: L.heartSmall, mag: false });
  else if (r < L.heartChance + (e.elite ? L.shieldElite : L.shieldChance)) s.gems.push({ kind: 'shield', x: e.x - 4, y: e.y, v: L.shieldAbsorb, mag: false });
}

/** ALL damage to the player goes through here. */
export function hurtP(s: SimState, d: number): void {
  const P = s.P;
  if (P.down || P.inv > 0 || s.phase !== 'play' || (s.coop && s.coop.shieldT > 0)) return; // co-op: shield after a level-up
  s.dir.lastHurt = s.clock;
  if (s.debug.god) return;
  const hv = s.cfg.scaling.hitVariance;
  if (P.evo.shield && P.skills.shield) d *= 1 - s.cfg.skills.shield.evo.absorb; // Aegis
  d = Math.max(1, Math.round(d * s.rng.combat.range(1 - hv, 1 + hv)));
  P.inv = s.cfg.player.inv;
  if (P.guardT > 0 && P.guard > 0) { // Shield pickup soaks the hit first
    const a = Math.min(P.guard, d);
    P.guard -= a; d -= a;
    if (P.guard <= 0) P.guardT = 0;
    text(s, P.x, P.y - 12, '-' + a, '#7fd4ff', false, { hurt: true });
    if (d <= 0) { sfx(s, 'hit'); return; }
  }
  P.hp -= d;
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
  if (s.coop) { // co-op: wait for an ally, the next Stage or buy a revive; the Run ends when everyone is down
    P.down = true;
    s.bolts = [];
    sfx(s, 'hurt');
    return true;
  }
  if (offerRevive(s)) return true;
  gameOver(s);
  return true;
}
