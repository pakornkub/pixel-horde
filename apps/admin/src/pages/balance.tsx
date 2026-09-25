// Tuning lab (prototype variant C): search every Balance Config field (generated from the zod
// schema), edit with range validation, impact chart + per-version history, staged changes with a
// note, test live on this device, publish / roll back (always a new version).
import { listFields, parseBalanceConfig, type FieldInfo } from '@pixel-horde/config';
import { useMemo, useState } from 'preact/hooks';
import { GAME_URL, type AdminApi, type ConfigRow } from '../api';
import { Chart } from '../chart';
import { Card, Loading, Tag, toast, useData } from '../ui';

const FIELDS: FieldInfo[] = listFields();
const get = (o: unknown, path: string): number | undefined => path.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown> | undefined)?.[k], o) as number | undefined;
function set(o: Record<string, unknown>, path: string, v: number): void {
  const ks = path.split('.');
  let cur = o;
  for (const k of ks.slice(0, -1)) cur = (cur[k] ??= {}) as Record<string, unknown>;
  cur[ks[ks.length - 1]] = v;
}
const label = (f: FieldInfo): string => f.path.replace(/^shared\./, '').replace(/^worlds\./, '');
/** Base64url of the changed fields only — the game reads it from #draftcfg= (local test, never sent to the server). */
function draftLink(changes: [string, number][]): string {
  const patch: Record<string, unknown> = {};
  for (const [p, v] of changes) set(patch, p, v);
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(patch)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${GAME_URL}/#draftcfg=${b64}`;
}

export function Balance({ api, focus }: { api: AdminApi; focus?: string }) {
  const cfgs = useData(() => api.configs());
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [q, setQ] = useState(focus ?? '');
  const [sel, setSel] = useState<string>(FIELDS.find((f) => focus && f.path.includes(focus))?.path ?? 'shared.stage.durBase');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const pub: ConfigRow | undefined = cfgs.data?.find((c) => c.status === 'published');
  const stats = useData(() => api.stats(14, pub?.version ?? null, cfgs.data?.filter((c) => c.status === 'published')[1]?.version ?? null), [pub?.version]);
  const base = pub?.data;
  const d = draft ?? base;
  const changes = useMemo(() => (base && draft ? FIELDS.filter((f) => get(draft, f.path) !== get(base, f.path)).map((f) => [f.path, get(draft, f.path)!] as [string, number]) : []), [draft, base]);
  if (!cfgs.data || !base || !d) return <Loading error={cfgs.error} />;
  const F = FIELDS.find((f) => f.path === sel) ?? FIELDS[0];
  const cur = get(d, F.path), old = get(base, F.path);
  const groups = new Map<string, FieldInfo[]>();
  for (const f of FIELDS) {
    if (q && !(f.path + ' ' + f.desc + ' ' + f.group).toLowerCase().includes(q.toLowerCase())) continue;
    const g = f.group || 'อื่นๆ';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(f);
  }
  const edit = (raw: string): void => {
    const v = Number(raw);
    if (raw === '' || !Number.isFinite(v)) { setErr('ต้องเป็นตัวเลข'); return; }
    if (v < F.min || v > F.max) { setErr(`ต้องอยู่ระหว่าง ${F.min} – ${F.max}`); return; }
    setErr('');
    const next = JSON.parse(JSON.stringify(d)) as Record<string, unknown>;
    set(next, F.path, v);
    setDraft(next);
  };
  const publish = async (): Promise<void> => {
    if (!changes.length) { toast('ยังไม่มีค่าที่เปลี่ยน'); return; }
    if (!note.trim()) { toast('ใส่โน้ตก่อน (ทำไมถึงปรับ)'); return; }
    try {
      const rest = { ...(d as Record<string, unknown>) };
      delete rest.version;
      parseBalanceConfig(rest); // same zod schema the game uses; the server checks again
      const v = await api.publishConfig(rest, note.trim());
      toast(`Publish v${v} แล้ว มีผลตอนผู้เล่นเริ่มด่านถัดไป`);
      setDraft(null); setNote(''); cfgs.reload();
    } catch (e) { toast('Publish ไม่ได้: ' + (e as Error).message); }
  };
  const rollback = async (v: number): Promise<void> => {
    if (!confirm(`สร้างเวอร์ชันใหม่ที่ใช้ค่าของ v${v}?`)) return;
    try { const nv = await api.rollbackConfig(v); toast(`ย้อนกลับแล้ว (v${nv} = ค่าของ v${v})`); setDraft(null); cfgs.reload(); } catch (e) { toast('ไม่สำเร็จ: ' + (e as Error).message); }
  };
  const sA = stats.data?.survivalA ?? [], sB = stats.data?.survivalB ?? [];
  const published = cfgs.data.filter((c) => c.status === 'published');
  return (
    <div class="lab">
      <div class="tree">
        <input type="search" placeholder={`ค้นหา ${FIELDS.length} ค่า เช่น bossAt, dragon, hp`} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="ค้นหาค่า" />
        {[...groups].map(([g, fs]) => (
          <div>
            <div class="g">{g.toUpperCase()}</div>
            {fs.slice(0, q ? 200 : 40).map((f) => {
              const changed = get(d, f.path) !== get(base, f.path);
              return <button class={'it' + (f.path === sel ? ' on' : '')} onClick={() => { setSel(f.path); setErr(''); }}>
                <span>{label(f)}</span><span class={changed ? 'chgv' : 'mut small'}>{String(get(d, f.path))}</span>
              </button>;
            })}
            {!q && fs.length > 40 && <div class="small mut" style="padding:4px 8px">…อีก {fs.length - 40} ค่า (พิมพ์ค้นหา)</div>}
          </div>
        ))}
      </div>
      <div class="center">
        <div class="small mut">{F.group} · <code>{F.path}</code></div>
        <h2>{F.desc}</h2>
        <div class="row"><span class="big">{String(cur)}</span><span class="mut">{cur !== old ? `เดิม ${old} (v${pub!.version})` : `= v${pub!.version}`}</span></div>
        <input type="range" min={F.min} max={F.max} step={Math.max((F.max - F.min) / 400, 0.001)} value={cur} onInput={(e) => edit((e.target as HTMLInputElement).value)} aria-label={F.desc} />
        <div class="row small mut between"><span>{F.min}</span><span>ค่าเริ่มต้น {F.def}</span><span>{F.max}</span></div>
        <div class="row"><input type="number" value={cur} step="any" onChange={(e) => edit((e.target as HTMLInputElement).value)} aria-label="ค่าใหม่" style="width:140px" />
          <button onClick={() => { const n = JSON.parse(JSON.stringify(d)); set(n, F.path, old!); setDraft(n); setErr(''); }}>คืนค่าเดิม</button></div>
        {err && <div class="err">{err}</div>}
        <Card title={`รอดในแต่ละ Chapter · v${pub!.version}${sB.length ? ` เทียบ v${published[1]?.version}` : ''}`}>
          {sA.length ? <Chart ariaLabel="เปอร์เซ็นต์ผู้เล่นที่ไปถึงแต่ละ Chapter" x={sA.map((r) => r.chapter - 1)} xLabels={sA.map((r) => 'Ch' + r.chapter)}
            series={[{ label: 'v' + pub!.version, values: sA.map((r) => r.reached), color: '#1e1b33', bars: true }, ...(sB.length ? [{ label: 'v' + published[1]?.version, values: sB.map((r) => r.reached), color: '#b9b4d6', bars: true }] : [])]} height={180} /> : <p class="mut small">ยังไม่มีข้อมูลรอบของเวอร์ชันนี้</p>}
        </Card>
        <Card title="ค่านี้ในแต่ละเวอร์ชัน">
          <table><thead><tr><th>เวอร์ชัน</th><th>ค่า</th><th>โน้ต</th></tr></thead>
            <tbody>{published.map((c) => <tr><td>v{c.version}</td><td>{String(get(c.data, F.path))}</td><td class="small mut">{c.note}</td></tr>)}</tbody></table>
        </Card>
      </div>
      <div class="stage">
        <h3>รอ publish ({changes.length})</h3>
        {changes.length ? changes.map(([p, v]) => <div class="row between chgrow"><span class="small">{p.replace(/^shared\./, '')}</span><span class="small"><s class="mut">{String(get(base, p))}</s> → <b>{String(v)}</b></span></div>) : <div class="small mut">ยังไม่มีค่าที่เปลี่ยน</div>}
        <input placeholder="โน้ต (ทำไมถึงปรับ) จำเป็น" value={note} onInput={(e) => setNote((e.target as HTMLInputElement).value)} aria-label="โน้ต" />
        <a class={'btn' + (changes.length ? '' : ' disabled')} href={changes.length ? draftLink(changes) : undefined} target="_blank" rel="noopener">ทดสอบสดในเครื่องนี้</a>
        <div class="small mut">เปิดเกมในแท็บใหม่ด้วยค่าฉบับร่าง ผู้เล่นคนอื่นไม่ได้รับผล และรอบทดสอบไม่ส่งคะแนน</div>
        <button class="pri" onClick={publish} disabled={!changes.length}>Publish เป็น v{(cfgs.data[0]?.version ?? 0) + 1}</button>
        {changes.length > 0 && <button onClick={() => setDraft(null)}>ทิ้งฉบับร่าง</button>}
        <h3 style="margin-top:10px">เวอร์ชัน</h3>
        {published.map((c, i) => <div class="row between"><span class="small">v{c.version} {i === 0 && <Tag kind="ok">ใช้อยู่</Tag>}<br /><span class="mut">{c.note}</span></span>{i > 0 && <button onClick={() => rollback(c.version)}>ย้อนกลับ</button>}</div>)}
      </div>
    </div>
  );
}
