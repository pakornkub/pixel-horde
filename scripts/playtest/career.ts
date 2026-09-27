// Career worker: a player's first Runs in a row. After each Run its Gold is banked and spent in the permanent
// shop (cheapest next level first, like most players), so the next Run starts stronger. Answers "how many Runs
// until the shop is maxed / a Hero is affordable". Driven by career.mjs.
import { parentPort } from 'node:worker_threads';
import { SHOP_IDS, resolveConfig, shopCost, type ShopId } from '@pixel-horde/sim';
import { BALANCE_PASSES, DEFAULT_CONFIG, withOverrides, type BalanceConfigInput } from '@pixel-horde/config';
import { runOne, type Job } from './run';
import type { BotProfile } from './bot';

export interface CareerJob { id: number; hero: Job['hero']; seed: number; runs: number; pass?: string; patch?: BalanceConfigInput; profile?: Partial<BotProfile>; label: string }
export interface CareerRun { gold: number; chapter: number; victory: boolean; shopSpent: number; shop: Partial<Record<ShopId, number>> }

function careerOf(c: CareerJob): { label: string; hero: string; seed: number; runs: CareerRun[] } {
  const passes = [...BALANCE_PASSES].reverse();
  const upTo = !c.pass ? 0 : c.pass === '1' ? passes.length : passes.findIndex((p) => p.id === c.pass) + 1;
  const cfg = resolveConfig(withOverrides(passes.slice(0, upTo).reduce((x, p) => withOverrides(x, p.patch), DEFAULT_CONFIG), c.patch ?? {}));
  const shop: Partial<Record<ShopId, number>> = {};
  let wallet = 0, spent = 0;
  const out: CareerRun[] = [];
  for (let i = 0; i < c.runs; i++) {
    const m = runOne({ hero: c.hero, seed: c.seed * 1000 + i, label: c.label, shop: { ...shop }, pass: c.pass, patch: c.patch, profile: c.profile });
    wallet += m.gold;
    for (;;) { // cheapest next level first
      let best: ShopId | null = null, bc = Infinity;
      for (const id of SHOP_IDS) { const lv = shop[id] || 0; if (lv < cfg.shop[id].max && shopCost(cfg, id, lv) < bc) { bc = shopCost(cfg, id, lv); best = id; } }
      if (!best || bc > wallet) break;
      wallet -= bc; spent += bc; shop[best] = (shop[best] || 0) + 1;
    }
    out.push({ gold: m.gold, chapter: m.chapter, victory: m.result === 'victory', shopSpent: spent, shop: { ...shop } });
  }
  return { label: c.label, hero: c.hero, seed: c.seed, runs: out };
}

parentPort?.on('message', (c: CareerJob) => {
  try { parentPort!.postMessage({ ok: true, m: careerOf(c) }); } catch (e) { parentPort!.postMessage({ ok: false, err: String((e as Error)?.stack || e), job: c }); }
});
