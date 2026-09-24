// Offline adapter: a local-only account so solo play works with no server.
import { StatusBox, type Account, type Backend } from './backend';
import { defaultNickname, nicknameProblem } from './nickname';
import { BackendError } from './backend';

const KEY = 'pixelhorde-account';

export interface KeyValue { get(k: string): string | null; set(k: string, v: string): void }
export const browserStore: KeyValue = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

const offlineErr = async (): Promise<never> => { throw new BackendError('OFFLINE'); };

export function createOfflineBackend(store: KeyValue = browserStore): Backend {
  const status = new StatusBox();
  let acc: Account | null = null;
  const save = (): void => { if (acc) store.set(KEY, JSON.stringify(acc)); };
  return {
    kind: 'offline',
    status: () => status.get(),
    onStatus: (fn) => status.on(fn),
    async start({ nickname }) {
      try { acc = JSON.parse(store.get(KEY) || 'null'); } catch { acc = null; }
      if (!acc || typeof acc.id !== 'string') {
        const id = 'local-' + (globalThis.crypto?.randomUUID?.() ?? String(Math.random()).slice(2));
        acc = { id, nickname: nickname && !nicknameProblem(nickname) ? nickname.trim() : defaultNickname(), anonymous: true, role: 'player' };
        save();
      }
      status.set('offline');
      return acc;
    },
    account: () => acc,
    async setNickname(nick) {
      if (nicknameProblem(nick)) throw new BackendError('NICKNAME_REJECTED');
      if (!acc) throw new BackendError('NOT_SIGNED_IN');
      acc = { ...acc, nickname: nick.trim() };
      save();
      return acc;
    },
    checkSession: async () => true,
    reclaim: async () => undefined,
    getMeta: offlineErr,
    startRun: async () => null,
    submitRun: offlineErr,
    submitOfflineRun: offlineErr,
    buyUpgrade: offlineErr,
    unlockHero: offlineErr,
    importLegacy: offlineErr,
    getLeaderboard: offlineErr,
    getLive: offlineErr,
    getConfig: offlineErr,
    report: async () => false,
  };
}
