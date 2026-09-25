// ZzFX-compatible sound generator. Parameters follow ZzFX by Frank Force (MIT License,
// https://github.com/KilledByAPixel/ZzFX); this is a small TypeScript reimplementation of its
// sample builder so every sound is described by a short number array and no audio files ship.

export const SAMPLE_RATE = 44100;

/**
 * [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide,
 *  pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo]
 * shape: 0 sin, 1 triangle, 2 saw, 3 tan, 4 noise-ish
 */
export type ZzfxParams = (number | undefined)[];

export function zzfxSamples(p: ZzfxParams, rand: () => number = Math.random): Float32Array {
  /* eslint-disable prefer-const -- ZzFX parameter names mirror the original; most are rescaled below */
  let [volume = 1, randomness = 0.05, frequency = 220, attack = 0, sustain = 0, release = 0.1, shape = 0, shapeCurve = 1,
    slide = 0, deltaSlide = 0, pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0, modulation = 0, bitCrush = 0,
    delay = 0, sustainVolume = 1, decay = 0, tremolo = 0] = p;
  /* eslint-enable prefer-const */
  const PI2 = Math.PI * 2, sr = SAMPLE_RATE;
  const sign = (v: number): number => (v > 0 ? 1 : -1);
  const startSlide = (slide *= (500 * PI2) / sr / sr);
  let startFrequency = (frequency *= ((1 + randomness * 2 * rand() - randomness) * PI2) / sr);
  let t = 0, tm = 0, i = 0, j = 1, r = 0, c = 0, s = 0, f: number;
  const b: number[] = [];
  const length = 0 | ((attack = attack * sr + 9) + (decay *= sr) + (sustain *= sr) + (release *= sr) + (delay *= sr));
  deltaSlide *= (500 * PI2) / sr ** 3;
  modulation *= PI2 / sr;
  pitchJump *= PI2 / sr;
  pitchJumpTime *= sr;
  repeatTime = (repeatTime * sr) | 0;
  for (; i < length; b[i++] = s) {
    if (!(++c % ((bitCrush * 100) | 0))) {
      s = shape
        ? shape > 1
          ? shape > 2
            ? shape > 3
              ? Math.sin((t % PI2) ** 3)
              : Math.max(Math.min(Math.tan(t), 1), -1)
            : 1 - (((((2 * t) / PI2) % 2) + 2) % 2)
          : 1 - 4 * Math.abs(Math.round(t / PI2) - t / PI2)
        : Math.sin(t);
      s = (repeatTime ? 1 - tremolo + tremolo * Math.sin((PI2 * i) / repeatTime) : 1) * sign(s) * Math.abs(s) ** shapeCurve *
        volume * (i < attack ? i / attack
          : i < attack + decay ? 1 - ((i - attack) / decay) * (1 - sustainVolume)
          : i < attack + decay + sustain ? sustainVolume
          : i < length - delay ? ((length - i - delay) / release) * sustainVolume
          : 0);
      s = delay ? s / 2 + (delay > i ? 0 : ((i < length - delay ? 1 : (length - i) / delay) * b[(i - delay) | 0]) / 2) : s;
    }
    f = (frequency += slide += deltaSlide) * Math.cos(modulation * tm++);
    t += f - f * noise * (1 - (((Math.sin(i) + 1) * 1e9) % 2));
    if (j && ++j > pitchJumpTime) { frequency += pitchJump; startFrequency += pitchJump; j = 0; }
    if (repeatTime && !(++r % repeatTime)) { frequency = startFrequency; slide = startSlide; j = j || 1; }
  }
  return Float32Array.from(b);
}

/** MIDI-style note number → Hz (69 = A4 440 Hz). */
export const noteHz = (n: number): number => 440 * 2 ** ((n - 69) / 12);
