// Control-room home (prototype variant B): key numbers + automatic "needs attention" list with inline actions.
import type { AdminApi, Attention } from '../api';
import { Card, Kpi, Loading, Tag, toast, useData } from '../ui';

const ICON: Record<string, string> = { dropoff: '!', suspicious: '?', error: '⚠', gold: '$', quota: '▲', coop_review: '✓', skill: '↑' };

function describe(a: Attention): { title: string; detail: string } {
  switch (a.kind) {
    case 'dropoff': return { title: `ผู้เล่นหลุดเยอะที่ Chapter ${a.chapter} → ${Number(a.chapter) + 1}`, detail: `หายไป ${a.drop}% ของรอบ (ค่าเฉลี่ยต่อ Chapter ${a.avg}%)` };
    case 'suspicious': return { title: `คะแนนน่าสงสัย: ${a.name}`, detail: `เหตุผล: ${a.reason}` };
    case 'error': return { title: `${a.new ? 'error ใหม่' : 'error พุ่ง'} ${a.count} ครั้ง`, detail: String(a.message) };
    case 'gold': return { title: `Gold สูงผิดปกติ: ${a.name}`, detail: `${Number(a.gold).toLocaleString()} Gold` };
    case 'quota': return { title: `ใกล้เต็มโควตาฟรี: ${a.what === 'database' ? 'ฐานข้อมูล' : 'จำนวนผู้เล่น'}`, detail: `${a.used} / ${a.limit}` };
    case 'coop_review': return { title: `co-op รอตรวจ ${a.count} อันดับ`, detail: 'อันดับต้นๆ ของ co-op ต้องตรวจก่อนนับเป็นยืนยัน' };
    case 'skill': return { title: `${a.skill} อาจ${a.dir === 'up' ? 'แรงเกิน' : 'อ่อนเกิน'}`, detail: `รอบที่ใช้ไปถึง Ch6+ ${a.reach}% (เฉลี่ย ${a.avg}%)` };
    default: return { title: a.kind, detail: '' };
  }
}

export function Home({ api, go }: { api: AdminApi; go: (page: string, arg?: string) => void }) {
  const ov = useData(() => api.overview());
  const st = useData(() => api.stats(7));
  if (!ov.data) return <Loading error={ov.error} />;
  const o = ov.data, k = o.kpi;
  // Skill outliers (ticket 18) from the last 7 days of rollups
  const att: Attention[] = [...o.attention];
  if (st.data) {
    const sum = (m: string): Map<string, number> => { const r = new Map<string, number>(); for (const d of st.data!.daily) if (d.metric === m) r.set(d.key, (r.get(d.key) || 0) + d.value); return r; };
    const picked = sum('skill_picked'), reach = sum('skill_reach6');
    const rates = [...picked].filter(([, n]) => n >= 30).map(([s, n]) => [s, Math.round((100 * (reach.get(s) || 0)) / n)] as const);
    const avg = rates.reduce((a, [, r]) => a + r, 0) / (rates.length || 1);
    for (const [s, r] of rates) if (Math.abs(r - avg) >= 12) att.push({ kind: 'skill', level: 'info', skill: s, reach: r, avg: Math.round(avg), dir: r > avg ? 'up' : 'down' });
  }
  const act = async (label: string, fn: () => Promise<unknown>): Promise<void> => { try { await fn(); toast(label); ov.reload(); } catch (e) { toast('ไม่สำเร็จ: ' + (e as Error).message); } };
  return (
    <>
      <div class="row between"><div><h2>ห้องควบคุม</h2><div class="small mut">Balance Config v{o.configVersion} · {o.season?.name ?? 'ไม่มี Season'} · {o.maintenance ? <Tag kind="bad">ปิดปรับปรุงอยู่</Tag> : <Tag kind="ok">ระบบเปิดปกติ</Tag>}</div></div>
        <div class="row"><button onClick={() => go('balance')}>ห้องจูนค่า</button><button onClick={() => go('leaderboard')}>Leaderboard</button><button onClick={() => ov.reload()}>รีเฟรช</button></div></div>
      <div class="kpis">
        <Kpi label="คนเล่นวันนี้" value={k.playersToday.toLocaleString()} />
        <Kpi label="จำนวนรอบวันนี้" value={k.runsToday.toLocaleString()} />
        <Kpi label="เวลาเล่นเฉลี่ย" value={k.avgMinutes != null ? `${k.avgMinutes} น.` : '–'} />
        <Kpi label="กลับมาวันที่ 1 / 7" value={`${k.d1 ?? '–'}% / ${k.d7 ?? '–'}%`} />
        <Kpi label="error 24 ชม." value={k.errorsToday} />
        <Kpi label="ฐานข้อมูล" value={`${k.dbMb} / 500 MB`} />
      </div>
      <Card title={`ต้องดู (${att.length})`}>
        {att.length === 0 && <p class="mut">ไม่มีอะไรผิดปกติ</p>}
        {att.map((a) => {
          const d = describe(a);
          return (
            <div class={'alert ' + a.level}>
              <div class="ic">{a.kind === 'skill' && a.dir === 'down' ? '↓' : ICON[a.kind] ?? '•'}</div>
              <div><b>{d.title}</b><div class="small mut">{d.detail}</div></div>
              <div class="row">
                {a.kind === 'dropoff' && <button onClick={() => go('balance', 'scaling')}>ปรับความยาก</button>}
                {a.kind === 'dropoff' && <button onClick={() => go('stats')}>ดูสถิติ</button>}
                {(a.kind === 'suspicious' || a.kind === 'gold') && <button onClick={() => act('ซ่อนคะแนนแล้ว', () => api.hideScore(String(a.userId), 'solo', true))}>ซ่อนคะแนน</button>}
                {(a.kind === 'suspicious' || a.kind === 'gold') && <button class="danger" onClick={() => act('แบนจาก leaderboard 30 วันแล้ว', () => api.banPlayer(String(a.userId), new Date(Date.now() + 30 * 864e5).toISOString()))}>แบน 30 วัน</button>}
                {a.kind === 'error' && <button onClick={() => go('stats')}>ดู error</button>}
                {a.kind === 'error' && <button onClick={() => act('ปิดมังกรชั่วคราวแล้ว', () => api.setFlag('dragon', false))}>ปิดมังกรชั่วคราว</button>}
                {a.kind === 'coop_review' && <button onClick={() => go('leaderboard', 'coop')}>ตรวจ co-op</button>}
                {a.kind === 'skill' && <button onClick={() => go('balance', 'skills.' + String(a.skill))}>ปรับสกิล</button>}
              </div>
            </div>
          );
        })}
      </Card>
    </>
  );
}
