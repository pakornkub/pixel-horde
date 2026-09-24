// Google linking state machine (ticket 11). Pure, so it is unit-tested; the adapter does the I/O.
//   idle → (link clicked) linking → back from Google:
//     ok                         → done (same account, now permanent)
//     identity_already_exists    → signing-in (sign in with that Google account)
//   signing-in → back with a session → merge (merge_accounts(ticket)) → done

export interface LinkState { ticket: string; phase: 'linking' | 'signing-in'; at: number }
export type LinkAction =
  | { do: 'nothing' }
  | { do: 'clear' }
  | { do: 'signInGoogle'; state: LinkState }
  | { do: 'merge'; ticket: string }
  | { do: 'failed'; reason: string };

const MAX_AGE_MS = 30 * 60 * 1000;

/** Decide what to do after the page loads, from the URL's OAuth result and the stored state. */
export function nextLinkStep(params: URLSearchParams, stored: LinkState | null, now: number, hasSession: boolean): LinkAction {
  if (!stored) return { do: 'nothing' };
  if (now - stored.at > MAX_AGE_MS) return { do: 'clear' };
  const code = params.get('error_code') || '';
  const err = params.get('error') || '';
  if (stored.phase === 'linking') {
    if (code === 'identity_already_exists' || /already.*(linked|exists)/i.test(params.get('error_description') || '')) {
      return { do: 'signInGoogle', state: { ...stored, phase: 'signing-in', at: now } };
    }
    if (err || code) return { do: 'failed', reason: code || err };
    return { do: 'clear' }; // linked in place: nothing to merge
  }
  // signing-in
  if (err || code) return { do: 'failed', reason: code || err };
  return hasSession ? { do: 'merge', ticket: stored.ticket } : { do: 'nothing' };
}

/** OAuth results may arrive in the query or the hash. */
export function oauthParams(loc: { search: string; hash: string }): URLSearchParams {
  const p = new URLSearchParams(loc.search);
  new URLSearchParams(loc.hash.replace(/^#/, '')).forEach((v, k) => { if (!p.has(k)) p.set(k, v); });
  return p;
}
