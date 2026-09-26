// Headless deterministic simulation. Must never import DOM/Canvas/network, Math.random,
// wall-clock or non-deterministic Math.* (see core/fmath.ts).
export { createSim, runFacts, scoreOf, scoreBreakdown, endlessBreakdown, hashState, runReplay, HASH_EVERY, type Sim, type Replay, type Checkpoint } from './sim';
export * from './content/lumora/realms';
export * from './types';
export * from './data/skills';
export * from './data/enemies';
export * from './data/heroes';
export * from './data/shop';
export * from './data/themes';
export * from './data/weapons';
export * from './data/achievements';
export { xpNeed } from './systems/player';
export { usableWeapons } from './systems/combat';
export { GUARDIANS, canFuse } from './systems/guardians';
export { KING_KITS, ULTS } from './systems/kings';
export { attackSlots, awakenEligible, benchSize, qualifiedLinks, reviveCost, swapCost } from './systems/progress';
export { SNAP_ENEMIES, hostPhaseOf, hostSnapshot, packEnemies, selfWire, takeHits, unpackEnemies } from './systems/coop';
export { DEFAULT_RESOLVED, resolveConfig, type ResolvedConfig } from '@pixel-horde/config';
export { createRng, createStreams, hashString, type Rng } from './core/rng';
export * as fmath from './core/fmath';
export const SIM_TICK_HZ = 60;
