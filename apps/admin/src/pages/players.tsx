import { useState } from 'preact/hooks';
import type { AdminApi, PlayerRow } from '../api';
import { Card, Loading, Tag, fmtTime, toast, useData } from '../ui';

const DAYS = [1, 7, 30];
const untilIn = (days: number): string => new Date(Date.now() + days * 864e5).toISOString();

export function Players({ api }: { api: AdminApi }) {
  const [q, setQ] = useState('');
  const [days, setDays] = useState(7);
  const rows = useData(() => api.players(q), [q]);
  const ban = async (p: PlayerRow): Promise<void> => {
    await api.banPlayer(p.id, p.banned ? null : untilIn(days));
    toast(p.banned ? `เอา ${p.name} กลับเข้า leaderboard แล้ว` : `ซ่อน ${p.name} จาก leaderboard ${days} วัน (ยังเล่นได้)`);
    rows.reload();
  };
  const suspend = async (p: PlayerRow): Promise<void> => {
    if (!p.suspended && !confirm(`ระงับบัญชี ${p.name} ${days} วัน?\nเล่นออนไลน์และ co-op ไม่ได้ ไม่ได้ Gold / คะแนน จนกว่าจะครบกำหนด`)) return;
    await api.suspendPlayer(p.id, p.suspended ? null : untilIn(days));
    toast(p.suspended ? `ปลดระงับ ${p.name} แล้ว` : `ระงับบัญชี ${p.name} ${days} วันแล้ว`);
    rows.reload();
  };
  return (
    <>
      <h2>ผู้เล่น</h2>
      <div class="row">
        <input type="search" placeholder="ค้นหาชื่อ" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="ค้นหาชื่อผู้เล่น" />
        <label class="small">ระยะเวลา <select value={days} onChange={(e) => setDays(Number((e.target as HTMLSelectElement).value))} aria-label="ระยะเวลาแบน/ระงับ">
          {DAYS.map((d) => <option value={d}>{d} วัน</option>)}
        </select></label>
      </div>
      <Card>
        <p class="small mut">
          <b>ซ่อนจาก leaderboard</b> = ผู้เล่นยังเล่นได้ตามปกติ แต่ชื่อและคะแนนไม่ขึ้นตารางอันดับ ·{' '}
          <b>ระงับบัญชี</b> = เล่นออนไลน์และ co-op ไม่ได้ ไม่ได้ Gold / คะแนน / เซฟ จนกว่าจะครบกำหนด (เปิดเกมจะเห็นข้อความแจ้งพร้อมวันที่)
        </p>
        {!rows.data ? <Loading error={rows.error} /> : (
          <table><thead><tr><th>ชื่อ</th><th>Gold</th><th>ผูก Google</th><th>เห็นล่าสุด</th><th /></tr></thead><tbody>
            {rows.data.map((p) => (
              <tr><td>{p.name} {p.role === 'admin' && <Tag kind="info">admin</Tag>}
                {p.banned && <Tag kind="warn">ซ่อนจาก leaderboard{p.bannedUntil ? ' ถึง ' + fmtTime(p.bannedUntil) : ''}</Tag>}
                {p.suspended && <Tag kind="bad">ระงับบัญชี{p.suspendedUntil ? ' ถึง ' + fmtTime(p.suspendedUntil) : ''}</Tag>}</td>
                <td>{p.gold.toLocaleString()} {p.gold > 50000 && <Tag kind="warn">สูงผิดปกติ</Tag>}</td>
                <td>{p.linked ? 'ใช่' : '–'}</td><td class="small">{fmtTime(p.lastSeen)}</td>
                <td class="row">
                  <button onClick={() => ban(p)}>{p.banned ? 'เลิกซ่อนจาก leaderboard' : 'ซ่อนจาก leaderboard'}</button>
                  <button class="danger" onClick={() => suspend(p)}>{p.suspended ? 'ปลดระงับบัญชี' : 'ระงับบัญชี'}</button>
                </td></tr>
            ))}
          </tbody></table>
        )}
      </Card>
      <p class="small mut">แจก Gold และรีเซ็ตบัญชีอยู่ในรุ่นถัดไป (ดู spec: Out of Scope)</p>
    </>
  );
}
