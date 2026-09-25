// Audio engine: ZzFX sounds on an effects bus and ZzFXM-style music on a music bus; both
// volumes follow Settings. No audio files are shipped — everything is synthesized once.
import type { ComboId, SfxKey, SkillId } from '@pixel-horde/sim';
import { onSettingsChange, settings } from '../settings';
import { SONGS, renderSong } from './music';
import { CAST, COMBO, SAY, SFX, ULT } from './sounds';
import { SAMPLE_RATE, zzfxSamples, type ZzfxParams } from './zzfx';

let AC: AudioContext | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
export const audio = { muted: false };

export function initAudio(): void {
  if (AC) { if (AC.state === 'suspended') void AC.resume(); return; }
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    AC = new Ctor();
    sfxBus = AC.createGain();
    musicBus = AC.createGain();
    sfxBus.connect(AC.destination);
    musicBus.connect(AC.destination);
    applyVolumes();
    if (wanted) playMusic(wanted, true);
  } catch { AC = null; }
}

function applyVolumes(): void {
  if (sfxBus) sfxBus.gain.value = audio.muted ? 0 : settings.sfx;
  if (musicBus) musicBus.gain.value = audio.muted ? 0 : settings.music * 0.5;
}
onSettingsChange(applyVolumes);
export function setMuted(m: boolean): void { audio.muted = m; applyVolumes(); }

/* ---------- effects ---------- */
const buffers = new Map<ZzfxParams, AudioBuffer>();
const lastAt = new Map<string, number>();

function play(p: ZzfxParams, key: string, minGap: number, rate = 1): void {
  if (!AC || !sfxBus || audio.muted || AC.state !== 'running' || settings.sfx <= 0) return;
  const now = AC.currentTime;
  if (now - (lastAt.get(key) ?? -1) < minGap) return; // hordes: do not stack the same sound
  lastAt.set(key, now);
  try {
    let buf = buffers.get(p);
    if (!buf) {
      const smp = zzfxSamples(p);
      buf = AC.createBuffer(1, smp.length, SAMPLE_RATE);
      buf.getChannelData(0).set(smp);
      buffers.set(p, buf);
    }
    const src = AC.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.connect(sfxBus);
    src.start();
  } catch { /* audio is best-effort */ }
}

const GAP: Partial<Record<SfxKey, number>> = { hit: 0.05, crit: 0.03, coin: 0.035, gem: 0.035, tick: 0.02 };

export function sfx(k: SfxKey): void { play(SFX[k], k, GAP[k] ?? 0.02, k === 'hit' || k === 'gem' ? 0.9 + Math.random() * 0.2 : 1); }
export function castSound(id: SkillId): void { play(CAST[id], 'cast:' + id, 0.08); }
export function comboSound(id: ComboId): void { play(COMBO[id], 'combo:' + id, 0.12); }
export function ultSound(form: string): void { play(ULT[form] ?? SFX.ult, 'ult', 0.3); }
export function saySound(): void { play(SAY, 'say', 0.15); }

/* ---------- music ---------- */
export type MusicId = keyof typeof SONGS;
let wanted: MusicId | null = null;
let current: { id: MusicId; src: AudioBufferSourceNode; gain: GainNode } | null = null;
const rendered = new Map<MusicId, AudioBuffer>();

/** Crossfade to a track (null = silence). Safe to call every frame. */
export function playMusic(id: MusicId | null, force = false): void {
  if (id === wanted && !force) return;
  wanted = id;
  if (!AC || !musicBus) return;
  const t = AC.currentTime;
  if (current) {
    const old = current;
    old.gain.gain.setTargetAtTime(0, t, 0.3);
    setTimeout(() => { try { old.src.stop(); } catch { /* already stopped */ } }, 1500);
    current = null;
  }
  if (!id) return;
  try {
    let buf = rendered.get(id);
    if (!buf) {
      const smp = renderSong(SONGS[id]);
      buf = AC.createBuffer(1, smp.length, SAMPLE_RATE);
      buf.getChannelData(0).set(smp);
      rendered.set(id, buf);
    }
    const src = AC.createBufferSource(), gain = AC.createGain();
    src.buffer = buf;
    src.loop = true;
    gain.gain.setValueAtTime(0, t);
    gain.gain.setTargetAtTime(1, t, 0.4);
    src.connect(gain); gain.connect(musicBus);
    src.start();
    current = { id, src, gain };
  } catch { /* best-effort */ }
}
