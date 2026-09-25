import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

export const Card = ({ title, children, right }: { title?: string; children: ComponentChildren; right?: ComponentChildren }) => (
  <section class="card">
    {(title || right) && <div class="row between"><h3>{title}</h3>{right}</div>}
    {children}
  </section>
);
export const Tag = ({ kind = '', children }: { kind?: string; children: ComponentChildren }) => <span class={'tag ' + kind}>{children}</span>;
export const Kpi = ({ label, value }: { label: string; value: ComponentChildren }) => <div class="kpi"><span>{label}</span><b>{value ?? '–'}</b></div>;
export function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return <button class={'sw' + (on ? ' on' : '')} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

let toastSet: ((t: string) => void) | null = null;
export function toast(t: string): void { toastSet?.(t); }
export function Toast() {
  const [t, setT] = useState('');
  const timer = useRef(0);
  useEffect(() => { toastSet = (x) => { setT(x); clearTimeout(timer.current); timer.current = window.setTimeout(() => setT(''), 2600); }; }, []);
  return <div id="toast" class={t ? 'on' : ''} role="status">{t}</div>;
}

/** Load async data with loading / error states; `reload` re-runs it. */
export function useData<T>(fn: () => Promise<T>, deps: unknown[] = []): { data: T | null; error: string; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    setError('');
    fn().then((d) => { if (live) setData(d); }).catch((e: Error) => { if (live) setError(e.message || String(e)); });
    return () => { live = false; };
  }, [...deps, n]);
  return { data, error, reload: () => setN((x) => x + 1) };
}

export const Loading = ({ error }: { error?: string }) => (error ? <p class="err">{error}</p> : <p class="mut">กำลังโหลด…</p>);

export function fmtTime(s: string | null | undefined): string {
  if (!s) return '–';
  const d = new Date(s);
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}
