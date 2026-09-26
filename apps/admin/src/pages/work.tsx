// Work progress: what the daily triage routine (docs/agents/triage-routine.md) or the owner picked up from
// errors and feedback, how far each fix got (PR link, timeline) and the questions waiting for the owner.
import { useState } from 'preact/hooks';
import type { AdminApi, WorkItem, WorkKind, WorkRef, WorkStatus } from '../api';
import { Card, Kpi, Loading, Tag, fmtTime, toast, useData } from '../ui';

export const WORK_STATUS: Record<WorkStatus, [string, string]> = {
  needs_decision: ['รอคุณตัดสินใจ', 'bad'], todo: ['รอทำ', ''], in_progress: ['กำลังทำ', 'info'],
  pr_open: ['เปิด PR แล้ว (รอ merge)', 'warn'], shipped: ['เสร็จแล้ว', 'ok'], wontfix: ['ไม่ทำ', ''],
};
const KIND: Record<WorkKind, string> = { bug: 'บั๊ก', ux: 'หน้าจอ/ใช้งาน', balance: 'ความสมดุล', idea: 'ไอเดีย', infra: 'ระบบ', other: 'อื่น ๆ' };
const WHO: Record<string, string> = { agent: 'ผู้ช่วย (routine)', owner: 'เจ้าของ' };

function Refs({ refs, go }: { refs: WorkRef[]; go: (page: string) => void }) {
  if (!refs.length) return null;
  return (
    <span class="small mut">
      มาจาก: {refs.map((r, i) => (
        <>{i > 0 && ', '}{r.type === 'feedback' ? <a href="#/feedback" onClick={(e) => { e.preventDefault(); go('feedback'); }}>ความเห็น #{r.id}</a>
          : r.type === 'error' ? <a href="#/stats" onClick={(e) => { e.preventDefault(); go('stats'); }}>error {r.fingerprint}</a> : r.type}</>
      ))}
    </span>
  );
}

function Decide({ w, api, done, go }: { w: WorkItem; api: AdminApi; done: () => void; go: (page: string) => void }) {
  const [pick, setPick] = useState(w.decision?.recommended ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (): Promise<void> => {
    setBusy(true);
    try { await api.answerWork(w.id, pick, note); toast('ส่งคำตอบแล้ว รอบถัดไปของ routine จะทำตามนี้'); done(); } catch (e) { toast('ไม่สำเร็จ: ' + (e as Error).message); }
    setBusy(false);
  };
  return (
    <div class="alert bad">
      <div class="ic">?</div>
      <div>
        <b>#{w.id} {w.title}</b> <Tag>{KIND[w.kind]}</Tag>
        {w.summary && <div class="small" style="white-space:pre-wrap;margin:4px 0">{w.summary}</div>}
        <div style="margin:8px 0 4px"><b>{w.decision?.question}</b></div>
        {(w.decision?.options ?? []).map((o) => (
          <label class="row" style="align-items:flex-start;gap:8px;margin:4px 0;cursor:pointer">
            <input type="radio" name={'w' + w.id} checked={pick === o.key} onChange={() => setPick(o.key)} />
            <span>{o.label} {o.key === w.decision?.recommended && <Tag kind="ok">แนะนำ</Tag>}{o.detail && <><br /><span class="small mut">{o.detail}</span></>}</span>
          </label>
        ))}
        <textarea rows={2} style="width:100%;margin-top:6px" placeholder="หมายเหตุถึงผู้ช่วย (ไม่บังคับ) เช่น เงื่อนไขเพิ่ม" value={note}
          onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} aria-label="หมายเหตุ" />
        <Refs refs={w.refs} go={go} />
      </div>
      <div class="row"><button class="pri" disabled={busy || (!pick && !note.trim())} onClick={send}>ส่งคำตอบ</button></div>
    </div>
  );
}

export function Work({ api, go }: { api: AdminApi; go: (page: string) => void }) {
  const [status, setStatus] = useState<WorkStatus | 'open' | ''>('open');
  const all = useData(() => api.workItems(''), []);
  const list = useData(() => api.workItems(status), [status]);
  const reload = (): void => { all.reload(); list.reload(); };
  const set = async (w: WorkItem, s: 'todo' | 'shipped' | 'wontfix'): Promise<void> => {
    const note = s === 'todo' ? prompt('เหตุผลที่เปิดใหม่ (ผู้ช่วยจะอ่าน)') ?? '' : '';
    try { await api.setWorkStatus(w.id, s, note); reload(); } catch (e) { toast('ไม่สำเร็จ: ' + (e as Error).message); }
  };
  const a = all.data ?? [];
  const count = (s: WorkStatus): number => a.filter((w) => w.status === s).length;
  const week = Date.now() - 7 * 864e5;
  const waiting = a.filter((w) => w.status === 'needs_decision');
  return (
    <>
      <div class="row between"><div><h2>งานแก้ไข</h2>
        <div class="small mut">ผู้ช่วยตรวจ error และความเห็นผู้เล่นทุกวัน 09:00 แก้เองแล้วเปิด PR ส่วนเรื่องที่ต้องให้คุณเลือกจะมารออยู่ที่นี่</div></div>
        <button onClick={reload}>รีเฟรช</button></div>
      <div class="kpis">
        <Kpi label="รอคุณตัดสินใจ" value={count('needs_decision')} />
        <Kpi label="รอทำ / กำลังทำ" value={count('todo') + count('in_progress')} />
        <Kpi label="เปิด PR รอ merge" value={count('pr_open')} />
        <Kpi label="เสร็จใน 7 วัน" value={a.filter((w) => w.status === 'shipped' && Date.parse(w.updated) > week).length} />
      </div>
      {waiting.length > 0 && (
        <Card title={`รอคุณตัดสินใจ (${waiting.length})`}>
          {waiting.map((w) => <Decide w={w} api={api} done={reload} go={go} />)}
        </Card>
      )}
      <Card title="ความคืบหน้า" right={
        <div class="row">
          <select aria-label="สถานะ" value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value as WorkStatus | 'open' | '')}>
            <option value="open">ยังไม่ปิด</option><option value="">ทั้งหมด</option>
            {Object.entries(WORK_STATUS).map(([k, [l]]) => <option value={k}>{l}</option>)}
          </select>
        </div>
      }>
        {!list.data ? <Loading error={list.error} /> : !list.data.length ? <p class="mut">ไม่มีงานในตัวกรองนี้</p> : (
          <table><thead><tr><th>#</th><th>งาน</th><th>สถานะ</th><th>PR</th><th>อัปเดต</th><th /></tr></thead><tbody>
            {list.data.map((w) => (
              <tr>
                <td class="small">{w.id}</td>
                <td style="max-width:560px">
                  <b>{w.title}</b> <Tag>{KIND[w.kind]}</Tag>
                  {w.summary && <div class="small" style="white-space:pre-wrap;overflow-wrap:anywhere">{w.summary}</div>}
                  {w.answer && <div class="small"><Tag kind="info">คำตอบของคุณ</Tag> {w.answer.option && (w.decision?.options.find((o) => o.key === w.answer!.option)?.label ?? w.answer.option)}{w.answer.note && ` — ${w.answer.note}`}</div>}
                  <Refs refs={w.refs} go={go} />
                  {w.log.length > 0 && (
                    <details class="small"><summary class="mut">ไทม์ไลน์ ({w.log.length})</summary>
                      <ul style="margin:4px 0;padding-left:18px">
                        {[...w.log].reverse().map((l) => <li>{fmtTime(l.at)} · {WHO[l.by] ?? l.by}{l.status && <> → {WORK_STATUS[l.status]?.[0] ?? l.status}</>}{l.note && <>: {l.note}</>}</li>)}
                      </ul>
                    </details>
                  )}
                </td>
                <td><Tag kind={WORK_STATUS[w.status][1]}>{WORK_STATUS[w.status][0]}</Tag></td>
                <td class="small">{w.prUrl ? <a href={w.prUrl} target="_blank" rel="noopener">#{w.prUrl.split('/').pop()}</a> : '–'}</td>
                <td class="small">{fmtTime(w.updated)}</td>
                <td class="row">
                  {w.status !== 'shipped' && w.status !== 'wontfix' && <button onClick={() => set(w, 'shipped')}>เสร็จแล้ว</button>}
                  {w.status !== 'shipped' && w.status !== 'wontfix' && <button onClick={() => set(w, 'wontfix')}>ไม่ทำ</button>}
                  {(w.status === 'shipped' || w.status === 'wontfix') && <button onClick={() => set(w, 'todo')}>เปิดใหม่</button>}
                </td>
              </tr>
            ))}
          </tbody></table>
        )}
      </Card>
    </>
  );
}
