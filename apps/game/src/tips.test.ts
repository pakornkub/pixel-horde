import { describe, expect, it } from 'vitest';
import { DEFAULT_RESOLVED, type SimEvent, type SimState } from '@pixel-horde/sim';
import { TIP_TIME, createTips, type TipId } from './tips';

const view = (o: Partial<SimState> = {}): SimState => ({
  totalTime: 0, gems: [], phase: 'play', ult: 0, cfg: DEFAULT_RESOLVED, awakenOffer: false, stage: 1, P: { bench: [] }, ...o,
}) as unknown as SimState;

function setup(enabled = true) {
  const seen: string[] = [];
  const tips = createTips({ seen: () => seen, mark: (id) => { seen.push(id); }, enabled: () => enabled });
  const shownLog: TipId[] = [];
  const run = (secs: number): void => {
    for (let t = 0; t < secs; t += 0.1) { const id = tips.tick(0.1); if (id && shownLog[shownLog.length - 1] !== id) shownLog.push(id); }
  };
  return { seen, tips, shownLog, run };
}

describe('tutorial hints', () => {
  it('teach the basics in order, each once', () => {
    const { tips, shownLog, run, seen } = setup();
    tips.observe([], view({ totalTime: 1 }));
    tips.observe([], view({ totalTime: 6, gems: [{ kind: 'xp', x: 0, y: 0, v: 1, mag: false }] }));
    run(30);
    expect(shownLog).toEqual(['move', 'auto', 'crystals']);
    // the same situations again never repeat a hint
    tips.observe([], view({ totalTime: 60, gems: [{ kind: 'xp', x: 0, y: 0, v: 1, mag: false }] }));
    run(30);
    expect(shownLog).toEqual(['move', 'auto', 'crystals']);
    expect(seen).toEqual(['move', 'auto', 'crystals']);
  });

  it('just-in-time hints come from events', () => {
    const { tips, shownLog, run } = setup();
    const ev: SimEvent[] = [{ t: 'combo', id: 'shatter', x: 0, y: 0 }, { t: 'banner', key: 'bloodMoon', dur: 1 }, { t: 'kingIntro', realm: 'greenvale', x: 0, y: 0 }];
    tips.observe(ev, view());
    run(3 * (TIP_TIME + 1.2));
    expect(shownLog).toEqual(['combo', 'bloodMoon', 'king']); // in the order they happened
  });

  it('are skipped when already seen by the account or turned off', () => {
    const a = setup();
    a.seen.push('levelup');
    a.tips.observe([], view({ phase: 'levelup' }));
    a.run(10);
    expect(a.shownLog).toEqual([]);
    const b = setup(false);
    b.tips.observe([], view({ totalTime: 10 }));
    b.run(10);
    expect(b.shownLog).toEqual([]);
  });
});
