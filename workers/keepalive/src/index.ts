// Daily ping so the Supabase Free project never pauses for inactivity (internal pg_cron jobs
// do not count as activity). Deployed with `npx wrangler deploy` from this folder.
export interface Env { SUPABASE_URL: string; SUPABASE_KEY: string }

async function ping(env: Env): Promise<Response> {
  return fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_live_state`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_KEY, 'content-type': 'application/json' },
    body: '{}',
  });
}

export default {
  async scheduled(_event: unknown, env: Env): Promise<void> {
    const r = await ping(env);
    if (!r.ok) throw new Error(`keep-alive ping failed: ${r.status}`);
  },
  // GET / pings on demand (handy right after deploying).
  async fetch(_req: Request, env: Env): Promise<Response> {
    const r = await ping(env);
    return new Response(r.ok ? 'ok' : 'failed ' + r.status, { status: r.ok ? 200 : 502 });
  },
};
