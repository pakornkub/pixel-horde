// Tuning lab (prototype variant C): search every Balance Config field (generated from the zod
// schema), edit with range validation, impact chart + per-version history, staged changes with a
// note, test live on this device, publish / roll back (always a new version).
import { BALANCE_PASSES, CAT_LABEL, FIELD_TH, GROUP_TH, autoItems, listFields, parseBalanceConfig, withOverrides, type BalanceConfig, type BalancePass, type BalanceReport, type ChangeEntry, type FieldInfo } from '@pixel-horde/config';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { GAME_URL, type AdminApi, type ConfigRow } from '../api';
import { Chart } from '../chart';
import { Card, Loading, Tag, fmtTime, toast, useData } from '../ui';
import { AI_DRAFT_KEY } from './ai';
import { ReportView, type ReportChange } from './report';

const FIELDS: FieldInfo[] = listFields();
const get = (o: unknown, path: string): number | undefined => path.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown> | undefined)?.[k], o) as number | undefined;
function set(o: Record<string, unknown>, path: string, v: number): void {
  const ks = path.split('.');
  let cur = o;
  for (const k of ks.slice(0, -1)) cur = (cur[k] ??= {}) as Record<string, unknown>;
  cur[ks[ks.length - 1]] = v;
}
const label = (f: FieldInfo): string => f.path.replace(/^shared\./, '').replace(/^worlds\./, '');
/** Thai explanation (Admin is for the owner): what the value is, in its context, and what raising it does. */
const thGroup = (g: string): string => GROUP_TH[g] ?? g;
function thai(f: FieldInfo): { name: string; context: string; up: string } {
  const d = FIELD_TH[f.desc];
  const context = f.parent && f.parent !== f.group ? thGroup(f.parent) : '';
  return { name: d?.th ?? f.desc, context, up: d?.up ?? '' };
}
/** Short name for the list: "ดาเมจ · ค่าตั้งต้น" for a level-formula part, else the field's own name. */
const shortName = (f: FieldInfo): string => { const x = thai(f); return x.context ? `${x.context} · ${x.name}` : x.name; };
/** Base64url of the changed fields only — the game reads it from #draftcfg= (local test, never sent to the server). */
function draftLink(changes: [string, number][]): string {
  const patch: Record<string, unknown> = {};
  for (const [p, v] of changes) set(patch, p, v);
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(patch)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${GAME_URL}/#draftcfg=${b64}`;
}

/** A version's data with fields added later filled in, so versions compare field by field. */
function filled(data: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...data };
  delete rest.version;
  try { return parseBalanceConfig(rest) as unknown as Record<string, unknown>; } catch { return rest; }
}
const nameOf = (p: string): string => { const f = FIELDS.find((x) => x.path === p); return f ? shortName(f) : p; };
function diff(a: Record<string, unknown>, b: Record<string, unknown>): ReportChange[] {
  const fa = filled(a), fb = filled(b);
  return FIELDS.filter((f) => get(fa, f.path) !== get(fb, f.path)).map((f) => ({ path: f.path, name: shortName(f), from: get(fa, f.path), to: get(fb, f.path) }));
}
/** What the report panel shows: the draft (with its pass report) or a published version against the one before it. */
function reportFor(viewing: 'draft' | number | null, published: ConfigRow[], changes: [string, number][], base: Record<string, unknown>, report: BalanceReport | null, nextV: number) {
  if (viewing === 'draft') {
    return { heading: 'ฉบับร่าง', sub: `ฉบับร่าง · จะ publish เป็น v${nextV}`, report, changes: changes.map(([p, v]) => ({ path: p, name: nameOf(p), from: get(base, p), to: v })) };
  }
  if (viewing === null) return null;
  const i = published.findIndex((c) => c.version === viewing);
  if (i < 0) return null;
  const c = published[i], prev = published[i + 1];
  return {
    heading: `v${c.version}: ${c.note || 'ไม่มีโน้ต'}`,
    sub: `v${c.version} · ${fmtTime(c.at)}${c.by ? ' · ' + c.by : ''}${prev ? ` · เทียบกับ v${prev.version}` : ''}`,
    report: c.report ?? null, changes: prev ? diff(prev.data, c.data) : [],
  };
}

export function Balance({ api, focus }: { api: AdminApi; focus?: string }) {
  const cfgs = useData(() => api.configs());
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [q, setQ] = useState(focus ?? '');
  const [sel, setSel] = useState<string>(FIELDS.find((f) => focus && f.path.includes(focus))?.path ?? 'shared.stage.durBase');
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  /** Report travelling with the draft (a loaded balance pass); published with the version. */
  const [report, setReport] = useState<BalanceReport | null>(null);
  /** Patch notes from a loaded pass; otherwise they are generated from the changed values. */
  const [passNotes, setPassNotes] = useState<Pick<ChangeEntry, 'titleTh' | 'titleEn' | 'items'> | null>(null);
  const [clTitle, setClTitle] = useState('');
  /** Report on screen: the draft's, or a published version's. */
  const [viewing, setViewing] = useState<'draft' | number | null>(null);
  const pub: ConfigRow | undefined = cfgs.data?.find((c) => c.status === 'published');
  const stats = useData(() => api.stats(14, pub?.version ?? null, cfgs.data?.filter((c) => c.status === 'published')[1]?.version ?? null), [pub?.version]);
  // older versions lack fields added later: show (and publish) them with the defaults the game uses
  const base = useMemo(() => {
    if (!pub) return undefined;
    const rest = { ...pub.data };
    delete rest.version;
    return { ...(parseBalanceConfig(rest) as unknown as Record<string, unknown>), version: pub.version };
  }, [pub?.version]);
  // changes handed over from the AI page start a draft on top of the published version
  useEffect(() => {
    if (!base) return;
    let raw: string | null = null;
    try { raw = sessionStorage.getItem(AI_DRAFT_KEY); sessionStorage.removeItem(AI_DRAFT_KEY); } catch { /* storage blocked */ }
    if (!raw) return;
    const next = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
    for (const [p, v] of JSON.parse(raw) as [string, number][]) { const f = FIELDS.find((x) => x.path === p); if (f && v >= f.min && v <= f.max) set(next, p, v); }
    setDraft(next);
    setNote('ตามคำแนะนำของผู้ช่วย AI');
    toast('ใส่ค่าจากผู้ช่วย AI ในฉบับร่างแล้ว ตรวจก่อน publish');
  }, [base]);
  const d = draft ?? base;
  const changes = useMemo(() => (base && draft ? FIELDS.filter((f) => get(draft, f.path) !== get(base, f.path)).map((f) => [f.path, get(draft, f.path)!] as [string, number]) : []), [draft, base]);
  /** What players will read on the website's Updates page for this publish. */
  const cl: Pick<ChangeEntry, 'titleTh' | 'titleEn' | 'items'> = passNotes ?? { titleTh: '', titleEn: '', items: autoItems(changes.map(([p, v]) => ({ path: p, from: get(base, p), to: v }))) };
  if (!cfgs.data || !base || !d) return <Loading error={cfgs.error} />;
  const F = FIELDS.find((f) => f.path === sel) ?? FIELDS[0];
  const TH = thai(F);
  const cur = get(d, F.path), old = get(base, F.path);
  const groups = new Map<string, FieldInfo[]>();
  for (const f of FIELDS) {
    if (q && !(f.path + ' ' + f.desc + ' ' + f.group + ' ' + shortName(f) + ' ' + thGroup(f.group)).toLowerCase().includes(q.toLowerCase())) continue;
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
      const v = await api.publishConfig(rest, note.trim(), report, { ...cl, titleTh: clTitle.trim() || cl.titleTh });
      toast(`Publish v${v} แล้ว มีผลตอนผู้เล่นเริ่มด่านถัดไป · บันทึกในอัปเดตเกมแล้ว`);
      setDraft(null); setNote(''); setReport(null); setPassNotes(null); setClTitle(''); setViewing(null); cfgs.reload();
    } catch (e) { toast('Publish ไม่ได้: ' + (e as Error).message); }
  };
  /** A playtest pass (packages/config/src/balance-pass.ts) on top of the current draft, with its report on screen. */
  const loadPass = (p: BalancePass): void => {
    const rest = { ...(d as Record<string, unknown>) };
    delete rest.version;
    const next = withOverrides(parseBalanceConfig(rest), p.patch) as BalanceConfig & Record<string, unknown>;
    setDraft({ ...next, version: base.version });
    if (!note.trim()) setNote(p.note);
    setReport(p.report);
    setPassNotes(p.changelog);
    setClTitle(p.changelog.titleTh);
    setViewing('draft');
    toast(`ใส่ค่าจากรอบจูน ${p.id} ในฉบับร่างแล้ว อ่านรายงานแล้วตรวจก่อน publish`);
  };
  const discard = (): void => { setDraft(null); setReport(null); setPassNotes(null); setClTitle(''); if (viewing === 'draft') setViewing(null); };
  const rollback = async (v: number): Promise<void> => {
    if (!confirm(`สร้างเวอร์ชันใหม่ที่ใช้ค่าของ v${v}?`)) return;
    try { const nv = await api.rollbackConfig(v); toast(`ย้อนกลับแล้ว (v${nv} = ค่าของ v${v})`); setDraft(null); cfgs.reload(); } catch (e) { toast('ไม่สำเร็จ: ' + (e as Error).message); }
  };
  const sA = stats.data?.survivalA ?? [], sB = stats.data?.survivalB ?? [];
  const published = cfgs.data.filter((c) => c.status === 'published');
  const view = reportFor(viewing, published, changes, base, report, (cfgs.data[0]?.version ?? 0) + 1);
  return (
    <div class="lab">
      <div class="tree">
        <input type="search" placeholder={`ค้นหา ${FIELDS.length} ค่า เช่น bossAt, dragon, hp`} value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="ค้นหาค่า" />
        {[...groups].map(([g, fs]) => (
          <div>
            <div class="g">{thGroup(g)} <span class="mut">· {g}</span></div>
            {fs.slice(0, q ? 200 : 40).map((f) => {
              const changed = get(d, f.path) !== get(base, f.path);
              return <button class={'it' + (f.path === sel ? ' on' : '')} onClick={() => { setSel(f.path); setErr(''); }} title={label(f)}>
                <span><span class="thn">{shortName(f)}</span><span class="key">{label(f)}</span></span><span class={changed ? 'chgv' : 'mut small'}>{String(get(d, f.path))}</span>
              </button>;
            })}
            {!q && fs.length > 40 && <div class="small mut" style="padding:4px 8px">…อีก {fs.length - 40} ค่า (พิมพ์ค้นหา)</div>}
          </div>
        ))}
      </div>
      <div class="center">
        {view ? <ReportView {...view} onClose={() => setViewing(null)} /> : <>
        <div class="small mut">{thGroup(F.group)}{TH.context ? ' › ' + TH.context : ''} · <code>{F.path}</code></div>
        <h2>{TH.context ? `${TH.context} · ${TH.name}` : TH.name}</h2>
        <Card title="ค่านี้คืออะไร / ปรับแล้วเป็นอย่างไร">
          <p class="explain"><b>คืออะไร:</b> {TH.context ? `${TH.name} ของ “${TH.context}” ในหมวด ${thGroup(F.group)}` : `${TH.name} (หมวด ${thGroup(F.group)})`}</p>
          {TH.up && <p class="explain"><b>ปรับเพิ่ม ▲</b> {TH.up}</p>}
          {TH.up && <p class="explain"><b>ปรับลด ▼</b> ได้ผลตรงข้าม</p>}
          <p class="explain small mut">ค่าเริ่มต้น {F.def} · ปรับได้ {F.min} – {F.max} · มีผลกับผู้เล่นตอนเริ่มด่านถัดไปหลัง Publish · ต้นฉบับ: {F.desc}</p>
        </Card>
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
        </>}
      </div>
      <div class="stage">
        <h3>รอ publish ({changes.length})</h3>
        {changes.length ? changes.map(([p, v]) => <div class="row between chgrow"><span class="small">{(() => { const f = FIELDS.find((x) => x.path === p); return f ? shortName(f) : ''; })()}<br /><span class="mut">{p.replace(/^shared\./, '')}</span></span><span class="small"><s class="mut">{String(get(base, p))}</s> → <b>{String(v)}</b></span></div>) : <div class="small mut">ยังไม่มีค่าที่เปลี่ยน</div>}
        <input placeholder="โน้ต (ทำไมถึงปรับ) จำเป็น" value={note} onInput={(e) => setNote((e.target as HTMLInputElement).value)} aria-label="โน้ต" />
        {changes.length > 0 && <details class="clprev"><summary class="small">ข้อความถึงผู้เล่นในหน้าอัปเดต ({cl.items.length} บรรทัด{passNotes ? '' : ', สร้างจากค่าที่เปลี่ยน'})</summary>
          <input placeholder="หัวข้ออัปเดต (ว่าง = ปรับสมดุลเกม vN)" value={clTitle} onInput={(e) => setClTitle((e.target as HTMLInputElement).value)} aria-label="หัวข้ออัปเดต" />
          <ul class="small">{cl.items.slice(0, 12).map((i) => <li><span class="mut">{CAT_LABEL[i.cat].th}:</span> {i.th}</li>)}{cl.items.length > 12 && <li class="mut">…อีก {cl.items.length - 12} บรรทัด</li>}</ul>
          <div class="small mut">แก้ถ้อยคำให้อ่านง่ายได้ภายหลังที่หน้า “อัปเดตเกม”</div></details>}
        <a class={'btn' + (changes.length ? '' : ' disabled')} href={changes.length ? draftLink(changes) : undefined} target="_blank" rel="noopener">ทดสอบสดในเครื่องนี้</a>
        <div class="small mut">เปิดเกมในแท็บใหม่ด้วยค่าฉบับร่าง ผู้เล่นคนอื่นไม่ได้รับผล และรอบทดสอบไม่ส่งคะแนน</div>
        <button class="pri" onClick={publish} disabled={!changes.length}>Publish เป็น v{(cfgs.data[0]?.version ?? 0) + 1}</button>
        {changes.length > 0 && <button onClick={discard}>ทิ้งฉบับร่าง</button>}
        {report && <button onClick={() => setViewing('draft')}>ดูรายงานของฉบับร่าง</button>}
        {BALANCE_PASSES.map((p) => <button onClick={() => loadPass(p)}>ใส่ค่าจากรอบจูน {p.id}</button>)}
        <div class="small mut">ค่าที่แนะนำจากการทดสอบด้วยบอท พร้อมรายงาน รายงานจะเก็บไว้กับเวอร์ชันที่ publish</div>
        <h3 style="margin-top:10px">เวอร์ชัน</h3>
        {published.map((c, i) => <div class="row between verrow"><span class="small">v{c.version} {i === 0 && <Tag kind="ok">ใช้อยู่</Tag>} {c.report && <Tag kind="info">มีรายงาน</Tag>}<br /><span class="mut">{c.note}</span></span>
          <span class="row"><button onClick={() => setViewing(c.version)}>รายงาน</button>{i > 0 && <button onClick={() => rollback(c.version)}>ย้อนกลับ</button>}</span></div>)}
      </div>
    </div>
  );
}
