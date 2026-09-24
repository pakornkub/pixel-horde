import { describe, expect, it } from 'vitest';
import { ALL_SKILL_IDS, COMBO_IDS } from '@pixel-horde/sim';
import { SONGS, renderSong } from './music';
import { CAST, COMBO, SFX, ULT } from './sounds';
import { zzfxSamples } from './zzfx';

describe('audio (ZzFX / ZzFXM-style, no files)', () => {
  it('every Skill, Combo and Ultimate form has a sound', () => {
    for (const id of ALL_SKILL_IDS) expect(CAST[id], id).toBeDefined();
    for (const id of COMBO_IDS) expect(COMBO[id], id).toBeDefined();
    for (const f of ['judgement', 'root', 'burn', 'reap', 'freeze']) expect(ULT[f], f).toBeDefined();
  });

  it('sounds render to finite, bounded samples', () => {
    for (const p of [...Object.values(SFX), ...Object.values(CAST), ...Object.values(COMBO), ...Object.values(ULT)]) {
      const s = zzfxSamples(p, () => 0.5);
      expect(s.length).toBeGreaterThan(100);
      expect(s.every((v) => Number.isFinite(v) && Math.abs(v) <= 2)).toBe(true);
    }
  });

  it('title, King and Umbra themes render to loops of a few seconds', () => {
    for (const [id, song] of Object.entries(SONGS)) {
      const smp = renderSong(song);
      expect(smp.length / 44100, id).toBeGreaterThan(2);
      expect(smp.length / 44100, id).toBeLessThan(30);
      let peak = 0; for (const v of smp) peak = Math.max(peak, Math.abs(v));
      expect(peak, id).toBeLessThanOrEqual(0.951);
      expect(smp.some((v) => Math.abs(v) > 0.01), id).toBe(true);
    }
  });
});
