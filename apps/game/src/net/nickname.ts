// Client-side copy of the server nickname rules (the server re-checks everything).
import list from '../../../../supabase/profanity.json';

const WORDS: string[] = list.words;

export function normalizeNickname(n: string): string {
  const map: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };
  return [...n.toLowerCase()].map((c) => map[c] ?? c).join('').replace(/[^\p{L}\p{M}\p{N}]/gu, '');
}

export function nicknameProblem(n: string): 'length' | 'chars' | 'rude' | null {
  const t = n.trim();
  if ([...t].length < 2 || [...t].length > 16) return 'length';
  if (!/^[\p{L}\p{M}\p{N} _.\-#]+$/u.test(t)) return 'chars';
  const norm = normalizeNickname(t);
  if (WORDS.some((w) => norm.includes(w))) return 'rude';
  return null;
}

export const defaultNickname = (): string => 'Hero#' + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
