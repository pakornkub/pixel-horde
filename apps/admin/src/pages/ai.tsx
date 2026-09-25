// Balance AI: describe a balance problem in Thai, Gemini (Edge Function `balance-ai`) proposes
// Balance Config changes with reasons. Nothing is published here: "ส่งเข้าฉบับร่าง" hands the
// changes to the Tuning Lab, where the owner can test live and publish as usual.
import { listFields } from '@pixel-horde/config';
import { useState } from 'preact/hooks';
import type { AdminApi, AiAnswer, AiMsg } from '../api';
import { Card, toast } from '../ui';

const FIELDS = listFields();
const CATALOG: [string, string, number, number, number][] = FIELDS.map((f) => [f.path, f.desc, f.min, f.max, f.def]);
export const AI_DRAFT_KEY = 'pixelhorde-ai-draft';

const EXAMPLES = ['บอสด่านแรกแรงไป โดยเฉพาะหลังหมดเวลา', 'ผู้เล่นตายที่ Chapter ไหนเยอะสุด', 'โล่ดรอปน้อยไป อยากให้เจอบ่อยขึ้นนิดหน่อย'];

interface Turn { user: string; answer?: AiAnswer; error?: string }

export function Ai({ api, go }: { api: AdminApi; go: (page: string) => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (q = text): Promise<void> => {
    const msg = q.trim();
    if (!msg || busy) return;
    const history: AiMsg[] = turns.flatMap((t) => (t.answer ? [{ role: 'user' as const, text: t.user }, { role: 'model' as const, text: JSON.stringify(t.answer) }] : []));
    const next = [...turns, { user: msg }];
    setTurns(next); setText(''); setBusy(true);
    try {
      const answer = await api.askAi([...history, { role: 'user', text: msg }], CATALOG);
      setTurns([...turns, { user: msg, answer }]);
    } catch (e) {
      setTurns([...turns, { user: msg, error: (e as Error).message }]);
    } finally { setBusy(false); }
  };
  const toDraft = (a: AiAnswer): void => {
    try { sessionStorage.setItem(AI_DRAFT_KEY, JSON.stringify(a.changes.map((c) => [c.path, c.value]))); } catch { toast('บันทึกฉบับร่างไม่ได้'); return; }
    go('balance');
  };
  return (
    <div>
      <h1>ผู้ช่วย AI ปรับสมดุล</h1>
      <p class="mut small">เล่าปัญหาที่เจอเป็นภาษาไทย AI จะเสนอค่าที่ควรปรับพร้อมเหตุผล เมื่อกด "ส่งเข้าฉบับร่าง" ค่าจะไปอยู่ในหน้าค่าสมดุล ให้ทดสอบสดหรือ publish เองตามปกติ AI ไม่มีสิทธิ์ publish เอง</p>
      {turns.length === 0 && <div class="row" style="flex-wrap:wrap;gap:6px;margin:10px 0">{EXAMPLES.map((e) => <button onClick={() => send(e)}>{e}</button>)}</div>}
      {turns.map((t) => (
        <Card>
          <p><b>คุณ:</b> {t.user}</p>
          {!t.answer && !t.error && <p class="mut">กำลังคิด…</p>}
          {t.error && <p class="err">เรียก AI ไม่สำเร็จ: {t.error}</p>}
          {t.answer && <>
            <p style="white-space:pre-wrap">{t.answer.reply}</p>
            {t.answer.changes.length > 0 && <>
              <table><thead><tr><th>ค่า</th><th>ใหม่</th><th>เหตุผล</th></tr></thead>
                <tbody>{t.answer.changes.map((c) => <tr><td class="small mono">{c.path.replace(/^shared\./, '')}</td><td><b>{String(c.value)}</b></td><td class="small">{c.why}</td></tr>)}</tbody></table>
              <div class="row" style="margin-top:8px"><button class="pri" onClick={() => toDraft(t.answer!)}>ส่งเข้าฉบับร่าง ({t.answer.changes.length} ค่า)</button>
                {t.answer.model && <span class="small mut">{t.answer.model}{t.answer.version != null ? ` · อิง v${t.answer.version}` : ''}</span>}</div>
            </>}
          </>}
        </Card>
      ))}
      <div class="row" style="margin-top:10px;align-items:flex-end">
        <textarea rows={3} style="flex:1" placeholder="เช่น บอสด่านแรกแรงไป อยากให้ตีทันก่อนหมดเวลามากขึ้น" value={text} disabled={busy}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); } }} aria-label="ข้อความถึง AI" />
        <button class="pri" onClick={() => send()} disabled={busy || !text.trim()}>{busy ? 'กำลังส่ง…' : 'ส่ง'}</button>
      </div>
      <p class="small mut">Ctrl+Enter เพื่อส่ง · ค่าที่ AI เสนอถูกตรวจช่วงค่าก่อนแสดง และตรวจอีกรอบตอน publish</p>
    </div>
  );
}
