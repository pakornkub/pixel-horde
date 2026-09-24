// Tutorial hints (ticket 44): short non-blocking lines, each shown once per account. The first
// Greenvale teaches the basics in order; later hints appear the first time something happens.
import { benchSize, type SimEvent, type SimState } from '@pixel-horde/sim';

export const TIP_IDS = ['move', 'auto', 'crystals', 'levelup', 'ult', 'king', 'stageEnd', 'combo', 'bench', 'bloodMoon', 'dragon', 'awaken', 'escape'] as const;
export type TipId = (typeof TIP_IDS)[number];

/** Seconds a hint stays up, and the pause before the next one. */
export const TIP_TIME = 5.5, TIP_GAP = 1;

export interface TipStore { seen(): readonly string[]; mark(id: TipId): void; enabled(): boolean }

export function createTips(store: TipStore) {
  let queue: TipId[] = [];
  let shown: { id: TipId; t: number } | null = null;
  let gap = 0;
  const want = (id: TipId): void => {
    if (!store.enabled() || store.seen().includes(id) || queue.includes(id) || shown?.id === id) return;
    queue.push(id);
  };
  return {
    /** Look at one sim step (its events and the state after it). */
    observe(events: readonly SimEvent[], v: Readonly<SimState>): void {
      if (v.totalTime > 0.3) want('move');
      if (v.totalTime > 5) want('auto');
      if (v.gems.some((g) => g.kind === 'xp')) want('crystals');
      if (v.phase === 'levelup') want('levelup');
      if (v.ult >= v.cfg.ult.max) want('ult');
      if (v.phase === 'clear') {
        want('stageEnd');
        if (benchSize(v as SimState) > 1) want('bench');
        if (v.awakenOffer) want('awaken');
      }
      for (const e of events) {
        if (e.t === 'kingIntro') want('king');
        else if (e.t === 'combo') want('combo');
        else if (e.t === 'banner') {
          if (e.key === 'bloodMoon') want('bloodMoon');
          else if (e.key === 'dragonOmen' || e.key === 'dragonAppears') want('dragon');
          else if (e.key === 'overtime') want('escape');
        }
      }
    },
    /** Advance by real time; returns the hint on screen (or null). */
    tick(rdt: number): TipId | null {
      if (!store.enabled()) { queue = []; shown = null; return null; }
      if (shown) {
        shown.t += rdt;
        if (shown.t >= TIP_TIME) { shown = null; gap = TIP_GAP; }
      } else if (gap > 0) gap -= rdt;
      else if (queue.length) {
        const id = queue.shift()!;
        shown = { id, t: 0 };
        store.mark(id); // counted as seen as soon as it shows
      }
      return shown?.id ?? null;
    },
    reset(): void { queue = []; shown = null; gap = 0; },
  };
}
