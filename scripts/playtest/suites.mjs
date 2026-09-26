// Playtest suites: lists of Jobs (see run.ts). Seeds are 1..n per variant.

const HEROES = process.env.PT_HEROES ? process.env.PT_HEROES.split(',') : ['mage', 'knight', 'ranger', 'alchemist'];
export const SHOP = {
  fresh: {},
  mid: { power: 5, vigor: 5, speed: 2, greed: 2, wisdom: 2, revive: 1 },
  max: { power: 10, vigor: 10, speed: 5, greed: 5, wisdom: 5, revive: 1 },
};

/** The published live Balance Config (v3) differs from the built-in defaults only here. */
export const LIVE = { shared: { stage: { durBase: 80, durMax: 180 } } };
const merge = (a, b) => {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b === undefined ? a : b;
  const out = { ...(a && typeof a === 'object' ? a : {}) };
  for (const [k, v] of Object.entries(b)) out[k] = merge(out[k], v);
  return out;
};
const BASE = process.env.PT_BASE === 'defaults' ? {} : LIVE;
/** PT_PASS=1: every job starts from the recommended balance pass. */
const PASS = !!process.env.PT_PASS;
const per = (n, f) => HEROES.flatMap((hero) => Array.from({ length: n }, (_, i) => { const j = f(hero, i + 1); return { ...j, patch: merge(BASE, j.patch || {}), ...(PASS ? { pass: true } : {}) }; }));

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
  patch: (n) => per(n, (hero, seed) => ({ hero, seed, label: process.env.PT_LABEL || 'patch', shop: SHOP[process.env.PT_SHOP || 'mid'], patch: JSON.parse(process.env.PT_PATCH_JSON || '{}'), ...(process.env.PT_PRESET ? { preset: process.env.PT_PRESET } : {}), ...(process.env.PT_MAXCH ? { maxCh: Number(process.env.PT_MAXCH) } : {}), ...(process.env.PT_NOAWAKEN ? { profile: { awaken: false } } : {}), ...(process.env.PT_RANDOM ? { profile: { pick: 'random', react: 0.4 } } : {}) })),
  /** Every difficulty preset, fresh and mid accounts. PT_PRESETS=relaxed,hard limits the list. */
  presets: (n) => (process.env.PT_PRESETS || 'relaxed,easy,balanced,challenge,hard,blitz').split(',').flatMap((preset) => [
    ...per(n, (hero, seed) => ({ hero, seed, label: `${preset}-fresh`, preset })),
    ...per(n, (hero, seed) => ({ hero, seed, label: `${preset}-mid`, preset, shop: SHOP.mid })),
  ]),
};
