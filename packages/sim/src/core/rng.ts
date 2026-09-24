// Seeded 32-bit RNG (sfc32) with named streams. Each gameplay concern draws from its own
// stream so that, e.g., level-up offers do not shift when combat consumes more numbers.

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [a, b). */
  range(a: number, b: number): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  /** Pick one element of a non-empty array. */
  pick<T>(arr: readonly T[]): T;
  /** Internal state, for hashing and checkpoints. */
  state(): [number, number, number, number];
}

/** FNV-1a 32-bit hash of a string, mixed with a numeric seed. */
export function hashString(s: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function createRng(seed: number, s1?: number, s2?: number, s3?: number): Rng {
  let a = seed >>> 0;
  let b = (s1 ?? 0x9e3779b9) >>> 0;
  let c = (s2 ?? 0x243f6a88) >>> 0;
  let d = (s3 ?? 1) >>> 0;
  const u32 = (): number => {
    const t = (((a + b) >>> 0) + d) >>> 0;
    d = (d + 1) >>> 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) >>> 0;
    c = ((c << 21) | (c >>> 11)) >>> 0;
    c = (c + t) >>> 0;
    return t;
  };
  if (s1 === undefined) for (let i = 0; i < 15; i++) u32(); // warm up a fresh seed
  const next = (): number => u32() / 4294967296;
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (n) => (next() * n) | 0,
    pick: (arr) => arr[(next() * arr.length) | 0],
    state: () => [a, b, c, d],
  };
}

export const STREAMS = ['spawn', 'ai', 'combat', 'loot', 'skills', 'levelup', 'events'] as const;
export type StreamName = (typeof STREAMS)[number];
export type Streams = Record<StreamName, Rng>;

export function createStreams(seed: number): Streams {
  const out = {} as Streams;
  for (const name of STREAMS) out[name] = createRng(hashString(name, seed >>> 0));
  return out;
}
