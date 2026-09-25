import { describe, expect, it } from 'vitest';
import { nextLinkStep, oauthParams, type LinkState } from './link';

const now = 1_000_000;
const linking: LinkState = { ticket: 't1', phase: 'linking', at: now - 1000 };
const q = (s: string): URLSearchParams => new URLSearchParams(s);

describe('Google link flow', () => {
  it('does nothing without a pending link', () => {
    expect(nextLinkStep(q(''), null, now, true)).toEqual({ do: 'nothing' });
  });
  it('a clean link needs no merge', () => {
    expect(nextLinkStep(q(''), linking, now, true)).toEqual({ do: 'clear' });
  });
  it('an existing Google save leads to sign-in, then merge with the ticket', () => {
    const a = nextLinkStep(q('error=server_error&error_code=identity_already_exists'), linking, now, true);
    expect(a).toMatchObject({ do: 'signInGoogle', state: { phase: 'signing-in', ticket: 't1' } });
    const state = (a as { state: LinkState }).state;
    expect(nextLinkStep(q(''), state, now + 5000, true)).toEqual({ do: 'merge', ticket: 't1' });
  });
  it('errors and stale state are reported/cleared', () => {
    expect(nextLinkStep(q('error=access_denied'), linking, now, true)).toEqual({ do: 'failed', reason: 'access_denied' });
    expect(nextLinkStep(q(''), { ...linking, at: 0 }, now + 60 * 60 * 1000, true)).toEqual({ do: 'clear' });
  });
  it('reads results from the hash too', () => {
    expect(oauthParams({ search: '?a=1', hash: '#error_code=identity_already_exists' }).get('error_code')).toBe('identity_already_exists');
  });
});
