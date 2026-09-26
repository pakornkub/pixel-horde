// The ONLY way the game talks to the backend (CLAUDE.md → Platform notes).
// Adapters: Supabase (online) and Offline (solo play keeps working when the server is down).

export interface Account {
  id: string;
  nickname: string;
  anonymous: boolean;
  role: 'player' | 'admin';
  /** Suspended by an admin until this time (ISO): no online play, Gold or scores until then. */
  suspendedUntil?: string | null;
}

export type BackendStatus = 'online' | 'offline' | 'replaced' | 'suspended';
export type BackendErrorCode =
  | 'SESSION_REPLACED' | 'NICKNAME_REJECTED' | 'NOT_SIGNED_IN' | 'OFFLINE' | 'UNKNOWN'
  | 'NOT_ENOUGH_GOLD' | 'MAXED' | 'HERO_LOCKED' | 'RATE_LIMITED' | 'RUN_ALREADY_SUBMITTED' | 'RUN_NOT_FOUND' | 'MAINTENANCE' | 'ACCOUNT_SUSPENDED' | 'FEEDBACK_LIMIT';

export class BackendError extends Error {
  constructor(public code: BackendErrorCode, message?: string) { super(message || code); }
}

/** Map a server error message/code to our codes. */
export function toBackendError(e: unknown): BackendError {
  if (e instanceof BackendError) return e;
  const msg = String((e as { message?: string })?.message ?? e ?? '');
  for (const code of ['SESSION_REPLACED', 'NICKNAME_REJECTED', 'NOT_SIGNED_IN', 'NOT_ENOUGH_GOLD', 'MAXED', 'HERO_LOCKED', 'RATE_LIMITED', 'RUN_ALREADY_SUBMITTED', 'RUN_NOT_FOUND', 'MAINTENANCE', 'ACCOUNT_SUSPENDED', 'FEEDBACK_LIMIT'] as const) {
    if (msg.includes(code)) return new BackendError(code, msg);
  }
  if (/fetch|network|Failed to|timeout|ECONN|503|502|504/i.test(msg)) return new BackendError('OFFLINE', msg);
  return new BackendError('UNKNOWN', msg);
}

/** Server-owned progression (Gold, Shop levels, unlocks). */
export interface ServerMeta {
  gold: number;
  shop: Record<string, number>;
  heroes: string[];
  weapons: string[];
  stats?: { heartCrack?: number; tips?: string[] };
  legacyImported: boolean;
}

export interface Collection {
  achievements: string[]; titles: string[]; badges: { badge: string; season: number }[];
  shownTitle: string | null; bestiary: Record<string, number>; weapons: string[];
}
export interface CheckpointSave { runId: string; token: string; chapter: number; hash: string; data: string; configVersion: number; quit?: boolean }
export interface ServerCheckpoint {
  runId: string; token: string; seed: number; hero: string; weapon: string | null; chapter: number;
  configVersion: number; hash: string; data: string; savedAt: string; seasonChanged: boolean;
}

/** Issued by start_run: the server picks the seed. */
export interface RunTicket { runId: string; token: string; seed: number; configVersion: number }

export interface RunResult {
  clientRunId: string;
  hero: string;
  mode: 'solo' | 'coop' | 'daily' | 'endless';
  result: 'dead' | 'quit' | 'victory' | 'escape' | 'closed';
  chapter: number;
  kills: number;
  level: number;
  gold: number;
  /** Achievement / bestiary facts (ticket 32). */
  facts?: Record<string, unknown>;
  /** Continued from this checkpoint while offline (the server checks it on submit). */
  resumedHash?: string;
  /** Endless Score (after Umbra), victory and Heart Crack tier. */
  endlessScore?: number;
  victory?: boolean;
  crack?: number;
  /** Weapon used and Weapons found this Run. */
  weapon?: string;
  weaponsFound?: string[];
  /** Gold taken from the wallet during the Run (Stage-end swaps); charged on submit. */
  walletSpent?: number;
  /** Co-op: the Chapter this player joined the room at, and the most players seen (the server's Run checks use both). */
  joinChapter?: number;
  team?: number;
  score: number;
  /** Active play time (sim time). */
  playMs: number;
  /** Wall time the Run was paused (menus, level-up, pause). */
  pausedMs: number;
  configVersion: number;
  summary?: Record<string, unknown>;
}

export interface SubmitOutcome { status: 'submitted' | 'offline' | 'rejected' | 'duplicate'; reason?: string | null; meta: ServerMeta }

export type BoardId = 'solo' | 'coop' | 'endless' | 'alltime';
export interface BoardRow {
  rank: number; userId: string; name: string; title: string | null; score: number; chapter: number;
  hero: string; weapon: string | null; verified: boolean; at: string; me: boolean;
}
export interface BoardView { board: BoardId; season: number; top: BoardRow[]; me: BoardRow | null; around: BoardRow[]; total: number }

export interface Announcement { id: number; title: { th: string; en: string }; body: { th: string; en: string }; endsAt: string | null }
export interface LiveState { flags: Record<string, unknown>; configVersion: number; announcements: Announcement[]; serverTime?: string }
/** The newest public patch note (details are read on the website's updates page). */
export interface UpdateNote { id: number; at: string; titleTh: string; titleEn: string }

export type FeedbackCategory = 'bug' | 'balance' | 'idea' | 'other';
/** A player's feedback message; context = build, device, screen and (from a Run) Chapter / Hero. */
export interface FeedbackInput { category: FeedbackCategory; message: string; context: Record<string, string | number | boolean> }

export interface Backend {
  readonly kind: 'supabase' | 'offline';
  status(): BackendStatus;
  onStatus(fn: (s: BackendStatus) => void): () => void;
  /** Sign in (anonymously on first launch) and claim this device's session. Never throws: falls back to offline. */
  start(opts: { nickname?: string }): Promise<Account>;
  account(): Account | null;
  setNickname(nick: string): Promise<Account>;
  /** false when another device took over the account (status becomes 'replaced'). */
  checkSession(): Promise<boolean>;
  /** "Play here": make this device the active one again. */
  reclaim(): Promise<void>;

  // --- progression (ticket 09); all throw BackendError('OFFLINE') when not online ---
  getMeta(): Promise<ServerMeta>;
  /** null when offline: the Run then uses a local seed and is submitted later as an offline Run. */
  startRun(hero: string, mode?: RunResult['mode'], weapon?: string): Promise<RunTicket | null>;
  submitRun(ticket: RunTicket, r: RunResult): Promise<SubmitOutcome>;
  submitOfflineRun(r: RunResult): Promise<SubmitOutcome>;
  /** Suspend / resume (ticket 31). */
  saveCheckpoint(p: CheckpointSave): Promise<boolean>;
  getCheckpoint(): Promise<ServerCheckpoint | null>;
  resumeRun(runId: string, hash: string): Promise<{ ok: boolean; seasonChanged: boolean }>;
  /** Collection menu (ticket 32). */
  getCollection(): Promise<Collection | null>;
  setTitle(title: string | null): Promise<void>;
  /** Tutorial hints seen by this account (ticket 44); replaces the list. */
  setTips(tips: string[]): Promise<string[]>;
  /** Feedback button (title + Settings); at most 5 per account per day (FEEDBACK_LIMIT). */
  sendFeedback(f: FeedbackInput): Promise<void>;
  buyUpgrade(item: string): Promise<ServerMeta>;
  unlockHero(hero: string): Promise<ServerMeta>;
  importLegacy(save: unknown): Promise<ServerMeta>;
  getLeaderboard(board: BoardId, hero?: string | null): Promise<BoardView>;
  /** Flags + config version + announcements in one cheap REST call (works signed out too). */
  getLive(): Promise<LiveState>;
  getConfig(version: number): Promise<{ version: number; data: unknown } | null>;
  /** Newest public patch note, or null (title screen "new update" notice). */
  latestUpdate(): Promise<UpdateNote | null>;
  /** Fire-and-forget uploads (errors, samples). keepalive=true survives the tab closing. */
  report(fn: 'report_errors' | 'report_telemetry', payload: unknown, keepalive?: boolean): Promise<boolean>;
  /** Start linking Google (redirects away). Only for anonymous online accounts. */
  linkGoogle(): Promise<void>;
  /** After a link/merge round-trip: 'merged' | 'linked' | 'failed:<reason>' | null. */
  linkResult(): string | null;
}

/** Small helper both adapters use for status listeners. */
export class StatusBox {
  private s: BackendStatus = 'offline';
  private fns = new Set<(s: BackendStatus) => void>();
  get(): BackendStatus { return this.s; }
  set(s: BackendStatus): void { if (s !== this.s) { this.s = s; for (const f of this.fns) f(s); } }
  on(fn: (s: BackendStatus) => void): () => void { this.fns.add(fn); return () => this.fns.delete(fn); }
}
