// Public client configuration (safe to ship: the publishable key only allows what RLS/RPCs allow).
// Override per environment with VITE_SUPABASE_URL / VITE_SUPABASE_KEY / VITE_TURNSTILE_SITE_KEY.
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'https://jqvgmkhzdhjreikjqhxt.supabase.co';
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_g90qGZet0U9BylLeZrPnNQ_iYjBfDPA';
export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';
/** `?offline` forces the offline adapter (testing, or when the owner pauses online features). */
export const FORCE_OFFLINE = typeof location !== 'undefined' && (new URLSearchParams(location.search).has('offline') || location.hash.includes('draftcfg='));
/** Co-op room server (Cloudflare Worker), e.g. wss://pixel-horde-room.<account>.workers.dev. Empty = co-op not set up.
 *  `?room=ws://localhost:8787` overrides it (local `wrangler dev`). */
export const ROOM_URL: string = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('room')) || (import.meta.env.VITE_ROOM_URL ?? '');
