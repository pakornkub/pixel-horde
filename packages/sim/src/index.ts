// Headless deterministic simulation. Must never import DOM/Canvas/network, Math.random,
// wall-clock or non-deterministic Math.* (see core/fmath.ts).
export { createSim, scoreOf, hashState, type Sim } from './sim';
export * from './types';
export * from './data/skills';
export * from './data/enemies';
export * from './data/heroes';
export * from './data/shop';
export * from './data/themes';
export { xpNeed, CD_CAP, CRIT_CAP } from './systems/player';
export { createRng, createStreams, hashString, type Rng } from './core/rng';
export * as fmath from './core/fmath';
export const SIM_TICK_HZ = 60;
