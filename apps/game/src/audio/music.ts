// A tiny ZzFXM-style tracker: songs are note patterns played with ZzFX instruments and
// rendered once into a looping AudioBuffer. Realm themes are added by the Realm tickets.
import { SAMPLE_RATE, noteHz, zzfxSamples, type ZzfxParams } from './zzfx';

export interface Track {
  /** ZzFX instrument; its frequency is replaced by each note's pitch ('x' keeps it: drums). */
  inst: ZzfxParams;
  /** 16th-note steps separated by spaces: "A2", "C#4", "x" (hit at the instrument pitch) or "." (rest). */
  steps: string;
}
export interface Song { bpm: number; tracks: Track[] }

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function midi(tok: string): number | null {
  const m = tok.match(/^([A-G]#?)(-?\d)$/);
  return m ? 12 * (Number(m[2]) + 1) + NOTE[m[1]] : null;
}

const I = {
  bass: [0.5, 0, 110, 0.01, 0.12, 0.08, 1, 1] as ZzfxParams,
  lead: [0.28, 0, 440, 0.01, 0.08, 0.1, 2, 1.4] as ZzfxParams,
  pad: [0.18, 0, 440, 0.08, 0.25, 0.3, 0, 1] as ZzfxParams,
  pluck: [0.25, 0, 440, 0, 0.04, 0.12, 1, 1.2] as ZzfxParams,
  kick: [0.7, 0, 60, 0, 0.03, 0.12, 0, 1, -8] as ZzfxParams,
  snare: [0.35, 0, 200, 0, 0.02, 0.1, 4, 1, 0, 0, 0, 0, 0, 5] as ZzfxParams,
  hat: [0.12, 0, 6000, 0, 0.005, 0.03, 4, 1, 0, 0, 0, 0, 0, 8] as ZzfxParams,
};

const rep = (s: string, n: number): string => Array(n).fill(s).join(' ');

export const SONGS: Record<'title' | 'king' | 'umbra', Song> = {
  // calm and hopeful, A minor → C major
  title: {
    bpm: 96,
    tracks: [
      { inst: I.bass, steps: 'A2 . . . . . A2 . F2 . . . . . F2 . C3 . . . . . C3 . G2 . . . . . G2 .' },
      { inst: I.pluck, steps: 'A4 . C5 . E5 . C5 . A4 . C5 . F5 . C5 . G4 . C5 . E5 . C5 . G4 . B4 . D5 . B4 .' },
      { inst: I.pad, steps: 'E4 . . . . . . . . . . . . . . . E4 . . . . . . . . . . . . . . .' },
    ],
  },
  // driving King battle, E minor with a pounding beat
  king: {
    bpm: 144,
    tracks: [
      { inst: I.kick, steps: rep('x . . . x . . . x . . . x . . .', 2) },
      { inst: I.snare, steps: rep('. . . . x . . . . . . . x . . x', 2) },
      { inst: I.hat, steps: rep('x . x . x . x . x . x . x . x x', 2) },
      { inst: I.bass, steps: 'E2 . E2 . G2 . E2 . D2 . D2 . B1 . D2 . C2 . C2 . E2 . C2 . B1 . B1 . D#2 . B1 .' },
      { inst: I.lead, steps: 'E5 . . G5 . . F#5 . E5 . D5 . B4 . . . C5 . . E5 . . D5 . B4 . A4 . B4 . . .' },
    ],
  },
  // dark and heavy, D minor with a tritone sting
  umbra: {
    bpm: 112,
    tracks: [
      { inst: I.kick, steps: rep('x . . . . . x . x . . . . . . .', 2) },
      { inst: I.snare, steps: rep('. . . . x . . . . . . . x . . .', 2) },
      { inst: I.bass, steps: 'D2 . . D2 . . D2 . G#1 . . G#1 . . G#1 . A#1 . . A#1 . . A#1 . A1 . . A1 . C#2 . A1 .' },
      { inst: I.pad, steps: 'D4 . . . . . . . G#3 . . . . . . . A#3 . . . . . . . A3 . . . . . . .' },
      { inst: I.lead, steps: '. . . . A5 . G#5 . . . . . F5 . E5 . . . . . D5 . C#5 . . . . . D5 . . .' },
    ],
  },
};

/** Render a song into one loop (stereo-ready mono samples at 44.1 kHz). */
export function renderSong(song: Song): Float32Array {
  const stepSec = 60 / song.bpm / 4;
  const steps = Math.max(...song.tracks.map((t) => t.steps.split(/\s+/).length));
  const len = Math.ceil(steps * stepSec * SAMPLE_RATE);
  const out = new Float32Array(len);
  const cache = new Map<string, Float32Array>();
  for (const tr of song.tracks) {
    tr.steps.split(/\s+/).forEach((tok, i) => {
      if (tok === '.' || !tok) return;
      const n = tok === 'x' ? null : midi(tok);
      if (tok !== 'x' && n === null) return;
      const key = JSON.stringify(tr.inst) + tok;
      let smp = cache.get(key);
      if (!smp) {
        const p = [...tr.inst];
        p[1] = 0; // no randomness: loops stay identical
        if (n !== null) p[2] = noteHz(n);
        smp = zzfxSamples(p, () => 0.5);
        cache.set(key, smp);
      }
      const at = Math.floor(i * stepSec * SAMPLE_RATE);
      for (let k = 0; k < smp.length; k++) out[(at + k) % len] += smp[k]; // tails wrap around the loop
    });
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0.95) for (let k = 0; k < len; k++) out[k] *= 0.95 / peak;
  return out;
}
