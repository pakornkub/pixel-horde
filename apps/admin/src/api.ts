// Admin data access. Live = Supabase RPCs (every one checks the admin role server-side).
// Demo (?demo) = in-memory fake data so the console can be tried before the backend is live.
import { DEFAULT_CONFIG } from '@pixel-horde/config';

export interface Attention { kind: string; level: 'bad' | 'warn' | 'info'; [k: string]: unknown }
export interface Overview {
  kpi: { playersToday: number; runsToday: number; avgMinutes: number | null; d1: number | null; d7: number | null; errorsToday: number; dbMb: number; users: number };
  configVersion: number;
  season: { id: number; name: string; since: string } | null;
  maintenance: boolean;
  attention: Attention[];
}
export interface AuditRow { id: number; at: string; actor: string; action: string; target: string; detail: unknown }
export interface ConfigRow { version: number; status: string; note: string; at: string; by: string | null; data: Record<string, unknown> }
export interface BoardRow { userId: string; name: string; score: number; chapter: number; hero: string; weapon: string | null; hidden: boolean; banned: boolean; at: string; status: 'verified' | 'pending' | 'suspicious' }
export interface PlayerRow {
  id: string; name: string; role: string; gold: number; linked: boolean; lastSeen: string;
  /** Hidden from leaderboards (still plays). */
  banned: boolean; bannedUntil?: string | null;
  /** Account suspended: no online play, Gold or scores. */
  suspended?: boolean; suspendedUntil?: string | null;
}
export interface Announcement { id?: number; title_th: string; title_en: string; body_th: string; body_en: string; starts_at?: string; ends_at?: string | null }
export interface DailyRow { day: string; v: number; metric: string; key: string; value: number }
export interface SurvivalRow { chapter: number; reached: number; runs: number }
export interface Stats { daily: DailyRow[]; survivalA: SurvivalRow[]; survivalB: SurvivalRow[]; errors: { message: string; stack: string; count: number; last: string; build: number | null }[] }

export interface AiMsg { role: 'user' | 'model'; text: string }
export interface AiChange { path: string; value: number; why: string }
export interface AiAnswer { reply: string; changes: AiChange[]; model?: string; version?: number }

export interface SeasonReward { userId: string; name: string; kind: 'title' | 'badge'; reward: string; rank: number | null; board: string }
export interface SeasonPreview { season: number; pendingCoop: number; rewards: SeasonReward[] }

export type FeedbackStatus = 'new' | 'read' | 'done';
export type FeedbackCategory = 'bug' | 'balance' | 'idea' | 'other';
export interface FeedbackRow { id: number; userId: string | null; name: string | null; category: FeedbackCategory; message: string; context: Record<string, string>; status: FeedbackStatus; at: string }

export interface AdminApi {
  mode: 'live' | 'demo';
  whoami(): Promise<{ email: string; isAdmin: boolean } | null>;
  signInGoogle(): Promise<void>;
  signInEmail(email: string): Promise<void>;
  signOut(): Promise<void>;
  overview(): Promise<Overview>;
  audit(limit?: number): Promise<AuditRow[]>;
  configs(): Promise<ConfigRow[]>;
  publishConfig(data: unknown, note: string): Promise<number>;
  rollbackConfig(version: number): Promise<number>;
  flags(): Promise<Record<string, unknown>>;
  setFlag(key: string, value: unknown): Promise<void>;
  announcements(): Promise<Announcement[]>;
  upsertAnnouncement(a: Announcement): Promise<number>;
  deleteAnnouncement(id: number): Promise<void>;
  leaderboard(board: string): Promise<BoardRow[]>;
  hideScore(userId: string, board: string, hidden: boolean): Promise<void>;
  banPlayer(userId: string, until: string | null): Promise<void>;
  suspendPlayer(userId: string, until: string | null): Promise<void>;
  verifyCoop(userId: string): Promise<void>;
  seasonPreview(): Promise<SeasonPreview>;
  openSeason(name: string): Promise<number>;
  players(search: string): Promise<PlayerRow[]>;
  stats(days: number, a?: number | null, b?: number | null): Promise<Stats>;
  /** Player feedback from the game's Feedback button, newest first. */
  feedback(status: FeedbackStatus | '', category: FeedbackCategory | ''): Promise<FeedbackRow[]>;
  setFeedbackStatus(id: number, status: FeedbackStatus): Promise<void>;
  /** Balance AI (Supabase Edge Function `balance-ai`, Gemini): proposes changes, never publishes. */
  askAi(messages: AiMsg[], fields: [string, string, number, number, number][]): Promise<AiAnswer>;
}

const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'https://jqvgmkhzdhjreikjqhxt.supabase.co';
const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_g90qGZet0U9BylLeZrPnNQ_iYjBfDPA';
export const GAME_URL: string = import.meta.env.VITE_GAME_URL ?? (location.hostname === 'localhost' ? 'http://localhost:5173' : 'https://pixel-horde.pages.dev');

async function liveApi(): Promise<AdminApi> {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, storageKey: 'pixelhorde-admin-auth' } });
  const rpc = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data as T;
  };
  const here = location.origin + location.pathname;
  return {
    mode: 'live',
    async whoami() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      if (!u) return null;
      const { data: p } = await sb.from('profiles').select('role').eq('id', u.id).maybeSingle();
      return { email: u.email || u.id, isAdmin: p?.role === 'admin' };
    },
    async signInGoogle() { await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: here } }); },
    async signInEmail(email) { const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: here, shouldCreateUser: false } }); if (error) throw new Error(error.message); },
    async signOut() { await sb.auth.signOut(); },
    overview: () => rpc('admin_overview'),
    audit: (limit = 200) => rpc('admin_audit', { p_limit: limit }),
    configs: () => rpc('admin_configs'),
    publishConfig: (data, note) => rpc('publish_config', { p_data: data, p_note: note }),
    rollbackConfig: (version) => rpc('rollback_config', { p_version: version }),
    async flags() { const s = await rpc<{ flags: Record<string, unknown> }>('get_live_state'); return s.flags; },
    setFlag: (key, value) => rpc('set_flag', { p_key: key, p_value: value }),
    announcements: () => rpc('admin_announcements'),
    upsertAnnouncement: (a) => rpc('upsert_announcement', { p: a }),
    deleteAnnouncement: (id) => rpc('delete_announcement', { p_id: id }),
    leaderboard: (board) => rpc('admin_leaderboard', { p_board: board }),
    hideScore: (userId, board, hidden) => rpc('hide_score', { p_user: userId, p_board: board, p_hidden: hidden }),
    banPlayer: (userId, until) => rpc('ban_player', { p_user: userId, p_until: until }),
    suspendPlayer: (userId, until) => rpc('suspend_player', { p_user: userId, p_until: until }),
    verifyCoop: (userId) => rpc('verify_coop', { p_user: userId }),
    seasonPreview: () => rpc('admin_season_rewards_preview'),
    openSeason: (name) => rpc('admin_open_season', { p_name: name }),
    players: (search) => rpc('admin_players', { p_search: search }),
    stats: (days, a, b) => rpc('admin_stats', { p_days: days, p_version_a: a ?? null, p_version_b: b ?? null }),
    feedback: (status, category) => rpc('admin_feedback', { p_status: status, p_category: category }),
    setFeedbackStatus: (id, status) => rpc('set_feedback_status', { p_id: id, p_status: status }),
    async askAi(messages, fields) {
      const { data, error } = await sb.functions.invoke('balance-ai', { body: { messages, fields } });
      if (error) {
        let msg = error.message;
        try { const b = await (error as { context?: Response }).context?.json(); if (b?.error) msg = b.error; } catch { /* keep the generic message */ }
        throw new Error(msg);
      }
      return data as AiAnswer;
    },
  };
}

/* ---------------- demo ---------------- */
function demoApi(): AdminApi {
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  const now = (): string => new Date().toISOString();
  const v1 = clone(DEFAULT_CONFIG) as unknown as Record<string, unknown>;
  const v2 = clone(v1) as { shared: { stage: { durBase: number } } };
  v2.shared.stage.durBase = 55;
  const configs: ConfigRow[] = [
    { version: 2, status: 'published', note: 'สั้นลงเล็กน้อยหลังเห็นคนเบื่อด่าน 1', at: now(), by: 'Owner', data: { ...(v2 as object), version: 2 } },
    { version: 1, status: 'published', note: 'ค่าเริ่มต้นเปิดเกม', at: now(), by: 'Owner', data: { ...v1, version: 1 } },
    { version: 0, status: 'published', note: 'built-in defaults', at: now(), by: null, data: { ...v1, version: 0 } },
  ];
  const flags: Record<string, unknown> = { coop: true, scoreSubmit: true, bloodMoon: true, dragon: true, rival: true, maintenance: false, minClientBuild: 0 };
  const audit: AuditRow[] = [{ id: 1, at: now(), actor: 'Owner', action: 'insert', target: 'balance_configs', detail: { new: { version: 2 } } }];
  const note = (action: string, target: string, detail: unknown): void => { audit.unshift({ id: audit.length + 1, at: now(), actor: 'Owner (demo)', action, target, detail }); };
  const names = ['KitMain', 'lyra_th', 'speedyyy', 'bramfan', 'ด.ช.มอนเยอะ', 'Pim', 'Hero#4821'];
  const board: BoardRow[] = names.map((n, i) => ({ userId: 'u' + i, name: n, score: 80900 - i * 7000, chapter: 8 - (i >> 1), hero: ['kit', 'lyra', 'bram', 'vex'][i % 4], weapon: null, hidden: false, banned: false, at: now(), status: i === 2 ? 'suspicious' : i === 3 ? 'pending' : 'verified' }));
  let season = 1;
  const players: PlayerRow[] = names.map((n, i) => ({ id: 'u' + i, name: n, role: 'player', gold: i === 2 ? 98000 : 3000 - i * 300, linked: i % 2 === 0, banned: false, suspended: false, lastSeen: now() }));
  const fb: FeedbackRow[] = [
    { id: 3, userId: 'u5', name: 'Pim', category: 'bug', message: 'บอสตายแล้วค้าง คับ', context: { build: '202609261200', device: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', screen: '390x844@3', lang: 'th', chapter: '3', hero: 'alchemist', realm: 'deepdark', mode: 'solo', phase: 'overtime' }, status: 'new', at: now() },
    { id: 2, userId: 'u1', name: 'lyra_th', category: 'balance', message: 'ปรับตัว vex ปาขวด เท่าที่เล่นคือปามัว ทำให้เล่นยาก และเวลามีบอสปาโดนบอสน้อยมาก', context: { build: '202609261200', device: 'Android 15; Pixel 8', screen: '412x915@2.63', lang: 'th' }, status: 'read', at: now() },
    { id: 1, userId: 'u0', name: 'KitMain', category: 'idea', message: 'อยากให้มีโหมดฝึกสกิล', context: { build: '202609251200', device: 'Windows NT 10.0', screen: '1920x1080@1', lang: 'th' }, status: 'done', at: now() },
  ];
  let ann: Announcement[] = [{ id: 1, title_th: 'Blood Moon สุดสัปดาห์', title_en: 'Blood Moon weekend', body_th: 'เหรียญ ×2', body_en: 'Gold ×2', starts_at: now(), ends_at: null }];
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10));
  const daily: DailyRow[] = days.flatMap((d, i) => [
    { day: d, v: 2, metric: 'players', key: '', value: 800 + i * 20 + (i % 7) * 30 },
    { day: d, v: 2, metric: 'runs', key: '', value: 2500 + i * 50 },
    { day: d, v: 2, metric: 'play_seconds', key: '', value: (2500 + i * 50) * 900 },
    ...['bolt', 'orbit', 'chain', 'nova', 'meteor', 'frost', 'lance', 'hole'].flatMap((s, j) => [
      { day: d, v: 2, metric: 'skill_picked', key: s, value: 300 + j * 40 },
      { day: d, v: 2, metric: 'skill_reach6', key: s, value: (300 + j * 40) * (s === 'hole' ? 0.6 : s === 'orbit' ? 0.2 : 0.4) },
      { day: d, v: 2, metric: 'skill_level_sum', key: s, value: (300 + j * 40) * 4 },
    ]),
    ...[0, 1, 2, 3].map((b) => ({ day: d, v: 2, metric: 'fps_bucket', key: String(b + 1), value: [20, 60, 200, 2400][b] })),
  ]);
  const surv = (k: number): SurvivalRow[] => [100, 96, 88, 72, 49, 33, 21, 12].map((r, i) => ({ chapter: i + 1, reached: Math.max(0, r + k * i), runs: 3000 }));
  return {
    mode: 'demo',
    whoami: async () => ({ email: 'demo@pixel-horde', isAdmin: true }),
    signInGoogle: async () => undefined, signInEmail: async () => undefined, signOut: async () => undefined,
    overview: async () => ({
      kpi: { playersToday: 1284, runsToday: 3912, avgMinutes: 17.4, d1: 38, d7: 12, errorsToday: 23, dbMb: 212, users: 5402 },
      configVersion: configs[0].version, season: { id: 1, name: 'Season 1', since: now() }, maintenance: flags.maintenance === true,
      attention: [
        { kind: 'dropoff', level: 'bad', chapter: 4, drop: 23, avg: 12.6 },
        { kind: 'suspicious', level: 'warn', userId: 'u2', name: 'speedyyy', reason: 'TOO_FAST', runId: 'r' },
        { kind: 'error', level: 'bad', message: 'TypeError: e.st is undefined', count: 64, new: true },
        { kind: 'gold', level: 'warn', userId: 'u2', name: 'speedyyy', gold: 98000 },
        { kind: 'coop_review', level: 'info', count: 1 },
      ],
    }),
    audit: async () => clone(audit),
    configs: async () => clone(configs),
    async publishConfig(data, n) { const v = configs[0].version + 1; configs.unshift({ version: v, status: 'published', note: n, at: now(), by: 'Owner (demo)', data: { ...(data as object), version: v } }); note('insert', 'balance_configs', { version: v, note: n }); return v; },
    async rollbackConfig(version) { const src = configs.find((c) => c.version === version)!; return this.publishConfig(clone(src.data), 'rollback to v' + version); },
    flags: async () => clone(flags),
    async setFlag(k, v) { note('update', 'feature_flags', { old: { key: k, value: flags[k] }, new: { key: k, value: v } }); flags[k] = v; },
    announcements: async () => clone(ann),
    async upsertAnnouncement(a) { if (a.id) ann = ann.map((x) => (x.id === a.id ? { ...x, ...a } : x)); else ann.unshift({ ...a, id: ann.length + 10 }); note(a.id ? 'update' : 'insert', 'announcements', a); return a.id ?? ann[0].id!; },
    async deleteAnnouncement(id) { ann = ann.filter((a) => a.id !== id); note('delete', 'announcements', { id }); },
    leaderboard: async () => clone(board),
    async hideScore(u, b, h) { const r = board.find((x) => x.userId === u); if (r) r.hidden = h; note('update', 'leaderboard', { user: u, board: b, hidden: h }); },
    async suspendPlayer(u, until) { const p = players.find((x) => x.id === u); if (p) { p.suspended = !!until; p.suspendedUntil = until; } note('update', 'profiles', { user: u, suspended_until: until }); },
    async banPlayer(u, until) { const p = players.find((x) => x.id === u); if (p) p.banned = !!until; const r = board.find((x) => x.userId === u); if (r) r.banned = !!until; note('update', 'profiles', { user: u, banned_until: until }); },
    async verifyCoop(u) { const r = board.find((x) => x.userId === u); if (r) r.status = 'verified'; note('verify', 'leaderboard', { user: u }); },
    async seasonPreview() {
      const top = board.filter((r) => r.status === 'verified' && !r.hidden).slice(0, 12);
      return { season, pendingCoop: board.filter((r) => r.status === 'pending').length, rewards: top.flatMap((r, i) => i === 0
        ? [{ userId: r.userId, name: r.name, kind: 'title' as const, reward: `Season ${season} Champion`, rank: 1, board: 'solo' }, { userId: r.userId, name: r.name, kind: 'badge' as const, reward: 'gold_frame', rank: 1, board: 'solo' }]
        : [{ userId: r.userId, name: r.name, kind: 'badge' as const, reward: i < 10 ? 'champion' : 'top100', rank: i + 1, board: 'solo' }]) };
    },
    async openSeason(name) { note('open_season', 'seasons', { closed: season, name }); season++; return season; },
    feedback: async (st, c) => clone(fb.filter((f) => (!st || f.status === st) && (!c || f.category === c))),
    async setFeedbackStatus(id, st) { const f = fb.find((x) => x.id === id); if (f) f.status = st; },
    players: async (q) => clone(players.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))),
    askAi: async (msgs) => ({
      reply: `(โหมดตัวอย่าง) รับคำขอ "${msgs[msgs.length - 1]?.text ?? ''}" แล้ว ตัวอย่างข้อเสนอ: ให้ท่าใหญ่ของบอสช่วง overtime ไม่ถี่ขึ้น และแรงขึ้นน้อยลง`,
      changes: [
        { path: 'shared.kings.overtimeUltMul', value: 1, why: 'ท่าใหญ่ช่วง overtime ทุก 10 วินาทีเท่าช่วงปกติ (0.5 → 1)' },
        { path: 'shared.stage.enrageDmg', value: 1.15, why: 'ดาเมจบอสช่วง overtime ×1.3 → ×1.15' },
      ],
      model: 'demo',
    }),
    stats: async (_d, _a, b) => ({ daily, survivalA: surv(0), survivalB: b == null ? [] : surv(-1.5), errors: [{ message: 'TypeError: e.st is undefined', stack: 'at dragonAI (events.ts:88)', count: 64, last: now(), build: 202609251200 }, { message: 'AudioContext was not allowed to start', stack: '', count: 12, last: now(), build: 202609251200 }] }),
  };
}

export const isDemo = new URLSearchParams(location.search).has('demo');
export const apiPromise: Promise<AdminApi> = isDemo ? Promise.resolve(demoApi()) : liveApi();
