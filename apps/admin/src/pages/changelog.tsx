// Changelog (patch notes): every update in words players understand, grouped by category. Balance
// publishes add their entry automatically; code releases (new features, fixes) are written here.
// Public entries show on the website's Updates page.
import { CAT_LABEL, CHANGE_CATS, CHANGE_KINDS, KIND_LABEL, groupItems, type ChangeCat, type ChangeEntry, type ChangeItem, type ChangeKind } from '@pixel-horde/config';
import { useState } from 'preact/hooks';
import type { AdminApi } from '../api';
import { Card, Loading, Tag, fmtTime, toast, useData } from '../ui';

const KIND_TAG: Record<ChangeKind, string> = { balance: 'warn', feature: 'ok', fix: 'bad', content: 'info', system: '' };
const blank = (): ChangeEntry => ({ at: new Date().toISOString(), kind: 'feature', titleTh: '', titleEn: '', items: [{ cat: 'system', th: '', en: '' }], note: '', public: true });
const toLocal = (iso: string): string => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

function Editor({ entry, onSave, onCancel }: { entry: ChangeEntry; onSave: (e: ChangeEntry) => void; onCancel: () => void }) {
  const [e, setE] = useState<ChangeEntry>(JSON.parse(JSON.stringify(entry)));
  const item = (i: number, patch: Partial<ChangeItem>): void => setE({ ...e, items: e.items.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
  return (
    <Card title={e.id ? `แก้รายการ #${e.id}` : 'รายการใหม่'}>
      <div class="grid2">
        <label class="fieldrow">ประเภท<select value={e.kind} onChange={(x) => setE({ ...e, kind: (x.target as HTMLSelectElement).value as ChangeKind })}>
          {CHANGE_KINDS.map((k) => <option value={k}>{KIND_LABEL[k].th}</option>)}</select></label>
        <label class="fieldrow">วันที่อัปเดต<input type="datetime-local" value={toLocal(e.at)} onChange={(x) => setE({ ...e, at: new Date((x.target as HTMLInputElement).value).toISOString() })} /></label>
        <label class="fieldrow">หัวข้อ (ไทย)<input value={e.titleTh} maxLength={120} onInput={(x) => setE({ ...e, titleTh: (x.target as HTMLInputElement).value })} /></label>
        <label class="fieldrow">หัวข้อ (English)<input value={e.titleEn} maxLength={120} onInput={(x) => setE({ ...e, titleEn: (x.target as HTMLInputElement).value })} /></label>
      </div>
      <h3 style="margin-top:12px">สิ่งที่เปลี่ยน (ผู้เล่นอ่าน)</h3>
      {e.items.map((it, i) => (
        <div class="clitem">
          <select aria-label="หมวด" value={it.cat} onChange={(x) => item(i, { cat: (x.target as HTMLSelectElement).value as ChangeCat })}>
            {CHANGE_CATS.map((c) => <option value={c}>{CAT_LABEL[c].th}</option>)}</select>
          <input aria-label="ข้อความไทย" placeholder="เช่น King Slime หลบท่าคลื่นได้ง่ายขึ้น" value={it.th} maxLength={300} onInput={(x) => item(i, { th: (x.target as HTMLInputElement).value })} />
          <input aria-label="English" placeholder="English (optional)" value={it.en} maxLength={300} onInput={(x) => item(i, { en: (x.target as HTMLInputElement).value })} />
          <button class="danger" aria-label="ลบบรรทัด" onClick={() => setE({ ...e, items: e.items.filter((_, k) => k !== i) })}>ลบ</button>
        </div>
      ))}
      <div class="row"><button onClick={() => setE({ ...e, items: [...e.items, { cat: e.items[e.items.length - 1]?.cat ?? 'system', th: '', en: '' }] })}>+ เพิ่มบรรทัด</button></div>
      <label class="fieldrow" style="margin-top:10px">โน้ตสำหรับแอดมิน (ผู้เล่นไม่เห็น เช่น PR, เหตุผล)<textarea rows={2} value={e.note} onInput={(x) => setE({ ...e, note: (x.target as HTMLTextAreaElement).value })} /></label>
      <div class="row" style="margin-top:10px">
        <label class="row small"><input type="checkbox" checked={e.public !== false} onChange={(x) => setE({ ...e, public: (x.target as HTMLInputElement).checked })} /> แสดงบนหน้าเว็บ</label>
        <button class="pri" onClick={() => onSave(e)}>บันทึก</button><button onClick={onCancel}>ยกเลิก</button>
      </div>
    </Card>
  );
}

export function Changelog({ api }: { api: AdminApi }) {
  const list = useData(() => api.changelog());
  const [editing, setEditing] = useState<ChangeEntry | null>(null);
  const [kind, setKind] = useState<ChangeKind | ''>('');
  const save = async (e: ChangeEntry): Promise<void> => {
    if (!e.titleTh.trim()) { toast('ใส่หัวข้อภาษาไทยก่อน'); return; }
    try { await api.upsertChangelog({ ...e, items: e.items.filter((i) => i.th.trim()) }); toast('บันทึกแล้ว'); setEditing(null); list.reload(); } catch (x) { toast('ไม่สำเร็จ: ' + (x as Error).message); }
  };
  const del = async (e: ChangeEntry): Promise<void> => {
    if (!e.id || !confirm(`ลบ "${e.titleTh}"?`)) return;
    try { await api.deleteChangelog(e.id); list.reload(); } catch (x) { toast('ไม่สำเร็จ: ' + (x as Error).message); }
  };
  if (!list.data) return <Loading error={list.error} />;
  const rows = list.data.filter((e) => !kind || e.kind === kind);
  return (
    <>
      <div class="row between"><div><h2>อัปเดตเกม (Changelog)</h2><div class="small mut">ทุกการเปลี่ยนแปลง แยกหมวด ผู้เล่นเห็นบนหน้าเว็บ “อัปเดต” · การ publish ค่าสมดุลจะเพิ่มรายการให้เอง</div></div>
        <button class="pri" onClick={() => setEditing(blank())}>+ เพิ่มรายการ (ฟีเจอร์/แก้บั๊ก)</button></div>
      {editing && <Editor entry={editing} onSave={save} onCancel={() => setEditing(null)} />}
      <div class="tabs">
        <button class={kind === '' ? 'on' : ''} onClick={() => setKind('')}>ทั้งหมด ({list.data.length})</button>
        {CHANGE_KINDS.map((k) => <button class={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{KIND_LABEL[k].th} ({list.data!.filter((e) => e.kind === k).length})</button>)}
      </div>
      {rows.map((e) => (
        <Card title={e.titleTh} right={<div class="row"><Tag kind={KIND_TAG[e.kind]}>{KIND_LABEL[e.kind].th}</Tag>{e.configVersion != null && <Tag>ค่าสมดุล v{e.configVersion}</Tag>}{e.public === false && <Tag kind="bad">ซ่อนจากเว็บ</Tag>}
          <button onClick={() => setEditing(e)}>แก้</button><button class="danger" onClick={() => del(e)}>ลบ</button></div>}>
          <div class="small mut">{fmtTime(e.at)}{e.titleEn ? ' · ' + e.titleEn : ''}</div>
          {groupItems(e.items).map(([c, items]) => <div class="clgroup"><b class="small">{CAT_LABEL[c].th}</b><ul>{items.map((i) => <li>{i.th}{i.en && <span class="small mut"> · {i.en}</span>}</li>)}</ul></div>)}
          {!e.items.length && <p class="small mut">ไม่มีรายละเอียด (ผู้เล่นจะเห็นแค่หัวข้อ)</p>}
          {e.note && <p class="small mut">โน้ตแอดมิน: {e.note}</p>}
        </Card>
      ))}
      {!rows.length && <p class="mut">ยังไม่มีรายการ</p>}
    </>
  );
}
