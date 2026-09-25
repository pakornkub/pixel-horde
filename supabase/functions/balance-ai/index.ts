// Balance AI (Admin Console): the owner describes a balance problem in Thai, Gemini proposes
// Balance Config changes. Admin only (admin_configs() refuses anyone else). Nothing is published
// here: the Admin Console shows the proposal and the owner publishes it.
// Secrets: GEMINI_API_KEY (required), GEMINI_MODEL (optional).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseProposal, statsSummary, systemPrompt, toContents, type ChatMsg, type Field } from './logic.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return json({ error: 'GEMINI_API_KEY is not set (Supabase → Edge Functions → Secrets)' }, 500);

  // Act as the caller: the admin RPCs check the role themselves.
  const apikey = Deno.env.get('SUPABASE_ANON_KEY') || req.headers.get('apikey') || '';
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, apikey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const cfgs = await sb.rpc('admin_configs');
  if (cfgs.error) return json({ error: 'NOT_ADMIN' }, 403);
  const pub = (cfgs.data as { version: number; status: string; data: Record<string, unknown> }[]).find((c) => c.status === 'published');
  if (!pub) return json({ error: 'no published config' }, 500);
  const st = await sb.rpc('admin_stats', { p_days: 14, p_version_a: pub.version, p_version_b: null });

  let body: { messages?: ChatMsg[]; fields?: Field[] };
  try { body = await req.json(); } catch { return json({ error: 'bad JSON' }, 400); }
  const fields = Array.isArray(body.fields) ? body.fields.filter((f) => Array.isArray(f) && typeof f[0] === 'string').slice(0, 3000) : [];
  const contents = toContents(Array.isArray(body.messages) ? body.messages : []);
  if (!fields.length || !contents.length || contents[contents.length - 1].role !== 'user') return json({ error: 'need fields and a user message' }, 400);

  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt(fields, pub.data, pub.version, statsSummary(st.data)) }] },
      contents,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
    }),
  });
  if (!r.ok) return json({ error: `Gemini ${r.status}: ${(await r.text()).slice(0, 300)}` }, 502);
  const out = await r.json();
  const text: string = (out?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  return json({ ...parseProposal(text, fields, pub.data), model, version: pub.version });
});
