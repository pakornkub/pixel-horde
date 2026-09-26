// Supabase adapter. Loaded lazily so offline play never downloads supabase-js.
import type { SupabaseClient } from '@supabase/supabase-js';
import { BackendError, StatusBox, toBackendError, type Account, type Backend, type BoardView, type LiveState, type RunTicket, type Collection, type ServerCheckpoint, type ServerMeta, type SubmitOutcome, type UpdateNote } from './backend';
import { SUPABASE_KEY, SUPABASE_URL, TURNSTILE_SITE_KEY } from './config';
import { createOfflineBackend } from './offline';
import { getCaptchaToken } from './turnstile';
import { nextLinkStep, oauthParams, type LinkState } from './link';

const K_LINK = 'pixelhorde-link';
const readLink = (): LinkState | null => { try { return JSON.parse(localStorage.getItem(K_LINK) || 'null'); } catch { return null; } };
const writeLink = (s: LinkState | null): void => { try { if (s) localStorage.setItem(K_LINK, JSON.stringify(s)); else localStorage.removeItem(K_LINK); } catch { /* ignore */ } };
const here = (): string => location.origin + location.pathname;

interface ProfileRow { id: string; nickname: string; role: 'player' | 'admin'; suspended_until?: string | null }
const isSuspended = (a: Account | null): boolean => !!a?.suspendedUntil && Date.parse(a.suspendedUntil) > Date.now();

export function createSupabaseBackend(): Backend {
  const status = new StatusBox();
  const offline = createOfflineBackend();
  let sb: SupabaseClient | null = null;
  let acc: Account | null = null;
  let linkOutcome: string | null = null;

  const client = async (): Promise<SupabaseClient> => {
    if (sb) return sb;
    const { createClient } = await import('@supabase/supabase-js');
    sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'pixelhorde-auth' } });
    return sb;
  };
  const toAccount = (p: ProfileRow, anonymous: boolean): Account => ({ id: p.id, nickname: p.nickname, anonymous, role: p.role, suspendedUntil: p.suspended_until ?? null });

  async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const c = await client();
    const { data, error } = await c.rpc(fn, args);
    if (error) {
      const e = toBackendError(error);
      if (e.code === 'SESSION_REPLACED') status.set('replaced');
      if (e.code === 'ACCOUNT_SUSPENDED') {
        const until = (error as { hint?: string }).hint;
        if (acc && until) acc = { ...acc, suspendedUntil: until };
        status.set('suspended');
      }
      throw e;
    }
    return data as T;
  }

  const online = (): void => {
    const st = status.get();
    if (st !== 'online') throw new BackendError(st === 'replaced' ? 'SESSION_REPLACED' : st === 'suspended' ? 'ACCOUNT_SUSPENDED' : 'OFFLINE');
  };

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
        // Returning from Google: finish linking / merging before anything else.
        const step = nextLinkStep(oauthParams(location), readLink(), Date.now(), !!session);
        if (step.do === 'signInGoogle') {
          writeLink(step.state);
          await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: here() } });
          return new Promise<Account>(() => undefined); // navigating away
        }
        const row = await rpc<ProfileRow>('claim_session');
        acc = toAccount(row, !!session?.user.is_anonymous);
        if (step.do === 'merge') {
          try { await rpc('merge_accounts', { p_ticket: step.ticket }); linkOutcome = 'merged'; } catch (e) { linkOutcome = 'failed:' + toBackendError(e).code; }
          writeLink(null);
        } else if (step.do === 'clear') { if (readLink()) linkOutcome = acc.anonymous ? null : 'linked'; writeLink(null); }
        else if (step.do === 'failed') { linkOutcome = 'failed:' + step.reason; writeLink(null); }
        if (linkOutcome) history.replaceState(null, '', here());
        status.set(isSuspended(acc) ? 'suspended' : 'online');
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
        if (e instanceof BackendError && (e.code === 'SESSION_REPLACED' || e.code === 'ACCOUNT_SUSPENDED')) return false;
        return true; // network hiccup: do not interrupt play
      }
    },
    async reclaim() {
      const row = await rpc<ProfileRow>('claim_session');
      acc = toAccount(row, acc?.anonymous ?? true);
      status.set(isSuspended(acc) ? 'suspended' : 'online');
    },
    async getMeta() { online(); return rpc<ServerMeta>('get_meta'); },
    async startRun(hero, mode = 'solo', weapon = 'judgement') {
      if (status.get() !== 'online') return null;
      try {
        const t = await rpc<{ runId: string; token: string; seed: number; configVersion: number }>('start_run', { p_hero: hero, p_mode: mode, p_weapon: weapon });
        return { runId: t.runId, token: t.token, seed: Number(t.seed) >>> 0, configVersion: t.configVersion } satisfies RunTicket;
      } catch (e) {
        if (e instanceof BackendError && e.code === 'SESSION_REPLACED') throw e;
        return null; // rate limit / network: play now, submit as an offline Run later
      }
    },
    async submitRun(ticket, r) {
      online();
      return rpc<SubmitOutcome>('submit_run', { p: { runId: ticket.runId, token: ticket.token, result: r.result, chapter: r.chapter, kills: r.kills, level: r.level, gold: r.gold, walletSpent: r.walletSpent ?? 0, weaponsFound: r.weaponsFound ?? [], endlessScore: r.endlessScore ?? 0, victory: !!r.victory, crack: r.crack ?? 0, facts: r.facts ?? {}, score: r.score, pausedMs: r.pausedMs, ...(r.resumedHash ? { resumedHash: r.resumedHash } : {}), ...(r.joinChapter ? { joinChapter: r.joinChapter, team: r.team ?? 1 } : {}), summary: r.summary ?? {} } });
    },
    async submitOfflineRun(r) { online(); return rpc<SubmitOutcome>('submit_offline_run', { p: r }); },
    async saveCheckpoint(p) { try { online(); await rpc('save_checkpoint', { p }); return true; } catch { return false; } },
    async getCheckpoint() { online(); return rpc<ServerCheckpoint | null>('get_checkpoint'); },
    async getCollection() { online(); return rpc<Collection | null>('get_collection'); },
    async setTitle(title) { online(); await rpc('set_title', { p_title: title }); },
    async setTips(tips) { online(); return rpc<string[]>('set_tips', { p_tips: tips }); },
    async sendFeedback(f) { online(); await rpc('submit_feedback', { p_category: f.category, p_message: f.message, p_context: f.context }); },
    async resumeRun(runId, hash) { online(); return rpc<{ ok: boolean; seasonChanged: boolean }>('resume_run', { p_run: runId, p_hash: hash }); },
    async buyUpgrade(item) { online(); return rpc<ServerMeta>('buy_upgrade', { p_item: item }); },
    async unlockHero(hero) { online(); return rpc<ServerMeta>('unlock_hero', { p_hero: hero }); },
    async importLegacy(save) { online(); return rpc<ServerMeta>('import_legacy_meta', { p: save }); },
    async getLeaderboard(board, hero) { online(); return rpc<BoardView>('get_leaderboard', { p_board: board, p_hero: hero ?? null }); },
    async getLive() { return rpc<LiveState>('get_live_state'); },
    async getConfig(version) { return rpc<{ version: number; data: unknown } | null>('get_config', { p_version: version }); },
    async latestUpdate() { return (await rpc<UpdateNote[] | null>('get_changelog', { p_limit: 1 }))?.[0] ?? null; },
    async linkGoogle() {
      online();
      if (!acc?.anonymous) return;
      const ticket = await rpc<string>('create_merge_ticket');
      writeLink({ ticket, phase: 'linking', at: Date.now() });
      const c = await client();
      const { error } = await c.auth.linkIdentity({ provider: 'google', options: { redirectTo: here() } });
      if (error) { writeLink(null); throw toBackendError(error); }
    },
    linkResult: () => linkOutcome,
    async report(fn, payload, keepalive = false) {
      // Plain fetch so it can use keepalive (sendBeacon cannot send the apikey header / JSON).
      try {
        const token = sb ? (await sb.auth.getSession()).data.session?.access_token : undefined;
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
          method: 'POST', keepalive,
          headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
          body: JSON.stringify({ p: payload }),
        });
        return r.ok;
      } catch { return false; }
    },
  };
}
