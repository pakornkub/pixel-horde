// Leaderboard moderation (ticket 17): board tabs, status tags, hide/unhide, ban/unban, verify co-op.
import { useState } from 'preact/hooks';
import type { AdminApi, BoardRow, SeasonPreview } from '../api';
import { Card, Loading, Tag, toast, useData } from '../ui';

const BOARDS: [string, string][] = [['solo', 'Season เดี่ยว'], ['coop', 'Season co-op'], ['endless', 'Endless'], ['alltime', 'ตลอดกาล']];

export function Leaderboard({ api, initial }: { api: AdminApi; initial?: string }) {
  const [board, setBoard] = useState(initial && BOARDS.some(([b]) => b === initial) ? initial : 'solo');
  const rows = useData(() => api.leaderboard(board), [board]);
  const act = async (label: string, fn: () => Promise<unknown>): Promise<void> => { try { await fn(); toast(label); rows.reload(); } catch (e) { toast('ไม่สำเร็จ: ' + (e as Error).message); } };
  const tag = (r: BoardRow) => r.status === 'verified' ? <Tag kind="ok">ยืนยัน</Tag> : r.status === 'pending' ? <Tag>รอตรวจ</Tag> : <Tag kind="bad">น่าสงสัย</Tag>;
  return (
    <>
      <h2>Leaderboard</h2>
      <div class="tabs" role="tablist">{BOARDS.map(([b, l]) => <button role="tab" aria-selected={b === board} class={b === board ? 'on' : ''} onClick={() => setBoard(b)}>{l}</button>)}</div>
      <Card>
        {!rows.data ? <Loading error={rows.error} /> : rows.data.length === 0 ? <p class="mut">ยังไม่มีคะแนน</p> : (
          <table><thead><tr><th>#</th><th>ชื่อ</th><th>คะแนน</th><th>Ch</th><th>ฮีโร่</th><th>สถานะ</th><th /></tr></thead><tbody>
            {rows.data.map((r, i) => (
              <tr class={r.hidden ? 'dim' : ''}>
                <td>{i + 1}</td><td>{r.name} {r.banned && <Tag kind="bad">แบน</Tag>}</td><td>{r.score.toLocaleString()}</td><td>{r.chapter}</td><td>{r.hero}</td><td>{tag(r)} {r.hidden && <Tag>ซ่อน</Tag>}</td>
                <td class="row">
                  <button onClick={() => act(r.hidden ? 'แสดงคะแนนแล้ว' : 'ซ่อนคะแนนแล้ว', () => api.hideScore(r.userId, board, !r.hidden))}>{r.hidden ? 'แสดง' : 'ซ่อน'}</button>
                  {board === 'coop' && r.status === 'pending' && <button onClick={() => act('ยืนยันแล้ว', () => api.verifyCoop(r.userId))}>ยืนยัน</button>}
                  <button class="danger" onClick={() => act(r.banned ? 'ปลดแบนแล้ว' : 'แบน 30 วันแล้ว', () => api.banPlayer(r.userId, r.banned ? null : new Date(Date.now() + 30 * 864e5).toISOString()))}>{r.banned ? 'ปลดแบน' : 'แบน'}</button>
                </td>
              </tr>
            ))}
          </tbody></table>
        )}
      </Card>
      <SeasonCard api={api} onDone={() => rows.reload()} />
    </>
  );
}

/** Open a new Season: shows who gets which reward (verified entries only) before confirming. */
function SeasonCard({ api, onDone }: { api: AdminApi; onDone: () => void }) {
  const [preview, setPreview] = useState<SeasonPreview | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async (): Promise<void> => { try { setPreview(await api.seasonPreview()); } catch (e) { toast('ไม่สำเร็จ: ' + (e as Error).message); } };
  const open = async (): Promise<void> => {
    if (!preview || !confirm(`ปิด Season ${preview.season} แจกรางวัล ${preview.rewards.length} รายการ แล้วเปิด Season ใหม่?`)) return;
    setBusy(true);
    try { const n = await api.openSeason(name); toast(`เปิด Season ${n} แล้ว`); setPreview(null); onDone(); } catch (e) { toast('ไม่สำเร็จ: ' + (e as Error).message); }
    setBusy(false);
  };
  return (
    <Card title="Season">
      {!preview ? <button onClick={() => void load()}>เตรียมเปิด Season ใหม่ (ดูรายชื่อรางวัล)</button> : (
        <>
          <p>Season {preview.season}: รางวัล {preview.rewards.length} รายการ (เฉพาะคะแนนที่ยืนยันแล้ว)</p>
          {preview.pendingCoop > 0 && <p><Tag>รอตรวจ</Tag> co-op ยังไม่ยืนยัน {preview.pendingCoop} รายการ จะไม่ได้รางวัลถ้าไม่ยืนยันก่อน</p>}
          <table><thead><tr><th>อันดับ</th><th>ตาราง</th><th>ชื่อ</th><th>รางวัล</th></tr></thead><tbody>
            {preview.rewards.map((r) => <tr><td>{r.rank ?? '-'}</td><td>{r.board}</td><td>{r.name}</td><td>{r.kind === 'title' ? 'ฉายา: ' : 'เหรียญ: '}{r.reward}</td></tr>)}
          </tbody></table>
          <div class="row"><input placeholder="ชื่อ Season ใหม่ (ไม่ใส่ = Season N)" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
            <button class="pri" disabled={busy} onClick={() => void open()}>ยืนยัน: ปิดและเปิด Season ใหม่</button>
            <button onClick={() => setPreview(null)}>ยกเลิก</button></div>
        </>
      )}
    </Card>
  );
}
