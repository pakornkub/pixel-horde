// Playtest suites: lists of Jobs (see run.ts). Seeds are 1..n per variant.

const HEROES = process.env.PT_HEROES ? process.env.PT_HEROES.split(',') : ['mage', 'knight', 'ranger', 'alchemist'];
export const SHOP = {
  fresh: {},
  mid: { power: 5, vigor: 5, speed: 2, greed: 2, wisdom: 2, revive: 1 },
  max: { power: 10, vigor: 10, speed: 5, greed: 5, wisdom: 5, revive: 1 },
};

/** The Stage lengths published in v3 (kept by every later version). Only these are applied by default, not the whole
 *  live config: add the later passes (v4 = 2026-09, v5 = 2026-09b, v6 = 2026-09c, …) with PT_PASS. */
export const V3_STAGES = { shared: { stage: { durBase: 80, durMax: 180 } } };
const merge = (a, b) => {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b === undefined ? a : b;
  const out = { ...(a && typeof a === 'object' ? a : {}) };
  for (const [k, v] of Object.entries(b)) out[k] = merge(out[k], v);
  return out;
};
const BASE = process.env.PT_BASE === 'defaults' ? {} : V3_STAGES;
/** PT_PASS=1: every job starts from all the recommended balance passes; PT_PASS=<id> stops at that pass. */
const PASS = process.env.PT_PASS;
const per = (n, f) => HEROES.flatMap((hero) => Array.from({ length: n }, (_, i) => { const j = f(hero, i + 1); return { ...j, patch: merge(BASE, j.patch || {}), ...(PASS ? { pass: PASS } : {}) }; }));

export const suites = {
  heroes: (n) => per(n, (hero, seed) => ({ hero, seed, label: 'fresh' })),
  veteran: (n) => per(n, (hero, seed) => ({ hero, seed, label: 'mid', shop: SHOP.mid })),
  max: (n) => per(n, (hero, seed) => ({ hero, seed, label: 'max', shop: SHOP.max })),
  awaken: (n) => [
    ...per(n, (hero, seed) => ({ hero, seed, label: 'accept', shop: SHOP.mid })),
    ...per(n, (hero, seed) => ({ hero, seed, label: 'decline', shop: SHOP.mid, profile: { awaken: false } })),
  ],
  casual: (n) => per(n, (hero, seed) => ({ hero, seed, label: 'random-picks', shop: SHOP.mid, profile: { pick: 'random', react: 0.4 } })),
  /** A patch file given as PT_PATCH=path.json (tuning experiments). */
  patch: (n) => per(n, (hero, seed) => ({ hero, seed, label: process.env.PT_LABEL || 'patch', shop: SHOP[process.env.PT_SHOP || 'mid'], patch: JSON.parse(process.env.PT_PATCH_JSON || '{}'), ...(process.env.PT_CRACK ? { crack: Number(process.env.PT_CRACK) } : {}), ...(process.env.PT_MAXCH ? { maxCh: Number(process.env.PT_MAXCH) } : {}), ...(process.env.PT_NOAWAKEN ? { profile: { awaken: false } } : {}), ...(process.env.PT_RANDOM ? { profile: { pick: 'random', react: 0.4 } } : {}) })),
  /** Every Heart Crack tier, fresh and mid accounts. PT_CRACKS=0,3 limits the list. */
  cracks: (n) => (process.env.PT_CRACKS || '0,1,2,3').split(',').map(Number).flatMap((crack) => [
    ...per(n, (hero, seed) => ({ hero, seed, label: `crack${crack}-fresh`, crack })),
    ...per(n, (hero, seed) => ({ hero, seed, label: `crack${crack}-mid`, crack, shop: SHOP.mid })),
  ]),
};
