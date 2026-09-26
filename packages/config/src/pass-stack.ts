// Admin → Balance: loading several passes onto one draft (e.g. v5 = 2026-09b + 2026-09c) must publish one version
// that carries every pass's report and patch notes, not just the last one loaded.
import type { BalancePass, BalanceReport } from './balance-pass';
import { groupItems, type ChangeEntry } from './changelog';

type PassNotes = Pick<ChangeEntry, 'titleTh' | 'titleEn' | 'items'>;

/** Report of a draft that already holds `prev` (null = first pass on this draft) after `p` is loaded too. */
export function stackReport(prev: BalanceReport | null, p: BalancePass): BalanceReport {
  const r = p.report;
  if (!prev) return r;
  return {
    title: `${prev.title} + ${r.title}`,
    summary: `${prev.summary}\n\n${r.summary}`,
    method: [prev.method, r.method].filter(Boolean).join('\n\n') || undefined,
    metrics: [...(prev.metrics ?? []), ...(r.metrics ?? [])],
    findings: [...(prev.findings ?? []), ...(r.findings ?? [])],
    reasons: { ...prev.reasons, ...r.reasons },
    next: [...(prev.next ?? []), ...(r.next ?? [])],
    link: prev.link ?? r.link,
  };
}

/** Patch notes likewise: titles joined, items merged in category order. */
export function stackNotes(prev: PassNotes | null, p: BalancePass): PassNotes {
  const c = p.changelog;
  if (!prev) return c;
  return {
    titleTh: `${prev.titleTh} · ${c.titleTh}`,
    titleEn: `${prev.titleEn} · ${c.titleEn}`,
    items: groupItems([...prev.items, ...c.items]).flatMap(([, l]) => l),
  };
}
