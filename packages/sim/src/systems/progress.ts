import { EVO_PASSIVE, PASSIVE_IDS, SKILL_IDS, isLine, type PassiveId, type SkillId } from '../data/skills';
import { AWAKENING, SKILL_LINES, signatureOf } from '../data/heroes';
import { ipow } from '../core/fmath';
import type { LevelOption, SimState } from '../types';
import { rollStage } from './events';
import { canFuse, levelCompanion } from './guardians';
import { say } from './kings';
import { banner, burst, flash, sfx, shake } from './fx';
import { recompute, U, xpNeed } from './player';
import { DEATH_COL } from '../data/enemies';
import { REALMS, ROUTE_REALMS, type RealmId } from '../content/lumora/realms';

export function startStage(s: SimState, n: number): void {
  // A new Balance Config / event switches take effect only here, never mid-Stage.
  if (n > 1 && s.pending.cfg) {
    s.cfg = s.pending.cfg;
    if (s.configVersions[s.configVersions.length - 1] !== s.cfg.version) s.configVersions.push(s.cfg.version);
    recompute(s);
  }
  if (n > 1 && s.pending.events) s.eventSwitches = s.pending.events;
  s.pending = {};
  const P = s.P, G = s.cfg.stage;
  s.pickReturn = null;
  rollStage(s, n);
  if (P.down) { P.down = false; P.hp = Math.round(P.maxHp * G.reviveHp); P.inv = 2; }
  s.stage = n;
  s.swaps = 0;
  if (s.coop) s.coop.revivedStage = [];
  s.awakenOffer = false;
  s.darkness = false;
  P.linkStart = maxLinks(s);
  s.stageDur = Math.min(G.durMax, G.durBase + G.durPerStage * (n - 1));
  s.stageTime = 0; s.spawnAcc = 0; s.waveT = s.cfg.spawn.swarmFirst; s.front.t = 0; s.bossSpawned = false; s.boss = null; s.stageKills = 0;
  const D = s.cfg.director;
  if (D.stageReset > 0) s.dir.v += (D.start - s.dir.v) * D.stageReset; // pressure built up last Stage eases off
  s.enemies = []; s.bolts = []; s.effects = [];
  for (const g of s.gems) if (g.kind === 'xp') { P.xp += g.v; if (s.coop?.role === 'host') s.coop.teamXp += g.v; } // co-op: shared
  s.gems = [];
  levelCheck(s);
  s.streak = 0; s.streakT = 0;
  s.overtime = false;
  s.bloodMoonShown = false;
  s.lastEnd = null;
  s.events.push({ t: 'stageStart', stage: n, special: s.specialStage });
  // Blood Moon is never announced in advance: it reveals itself a little into the Stage.
  banner(s, 'stage', 2.4, false, { n, dur: s.stageDur });
  s.phase = 'play';
}

/** Links (the Hero's Skill Line general skills) that are equipped and at max level. */
function maxLinks(s: SimState): SkillId[] {
  const P = s.P, K = s.cfg.skills;
  return SKILL_LINES[P.ch].filter((id) => (P.skills[id] || 0) >= K[id].max);
}

/** Links that have been max level and equipped for the required number of full Stages. */
export function qualifiedLinks(s: SimState): SkillId[] {
  const P = s.P, now = maxLinks(s);
  return SKILL_LINES[P.ch].filter((id) => now.includes(id) && (P.linkStages[id] || 0) >= s.cfg.awaken.stages);
}

export function awakenEligible(s: SimState): boolean {
  const P = s.P;
  return !P.awakened && !P.awakenDeclined && !!P.evo[signatureOf(P.ch)] && qualifiedLinks(s).length >= s.cfg.awaken.links;
}

/** Stage end: count full Stages each Link spent maxed and equipped, then maybe offer Awakening. */
function updateLinks(s: SimState): void {
  const P = s.P, now = maxLinks(s);
  for (const id of SKILL_LINES[P.ch]) {
    if (now.includes(id) && P.linkStart.includes(id)) P.linkStages[id] = (P.linkStages[id] || 0) + 1;
    else if (!now.includes(id)) P.linkStages[id] = 0;
  }
  s.awakenOffer = awakenEligible(s);
}

/** Clear screen answer: accept consumes two Links and transforms the Signature; decline forfeits for this Run. */
export function answerAwaken(s: SimState, accept: boolean): void {
  const P = s.P;
  if (s.phase !== 'clear' || !s.awakenOffer) return;
  s.awakenOffer = false;
  if (!accept) { P.awakenDeclined = true; return; }
  for (const id of qualifiedLinks(s).slice(0, s.cfg.awaken.links)) { delete P.skills[id]; delete P.evo[id]; delete P.cds[id]; P.linkStages[id] = 0; }
  // the first Skill Line skills arrive at once in the freed slots, so the transformation is felt
  const A = s.cfg.awaken;
  for (const id of AWAKENING[P.ch].line.slice(0, A.grant)) {
    if (!P.skills[id] && Object.keys(P.skills).length >= s.cfg.maxAttackSlots) break;
    P.skills[id] = Math.min(s.cfg.skills[id].max, Math.max(P.skills[id] || 0, A.grantLv));
  }
  P.awakened = true;
  banner(s, 'awakened', 2.6, true);
  flash(s, 0.4, '#ffd23f');
  sfx(s, 'ult');
}

export function stageClear(s: SimState, escaped = false): void {
  s.phase = 'clearing';
  if (s.specialStage) s.chestQueue++; // the Blood Moon bonus chest, opened with the Stage-end rewards
  updateLinks(s);
  s.fuseOffer = canFuse(s);
  s.clearT = s.cfg.stage.clearDelay;
  s.lastEnd = escaped ? 'escape' : 'clear';
  if (!escaped) s.chaptersCleared.push(s.stage);
  if (!escaped && s.doubleKing) s.doubleKingsBeaten++;
  sfx(s, 'clear');
  if (escaped) banner(s, 'kingEscaped', 2.4, true);
  else if (s.rivalE && !s.rivalE.dead) banner(s, 'stageClearRivalFled', 2, true);
  else if (s.dragonE && !s.dragonE.dead) banner(s, 'stageClearDragonFled', 2, true);
  else banner(s, 'stageClear', 1.5, true);
  s.dragonE = s.rivalE = null;
  s.hz = [];
  for (const e of s.enemies) {
    if (e.dead) continue;
    burst(s, e.x, e.y, DEATH_COL[e.type], 6, 70, 0.5);
    e.dead = true;
    s.kills++;
    s.stageKills++;
    s.gems.push({ kind: 'xp', x: e.x, y: e.y, v: e.xp, mag: true });
  }
  for (const g of s.gems) g.mag = true; // end-of-Stage vacuum: everything left flies to the player
  flash(s, 0.3, '#ffffff');
  shake(s, 6);
  s.events.push({ t: 'stageClear', stage: s.stage, escaped });
}

/** The King survived overtime: he flees with his crystal shard. Umbra grows stronger. */
export function kingEscapes(s: SimState): void {
  for (const [k, r] of [[s.boss, s.realm], [s.boss2, s.skipped]] as const) {
    if (!k || k.dead || !r) continue;
    say(s, k, 'escape');
    s.events.push({ t: 'say', who: 'umbra', beat: 'absorb', x: k.x, y: k.y });
    burst(s, k.x, k.y, '#3a1f66', 40, 120, 0.8);
    k.dead = true;
    s.escapes++;
    s.escapedKings.push(r);
  }
  s.boss = s.boss2 = null;
  stageClear(s, true);
}

/** Two Realms for a route choice: unvisited first, then any other available one. */
function routeChoices(s: SimState, exclude: RealmId[]): RealmId[] {
  const R = s.rng.route;
  const avail = ROUTE_REALMS.filter((r) => REALMS[r].available && !exclude.includes(r));
  const fresh = avail.filter((r) => !s.visited.includes(r));
  const pick = (from: RealmId[], k: number): RealmId[] => {
    const pool = from.slice(), out: RealmId[] = [];
    while (out.length < k && pool.length) out.push(pool.splice(R.int(pool.length), 1)[0]);
    return out;
  };
  const out = pick(fresh, 2);
  if (out.length < 2) out.push(...pick(avail.filter((r) => !out.includes(r)), 2 - out.length));
  return out;
}

/** From the clear screen: next Chapter (route choice for 2..chapters−1), a re-pick after an Escape, or the finale. */
export function afterStage(s: SimState): void {
  const G = s.cfg.stage;
  let chapter = s.stage + 1;
  if (s.lastEnd === 'escape' && s.repicks < G.escapeRepicks && s.realm !== 'crater') {
    s.repicks++;
    chapter = s.stage;
  } else s.repicks = 0;
  s.skipped = null;
  if (s.endless) {
    // Endless: random available Realms, rising difficulty, no route choice
    const pool = ROUTE_REALMS.filter((r) => REALMS[r].available);
    s.realm = pool[s.rng.route.int(pool.length)];
    s.visited.push(s.realm);
    startStage(s, chapter);
  } else if (chapter >= G.chapters) {
    s.realm = 'crater';
    s.visited.push('crater');
    startStage(s, chapter);
  } else if (chapter === 1) {
    startStage(s, 1); // Greenvale again
  } else {
    const exclude: RealmId[] = s.lastEnd === 'escape' && chapter === s.stage ? [s.realm] : [];
    s.route = { chapter, choices: routeChoices(s, exclude) };
    s.phase = 'route';
  }
}

export function chooseRoute(s: SimState, index: number): void {
  if (s.phase !== 'route' || !s.route) return;
  const r = s.route.choices[index];
  if (!r) return;
  s.realm = r;
  s.visited.push(r);
  s.skipped = s.route.choices.find((x) => x !== r) ?? null;
  const ch = s.route.chapter;
  s.route = null;
  startStage(s, ch);
}

export function gameOver(s: SimState): void {
  s.phase = 'over';
  if (!s.victory) sfx(s, 'hurt');
  s.events.push({ t: 'gameOver' });
}

export function levelCheck(s: SimState): void {
  const P = s.P;
  while (P.xp >= P.need) { P.xp -= P.need; P.lv++; P.need = xpNeed(s.cfg, P.lv); s.pendingLv++; }
}

/** Bench slots: start, +1 once each growth Chapter is behind the player. */
export function benchSize(s: SimState): number {
  const B = s.cfg.bench;
  return B.start + (s.stage > B.growAt1 ? 1 : 0) + (s.stage > B.growAt2 ? 1 : 0);
}

/** Offer rules (ticket 21): 4 attack slots, then new Skills go to the Bench while it has room;
 *  benched Skills are never offered; new passives only while a passive slot is free. */
export function buildOptions(s: SimState): LevelOption[] {
  const P = s.P, R = s.rng.levelup, L = s.cfg.levelup, K = s.cfg.skills, out: LevelOption[] = [];
  for (const id of Object.keys(P.skills) as SkillId[]) {
    const pas = EVO_PASSIVE[id];
    if (pas && P.skills[id]! >= K[id].max && !P.evo[id] && (P.pas[pas] || 0) >= 1 && out.length < L.offers) out.push({ kind: 'evo', id });
  }
  const c: { o: LevelOption; w: number }[] = [];
  const owned = Object.keys(P.skills).length, sig = signatureOf(P.ch);
  const slotFree = owned < s.cfg.maxAttackSlots, benchFree = P.bench.length < benchSize(s);
  for (const id of [...SKILL_IDS, sig, ...(P.awakened ? AWAKENING[P.ch].line : [])]) {
    const lv = P.skills[id] || 0;
    if (lv >= K[id].max || s.banished.includes(id)) continue;
    if (!lv) {
      if (P.bench.some((b) => b.id === id)) continue;
      if (!slotFree && !benchFree) continue;
      c.push({ o: slotFree ? { kind: 'skill', id } : { kind: 'skill', id, toBench: true }, w: L.wNew * (isLine(id) ? s.cfg.awaken.wLine : 1) });
    } else c.push({ o: { kind: 'skill', id }, w: L.wUpgrade * (id === sig ? L.wSignature : 1) * (isLine(id) ? s.cfg.awaken.wLine : 1) });
  }
  const pasFree = Object.keys(P.pas).length < s.cfg.passiveSlots, pasBench = !!s.cfg.bench.passives && benchFree;
  for (const id of PASSIVE_IDS) {
    const lv = P.pas[id] || 0;
    if (lv >= s.cfg.passives.max[id] || s.banished.includes(id)) continue;
    if (!lv) {
      if (P.bench.some((b) => b.id === id)) continue;
      if (!pasFree && !pasBench) continue;
      c.push({ o: pasFree ? { kind: 'pas', id } : { kind: 'pas', id, toBench: true }, w: L.wPassive });
    } else c.push({ o: { kind: 'pas', id }, w: L.wPassive });
  }
  if (P.pet && P.pet.lv < s.cfg.companion.maxLv) c.push({ o: { kind: 'comp' }, w: s.cfg.companion.wLevel });
  while (out.length < L.offers && c.length) {
    const tot = c.reduce((a, o) => a + o.w, 0);
    let r = R.next() * tot, i = 0;
    for (; i < c.length - 1; i++) { r -= c[i].w; if (r <= 0) break; }
    out.push(c.splice(i, 1)[0].o);
  }
  if (!out.length) out.push({ kind: 'heal' });
  return out;
}

/** Stage-end cost of the next swap: base × Chapter × growth^swaps. */
export function swapCost(s: SimState): number {
  const B = s.cfg.bench;
  return Math.round(B.swapBase * s.stage * ipow(B.swapGrowth, s.swaps));
}

/** Pay from this Run's Gold first, then the wallet. Returns false (nothing paid) if short. */
export function spendGold(s: SimState, cost: number): boolean {
  const wallet = Math.max(0, (s.meta.wallet || 0) - s.walletSpent);
  if (s.runGold + wallet < cost) return false;
  const fromRun = Math.min(s.runGold, cost);
  s.runGold -= fromRun;
  s.walletSpent += cost - fromRun;
  return true;
}

/** Clear screen: move Bench entry `bi` into a slot of its kind, swapping out `slot` (never the Signature).
 *  An evolved Skill stays evolved when its paired passive is benched (Evolution is only checked when offered). */
export function swapBench(s: SimState, bi: number, slot: SkillId | PassiveId | null): void {
  const P = s.P, b = P.bench[bi];
  if (s.phase !== 'clear' || !b) return;
  if (b.pas) {
    const out = slot as PassiveId | null;
    if (out ? !P.pas[out] : Object.keys(P.pas).length >= s.cfg.passiveSlots) return;
    if (!spendGold(s, swapCost(s))) { s.events.push({ t: 'swapDenied' }); return; }
    s.swaps++;
    P.bench.splice(bi, 1);
    if (out) { P.bench.splice(bi, 0, { id: out, lv: P.pas[out]!, evo: false, pas: true }); delete P.pas[out]; }
    P.pas[b.id] = b.lv;
    recompute(s);
    P.hp = Math.min(P.hp, P.maxHp); // Vitality out: max HP drops
    sfx(s, 'coin');
    return;
  }
  const out = slot as SkillId | null;
  if (out === signatureOf(P.ch)) return;
  if (out ? !P.skills[out] : Object.keys(P.skills).length >= s.cfg.maxAttackSlots) return;
  if (!spendGold(s, swapCost(s))) { s.events.push({ t: 'swapDenied' }); return; }
  s.swaps++;
  P.bench.splice(bi, 1);
  if (out) {
    P.bench.splice(bi, 0, { id: out, lv: P.skills[out]!, evo: !!P.evo[out] });
    delete P.skills[out]; delete P.evo[out]; delete P.cds[out];
  }
  P.skills[b.id] = b.lv;
  if (b.evo) P.evo[b.id] = true;
  sfx(s, 'coin');
}

/** Stage-end screen: throw a Bench skill away, free (its levels are lost; it may be offered again). */
export function discardBench(s: SimState, bi: number): void {
  if (s.phase !== 'clear' || !s.P.bench[bi] || !s.cfg.bench.discard) return;
  s.P.bench.splice(bi, 1);
  sfx(s, 'hit');
}

export function openLevelUp(s: SimState): void {
  s.phase = 'levelup';
  if (s.coop) s.coop.chooseT = s.cfg.coop.pickTime; // co-op: the room keeps playing; pick in time
  sfx(s, 'lv');
  s.levelUp = { options: buildOptions(s), chest: s.pendingChest > 0, lv: s.P.lv - s.pendingLv + 1 };
}

export function choose(s: SimState, index: number): void {
  if (s.phase !== 'levelup' || !s.levelUp) return;
  const o = s.levelUp.options[index];
  if (!o) return;
  const P = s.P;
  if (o.kind === 'evo') { P.evo[o.id] = true; banner(s, 'evolved', 1.8, true, { id: o.id }); flash(s, 0.3, '#ffd23f'); }
  else if (o.kind === 'skill') {
    if (o.toBench) P.bench.push({ id: o.id, lv: 1, evo: false });
    else P.skills[o.id] = (P.skills[o.id] || 0) + 1;
  }
  else if (o.kind === 'pas' && o.toBench) P.bench.push({ id: o.id, lv: 1, evo: false, pas: true });
  else if (o.kind === 'pas') {
    P.pas[o.id as PassiveId] = (P.pas[o.id] || 0) + 1;
    recompute(s);
    if (o.id === 'vital') P.hp = Math.min(P.maxHp, P.hp + s.cfg.passives.vitalHeal);
  } else if (o.kind === 'comp') {
    levelCompanion(s);
    if (P.pet) banner(s, 'dragonPowerUp', 1.6, false, { lv: P.pet.lv, kind: P.pet.kind });
  } else P.hp = P.maxHp;
  if (s.pendingChest > 0) s.pendingChest--;
  else s.pendingLv--;
  s.levelUp = null;
  if (s.pendingLv > 0 || s.pendingChest > 0) openLevelUp(s);
  else afterRewards(s);
}

/** A level-up / chest is done: back to play, or at the Stage end to the next waiting reward. */
function afterRewards(s: SimState): void {
  const back = s.pickReturn;
  if (!back) { s.phase = 'play'; return; }
  if (!stageEndRewards(s, back)) s.phase = back;
}

/**
 * Stage end: open the next reward still waiting (chest wheel first, then level-ups and chest picks)
 * so none spills into the next Stage. Returns false when nothing is left.
 */
export function stageEndRewards(s: SimState, back: 'clearing' | 'clear'): boolean {
  if (s.chestQueue > 0) { s.chestQueue--; s.pickReturn = back; openChest(s); return true; }
  if (s.pendingLv > 0 || s.pendingChest > 0) { s.pickReturn = back; openLevelUp(s); return true; }
  s.pickReturn = null;
  return false;
}

export function openChest(s: SimState): void {
  const R = s.rng.loot;
  s.phase = 'chest';
  if (s.coop) s.coop.chooseT = s.cfg.coop.pickTime;
  const W = s.cfg.chest, r = R.next(), res = r < W.p1 ? 1 : r < W.p1 + W.p2 ? 2 : 3;
  const cells: number[] = [];
  [1, 2, 1, 3, 1, 2, 1, 2].forEach((v, i) => { if (v === res) cells.push(i); });
  const target = cells[R.int(cells.length)];
  const start = R.int(8);
  s.chest = { res, target, start };
  sfx(s, 'lv');
}

export function chestStop(s: SimState): void {
  if (s.phase !== 'chest' || !s.chest) return;
  s.pendingChest += s.chest.res;
  s.chest = null;
  afterRewards(s);
}

export function stepGems(s: SimState, dt: number): void {
  const P = s.P, L = s.cfg.loot, sh = s.cfg.shop;
  for (const g of s.gems) {
    const dx = P.x - g.x, dy = P.y - g.y, l = Math.sqrt(dx * dx + dy * dy) || 1;
    if (l < P.pick) g.mag = true;
    if (g.mag) {
      const sp = Math.min(L.magnetMax, (g.sp = (g.sp || 60) + L.magnetAccel * dt));
      g.x += (dx / l) * sp * dt;
      g.y += (dy / l) * sp * dt;
    }
    if (l < 7) {
      g.got = true;
      if (g.kind === 'xp') { P.xp += g.v * (1 + sh.wisdom.per * U(s, 'wisdom')); sfx(s, 'gem'); }
      else if (g.kind === 'coin') {
        const c = Math.max(1, Math.round(g.v * (1 + sh.greed.per * U(s, 'greed'))));
        s.runGold += c;
        sfx(s, 'coin');
        if (g.v >= 5) s.events.push({ t: 'text', x: g.x, y: g.y - 8, v: '+' + c + 'G', col: '#ffd23f', cr: false });
      } else if (g.kind === 'chest') { s.chestQueue++; s.runGold += L.chestGold; }
      else if (g.kind === 'shield') {
        P.guard = Math.max(P.guard, Math.round(P.maxHp * g.v));
        P.guardT = L.shieldDur;
        sfx(s, 'lv');
        s.events.push({ t: 'text', x: P.x, y: P.y - 12, v: '+' + P.guard, col: '#7fd4ff', cr: false });
      }
      else {
        const h = Math.round(P.maxHp * g.v);
        P.hp = Math.min(P.maxHp, P.hp + h);
        s.events.push({ t: 'text', x: P.x, y: P.y - 12, v: '+' + h, col: '#6fe36a', cr: false });
      }
    }
  }
  s.gems = s.gems.filter((g) => !g.got);
  levelCheck(s);
}

/* ---------- Skill Points and the bought revive (ticket 26) ---------- */
function spend(s: SimState, n: number, what: 'reroll' | 'banish' | 'upgrade'): boolean {
  if (s.sp < n) return false;
  s.sp -= n;
  s.events.push({ t: 'spent', what });
  return true;
}

/** Level-up: fresh offers for Skill Points. */
export function reroll(s: SimState): void {
  if (s.phase !== 'levelup' || !s.levelUp || !spend(s, s.cfg.economy.reroll, 'reroll')) return;
  s.levelUp = { ...s.levelUp, options: buildOptions(s) };
}

/** Level-up: this offer's Skill/passive never comes back this Run; the offers are redrawn. */
export function banish(s: SimState, index: number): void {
  const o = s.levelUp?.options[index];
  if (s.phase !== 'levelup' || !o || (o.kind !== 'skill' && o.kind !== 'pas')) return;
  if (o.kind === 'skill' && s.P.skills[o.id]) return; // owned Skills cannot be banished
  if (o.kind === 'pas' && s.P.pas[o.id]) return;
  if (!spend(s, s.cfg.economy.banish, 'banish')) return;
  s.banished.push(o.id);
  s.levelUp = { ...s.levelUp!, options: buildOptions(s) };
}

/** +1 level to an equipped attack Skill (level-up or clear screen). */
export function spUpgrade(s: SimState, id: SkillId): void {
  const P = s.P, lv = P.skills[id];
  if ((s.phase !== 'levelup' && s.phase !== 'clear') || !lv || lv >= s.cfg.skills[id].max) return;
  if (!spend(s, s.cfg.economy.upgrade, 'upgrade')) return;
  P.skills[id] = lv + 1;
}

/** Clear screen: Gold (this Run's first, then the wallet) → 1 Skill Point. */
export function buySp(s: SimState): void {
  if (s.phase !== 'clear' || !s.cfg.economy.spShop) return; // the Skill Point shop is switched off by default
  if (!spendGold(s, Math.round(s.cfg.economy.spCost * s.stage))) { s.events.push({ t: 'swapDenied' }); return; }
  s.sp++;
  s.events.push({ t: 'spent', what: 'buySp' });
}

export const reviveCost = (s: SimState): number => Math.round(s.cfg.economy.revive * s.stage);

/** Down without Second Wind: offer the bought revive when it is allowed and affordable. */
export function offerRevive(s: SimState): boolean {
  if (s.mode === 'daily' || s.revivesBought > 0) return false;
  const wallet = Math.max(0, (s.meta.wallet || 0) - s.walletSpent);
  if (s.runGold + wallet < reviveCost(s)) return false;
  s.phase = 'revive';
  return true;
}

export function buyRevive(s: SimState): void {
  const P = s.P, E = s.cfg.economy;
  if (s.coop) { // co-op: a downed player buys their revive without stopping the room
    if (!P.down || s.phase !== 'play' || s.mode === 'daily' || s.revivesBought > 0 || !spendGold(s, reviveCost(s))) return;
    P.down = false;
  } else if (s.phase !== 'revive' || !spendGold(s, reviveCost(s))) return;
  s.revivesBought++;
  if (s.endless) s.reviveEndless = true; // in Endless the penalty hits only the Endless Score
  P.hp = Math.round(P.maxHp * E.reviveHp);
  P.inv = E.reviveInv;
  s.phase = 'play';
  banner(s, 'secondWind', 1.6, true);
  flash(s, 0.4, '#fff35c');
  sfx(s, 'ult');
  s.events.push({ t: 'spent', what: 'revive' });
}

/** After Umbra: continue the same Run in Endless, or finish it. */
export function chooseEndless(s: SimState, go: boolean): void {
  if (s.phase !== 'victory') return;
  if (!go) { gameOver(s); return; }
  s.endless = true;
  s.endlessFrom = { kills: s.kills, combos: s.combos, escapes: s.escapes };
  s.lastEnd = 'clear';
  afterStage(s);
}
