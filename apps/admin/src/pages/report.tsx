// Balance report of one config version (or of the draft): the attached report — summary,
// measurements, findings, what is still open — and every value that changed, with its reason.
import type { BalanceReport } from '@pixel-horde/config';
import { Card, Tag } from '../ui';

export interface ReportChange { path: string; name: string; from: number | undefined; to: number | undefined }

const LEVEL: Record<string, [string, string]> = { bad: ['bad', 'สำคัญมาก'], warn: ['warn', 'สำคัญ'], info: ['info', 'ควรดู'] };

export function ReportView({ heading, sub, report, changes, onClose }: {
  heading: string; sub: string; report: BalanceReport | null | undefined; changes: ReportChange[]; onClose: () => void;
}) {
  const reasons = report?.reasons ?? {};
  return (
    <div class="report">
      <div class="row between">
        <div><div class="small mut">{sub}</div><h2>{report?.title ?? heading}</h2></div>
        <button onClick={onClose}>ปิดรายงาน</button>
      </div>
      {report ? <>
        <Card title="สรุป"><p class="explain">{report.summary}</p>{report.method && <p class="explain small mut">วิธีวัด: {report.method}</p>}</Card>
        {!!report.metrics?.length && <Card title="ผลที่วัดได้">
          <table><thead><tr><th>ตัวชี้วัด</th><th>ก่อน</th><th>หลัง</th></tr></thead>
            <tbody>{report.metrics.map((m) => <tr><td>{m.label}</td><td class="mut">{m.before}</td><td><b>{m.after}</b></td></tr>)}</tbody></table>
        </Card>}
        {!!report.findings?.length && <Card title="ปัญหาที่พบ">
          {report.findings.map((f) => <div class="finding"><div class="row"><Tag kind={LEVEL[f.level]?.[0]}>{LEVEL[f.level]?.[1] ?? f.level}</Tag><b>{f.title}</b><Tag>{f.status}</Tag></div><p class="explain small">{f.body}</p></div>)}
        </Card>}
      </> : <Card><p class="explain mut">เวอร์ชันนี้ไม่มีรายงานแนบ (publish ด้วยมือหรือย้อนกลับ) ด้านล่างคือค่าที่เปลี่ยนจากเวอร์ชันก่อนหน้า</p></Card>}
      <Card title={`ค่าที่เปลี่ยน (${changes.length})`}>
        {changes.length ? <table><thead><tr><th>ค่า</th><th>เดิม</th><th>ใหม่</th><th>เหตุผล</th></tr></thead>
          <tbody>{changes.map((c) => <tr><td>{c.name}<div class="small mut mono">{c.path.replace(/^shared\./, '')}</div></td><td class="mut">{String(c.from ?? '–')}</td><td><b>{String(c.to ?? '–')}</b></td><td class="small">{reasons[c.path] ?? ''}</td></tr>)}</tbody></table>
          : <p class="small mut">ไม่มีค่าที่เปลี่ยน</p>}
      </Card>
      {!!report?.next?.length && <Card title="ยังต้องทำต่อ"><ul class="explain">{report.next.map((n) => <li>{n}</li>)}</ul></Card>}
      {report?.link && <a class="btn" href={report.link} target="_blank" rel="noopener">เปิดรายงานฉบับเต็ม (กราฟ)</a>}
    </div>
  );
}
