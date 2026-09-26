// One headless playtest Run with the bot, plus what a balance pass needs to know about it.
// Damage attribution comes from hooks the build step (build.mjs) wraps around hit() and hurtP().
import {
  COMBO_HIT, FLASK_TAGS, HOLE_BOOM, PET_DIVE, PET_FIRE, SKILL_TAGS, createSim, resolveConfig,
  type Enemy, type Hazard, type HeroId, type HitTag, type SimState, type ShopId,
} from '@pixel-horde/sim';
import { BALANCE_PASS_2026_09, DEFAULT_CONFIG, applyPreset, withOverrides, type BalanceConfigInput, type PresetId } from '@pixel-horde/config';
import { createBot, DEFAULT_PROFILE, type BotProfile } from './bot';

export interface Job {
  hero: HeroId;
  seed: number;
  label: string;
  /** Balance Config patch (a preset) on top of the defaults. */
  patch?: BalanceConfigInput;
  /** Difficulty preset applied on top (Settings → Difficulty). */
  preset?: PresetId;
  /** Start from the recommended balance pass (packages/config/src/balance-pass.ts). */
  pass?: boolean;
  shop?: Partial<Record<ShopId, number>>;
  profile?: Partial<BotProfile>;
  /** Stop after this many minutes of game time. */
  maxMin?: number;
  /** Stop once this Chapter is behind the player (quick early-game checks). */
  maxCh?: number;
}

export interface RunMetrics {
  label: string; hero: HeroId; seed: number;
  result: 'dead' | 'victory' | 'timeout';
  chapter: number; cleared: number; kings: number; escapes: number; level: number; minutes: number; kills: number; gold: number;
  revives: number; secondWinds: number;
  awakenAt: number | null; awakenOfferAt: number | null; sigEvoAt: number | null; firstLinkMaxAt: number | null; evos: number;
  dmg: Record<string, number>; dmgAfterAwaken: Record<string, number>;
  hurt: Record<string, number>; deathBy: string | null; deathChapter: number | null;
  /** Per Chapter played: seconds from the King's arrival to its death (null = escaped). */
  kingTtk: { ch: number; realm: string; t: number | null }[];
  /** Lowest HP fraction per Chapter. */
  hpMin: number[];
  combos: number;
  /** Damage dealt per second by Chapter (skills only). */
  dpsByChapter: number[];
  /** Skills equipped at the end. */
  build: string[];
  /** HP fraction the current King still had when the Run ended (null = none alive). */
  kingLeft: number | null;
}

interface Hooks { combo?: string | null; onHit(s: SimState, e: Enemy, tag: HitTag | undefined, d: number): void; onHurt(s: SimState, d: number): void; cur: { hz?: Hazard; en?: Enemy } | null }
declare global { var __PT: Hooks | undefined }

const TAG_NAME = new Map<object, string>();
for (const [k, v] of Object.entries(SKILL_TAGS)) TAG_NAME.set(v, k);
for (const v of Object.values(FLASK_TAGS)) TAG_NAME.set(v, 'flask');
TAG_NAME.set(HOLE_BOOM, 'hole');
TAG_NAME.set(PET_FIRE, 'companion');
TAG_NAME.set(PET_DIVE, 'companion');
TAG_NAME.set(COMBO_HIT, 'combo');

function tagName(tag: HitTag | undefined): string {
  if (!tag) return 'other';
  return TAG_NAME.get(tag) ?? (tag.raw ? 'ultimate' : 'companion');
}

export function runOne(job: Job): RunMetrics {
  const base = job.pass ? withOverrides(DEFAULT_CONFIG, BALANCE_PASS_2026_09.patch) : DEFAULT_CONFIG;
  const cfg = applyPreset(resolveConfig(withOverrides(base, job.patch ?? {})), job.preset ?? 'balanced');
  const profile = { ...DEFAULT_PROFILE, ...job.profile };
  const sim = createSim({ seed: job.seed, hero: job.hero, meta: { up: { ...job.shop } }, viewport: { w: 338, h: 190 }, config: cfg });
  const bot = createBot(job.seed, profile);
  const m: RunMetrics = {
    label: job.label, hero: job.hero, seed: job.seed, result: 'timeout', chapter: 1, cleared: 0, kings: 0, escapes: 0, level: 1, minutes: 0, kills: 0, gold: 0,
    revives: 0, secondWinds: 0, awakenAt: null, awakenOfferAt: null, sigEvoAt: null, firstLinkMaxAt: null, evos: 0,
    dmg: {}, dmgAfterAwaken: {}, hurt: {}, deathBy: null, deathChapter: null, kingTtk: [], hpMin: [], combos: 0, dpsByChapter: [], build: [], kingLeft: null,
  };
  let lastHurt = '';
  const chDmg: number[] = [], chTime: number[] = [];
  globalThis.__PT = {
    cur: null,
    onHit(s, _e, tag, d) {
      const k = tag === COMBO_HIT && this.combo ? 'combo:' + this.combo : tagName(tag);
      m.dmg[k] = (m.dmg[k] || 0) + d;
      if (s.P.awakened) m.dmgAfterAwaken[k] = (m.dmgAfterAwaken[k] || 0) + d;
      if (k !== 'ultimate') chDmg[s.stage] = (chDmg[s.stage] || 0) + d;
    },
    onHurt(s, d) {
      const c = this.cur;
      let k = 'other';
      if (c?.hz) k = c.hz.bm ? 'boss:' + c.hz.bm : 'hazard:' + c.hz.k;
      else if (c?.en) k = c.en.boss ? 'bossContact:' + c.en.type : c.en.elite ? 'elite' : 'mob';
      if (d > 0) { m.hurt[k] = (m.hurt[k] || 0) + d; lastHurt = k; }
      this.cur = null;
    },
  };
  const maxTicks = Math.round((job.maxMin ?? 45) * 3600);
  let kingAt = -1, kingRealm = '', kingKilled = 0, revives0 = sim.view().P.revives;
  for (let i = 0; i < maxTicks; i++) {
    const v = sim.view() as SimState;
    if (v.phase === 'over' || (job.maxCh && v.stage > job.maxCh)) break;
    const st = v.stage;
    bot.step(sim);
    const s = sim.view() as SimState, P = s.P;
    if (s.phase === 'play' || s.phase === 'levelup' || s.phase === 'chest') {
      m.hpMin[st] = Math.min(m.hpMin[st] ?? 1, Math.max(0, P.hp) / P.maxHp);
      if (s.phase === 'play') chTime[st] = (chTime[st] || 0) + 1 / 60;
    }
    if (s.boss && kingAt < 0) { kingAt = s.totalTime; kingRealm = s.realm; }
    if (s.kingsKilled.length > kingKilled) {
      kingKilled = s.kingsKilled.length;
      if (kingAt >= 0 && !s.boss) { m.kingTtk.push({ ch: s.stage, realm: kingRealm, t: +(s.totalTime - kingAt).toFixed(1) }); kingAt = -1; }
    }
    if (s.phase === 'clearing' && kingAt >= 0) { if (s.lastEnd === 'escape') m.kingTtk.push({ ch: s.stage, realm: kingRealm, t: null }); kingAt = -1; }
    if (P.revives < revives0) { m.secondWinds++; revives0 = P.revives; }
    if (s.awakenOffer && m.awakenOfferAt === null) m.awakenOfferAt = s.stage;
    if (P.awakened && m.awakenAt === null) m.awakenAt = s.stage;
    const sig = Object.keys(P.evo).length;
    if (sig > m.evos) m.evos = sig;
    if (m.sigEvoAt === null && P.evo[({ mage: 'sigil', knight: 'shield', ranger: 'hawk', alchemist: 'flask' } as const)[job.hero]]) m.sigEvoAt = s.stage;
    if (m.firstLinkMaxAt === null && P.linkStart.length) m.firstLinkMaxAt = s.stage;
    if (s.phase === 'over' && !s.victory && m.deathBy === null) { m.deathBy = lastHurt; m.deathChapter = s.stage; }
  }
  const s = sim.view() as SimState;
  m.result = s.victory ? 'victory' : s.phase === 'over' ? 'dead' : 'timeout';
  m.chapter = s.stage; m.cleared = s.chaptersCleared.length; m.kings = s.kingsKilled.length; m.escapes = s.escapes;
  m.level = s.P.lv; m.minutes = +(s.totalTime / 60).toFixed(1); m.kills = s.kills; m.gold = s.runGold; m.revives = s.revivesBought; m.combos = s.combos;
  m.dpsByChapter = chDmg.map((d, i) => Math.round(d / Math.max(1, chTime[i] || 1)));
  m.build = Object.entries(s.P.skills).map(([k, v]) => `${k}${v}${s.P.evo[k as keyof typeof s.P.evo] ? '*' : ''}`).concat(Object.entries(s.P.pas).map(([k, v]) => `${k}${v}`));
  m.kingLeft = s.boss && !s.boss.dead ? +(s.boss.hp / s.boss.maxHp).toFixed(2) : null;
  globalThis.__PT = undefined;
  return m;
}
