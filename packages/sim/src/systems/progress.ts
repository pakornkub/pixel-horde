import { EVO_PASSIVE, PASSIVE_IDS, SKILL_IDS, type PassiveId, type SkillId } from '../data/skills';
import type { LevelOption, SimState } from '../types';
import { rollStage } from './events';
import { banner, burst, flash, sfx, shake } from './fx';
import { recompute, U, xpNeed } from './player';
import { DEATH_COL } from '../data/enemies';

export function startStage(s: SimState, n: number): void {
  const P = s.P, G = s.cfg.stage;
  if (s.specialStage) s.chestQueue++;
  rollStage(s, n);
  if (P.down) { P.down = false; P.hp = Math.round(P.maxHp * G.reviveHp); P.inv = 2; }
  s.stage = n;
  s.stageDur = Math.min(G.durMax, G.durBase + G.durPerStage * (n - 1));
  s.stageTime = 0; s.spawnAcc = 0; s.waveT = s.cfg.spawn.swarmFirst; s.bossSpawned = false; s.boss = null; s.stageKills = 0;
  s.enemies = []; s.bolts = []; s.effects = [];
  for (const g of s.gems) if (g.kind === 'xp') P.xp += g.v;
  s.gems = [];
  levelCheck(s);
  s.streak = 0; s.streakT = 0;
  s.events.push({ t: 'stageStart', stage: n, special: s.specialStage });
  if (s.specialStage) banner(s, 'bloodMoon', 3, true);
  else banner(s, 'stage', 2.4, false, { n, dur: s.stageDur });
  s.phase = 'play';
}

export function stageClear(s: SimState): void {
  s.phase = 'clearing';
  s.clearT = s.cfg.stage.clearDelay;
  sfx(s, 'clear');
  if (s.rivalE && !s.rivalE.dead) banner(s, 'stageClearRivalFled', 2, true);
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
  flash(s, 0.3, '#ffffff');
  shake(s, 6);
  s.events.push({ t: 'stageClear', stage: s.stage });
}

export function gameOver(s: SimState): void {
  s.phase = 'over';
  sfx(s, 'hurt');
  s.events.push({ t: 'gameOver' });
}

export function levelCheck(s: SimState): void {
  const P = s.P;
  while (P.xp >= P.need) { P.xp -= P.need; P.lv++; P.need = xpNeed(s.cfg, P.lv); s.pendingLv++; }
}

export function buildOptions(s: SimState): LevelOption[] {
  const P = s.P, R = s.rng.levelup, L = s.cfg.levelup, K = s.cfg.skills, out: LevelOption[] = [];
  for (const id of Object.keys(P.skills) as SkillId[]) {
    if (P.skills[id]! >= K[id].max && !P.evo[id] && (P.pas[EVO_PASSIVE[id]] || 0) >= 1 && out.length < L.offers) out.push({ kind: 'evo', id });
  }
  const c: { o: LevelOption; w: number }[] = [];
  const owned = Object.keys(P.skills).length;
  for (const id of SKILL_IDS) {
    const lv = P.skills[id] || 0;
    if (lv >= K[id].max) continue;
    if (!lv && owned >= s.cfg.maxAttackSlots) continue;
    c.push({ o: { kind: 'skill', id }, w: lv ? L.wUpgrade : L.wNew });
  }
  for (const id of PASSIVE_IDS) {
    const lv = P.pas[id] || 0;
    if (lv >= s.cfg.passives.max[id]) continue;
    c.push({ o: { kind: 'pas', id }, w: L.wPassive });
  }
  while (out.length < L.offers && c.length) {
    const tot = c.reduce((a, o) => a + o.w, 0);
    let r = R.next() * tot, i = 0;
    for (; i < c.length - 1; i++) { r -= c[i].w; if (r <= 0) break; }
    out.push(c.splice(i, 1)[0].o);
  }
  if (!out.length) out.push({ kind: 'heal' });
  return out;
}

export function openLevelUp(s: SimState): void {
  s.phase = 'levelup';
  sfx(s, 'lv');
  s.levelUp = { options: buildOptions(s), chest: s.pendingChest > 0, lv: s.P.lv - s.pendingLv + 1 };
}

export function choose(s: SimState, index: number): void {
  if (s.phase !== 'levelup' || !s.levelUp) return;
  const o = s.levelUp.options[index];
  if (!o) return;
  const P = s.P;
  if (o.kind === 'evo') { P.evo[o.id] = true; banner(s, 'evolved', 1.8, true, { id: o.id }); flash(s, 0.3, '#ffd23f'); }
  else if (o.kind === 'skill') P.skills[o.id] = (P.skills[o.id] || 0) + 1;
  else if (o.kind === 'pas') {
    P.pas[o.id as PassiveId] = (P.pas[o.id] || 0) + 1;
    recompute(s);
    if (o.id === 'vital') P.hp = Math.min(P.maxHp, P.hp + s.cfg.passives.vitalHeal);
  } else P.hp = P.maxHp;
  if (s.pendingChest > 0) s.pendingChest--;
  else s.pendingLv--;
  s.levelUp = null;
  if (s.pendingLv > 0 || s.pendingChest > 0) openLevelUp(s);
  else s.phase = 'play';
}

export function openChest(s: SimState): void {
  const R = s.rng.loot;
  s.phase = 'chest';
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
  s.phase = 'play';
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
