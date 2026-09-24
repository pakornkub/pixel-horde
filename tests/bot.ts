// Scripted bot for headless runs: walks in a slow figure-eight, takes every offer,
// fires the Ultimate when ready and continues through stage clears.
import { createSim, type Command, type Sim, type SimOptions } from '@pixel-horde/sim';

export interface BotResult { sim: Sim; ticks: number; errors: unknown[] }

export function botOptions(seed: number, extra: Partial<SimOptions> = {}): SimOptions {
  return { seed, hero: 'mage', meta: { up: {} }, viewport: { w: 338, h: 190 }, ...extra };
}

export function botStep(sim: Sim, t: number): void {
  const v = sim.view();
  const cmds: Command[] = [];
  if (v.phase === 'levelup') cmds.push({ type: 'pick', index: t % (v.levelUp?.options.length || 1) });
  if (v.phase === 'chest' && t % 30 === 0) cmds.push({ type: 'chestStop' });
  if (v.phase === 'clear') cmds.push({ type: 'next' });
  if (v.phase === 'route') cmds.push({ type: 'route', index: t % 2 });
  if (v.ult >= 80) cmds.push({ type: 'ult' });
  // quantized like the real input layer
  const a = Math.floor(t / 20) / 12; // change direction every 20 ticks (keeps replays small)
  const q = (x: number): number => Math.round(x * 127) / 127;
  sim.step({ mx: q(Math.cos(a)), my: q(Math.sin(a * 0.7)) }, cmds);
}

export function runBot(opts: SimOptions, maxTicks: number): BotResult {
  const sim = createSim(opts);
  let t = 0;
  for (; t < maxTicks; t++) {
    if (sim.view().phase === 'over') break;
    botStep(sim, t);
  }
  return { sim, ticks: t, errors: [] };
}
