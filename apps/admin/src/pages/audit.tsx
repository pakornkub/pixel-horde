import type { AdminApi } from '../api';
import { Card, Loading, fmtTime, useData } from '../ui';

export function Audit({ api }: { api: AdminApi }) {
  const rows = useData(() => api.audit(300));
  return (
    <>
      <h2>บันทึกการแก้ไข</h2>
      <Card>
        {!rows.data ? <Loading error={rows.error} /> : (
          <table><thead><tr><th>เวลา</th><th>ใคร</th><th>ทำอะไร</th><th>รายละเอียด</th></tr></thead><tbody>
            {rows.data.map((a) => <tr><td class="small">{fmtTime(a.at)}</td><td>{a.actor}</td><td>{a.action} {a.target}</td><td class="small mono">{JSON.stringify(a.detail).slice(0, 160)}</td></tr>)}
          </tbody></table>
        )}
        <div class="small mut" style="margin-top:6px">บันทึกโดยฐานข้อมูลอัตโนมัติ แก้หรือลบไม่ได้</div>
      </Card>
    </>
  );
}
