// Admin Console (tickets 15–18). Shell = prototype A (sidebar pages), home = B (control room),
// Balance = C (tuning lab). Hosted separately behind Cloudflare Access; the database enforces
// the admin role on every RPC.
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import './style.css';
import { apiPromise, isDemo, type AdminApi } from './api';
import { Ai } from './pages/ai';
import { Announce } from './pages/announce';
import { Audit } from './pages/audit';
import { Balance } from './pages/balance';
import { Flags } from './pages/flags';
import { Home } from './pages/home';
import { Leaderboard } from './pages/leaderboard';
import { Players } from './pages/players';
import { Stats } from './pages/stats';
import { Loading, Toast } from './ui';

const PAGES: [string, string][] = [
  ['home', 'ห้องควบคุม'], ['balance', 'ค่าสมดุล'], ['ai', 'ผู้ช่วย AI'], ['flags', 'สวิตช์'], ['stats', 'สถิติ'],
  ['leaderboard', 'Leaderboard'], ['players', 'ผู้เล่น'], ['announce', 'ประกาศ'], ['audit', 'บันทึกการแก้ไข'],
];

function route(): { page: string; arg?: string } {
  const [page, arg] = location.hash.replace(/^#\/?/, '').split('/');
  return { page: PAGES.some(([p]) => p === page) ? page : 'home', arg: arg ? decodeURIComponent(arg) : undefined };
}

function SignIn({ api, notAdmin, email }: { api: AdminApi; notAdmin: boolean; email?: string }) {
  const [mail, setMail] = useState('');
  const [sent, setSent] = useState('');
  return (
    <div class="signin card">
      <h2>PIXEL HORDE ADMIN</h2>
      {notAdmin ? <p class="err">บัญชี {email} ไม่ใช่ admin</p> : <p class="mut">เข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์ admin</p>}
      <button class="pri" onClick={() => api.signInGoogle()}>เข้าสู่ระบบด้วย Google</button>
      <div class="row"><input type="email" placeholder="อีเมล admin" value={mail} onInput={(e) => setMail((e.target as HTMLInputElement).value)} aria-label="อีเมล" />
        <button onClick={async () => { try { await api.signInEmail(mail); setSent('ส่งลิงก์เข้าระบบไปที่อีเมลแล้ว'); } catch (e) { setSent((e as Error).message); } }}>ส่งลิงก์เข้าระบบ</button></div>
      {sent && <p class="small">{sent}</p>}
      {notAdmin && <button onClick={() => api.signOut().then(() => location.reload())}>ออกจากระบบ</button>}
      <p class="small mut">ยังไม่มี backend? เปิด <a href="?demo">โหมดตัวอย่าง</a> เพื่อลองใช้ด้วยข้อมูลจำลอง</p>
    </div>
  );
}

function App() {
  const [api, setApi] = useState<AdminApi | null>(null);
  const [who, setWho] = useState<{ email: string; isAdmin: boolean } | null | undefined>(undefined);
  const [r, setR] = useState(route());
  useEffect(() => { apiPromise.then(async (a) => { setApi(a); setWho(await a.whoami().catch(() => null)); }); }, []);
  useEffect(() => { const f = (): void => setR(route()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const go = (page: string, arg?: string): void => { location.hash = '#/' + page + (arg ? '/' + encodeURIComponent(arg) : ''); };
  if (!api || who === undefined) return <main class="solo"><Loading /></main>;
  if (!who || !who.isAdmin) return <main class="solo"><SignIn api={api} notAdmin={!!who} email={who?.email} /></main>;
  const body = r.page === 'balance' ? <Balance api={api} focus={r.arg} /> : r.page === 'ai' ? <Ai api={api} go={go} /> : r.page === 'flags' ? <Flags api={api} /> : r.page === 'stats' ? <Stats api={api} />
    : r.page === 'leaderboard' ? <Leaderboard api={api} initial={r.arg} /> : r.page === 'players' ? <Players api={api} /> : r.page === 'announce' ? <Announce api={api} />
    : r.page === 'audit' ? <Audit api={api} /> : <Home api={api} go={go} />;
  return (
    <div class={'shell' + (r.page === 'balance' ? ' wide' : '')}>
      <nav aria-label="เมนู">
        <div class="brand">PIXEL HORDE ADMIN{isDemo && <span class="demo">DEMO</span>}</div>
        {PAGES.map(([p, l]) => <a href={'#/' + p} class={r.page === p ? 'on' : ''} aria-current={r.page === p ? 'page' : undefined}>{l}</a>)}
        <div class="who small">{who.email}{!isDemo && <button class="link" onClick={() => api.signOut().then(() => location.reload())}>ออก</button>}</div>
      </nav>
      <main>{body}</main>
      <Toast />
    </div>
  );
}

render(<App />, document.getElementById('app')!);
