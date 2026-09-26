// Player feedback from the game's Feedback button (title footer + Settings): read, filter, mark done.
import { useState } from 'preact/hooks';
import type { AdminApi, FeedbackCategory, FeedbackRow, FeedbackStatus } from '../api';
import { WORK_STATUS } from './work';
import { Card, Loading, Tag, fmtTime, toast, useData } from '../ui';

const CAT: Record<FeedbackCategory, [string, string]> = { bug: ['บั๊ก', 'bad'], balance: ['ความสมดุล', 'warn'], idea: ['ไอเดีย', 'info'], other: ['อื่น ๆ', ''] };
const STATUS: Record<FeedbackStatus, [string, string]> = { new: ['ใหม่', 'bad'], read: ['อ่านแล้ว', 'info'], done: ['จัดการแล้ว', 'ok'] };
const CTX: [string, string][] = [['chapter', 'ด่าน'], ['hero', 'ฮีโร่'], ['realm', 'Realm'], ['mode', 'โหมด'], ['phase', 'ตอน'], ['screen', 'จอ'], ['lang', 'ภาษา'], ['build', 'build']];

function Context({ c }: { c: FeedbackRow['context'] }) {
  const parts = CTX.filter(([k]) => c[k]).map(([k, l]) => `${l} ${c[k]}`);
  return (
    <span class="small mut">
      {parts.join(' · ')}
      {c.device && <><br /><span title={c.device}>{c.device.length > 70 ? c.device.slice(0, 70) + '…' : c.device}</span></>}
    </span>
  );
}

export function Feedback({ api, go }: { api: AdminApi; go: (page: string) => void }) {
  const [status, setStatus] = useState<FeedbackStatus | ''>('new');
  const [cat, setCat] = useState<FeedbackCategory | ''>('');
  const list = useData(() => api.feedback(status, cat), [status, cat]);
  const work = useData(() => api.workItems(''));
  const itemOf = (id: number) => work.data?.find((w) => w.refs.some((r) => r.type === 'feedback' && r.id === id));
  const mark = async (f: FeedbackRow, s: FeedbackStatus): Promise<void> => {
    try { await api.setFeedbackStatus(f.id, s); list.reload(); } catch (e) { toast('ไม่สำเร็จ: ' + (e as Error).message); }
  };
  return (
    <>
      <h2>ความเห็นผู้เล่น</h2>
      <Card title="รายการ" right={
        <div class="row">
          <select aria-label="สถานะ" value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value as FeedbackStatus | '')}>
            <option value="">ทุกสถานะ</option>{Object.entries(STATUS).map(([k, [l]]) => <option value={k}>{l}</option>)}
          </select>
          <select aria-label="หมวด" value={cat} onChange={(e) => setCat((e.target as HTMLSelectElement).value as FeedbackCategory | '')}>
            <option value="">ทุกหมวด</option>{Object.entries(CAT).map(([k, [l]]) => <option value={k}>{l}</option>)}
          </select>
          <button onClick={list.reload}>รีเฟรช</button>
        </div>
      }>
        {!list.data ? <Loading error={list.error} /> : !list.data.length ? <p class="mut">ไม่มีข้อความในตัวกรองนี้</p> : (
          <table><thead><tr><th>เวลา / ผู้เล่น</th><th>หมวด</th><th>ข้อความ</th><th>สถานะ</th><th /></tr></thead><tbody>
            {list.data.map((f) => (
              <tr>
                <td class="small">{fmtTime(f.at)}<br />{f.name ?? <span class="mut">(ลบบัญชีแล้ว)</span>}</td>
                <td><Tag kind={CAT[f.category][1]}>{CAT[f.category][0]}</Tag></td>
                <td style="max-width:520px;white-space:pre-wrap;overflow-wrap:anywhere">{f.message}<br /><Context c={f.context} /></td>
                <td><Tag kind={STATUS[f.status][1]}>{STATUS[f.status][0]}</Tag>{(() => { const w = itemOf(f.id); return w && <><br /><a class="small" href="#/work" onClick={(e) => { e.preventDefault(); go('work'); }}>งาน #{w.id}: {WORK_STATUS[w.status][0]}</a></>; })()}</td>
                <td class="row">
                  {f.status !== 'read' && <button onClick={() => mark(f, 'read')}>อ่านแล้ว</button>}
                  {f.status !== 'done' && <button class="pri" onClick={() => mark(f, 'done')}>จัดการแล้ว</button>}
                  {f.status === 'done' && <button onClick={() => mark(f, 'new')}>เปิดใหม่</button>}
                </td>
              </tr>
            ))}
          </tbody></table>
        )}
      </Card>
    </>
  );
}
