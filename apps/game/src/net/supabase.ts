// Supabase adapter. Loaded lazily so offline play never downloads supabase-js.
import type { SupabaseClient } from '@supabase/supabase-js';
import { BackendError, StatusBox, toBackendError, type Account, type Backend, type BoardView, type RunTicket, type ServerMeta, type SubmitOutcome } from './backend';
import { SUPABASE_KEY, SUPABASE_URL, TURNSTILE_SITE_KEY } from './config';
import { createOfflineBackend } from './offline';
import { getCaptchaToken } from './turnstile';

interface ProfileRow { id: string; nickname: string; role: 'player' | 'admin' }

export function createSupabaseBackend(): Backend {
  const status = new StatusBox();
  const offline = createOfflineBackend();
  let sb: SupabaseClient | null = null;
  let acc: Account | null = null;

  const client = async (): Promise<SupabaseClient> => {
    if (sb) return sb;
    const { createClient } = await import('@supabase/supabase-js');
    sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pixelhorde-auth' } });
    return sb;
  };
  const toAccount = (p: ProfileRow, anonymous: boolean): Account => ({ id: p.id, nickname: p.nickname, anonymous, role: p.role });

  async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const c = await client();
    const { data, error } = await c.rpc(fn, args);
    if (error) {
      const e = toBackendError(error);
      if (e.code === 'SESSION_REPLACED') status.set('replaced');
      throw e;
    }
    return data as T;
  }

  const online = (): void => { if (status.get() !== 'online') throw new BackendError(status.get() === 'replaced' ? 'SESSION_REPLACED' : 'OFFLINE'); };

  return {
    kind: 'supabase',
    status: () => status.get(),
    onStatus: (fn) => status.on(fn),
    async start({ nickname }) {
      try {
        const c = await client();
        let { data: { session } } = await c.auth.getSession();
        if (!session) {
          const captchaToken = TURNSTILE_SITE_KEY ? await getCaptchaToken(TURNSTILE_SITE_KEY) : undefined;
          const { data, error } = await c.auth.signInAnonymously({ options: { data: nickname ? { nickname } : {}, captchaToken } });
          if (error) throw error;
          session = data.session;
        }
        const row = await rpc<ProfileRow>('claim_session');
        acc = toAccount(row, !!session?.user.is_anonymous);
        status.set('online');
        return acc;
      } catch (e) {
        // Server down, anonymous sign-in disabled, migrations missing…: keep playing offline.
        console.warn('[backend] offline:', toBackendError(e).message);
        acc = await offline.start({ nickname });
        status.set('offline');
        return acc;
      }
    },
    account: () => acc,
    async setNickname(nick) {
      if (status.get() !== 'online') { acc = await offline.setNickname(nick); return acc; }
      const row = await rpc<ProfileRow>('set_nickname', { nick });
      acc = toAccount(row, acc?.anonymous ?? true);
      return acc;
    },
    async checkSession() {
      if (status.get() === 'offline') return true;
      try {
        await rpc<boolean>('check_session');
        status.set('online');
        return true;
      } catch (e) {
        if (e instanceof BackendError && e.code === 'SESSION_REPLACED') return false;
        return true; // network hiccup: do not interrupt play
      }
    },
    async reclaim() {
      const row = await rpc<ProfileRow>('claim_session');
      acc = toAccount(row, acc?.anonymous ?? true);
      status.set('online');
    },
    async getMeta() { online(); return rpc<ServerMeta>('get_meta'); },
    async startRun(hero, mode = 'solo') {
      if (status.get() !== 'online') return null;
      try {
        const t = await rpc<{ runId: string; token: string; seed: number; configVersion: number }>('start_run', { p_hero: hero, p_mode: mode });
        return { runId: t.runId, token: t.token, seed: Number(t.seed) >>> 0, configVersion: t.configVersion } satisfies RunTicket;
      } catch (e) {
        if (e instanceof BackendError && e.code === 'SESSION_REPLACED') throw e;
        return null; // rate limit / network: play now, submit as an offline Run later
      }
    },
    async submitRun(ticket, r) {
      online();
      return rpc<SubmitOutcome>('submit_run', { p: { runId: ticket.runId, token: ticket.token, result: r.result, chapter: r.chapter, kills: r.kills, level: r.level, gold: r.gold, score: r.score, pausedMs: r.pausedMs, summary: r.summary ?? {} } });
    },
    async submitOfflineRun(r) { online(); return rpc<SubmitOutcome>('submit_offline_run', { p: r }); },
    async buyUpgrade(item) { online(); return rpc<ServerMeta>('buy_upgrade', { p_item: item }); },
    async unlockHero(hero) { online(); return rpc<ServerMeta>('unlock_hero', { p_hero: hero }); },
    async importLegacy(save) { online(); return rpc<ServerMeta>('import_legacy_meta', { p: save }); },
    async getLeaderboard(board, hero) { online(); return rpc<BoardView>('get_leaderboard', { p_board: board, p_hero: hero ?? null }); },
  };
}
