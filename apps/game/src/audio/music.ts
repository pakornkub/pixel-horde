// A tiny ZzFXM-style tracker: songs are note patterns played with ZzFX instruments and
// rendered once into a looping AudioBuffer: the title, one theme per Realm, Kings and Umbra.
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

export type SongId = 'title' | 'king' | 'umbra' | 'greenvale' | 'sunscar' | 'deepdark' | 'frostpeak' | 'emberforge' | 'mirefen' | 'skyreach' | 'tidehollow' | 'gearspire' | 'duskhold' | 'crater';

export const SONGS: Record<SongId, Song> = {
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
  /* ---------- Realm themes (tickets 34–38): short loops, one mood each ---------- */
  // bright and bouncy, C major
  greenvale: {
    bpm: 120,
    tracks: [
      { inst: I.hat, steps: rep('. . x . . . x . . . x . . . x .', 2) },
      { inst: I.bass, steps: 'C3 . . C3 . . G2 . A2 . . A2 . . E2 . F2 . . F2 . . C3 . G2 . . G2 . . B2 .' },
      { inst: I.pluck, steps: 'E5 . G5 . C6 . G5 . A5 . C6 . E5 . . . F5 . A5 . C6 . A5 . G5 . D5 . B4 . . .' },
    ],
  },
  // dry and swaying, D Phrygian dominant
  sunscar: {
    bpm: 100,
    tracks: [
      { inst: I.kick, steps: rep('x . . . . . x . . . x . . . . .', 2) },
      { inst: I.bass, steps: 'D2 . . D2 . . D2 . D#2 . . D#2 . . D2 . C2 . . C2 . . D#2 . D2 . . . . . . .' },
      { inst: I.lead, steps: 'A4 . A#4 . C#5 . D5 . . . C#5 . A#4 . A4 . . . G4 . A4 . A#4 . A4 . . . . . . .' },
    ],
  },
  // echoing and lonely, A minor with rests
  deepdark: {
    bpm: 84,
    tracks: [
      { inst: I.bass, steps: 'A1 . . . . . . . . . . . . . . . F1 . . . . . . . E1 . . . . . . .' },
      { inst: I.pluck, steps: 'A4 . . . E5 . . . C5 . . . . . . . A4 . . . F5 . . . E5 . . . B4 . . .' },
      { inst: I.pad, steps: 'E4 . . . . . . . . . . . . . . . C4 . . . . . . . B3 . . . . . . .' },
    ],
  },
  // cold and glassy, E minor with high plucks
  frostpeak: {
    bpm: 92,
    tracks: [
      { inst: I.pad, steps: 'E4 . . . . . . . G4 . . . . . . . C4 . . . . . . . B3 . . . . . . .' },
      { inst: I.pluck, steps: 'B5 . E6 . B5 . G5 . . . F#5 . G5 . . . E5 . G5 . C6 . G5 . F#5 . . . D#5 . . .' },
      { inst: I.bass, steps: 'E2 . . . . . . . E2 . . . . . . . C2 . . . . . . . B1 . . . . . . .' },
    ],
  },
  // hammering and fiery, C minor
  emberforge: {
    bpm: 132,
    tracks: [
      { inst: I.kick, steps: rep('x . . x x . . . x . . x x . . .', 2) },
      { inst: I.snare, steps: rep('. . . . x . . . . . . . x . . .', 2) },
      { inst: I.bass, steps: 'C2 C2 . C2 . . D#2 . C2 C2 . C2 . . G1 . G#1 G#1 . G#1 . . G1 . G1 G1 . G1 . . B1 .' },
      { inst: I.lead, steps: 'C5 . . D#5 . . G5 . F5 . D#5 . D5 . C5 . G#4 . . C5 . . D#5 . D5 . B4 . G4 . . .' },
    ],
  },
  // lazy and bubbling, swampy G minor shuffle
  mirefen: {
    bpm: 96,
    tracks: [
      { inst: I.bass, steps: 'G2 . . G2 . A#2 . . C3 . . C3 . A#2 . . G2 . . G2 . F2 . . D2 . . D2 . F2 . .' },
      { inst: I.pluck, steps: '. . D5 . . . A#4 . . . C5 . . D5 . . . . F5 . . D5 . . . C5 . . A4 . . .' },
      { inst: I.hat, steps: rep('x . . x . . x . x . . x . . x .', 2) },
    ],
  },
  // soaring and airy, D major
  skyreach: {
    bpm: 128,
    tracks: [
      { inst: I.hat, steps: rep('x . x . x . x . x . x . x . x .', 2) },
      { inst: I.bass, steps: 'D3 . . . A2 . . . B2 . . . F#2 . . . G2 . . . D2 . . . G2 . . . A2 . . .' },
      { inst: I.lead, steps: 'F#5 . A5 . D6 . . . C#6 . A5 . F#5 . . . G5 . B5 . D6 . B5 . A5 . . . E5 . . .' },
    ],
  },
  // flowing and songlike, F major waltz feel
  tidehollow: {
    bpm: 104,
    tracks: [
      { inst: I.bass, steps: 'F2 . . . . . C3 . . . . . A#2 . . . . . F2 . . . . . C2 . . . . . . .' },
      { inst: I.pad, steps: 'A4 . . . . . . . . . . . D5 . . . . . . . . . . . C5 . . . . . . .' },
      { inst: I.pluck, steps: 'C5 . F5 . A5 . G5 . F5 . . . D5 . F5 . A#5 . A5 . G5 . . . E5 . G5 . C5 . . .' },
    ],
  },
  // mechanical and ticking, A minor 16ths
  gearspire: {
    bpm: 124,
    tracks: [
      { inst: I.hat, steps: rep('x x . x x x . x x x . x x x . x', 2) },
      { inst: I.kick, steps: rep('x . . . x . . . x . . . x . . .', 2) },
      { inst: I.bass, steps: 'A2 . A2 . A3 . A2 . G2 . G2 . G3 . G2 . F2 . F2 . F3 . F2 . E2 . E2 . E3 . G#2 .' },
      { inst: I.lead, steps: 'E5 . . . E5 . D5 . C5 . . . . . . . D5 . . . D5 . C5 . B4 . . . . . . .' },
    ],
  },
  // spooky and dramatic, D harmonic minor
  duskhold: {
    bpm: 88,
    tracks: [
      { inst: I.bass, steps: 'D2 . . . . . . . A#1 . . . . . . . G1 . . . . . . . A1 . . . . . . .' },
      { inst: I.pad, steps: 'F4 . . . . . . . D4 . . . . . . . D4 . . . . . . . C#4 . . . . . . .' },
      { inst: I.lead, steps: 'A5 . . F5 . . D5 . . . E5 . F5 . . . G5 . . E5 . . C#5 . . . D5 . . . . .' },
    ],
  },
  // the Heart Crater: a slow heartbeat
  crater: {
    bpm: 70,
    tracks: [
      { inst: I.kick, steps: rep('x . x . . . . . . . . . . . . .', 2) },
      { inst: I.pad, steps: 'D4 . . . . . . . . . . . . . . . C#4 . . . . . . . . . . . . . . .' },
      { inst: I.pluck, steps: '. . . . . . . . A5 . . . . . . . . . . . . . . . G#5 . . . . . . .' },
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
