import { describe, expect, it } from 'vitest';
import { toBackendError } from './backend';
import { nicknameProblem } from './nickname';
import { createOfflineBackend, type KeyValue } from './offline';

const memStore = (): KeyValue => { const m = new Map<string, string>(); return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) }; };

describe('offline backend', () => {
  it('creates a local account with the chosen nickname and keeps it', async () => {
    const store = memStore();
    const a = await createOfflineBackend(store).start({ nickname: 'Pim' });
    expect(a.nickname).toBe('Pim');
    const again = await createOfflineBackend(store).start({});
    expect(again.id).toBe(a.id);
  });
  it('skipping gives Hero#1234 and rude names are rejected', async () => {
    const b = createOfflineBackend(memStore());
    expect((await b.start({})).nickname).toMatch(/^Hero#\d{4}$/);
    await expect(b.setNickname('sh1t')).rejects.toMatchObject({ code: 'NICKNAME_REJECTED' });
    expect((await b.setNickname('นักล่า')).nickname).toBe('นักล่า');
    expect(b.status()).toBe('offline');
    expect(await b.checkSession()).toBe(true);
  });
});

describe('server errors', () => {
  it('maps messages to codes', () => {
    expect(toBackendError({ message: 'SESSION_REPLACED' }).code).toBe('SESSION_REPLACED');
    expect(toBackendError(new TypeError('Failed to fetch')).code).toBe('OFFLINE');
    expect(toBackendError('weird').code).toBe('UNKNOWN');
  });
});

describe('nickname rules (client copy)', () => {
  it('flags length, characters and rude words', () => {
    expect(nicknameProblem('A')).toBe('length');
    expect(nicknameProblem('bad<script>')).toBe('chars');
    expect(nicknameProblem('F.u.c.k')).toBe('rude');
    expect(nicknameProblem('Grape Scholar')).toBeNull();
    expect(nicknameProblem('ผู้กล้า_01')).toBeNull();
  });
});
