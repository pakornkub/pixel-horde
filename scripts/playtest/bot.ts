// Playtest bot: a decent human-like player for balance runs (not used by the game).
// Moves by scoring 17 candidate directions (enemies, telegraphed hazards after a reaction delay,
// gems, the current boss), picks level-ups by a strategy, answers every menu.
import {
  AWAKENING, EVO_PASSIVE, SKILL_LINES, signatureOf,
  type Command, type Enemy, type Hazard, type LevelOption, type Sim, type SimState, type SkillId,
} from '@pixel-horde/sim';

export type PickStrategy = 'smart' | 'random';
export interface BotProfile {
  /** Seconds before a new telegraph is noticed. */
  react: number;
  /** Level-up choices. */
  pick: PickStrategy;
  /** Accept Awakening when offered. */
  awaken: boolean;
  /** Buy the revive when offered. */
  revive: boolean;
  /** Decision every N ticks (a human does not re-aim 60 times a second). */
  every: number;
  /** Movement weights (see move()). */
  w?: Partial<typeof W0>;
}
export const W0 = { hit: 150, near: 10, nearK: 0.3, gem: 40, still: 4, momentum: 1.5, boss: 0.9 };
export const DEFAULT_PROFILE: BotProfile = { react: 0.25, pick: 'smart', awaken: true, revive: true, every: 3 };

/** Melee-ish heroes want to hug the King a little closer. */
const BOSS_RANGE: Record<string, number> = { mage: 55, knight: 34, ranger: 70, alchemist: 55 };

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hyp = (x: number, y: number): number => Math.sqrt(x * x + y * y);
const DIRS: [number, number][] = [[0, 0]];
for (let i = 0; i < 16; i++) DIRS.push([Math.cos((i / 16) * Math.PI * 2), Math.sin((i / 16) * Math.PI * 2)]);

function segDist(px: number, py: number, x: number, y: number, a: number, len: number): number {
  const dx = Math.cos(a), dy = Math.sin(a);
  const t = Math.max(0, Math.min(len, (px - x) * dx + (py - y) * dy));
  return hyp(px - (x + dx * t), py - (y + dy * t));
}

/** Danger of standing at (x, y) `T` seconds from now because of this telegraph. */
function hazardCost(s: SimState, h: Hazard, x: number, y: number, T: number, react: number, moving: boolean): number {
  if (h.t < react && h.k !== 'proj') return 0; // not noticed yet
  const t = h.t + T, te = h.te ?? 0, d = hyp(x - h.x, y - h.y);
  // a wave follows these moves: players learn to run out of its reach during the warning
  const K = s.cfg.kings, wave = h.bm === 'splash' && h.k === 'circ' ? K.splash.r : h.bm === 'quake' && h.k === 'circ' ? K.quake.r : h.bm === 'siren' && h.k === 'pull' ? K.siren.wave : 0;
  const pre = wave && d < wave + 10 ? (wave + 10 - d) * 2.5 : 0;
  return pre + hazardCost0(h, x, y, t, te, d, moving);
}

function hazardCost0(h: Hazard, x: number, y: number, t: number, te: number, d: number, moving: boolean): number {
  const T = t - h.t;
  switch (h.k) {
    case 'cone': {
      if (t > te + (h.du ?? 0) || te - t > 1.2) return 0;
      const da = Math.atan2(Math.sin(Math.atan2(y - h.y, x - h.x) - h.a!), Math.cos(Math.atan2(y - h.y, x - h.x) - h.a!));
      return d < h.r! + 8 && Math.abs(da) < h.sp! + 8 / Math.max(d, 1) ? 500 : 0;
    }
    case 'circ':
      if (h.spawn || h.done) return 0;
      if (te - t > 1.2) return 0;
      return d < h.r! + 9 ? 400 + 300 * (1 - Math.max(0, te - t) / 1.2) : 0;
    case 'beam':
      if (h.done || te - t > 1.2) return 0;
      return segDist(x, y, h.x, h.y, h.a!, h.r!) < (h.w ?? 6) + 9 ? 500 : 0;
    case 'line': // dash / lance telegraph: the path stays dangerous a little after the warning
      if (t > te + 0.7) return 0;
      return segDist(x, y, h.x, h.y, h.a!, h.r!) < 16 ? 350 : 0;
    case 'proj': {
      const px = h.x + h.vx! * T, py = h.y + h.vy! * T;
      return hyp(x - px, y - py) < h.r! + 10 ? 450 : 0;
    }
    case 'ring': {
      const r = h.r! * Math.min(1, h.t / h.du!);
      if (h.hitP || d > h.r! + 8 || d < r - 8) return 0;
      return 150 + (h.r! - d);
    }
    case 'pull':
      if (t > te + (h.du ?? 0)) return 0;
      return d < (h.w ?? 10) + 14 ? 400 : d < h.r! ? 20 : 0;
    case 'safe': {
      if (h.done || te - t > 2.5) return 0;
      let best = Infinity;
      for (const [sx, sy] of h.pts!) best = Math.min(best, hyp(x - sx, y - sy) - h.r! + 4);
      return best > 0 ? 300 + best * 4 : 0;
    }
    case 'bliz':
      return t >= te && t < te + (h.du ?? 0) && !moving ? 250 : 0;
    default:
      return 0;
  }
}

function bosses(s: SimState): Enemy[] {
  return [s.boss, s.boss2, s.dragonE, s.rivalE].filter((e): e is Enemy => !!e && !e.dead && !e.hide);
}

export interface Bot {
  step(sim: Sim): void;
}

export function createBot(seed: number, profile: BotProfile = DEFAULT_PROFILE): Bot {
  const rnd = mulberry(seed ^ 0x5bd1e995);
  let t = 0, mx = 0, my = 0;
  const W = { ...W0, ...profile.w };

  function move(s: SimState): void {
    const P = s.P;
    const T1 = 0.18, T2 = 0.4, spd = P.spd;
    // the 32 closest monsters are all a player tracks (and all the bot can afford per decision)
    let near: Enemy[] = [];
    const nd: number[] = [];
    for (const e of s.enemies) {
      if (e.dead || e.hide) continue;
      const dx = e.x - P.x, dy = e.y - P.y;
      if (Math.abs(dx) < 90 && Math.abs(dy) < 90) { near.push(e); nd.push(dx * dx + dy * dy); }
    }
    if (near.length > 32) { const idx = near.map((_, i) => i).sort((a, b) => nd[a] - nd[b]).slice(0, 32); near = idx.map((i) => near[i]); }
    const bs = bosses(s);
    const want = BOSS_RANGE[P.ch] ?? 55;
    const hpFrac = P.hp / P.maxHp;
    // gems worth walking to (EXP is the whole game: humans vacuum the field between waves)
    const gems: [number, number, number][] = [];
    for (const g of s.gems) {
      if (g.mag || gems.length >= 48) continue;
      const d = hyp(g.x - P.x, g.y - P.y);
      if (d > 160) continue;
      const w = g.kind === 'heart' ? (hpFrac < 0.7 ? 6 : 0.3) : g.kind === 'chest' ? 5 : g.kind === 'shield' ? 3 : g.kind === 'coin' ? 1 : 1 + Math.min(3, g.v / 4);
      gems.push([g.x, g.y, w]);
    }
    let best = 0, bestC = Infinity;
    for (let i = 0; i < DIRS.length; i++) {
      const [dx, dy] = DIRS[i];
      let c = 0;
      for (const T of [T1, T2]) {
        const x = P.x + dx * spd * T, y = P.y + dy * spd * T;
        for (const e of near) {
          // chasers keep walking toward where the player is now
          const lx = P.x - e.x, ly = P.y - e.y, l0 = hyp(lx, ly) || 1;
          const step = Math.min(l0, (e.frz > 0 ? 0 : e.spd) * T);
          const d = hyp(e.x + (lx / l0) * step - x, e.y + (ly / l0) * step - y) - (e.r + 5);
          const w = e.boss ? 3 : e.elite ? 2 : 1;
          if (d < 0) c += W.hit * w;
          else if (d < W.near) c += w * (W.near - d) * (W.near - d) * W.nearK;
        }
        for (const h of s.hz) c += hazardCost(s, h, x, y, T, profile.react, i !== 0);
        if (bs.length) {
          const b = bs[0], d = hyp(b.x - x, b.y - y);
          c += Math.abs(d - want) * W.boss;
        }
        for (const [gx, gy, w] of gems) c -= (w * W.gem) / (Math.max(0, hyp(gx - x, gy - y) - P.pick) + 12);
      }
      // keep some momentum (humans do not jitter) and prefer moving to standing still
      if (i === 0) c += W.still; else c -= (dx * mx + dy * my) * W.momentum;
      if (c < bestC) { bestC = c; best = i; }
    }
    mx = DIRS[best][0]; my = DIRS[best][1];
  }

  function scoreOption(s: SimState, o: LevelOption): number {
    const P = s.P, hero = P.ch, sig = signatureOf(hero), links = SKILL_LINES[hero], line = AWAKENING[hero].line as readonly SkillId[];
    const noise = rnd() * 6;
    if (profile.pick === 'random') return rnd();
    switch (o.kind) {
      case 'evo': return 200;
      case 'heal': return P.hp < P.maxHp * 0.5 ? 30 : 1;
      case 'lb': return ({ dmg: 14, hp: 12, crit: 10, spd: 8 } as const)[o.id] + noise;
      case 'train': return 6 + noise;
      case 'gold': return 3 + noise;
      case 'comp': return 34 + noise;
      case 'pas': {
        const own = P.pas[o.id] || 0;
        const evoFor = Object.entries(EVO_PASSIVE).filter(([k, v]) => v === o.id && (P.skills[k as SkillId] || k === sig)).length;
        const base: Record<string, number> = { might: 40, haste: 36, vital: 30, crit: 28, swift: 22, magnet: 16 };
        return (base[o.id] ?? 20) + (EVO_PASSIVE[sig] === o.id && !own ? 40 : 0) + (evoFor && !own ? 12 : 0) + noise;
      }
      case 'skill': {
        if (o.toBench) return 4 + noise;
        const lv = P.skills[o.id] || 0;
        if (o.id === sig) return 70 + noise;
        if (line.includes(o.id)) return 80 + noise;
        if (links.includes(o.id)) {
          // two Links are enough for Awakening; the third is a normal skill
          const owned = links.filter((l) => P.skills[l]).length;
          return (lv ? 58 : owned >= 2 && !P.awakened ? 30 : 52) + noise;
        }
        return (lv ? 38 : 32) + noise;
      }
    }
  }

  function levelUp(s: SimState, cmds: Command[]): void {
    const opts = s.levelUp!.options;
    // spend Skill Points on the Signature, then a Link
    const P = s.P, sig = signatureOf(P.ch);
    if (s.sp >= s.cfg.economy.upgrade && profile.pick === 'smart') {
      const cand = [sig, ...SKILL_LINES[P.ch], ...AWAKENING[P.ch].line].find((id) => P.skills[id] && P.skills[id]! < s.cfg.skills[id].max);
      if (cand) { cmds.push({ type: 'spUpgrade', id: cand }); return; }
    }
    let bi = 0, bs = -Infinity;
    opts.forEach((o, i) => { const v = scoreOption(s, o); if (v > bs) { bs = v; bi = i; } });
    cmds.push({ type: 'pick', index: bi });
  }

  return {
    step(sim: Sim): void {
      const s = sim.view() as SimState, cmds: Command[] = [];
      switch (s.phase) {
        case 'levelup': if (t % 6 === 0) levelUp(s, cmds); break;
        case 'chest': if (t % 6 === 0) cmds.push({ type: 'chestStop' }); break;
        case 'clear':
          if (t % 6 === 0) {
            if (s.awakenOffer) cmds.push({ type: 'awaken', accept: profile.awaken });
            else if (s.fuseOffer) cmds.push({ type: 'fuse', accept: true });
            else cmds.push({ type: 'next' });
          }
          break;
        case 'route': if (t % 6 === 0) cmds.push({ type: 'route', index: rnd() < 0.5 ? 0 : 1 }); break;
        case 'revive': if (t % 6 === 0) cmds.push(profile.revive ? { type: 'revive' } : { type: 'giveUp' }); break;
        case 'victory': cmds.push({ type: 'endless', go: false }); break;
        case 'play': {
          if (t % profile.every === 0) move(s);
          if (s.ult >= s.cfg.ult.max) {
            let vis = 0;
            for (const e of s.enemies) if (!e.dead && Math.abs(e.x - s.P.x) < s.viewport.w / 2 && Math.abs(e.y - s.P.y) < s.viewport.h / 2) vis++;
            if (vis >= 25 || bosses(s).length) cmds.push({ type: 'ult' });
          }
          break;
        }
      }
      const live = s.phase === 'play';
      sim.step(live ? { mx: Math.round(mx * 127) / 127, my: Math.round(my * 127) / 127 } : { mx: 0, my: 0 }, cmds);
      t++;
    },
  };
}
