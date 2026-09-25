import type { Backend } from './backend';
import { FORCE_OFFLINE, SUPABASE_KEY, SUPABASE_URL } from './config';
import { createOfflineBackend } from './offline';
import { createSupabaseBackend } from './supabase';

export * from './backend';

/** The game's single backend instance. */
export const backend: Backend = FORCE_OFFLINE || !SUPABASE_URL || !SUPABASE_KEY ? createOfflineBackend() : createSupabaseBackend();
