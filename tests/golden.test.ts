import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runReplay, type Replay } from '@pixel-horde/sim';
import { botOptions, runBot } from './bot';

const CASES: [string, Parameters<typeof botOptions>[1], number][] = [
  // god mode keeps the bot alive so the replay covers stage clears, level-ups and the dragon
  ['replay-dragon-god.json', { debug: { event: 'dragon', god: true } }, 5 * 3600],
  // no god mode: real damage through hurtP() until the bot dies
  ['replay-plain.json', { meta: { up: { vigor: 10, revive: 1 } } }, 5 * 3600],
];

/** Regenerate with UPDATE_GOLDEN=1 only when gameplay is meant to change. */
function golden(name: string, extra: Parameters<typeof botOptions>[1], ticks: number): Replay {
  const file = new URL('./golden/' + name, import.meta.url);
  if (process.env.UPDATE_GOLDEN || !existsSync(file)) {
    const r = runBot(botOptions(20260924, extra), ticks).sim.replay();
    writeFileSync(file, JSON.stringify(r));
  }
  return JSON.parse(readFileSync(file, 'utf8')) as Replay;
}

describe('golden replay', () => {
  it.each(CASES)('%s reproduces its recorded hash sequence in Node', (name, extra, ticks) => {
    const r = golden(name, extra, ticks);
    expect(r.hashes.length).toBeGreaterThan(60);
    expect(runReplay(r).replay().hashes).toEqual(r.hashes);
  });
});
