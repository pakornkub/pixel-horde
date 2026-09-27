// Leaderboard moderation (ticket 17): board tabs, status tags, hide/unhide, ban/unban, verify co-op.
// "Run ออฟไลน์" (offline-run review, owner-approved 2026-09-28): Runs a client queued while
// `maintenance` blocked submit_run/submit_offline_run's server-verified path land as status='offline'
// and are permanently skipped by record_leaderboard ("kept unranked"). An admin reviews each one and
// either ranks it (adds an unverified solo + all-time entry, same as a co-op entry) or rejects it
// (keeps the Gold/achievements, never joins a leaderboard).
import { useState } from 'preact/hooks';
import type { AdminApi, BoardRow, OfflineRunRow, SeasonPreview } from '../api';
import { Card, fmtTime, Loading, Tag, toast, useData } from '../ui';

const BOARDS: [string, string][] = [['solo', 'Season เดี่ยว'], ['coop', 'Season co-op'], ['endless', 'Endless'], ['alltime', 'ตลอดกาล'], ['offline', 'Run ออฟไลน์']];
const BOARD_LABEL: Record<string, string> = { solo: 'Season เดี่ยว', coop: 'Season co-op', endless: 'Endless', alltime: 'ตลอดกาล' };
// Runs store the Hero id (mage/knight/ranger/alchemist/necromancer); show the in-game name, as the game itself does.
const HERO_NAMES: Record<string, string> = { mage: 'Lyra', knight: 'Bram', ranger: 'Kit', alchemist: 'Vex', necromancer: 'Mora' };
const heroName = (h: string): string => HERO_NAMES[h] ?? h;

export function Leaderboard({ api, initial }: { api: AdminApi; initial?: string }) {
  const [board, setBoard] = useState(initial && BOARDS.some(([b]) => b === initial) ? initial : 'solo');
  return (
    <>
      <h2>Leaderboard</h2>
      <div class="tabs" role="tablist">{BOARDS.map(([b, l]) => <button role="tab" aria-selected={b === board} class={b === board ? 'on' : ''} onClick={() => setBoard(b)}>{l}</button>)}</div>
      {board === 'offline' ? <OfflineReview api={api} /> : <BoardTable api={api} board={board} />}
    </>
  );
}

function BoardTable({ api, board }: { api: AdminApi; board: string }) {
  const rows = useData(() => api.leaderboard(board), [board]);
  const act = async (label: string, fn: () => Promise<unknown>): Promise<void> => { try { await fn(); toast(label); rows.reload(); } catch (e) { toast('ไม่สำเร็จ: ' + (e as Error).message); } };
  const tag = (r: BoardRow) => r.status === 'verified' ? <Tag kind="ok">ยืนยันแล้ว</Tag> : r.status === 'pending' ? <Tag>รอตรวจ</Tag> : <Tag kind="bad">น่าสงสัย</Tag>;
  return (
    <>
      <Card>
        {!rows.data ? <Loading error={rows.error} /> : rows.data.length === 0 ? <p class="mut">ยังไม่มีคะแนน</p> : (
          <table><thead><tr><th>#</th><th>ชื่อ</th><th>คะแนน</th><th>Ch</th><th>ฮีโร่</th><th>สถานะ</th><th /></tr></thead><tbody>
            {rows.data.map((r, i) => (
              <tr class={r.hidden ? 'dim' : ''}>
                <td>{i + 1}</td><td>{r.name} {r.banned && <Tag kind="bad">แบน</Tag>}</td><td>{r.score.toLocaleString()}</td><td>{r.chapter}</td><td>{heroName(r.hero)}</td><td>{tag(r)} {r.hidden && <Tag>ซ่อน</Tag>}</td>
                <td><div class="row">
                  <button onClick={() => act(r.hidden ? 'แสดงคะแนนนี้แล้ว' : 'ซ่อนคะแนนนี้แล้ว', () => api.hideScore(r.userId, board, !r.hidden))}>{r.hidden ? 'แสดงคะแนนนี้' : 'ซ่อนคะแนนนี้'}</button>
                  {r.status === 'pending' && <button onClick={() => act('ยืนยันแล้ว', () => api.verifyScore(r.userId, board))}>ยืนยัน</button>}
                  <button class="danger" onClick={() => act(r.banned ? 'เลิกซ่อนผู้เล่นแล้ว' : 'ซ่อนผู้เล่นจากบอร์ด 30 วันแล้ว (ยังเล่นได้)', () => api.banPlayer(r.userId, r.banned ? null : new Date(Date.now() + 30 * 864e5).toISOString()))}>{r.banned ? 'เลิกซ่อนผู้เล่น' : 'ซ่อนผู้เล่นจากบอร์ด'}</button>
                </div></td>
              </tr>
            ))}
          </tbody></table>
        )}
      </Card>
      <SeasonCard api={api} onDone={() => rows.reload()} />
    </>
  );
}

function OfflineReview({ api }: { api: AdminApi }) {
  const [includeReviewed, setIncludeReviewed] = useState(false);
  const data = useData(() => api.offlineRuns(includeReviewed), [includeReviewed]);
  const act = async (label: string, fn: () => Promise<unknown>): Promise<void> => { try { await fn(); toast(label); data.reload(); } catch (e) { toast('ไม่สำเร็จ: ' + (e as Error).message); } };
  const rank = async (r: OfflineRunRow): Promise<void> => {
    try {
      const res = await api.rankOfflineRun(r.id);
      const boards = [res.appliedSolo && BOARD_LABEL.solo, res.appliedAlltime && BOARD_LABEL.alltime].filter((x): x is string => !!x);
      toast(boards.length ? `เพิ่มเข้า ${boards.join(', ')} แล้ว (รอยืนยัน)` : 'บันทึกแล้ว แต่ไม่ขึ้นบอร์ด: คะแนนต่ำกว่าคะแนนเดิมของผู้เล่นนี้');
      data.reload();
    } catch (e) { toast('ไม่สำเร็จ: ' + (e as Error).message); }
  };
  const reviewTag = (r: OfflineRunRow) => r.review === 'rejected' ? <Tag kind="bad">ข้าม</Tag>
    : r.review === 'ranked' ? (r.onSolo || r.onAlltime ? <Tag kind="ok">ขึ้นบอร์ดแล้ว</Tag> : <Tag>ไม่ติดอันดับ</Tag>)
    : <Tag>รอตรวจ</Tag>;
  return (
    <Card title="Run ที่เล่นช่วงปิดปรับปรุง (offline)" right={<label class="row small"><input type="checkbox" checked={includeReviewed} onChange={(e) => setIncludeReviewed((e.target as HTMLInputElement).checked)} /> แสดงที่ตรวจแล้วด้วย</label>}>
      {!data.data ? <Loading error={data.error} /> : (
        <>
          <p class="small mut">ช่วงเวลา {fmtTime(data.data.since)} – {fmtTime(data.data.until)} (ค่าเริ่มต้น = ช่วงปิดปรับปรุงล่าสุด)</p>
          {data.data.rows.length === 0 ? <p class="mut">ไม่มี Run ที่ต้องตรวจ</p> : (
            <table><thead><tr><th>ชื่อ</th><th>ฮีโร่</th><th>Ch</th><th>คะแนน</th><th>ฆ่า</th><th>Gold (% เพดาน)</th><th>เวลาเล่น</th><th>สถานะ</th><th /></tr></thead><tbody>
              {data.data.rows.map((r) => (
                <tr>
                  <td>{r.name}</td><td>{heroName(r.hero)}</td><td>{r.chapter}</td><td>{(r.score ?? 0).toLocaleString()}</td><td>{r.kills ?? '–'}</td>
                  <td>{r.gold ?? 0} ({r.goldCeilingPct}%)</td><td>{Math.round(r.playSeconds / 60)} น.</td><td>{reviewTag(r)}</td>
                  <td><div class="row">
                    {!r.review && <button class="pri" onClick={() => rank(r)}>ขึ้นบอร์ด</button>}
                    {!r.review && <button onClick={() => act('ข้าม Run นี้แล้ว (Gold/ของยังได้)', () => api.rejectOfflineRun(r.id))}>ข้าม</button>}
                  </div></td>
                </tr>
              ))}
            </tbody></table>
          )}
          <p class="small mut">Run ที่ "ขึ้นบอร์ด" จะไปอยู่ในตาราง Season เดี่ยว / ตลอดกาล เป็น "รอตรวจ" ให้กดยืนยันที่นั่นอีกครั้ง</p>
        </>
      )}
    </Card>
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
