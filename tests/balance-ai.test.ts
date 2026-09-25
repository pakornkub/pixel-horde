// Balance AI function (supabase/functions/balance-ai): only valid, in-range, real changes survive.
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, listFields } from '@pixel-horde/config';
import { parseProposal, statsSummary, systemPrompt, toContents, type Field } from '../supabase/functions/balance-ai/logic';

const fields: Field[] = listFields().map((f) => [f.path, f.desc, f.min, f.max, f.def]);
const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Record<string, unknown>;

describe('Balance AI proposal parsing', () => {
  it('keeps valid changes and drops unknown paths, out-of-range and unchanged values', () => {
    const text = JSON.stringify({ reply: 'ลดความโหด overtime', changes: [
      { path: 'shared.kings.overtimeUltMul', value: 1, why: '0.5 → 1' },
      { path: 'shared.stage.enrageDmg', value: '1.15', why: 'string number is fine' },
      { path: 'shared.nope', value: 3, why: 'unknown' },
      { path: 'shared.stage.bossAt', value: 5, why: 'out of range' },
      { path: 'shared.stage.durBase', value: 60, why: 'same as now' },
      { path: 'shared.kings.overtimeUltMul', value: 0.8, why: 'duplicate' },
    ] });
    const p = parseProposal(text, fields, cfg);
    expect(p.reply).toBe('ลดความโหด overtime');
    expect(p.changes.map((c) => [c.path, c.value])).toEqual([['shared.kings.overtimeUltMul', 1], ['shared.stage.enrageDmg', 1.15]]);
  });

  it('non-JSON answers become a plain reply without changes', () => {
    expect(parseProposal('sorry', fields, cfg)).toEqual({ reply: 'sorry', changes: [] });
    expect(parseProposal('```json\n{"reply":"ok","changes":[]}\n```', fields, cfg).reply).toBe('ok');
  });

  it('fields missing from an older config compare against their default', () => {
    const old = JSON.parse(JSON.stringify(cfg));
    delete old.shared.loot.shieldDur;
    const p = parseProposal(JSON.stringify({ reply: '', changes: [{ path: 'shared.loot.shieldDur', value: 10 }, { path: 'shared.loot.shieldChance', value: 0.01 }] }), fields, old);
    expect(p.changes.map((c) => c.path)).toEqual(['shared.loot.shieldChance']);
  });

  it('the prompt lists every field with its live value, and history keeps the last turns', () => {
    const s = systemPrompt(fields, cfg, 3, statsSummary({ survivalA: [{ chapter: 1, reached: 100, runs: 20 }, { chapter: 2, reached: 40, runs: 20 }] }));
    expect(s).toContain('shared.stage.bossAt = 0.55 | 0..1');
    expect(s).toContain('Ch2 40%');
    expect(toContents(Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'model' as const : 'user' as const, text: 'm' + i }))).length).toBe(12);
  });
});
