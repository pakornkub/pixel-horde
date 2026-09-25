// Flags, maintenance and minimum build (ticket 17). Every switch applies immediately.
import { FeatureFlagsSchema } from '@pixel-horde/config';
import { useState } from 'preact/hooks';
import type { AdminApi } from '../api';
import { Card, Loading, Switch, Tag, toast, useData } from '../ui';

const LABEL: Record<string, string> = {
  coop: 'Co-op', scoreSubmit: 'ส่งคะแนนขึ้น Leaderboard', maintenance: 'ปิดปรับปรุง (ออนไลน์หยุด เล่นคนเดียวได้)',
  bloodMoon: 'อีเวนต์ Blood Moon', dragon: 'มังกร Inferno Dragon', rival: 'Shadow Rival',
};

export function Flags({ api }: { api: AdminApi }) {
  const f = useData(() => api.flags());
  const [build, setBuild] = useState('');
  if (!f.data) return <Loading error={f.error} />;
  const flip = async (k: string, v: boolean): Promise<void> => {
    if (k === 'maintenance' && v && !confirm('เปิดโหมดปิดปรับปรุง? ผู้เล่นทุกคนจะเล่นได้แค่ออฟไลน์')) return;
    try { await api.setFlag(k, v); toast(`${LABEL[k] ?? k}: ${v ? 'เปิด' : 'ปิด'} แล้ว (มีผลทันที)`); f.reload(); } catch (e) { toast('ไม่สำเร็จ: ' + (e as Error).message); }
  };
  const bools = Object.keys(FeatureFlagsSchema.shape).filter((k) => typeof f.data![k] === 'boolean' || k in LABEL);
  return (
    <>
      <h2>สวิตช์</h2>
      <Card title="สวิตช์ทั้งหมด">
        {bools.map((k) => <div class="qs"><span>{LABEL[k] ?? k} <Tag kind="info">ทันที</Tag></span><Switch on={f.data![k] === true} label={LABEL[k] ?? k} onChange={(v) => flip(k, v)} /></div>)}
      </Card>
      <Card title="บังคับอัปเดตเกม">
        <p class="small mut">เครื่องที่ใช้เวอร์ชันเก่ากว่าเลขนี้จะเห็นหน้าจอ "มีเวอร์ชันใหม่" ให้โหลดใหม่ (เลขเวอร์ชัน = ปีเดือนวันชั่วโมงนาที UTC ตอน build เช่น 202609251430)</p>
        <div class="row"><span>ขั้นต่ำตอนนี้: <b>{String(f.data.minClientBuild ?? 0)}</b></span>
          <input value={build} placeholder="202609251430" onInput={(e) => setBuild((e.target as HTMLInputElement).value)} aria-label="เวอร์ชันขั้นต่ำ" style="width:160px" />
          <button onClick={async () => { const n = Number(build); if (!Number.isInteger(n) || n < 0) { toast('ใส่ตัวเลขเท่านั้น'); return; } await api.setFlag('minClientBuild', n); toast('บันทึกแล้ว'); f.reload(); }}>บันทึก</button></div>
      </Card>
    </>
  );
}
