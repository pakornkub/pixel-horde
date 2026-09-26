// The website's only backend calls: public, read-only RPCs (anon key). The site stays readable offline:
// every caller has a fallback (built-in defaults, or an error line).
import { DEFAULT_RESOLVED, parseBalanceConfig, resolveConfig, type ResolvedConfig } from '@pixel-horde/config';

const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'https://jqvgmkhzdhjreikjqhxt.supabase.co';
const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_g90qGZet0U9BylLeZrPnNQ_iYjBfDPA';
// Same key and shape ({version, data}) the game caches its config under; site and game share one origin.
const K_CONFIG = 'pixelhorde-config';
const CONFIG_WAIT_MS = 2500;

export async function rpc<T>(fn: string, body: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok) throw new Error(`${fn}: ${r.status}`);
  return (await r.json()) as T;
}

type StoredConfig = { version: number; data: unknown };

function toResolved(c: StoredConfig | null | undefined): ResolvedConfig | null {
  if (!c || typeof c.version !== 'number' || c.version < 1) return null;
  try { return resolveConfig({ ...parseBalanceConfig(c.data), version: c.version }); } catch { return null; }
}

function cached(): ResolvedConfig | null {
  try { return toResolved(JSON.parse(localStorage.getItem(K_CONFIG) ?? 'null') as StoredConfig | null); } catch { return null; }
}

let pending: Promise<ResolvedConfig> | null = null;

/**
 * The Balance Config players get right now (published from Admin), so the site's numbers match the game.
 * Falls back to the last cached copy, then to the built-in defaults, if the backend is slow or unreachable.
 */
export function siteConfig(): Promise<ResolvedConfig> {
  pending ??= (async () => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), CONFIG_WAIT_MS);
    try {
      const c = await rpc<StoredConfig | null>('get_config', {}, ctl.signal);
      const cfg = toResolved(c);
      if (cfg) {
        try { localStorage.setItem(K_CONFIG, JSON.stringify(c)); } catch { /* storage full or blocked */ }
        return cfg;
      }
    } catch { /* offline, blocked or slow */ } finally {
      clearTimeout(timer);
    }
    return cached() ?? DEFAULT_RESOLVED;
  })();
  return pending;
}
