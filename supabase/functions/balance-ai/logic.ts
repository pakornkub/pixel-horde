// Pure helpers for the Balance AI function (no Deno / network here, so Vitest can test them).

/** [path, description, min, max, default] for every tunable number, sent by the Admin Console. */
export type Field = [string, string, number, number, number?];
export interface ChatMsg { role: 'user' | 'model'; text: string }
export interface Change { path: string; value: number; why: string }
export interface Proposal { reply: string; changes: Change[] }

export const MAX_CHANGES = 12;

const get = (o: unknown, path: string): unknown => path.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown> | undefined)?.[k], o);

/** System instruction: role, rules, the answer format, then the field catalog with live values. */
export function systemPrompt(fields: Field[], config: Record<string, unknown>, version: number, stats: string): string {
  const lines = fields.map(([p, d, lo, hi, def]) => {
    const v = get(config, p);
    return `${p} = ${typeof v === 'number' ? v : def ?? '?'} | ${lo}..${hi} | ${d}`;
  });
  return [
    'You are the balance assistant of "Pixel Horde", a retro top-down survivor game (8 Chapters, a King boss each Chapter, overtime if the King is alive when the timer ends).',
    'The game owner (Thai) tells you what feels wrong. Propose the SMALLEST set of Balance Config changes that addresses it.',
    'Rules:',
    '- Only use paths listed below, exactly as written. Stay inside each min..max range.',
    `- At most ${MAX_CHANGES} changes. Prefer 1-4. Never change values the owner did not ask about unless clearly needed.`,
    '- If the request is a question, answer it and return no changes.',
    '- Write "reply" and every "why" in Thai, plain and short, with the numbers before → after.',
    '- The owner reviews and publishes the changes; you never publish anything.',
    'Answer ONLY with JSON: {"reply": string, "changes": [{"path": string, "value": number, "why": string}]}',
    '',
    `Currently published config: v${version}.`,
    stats ? `Recent player statistics:\n${stats}` : 'No player statistics yet.',
    '',
    'Fields (path = current | min..max | description):',
    ...lines,
  ].join('\n');
}

/** Parse the model's JSON and keep only valid changes (known path, finite number in range, actually different). */
export function parseProposal(text: string, fields: Field[], config: Record<string, unknown>): Proposal {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, ''));
  } catch {
    return { reply: text.trim() || '(no answer)', changes: [] };
  }
  const o = (raw ?? {}) as { reply?: unknown; changes?: unknown };
  const known = new Map(fields.map((f) => [f[0], f]));
  const changes: Change[] = [];
  for (const c of Array.isArray(o.changes) ? o.changes : []) {
    const { path, value, why } = (c ?? {}) as Record<string, unknown>;
    const f = typeof path === 'string' ? known.get(path) : undefined;
    const v = typeof value === 'string' ? Number(value) : value;
    if (!f || typeof v !== 'number' || !Number.isFinite(v) || v < f[2] || v > f[3]) continue;
    if ((get(config, f[0]) ?? f[4]) === v || changes.some((x) => x.path === f[0])) continue;
    changes.push({ path: f[0], value: v, why: typeof why === 'string' ? why.slice(0, 400) : '' });
    if (changes.length >= MAX_CHANGES) break;
  }
  return { reply: typeof o.reply === 'string' ? o.reply.slice(0, 4000) : '', changes };
}

/** Last N turns only, trimmed, alternating roles as Gemini expects. */
export function toContents(msgs: ChatMsg[]): { role: 'user' | 'model'; parts: { text: string }[] }[] {
  return msgs.slice(-12)
    .filter((m) => (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text.trim())
    .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, 4000) }] }));
}

/** Survival and deaths per Chapter from admin_stats, as a few short lines. */
export function statsSummary(stats: { daily?: { metric: string; key: string; value: number }[]; survivalA?: { chapter: number; reached: number; runs: number }[] } | null): string {
  if (!stats) return '';
  const out: string[] = [];
  const sv = stats.survivalA ?? [];
  if (sv.length) out.push('Share of runs reaching each Chapter (last 14 days): ' + sv.map((r) => `Ch${r.chapter} ${r.reached}%`).join(', ') + ` (${sv[0].runs} runs)`);
  const deaths = new Map<string, number>();
  for (const d of stats.daily ?? []) if (d.metric === 'deaths_by_chapter') deaths.set(d.key, (deaths.get(d.key) ?? 0) + Number(d.value));
  if (deaths.size) out.push('Deaths by Chapter: ' + [...deaths].sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, n]) => `Ch${k} ${n}`).join(', '));
  return out.join('\n');
}
