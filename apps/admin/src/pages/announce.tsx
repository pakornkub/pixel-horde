// Announcements with Thai/English text and a schedule (ticket 17).
import { useState } from 'preact/hooks';
import type { AdminApi, Announcement } from '../api';
import { Card, Loading, Tag, fmtTime, toast, useData } from '../ui';

const empty: Announcement = { title_th: '', title_en: '', body_th: '', body_en: '', starts_at: '', ends_at: '' };
const toLocal = (s?: string | null): string => (s ? new Date(s).toISOString().slice(0, 16) : '');
const fromLocal = (s?: string | null): string | null => (s ? new Date(s).toISOString() : null);

export function Announce({ api }: { api: AdminApi }) {
  const list = useData(() => api.announcements());
  const [a, setA] = useState<Announcement>(empty);
  if (!list.data) return <Loading error={list.error} />;
  const field = (k: keyof Announcement, lbl: string, area = false) => (
    <label class="fieldrow"><span>{lbl}</span>
      {area ? <textarea rows={2} value={String(a[k] ?? '')} onInput={(e) => setA({ ...a, [k]: (e.target as HTMLTextAreaElement).value })} />
        : <input value={String(a[k] ?? '')} onInput={(e) => setA({ ...a, [k]: (e.target as HTMLInputElement).value })} />}
    </label>
  );
  const save = async (): Promise<void> => {
    if (!a.title_th.trim() || !a.title_en.trim()) { toast('ใส่หัวข้อทั้งไทยและอังกฤษ'); return; }
    try { await api.upsertAnnouncement({ ...a, starts_at: fromLocal(a.starts_at) ?? undefined, ends_at: fromLocal(a.ends_at) }); toast('บันทึกประกาศแล้ว'); setA(empty); list.reload(); }
    catch (e) { toast('ไม่สำเร็จ: ' + (e as Error).message); }
  };
  const now = Date.now();
  return (
    <>
      <h2>ประกาศหน้าแรก</h2>
      <Card title={a.id ? `แก้ประกาศ #${a.id}` : 'ประกาศใหม่'}>
        <div class="grid2">{field('title_th', 'หัวข้อ (ไทย)')}{field('title_en', 'Title (English)')}{field('body_th', 'ข้อความ (ไทย)', true)}{field('body_en', 'Text (English)', true)}</div>
        <div class="row">
          <label class="fieldrow"><span>เริ่ม</span><input type="datetime-local" value={toLocal(a.starts_at)} onInput={(e) => setA({ ...a, starts_at: (e.target as HTMLInputElement).value })} /></label>
          <label class="fieldrow"><span>จบ (เว้นว่าง = ไม่มีกำหนด)</span><input type="datetime-local" value={toLocal(a.ends_at)} onInput={(e) => setA({ ...a, ends_at: (e.target as HTMLInputElement).value })} /></label>
        </div>
        <div class="row"><button class="pri" onClick={save}>บันทึก</button>{a.id && <button onClick={() => setA(empty)}>ยกเลิกการแก้</button>}</div>
      </Card>
      <Card title="ทั้งหมด">
        <table><thead><tr><th>หัวข้อ</th><th>ช่วงเวลา</th><th>สถานะ</th><th /></tr></thead><tbody>
          {list.data.map((x) => {
            const on = (!x.starts_at || Date.parse(x.starts_at) <= now) && (!x.ends_at || Date.parse(x.ends_at) > now);
            return <tr><td>{x.title_th}<br /><span class="small mut">{x.title_en}</span></td><td class="small">{fmtTime(x.starts_at)} → {x.ends_at ? fmtTime(x.ends_at) : '∞'}</td>
              <td>{on ? <Tag kind="ok">กำลังแสดง</Tag> : <Tag>ไม่แสดง</Tag>}</td>
              <td class="row"><button onClick={() => setA({ ...x, starts_at: toLocal(x.starts_at), ends_at: toLocal(x.ends_at) })}>แก้</button>
                <button class="danger" onClick={async () => { if (confirm('ลบประกาศนี้?')) { await api.deleteAnnouncement(x.id!); list.reload(); } }}>ลบ</button></td></tr>;
          })}
        </tbody></table>
      </Card>
    </>
  );
}
