// Tiny WebAudio synth (ported from the original). ZzFX replaces it in ticket 40.
import type { SfxKey } from '@pixel-horde/sim';

let AC: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
let lastHit = 0, lastGem = 0;
export const audio = { muted: false };

export function initAudio(): void {
  if (AC) { if (AC.state === 'suspended') void AC.resume(); return; }
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    AC = new Ctor();
  } catch { AC = null; }
}

function tone(f: number, d: number, type: OscillatorType, vol: number, slide?: number, delay?: number): void {
  const ac = AC!;
  const t = ac.currentTime + (delay || 0);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.linearRampToValueAtTime(Math.max(40, f + slide), t + d);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + d + 0.02);
}

function noise(d: number, vol: number): void {
  const ac = AC!;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const a = noiseBuf.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
  }
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const g = ac.createGain(), f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 900;
  const t = ac.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f); f.connect(g); g.connect(ac.destination);
  s.start(t); s.stop(t + d);
}

export function sfx(k: SfxKey): void {
  if (!AC || audio.muted || AC.state !== 'running') return;
  const t = AC.currentTime, R = Math.random;
  try {
    if (k === 'hit') { if (t - lastHit < 0.05) return; lastHit = t; tone(700 + R() * 300, 0.04, 'square', 0.025, -300); }
    else if (k === 'crit') { if (t - lastHit < 0.03) return; lastHit = t; tone(1500, 0.07, 'square', 0.035, -900); }
    else if (k === 'boom') noise(0.35, 0.14);
    else if (k === 'zap') tone(1800, 0.12, 'sawtooth', 0.03, -1400);
    else if (k === 'nova') tone(300, 0.25, 'sawtooth', 0.04, -200);
    else if (k === 'lance') tone(1100, 0.08, 'triangle', 0.04, -500);
    else if (k === 'laser') tone(700, 0.8, 'sawtooth', 0.03, 900);
    else if (k === 'lv') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.045, 0, i * 0.07));
    else if (k === 'hurt') tone(160, 0.16, 'square', 0.06, -80);
    else if (k === 'ult') { noise(1.1, 0.25); tone(160, 0.9, 'sawtooth', 0.07, 700); }
    else if (k === 'coin') { if (t - lastGem < 0.035) return; lastGem = t; tone(1600, 0.06, 'square', 0.03, 500); }
    else if (k === 'tick') { if (t - lastGem < 0.02) return; lastGem = t; tone(900, 0.025, 'square', 0.025, 0); }
    else if (k === 'gem') { if (t - lastGem < 0.035) return; lastGem = t; tone(1300 + R() * 500, 0.03, 'triangle', 0.02, 0); }
    else if (k === 'clear') [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.05, 0, i * 0.1));
  } catch { /* audio is best-effort */ }
}
