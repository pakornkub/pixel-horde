import { useState } from 'preact/hooks';
import type { AdminApi } from '../api';
import { Card, Loading, Tag, fmtTime, toast, useData } from '../ui';

export function Players({ api }: { api: AdminApi }) {
  const [q, setQ] = useState('');
  const rows = useData(() => api.players(q), [q]);
  return (
    <>
      <h2>ผู้เล่น</h2>
      <input type="search" placeholder="ค้นหาชื่อ" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="ค้นหาชื่อผู้เล่น" />
      <Card>
        {!rows.data ? <Loading error={rows.error} /> : (
          <table><thead><tr><th>ชื่อ</th><th>Gold</th><th>ผูก Google</th><th>เห็นล่าสุด</th><th /></tr></thead><tbody>
            {rows.data.map((p) => (
              <tr><td>{p.name} {p.role === 'admin' && <Tag kind="info">admin</Tag>} {p.banned && <Tag kind="bad">แบน</Tag>}</td>
                <td>{p.gold.toLocaleString()} {p.gold > 50000 && <Tag kind="warn">สูงผิดปกติ</Tag>}</td>
                <td>{p.linked ? 'ใช่' : '–'}</td><td class="small">{fmtTime(p.lastSeen)}</td>
                <td><button class="danger" onClick={async () => { await api.banPlayer(p.id, p.banned ? null : new Date(Date.now() + 30 * 864e5).toISOString()); toast(p.banned ? 'ปลดแบนแล้ว' : 'แบน 30 วันแล้ว'); rows.reload(); }}>{p.banned ? 'ปลดแบน' : 'แบนจาก leaderboard'}</button></td></tr>
            ))}
          </tbody></table>
        )}
      </Card>
      <p class="small mut">แจก Gold และรีเซ็ตบัญชีอยู่ในรุ่นถัดไป (ดู spec: Out of Scope)</p>
    </>
  );
}
