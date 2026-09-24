// Live state from the server (tickets 12 + 13): feature flags, announcements, maintenance,
// minimum client build and the published Balance Config. Checked at launch, at every Stage
// start and before submitting a score / creating a room. No Realtime subscriptions.
import { DEFAULT_FLAGS, FeatureFlagsSchema, parseBalanceConfig, resolveConfig, type FeatureFlags, type ResolvedConfig } from '@pixel-horde/config';
import { lang } from '@pixel-horde/i18n';
import { active } from './config';
import { backend, type Announcement, type Backend } from './net';
import { browserStore, type KeyValue } from './net/offline';

export const BUILD: number = typeof __BUILD__ === 'number' ? __BUILD__ : 0;
const K_FLAGS = 'pixelhorde-flags', K_CONFIG = 'pixelhorde-config';

export interface LiveHooks {
  onMaintenance(on: boolean): void;
  onTooOld(): void;
  onAnnouncements(list: Announcement[]): void;
  /** A newer Balance Config is ready: the Run in progress applies it at its next Stage start. */
  onConfig(cfg: ResolvedConfig): void;
}

export function createLive(b: Backend, store: KeyValue) {
  let flags: FeatureFlags = DEFAULT_FLAGS;
  try { flags = FeatureFlagsSchema.parse(JSON.parse(store.get(K_FLAGS) || '{}')); } catch { /* defaults */ }

  /** Cached config from an earlier session (validated), else the built-in defaults. */
  function loadCachedConfig(): ResolvedConfig {
    try {
      const c = JSON.parse(store.get(K_CONFIG) || 'null') as { version: number; data: unknown } | null;
      if (c) return resolveConfig({ ...parseBalanceConfig(c.data), version: c.version });
    } catch { /* fall back */ }
    return active.cfg;
  }

  async function refresh(h: LiveHooks): Promise<boolean> {
    let state;
    try { state = await b.getLive(); } catch { return false; } // offline: keep cached flags/config
    try { flags = FeatureFlagsSchema.parse(state.flags ?? {}); } catch { flags = DEFAULT_FLAGS; }
    store.set(K_FLAGS, JSON.stringify(flags));
    h.onAnnouncements(state.announcements || []);
    h.onMaintenance(flags.maintenance);
    if (flags.minClientBuild > BUILD) h.onTooOld();
    if (state.configVersion !== active.cfg.version) {
      try {
        const c = await b.getConfig(state.configVersion);
        if (c) {
          const cfg = resolveConfig({ ...parseBalanceConfig(c.data), version: c.version }); // same zod schema as the server
          store.set(K_CONFIG, JSON.stringify(c));
          active.cfg = cfg;
          h.onConfig(cfg);
        }
      } catch (e) {
        console.warn('[live] config rejected, keeping version', active.cfg.version, e);
      }
    }
    return true;
  }

  return {
    flags: (): FeatureFlags => flags,
    loadCachedConfig,
    refresh,
  };
}

export const live = createLive(backend, browserStore);
active.cfg = live.loadCachedConfig();

export function announcementText(a: Announcement): { title: string; body: string } {
  const l = lang();
  return { title: a.title[l] || a.title.th || a.title.en, body: a.body[l] || a.body.th || a.body.en };
}
