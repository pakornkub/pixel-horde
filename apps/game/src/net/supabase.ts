// Supabase adapter. Loaded lazily so offline play never downloads supabase-js.
import type { SupabaseClient } from '@supabase/supabase-js';
import { BackendError, StatusBox, toBackendError, type Account, type Backend } from './backend';
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
  };
}
