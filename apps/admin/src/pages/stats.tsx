// Statistics (ticket 18): players/Runs/play time per day, survival by Chapter for two config
// versions, Skill pick rate and reach with outlier flags, top errors, FPS histogram.
import { useState } from 'preact/hooks';
import type { AdminApi, DailyRow } from '../api';
import { Chart } from '../chart';
import { Card, Loading, Tag, fmtTime, useData } from '../ui';

function byDay(rows: DailyRow[], metric: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) if (r.metric === metric) m.set(r.day, (m.get(r.day) || 0) + r.value);
  return m;
}
function byKey(rows: DailyRow[], metric: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) if (r.metric === metric) m.set(r.key, (m.get(r.key) || 0) + r.value);
  return m;
}

export function Stats({ api }: { api: AdminApi }) {
  const cfgs = useData(() => api.configs());
  const [days, setDays] = useState(30);
  const [va, setVa] = useState<number | null>(null);
  const [vb, setVb] = useState<number | null>(null);
  const st = useData(() => api.stats(days, va, vb), [days, va, vb]);
  if (!st.data) return <Loading error={st.error} />;
  const d = st.data.daily;
  const dayList = [...new Set(d.map((r) => r.day))].sort();
  const x = dayList.map((s) => Date.parse(s) / 1000);
  const players = byDay(d, 'players'), runs = byDay(d, 'runs'), secs = byDay(d, 'play_seconds');
  const picked = byKey(d, 'skill_picked'), reach = byKey(d, 'skill_reach6'), lvl = byKey(d, 'skill_level_sum');
  const totalRuns = [...runs.values()].reduce((a, b) => a + b, 0) || 1;
  const skills = [...picked].map(([s, n]) => ({ s, pick: Math.round((100 * n) / totalRuns), reach: Math.round((100 * (reach.get(s) || 0)) / (n || 1)), avgLv: +((lvl.get(s) || 0) / (n || 1)).toFixed(1) }))
    .sort((a, b) => b.pick - a.pick);
  const avgReach = skills.reduce((a, s) => a + s.reach, 0) / (skills.length || 1);
  const fps = byKey(d, 'fps_bucket');
  const fpsTotal = [...fps.values()].reduce((a, b) => a + b, 0) || 1;
  const versions = (cfgs.data ?? []).filter((c) => c.status === 'published').map((c) => c.version);
  const sel = (v: number | null, set: (v: number | null) => void, allowNone: boolean) => (
    <select value={v ?? ''} onChange={(e) => { const s = (e.target as HTMLSelectElement).value; set(s === '' ? null : Number(s)); }}>
      <option value="">{allowNone ? 'ไม่เทียบ' : 'ล่าสุด'}</option>{versions.map((n) => <option value={n}>v{n}</option>)}
    </select>
  );
  const sA = st.data.survivalA, sB = st.data.survivalB;
  return (
    <>
      <div class="row between"><h2>สถิติ</h2><label>ช่วง <select value={days} onChange={(e) => setDays(Number((e.target as HTMLSelectElement).value))}><option value={7}>7 วัน</option><option value={30}>30 วัน</option><option value={90}>90 วัน</option></select></label></div>
      <Card title="ผู้เล่นและจำนวนรอบต่อวัน">
        {x.length ? <Chart ariaLabel="ผู้เล่นและจำนวนรอบต่อวัน" x={x} series={[{ label: 'ผู้เล่น', values: dayList.map((k) => players.get(k) ?? null), color: '#1e1b33' }, { label: 'รอบ', values: dayList.map((k) => runs.get(k) ?? null), color: '#c2361f' }]} /> : <p class="mut">ยังไม่มีข้อมูล (สรุปทุกคืนเที่ยงคืนสิบนาที)</p>}
      </Card>
      <Card title="เวลาเล่นเฉลี่ยต่อรอบ (นาที)">
        {x.length ? <Chart ariaLabel="เวลาเล่นเฉลี่ยต่อรอบ" x={x} series={[{ label: 'นาที', values: dayList.map((k) => (runs.get(k) ? +((secs.get(k) || 0) / runs.get(k)! / 60).toFixed(1) : null)), color: '#1a6b9e' }]} height={160} /> : <p class="mut">–</p>}
      </Card>
      <Card title="รอดในแต่ละ Chapter" right={<div class="row small">A {sel(va, setVa, false)} B {sel(vb, setVb, true)}</div>}>
        {sA.length ? <Chart ariaLabel="เปอร์เซ็นต์รอบที่ไปถึงแต่ละ Chapter" x={sA.map((r) => r.chapter - 1)} xLabels={sA.map((r) => 'Ch' + r.chapter)}
          series={[{ label: va == null ? 'ล่าสุด' : 'v' + va, values: sA.map((r) => r.reached), color: '#1e1b33', bars: true }, ...(sB.length ? [{ label: 'v' + vb, values: sB.map((r) => r.reached), color: '#b9b4d6', bars: true }] : [])]} height={200} /> : <p class="mut">ยังไม่มีรอบ</p>}
      </Card>
      <Card title="สกิล">
        <table><thead><tr><th>สกิล</th><th>ถูกเลือก (% ของรอบ)</th><th>เลเวลเฉลี่ย</th><th>รอบที่ใช้แล้วถึง Ch6+</th></tr></thead><tbody>
          {skills.map((s) => <tr><td>{s.s}</td><td>{s.pick}%</td><td>{s.avgLv}</td><td>{s.reach}% {s.reach >= avgReach + 12 ? <Tag kind="warn">แรงไป?</Tag> : s.reach <= avgReach - 12 ? <Tag kind="info">อ่อนไป?</Tag> : null}</td></tr>)}
        </tbody></table>
      </Card>
      <Card title="FPS ของผู้เล่น">
        <div class="bars">{['<30', '30–45', '45–55', '55+'].map((l, i) => { const v = (fps.get(String(i + 1)) || 0) / fpsTotal; return <div><div class="bar" style={{ height: Math.max(2, v * 100) + 'px' }} /><span class="small">{l}<br />{Math.round(v * 100)}%</span></div>; })}</div>
      </Card>
      <Card title="error ที่เจอบ่อย">
        <table><thead><tr><th>ข้อความ</th><th>จำนวน</th><th>ล่าสุด</th></tr></thead><tbody>
          {st.data.errors.map((e) => <tr><td>{e.message}<br /><span class="small mut mono">{e.stack}</span></td><td>{e.count}</td><td class="small">{fmtTime(e.last)}</td></tr>)}
        </tbody></table>
      </Card>
    </>
  );
}
