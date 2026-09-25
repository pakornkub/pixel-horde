// End-to-end: the built game against a mocked Supabase HTTP API (auth + RPC), so online flows
// are exercised in real browsers without a live project.
import { expect, test, type Page, type Route } from '@playwright/test';

const USER = '11111111-1111-4111-8111-111111111111';
function jwt(sessionId: string): string {
  const b64 = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER, role: 'authenticated', session_id: sessionId, is_anonymous: true, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

interface Fake { calls: string[]; meta: { gold: number; shop: Record<string, number>; heroes: string[]; weapons: string[]; legacyImported: boolean }; nickname: string }

async function mockSupabase(page: Page): Promise<Fake> {
  const f: Fake = { calls: [], meta: { gold: 300, shop: {}, heroes: ['mage', 'knight'], weapons: [], legacyImported: true }, nickname: 'Hero#0001' };
  const json = (route: Route, body: unknown, status = 200): Promise<void> =>
    route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  await page.route('**/*.supabase.co/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.pathname.endsWith('/auth/v1/signup')) {
      const body = req.postDataJSON() as { data?: { nickname?: string } };
      if (body?.data?.nickname) f.nickname = body.data.nickname;
      f.calls.push('signup');
      return json(route, { access_token: jwt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: USER, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
    }
    const m = url.pathname.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      const fn = m[1], args = (req.postDataJSON() || {}) as Record<string, unknown>;
      f.calls.push(fn);
      switch (fn) {
        case 'claim_session': return json(route, { id: USER, nickname: f.nickname, role: 'player' });
        case 'check_session': return json(route, true);
        case 'get_live_state': return json(route, { flags: { coop: true }, configVersion: 0, announcements: [{ id: 1, title: { th: 'อีเวนต์ Blood Moon', en: 'Blood Moon weekend' }, body: { th: 'เหรียญ ×2', en: 'Gold ×2' }, endsAt: null }] });
        case 'get_meta': return json(route, f.meta);
        case 'start_run': return json(route, { runId: '22222222-2222-4222-8222-222222222222', token: '33333333-3333-4333-8333-333333333333', seed: 12345, configVersion: 0 });
        case 'submit_run': {
          const p = args.p as { gold: number };
          f.meta.gold += p.gold;
          return json(route, { status: 'submitted', reason: null, meta: f.meta });
        }
        case 'buy_upgrade': f.meta.gold -= 30; f.meta.shop.power = 1; return json(route, f.meta);
        case 'get_leaderboard':
          return json(route, { board: args.p_board, season: 1, total: 2, around: [], me: null,
            top: [{ rank: 1, userId: 'x', name: 'Pim', title: 'Dragon Tamer', score: 80900, chapter: 8, hero: 'ranger', weapon: null, verified: true, at: '', me: false },
                  { rank: 2, userId: USER, name: f.nickname, title: null, score: 24150, chapter: 6, hero: 'mage', weapon: null, verified: false, at: '', me: true }] });
        default: return json(route, { message: 'unknown rpc ' + fn }, 404);
      }
    }
    return json(route, {}, 404);
  });
  return f;
}

test('online: sign in with a nickname, server Gold, shop, leaderboard, Run submit', async ({ page }) => {
  const f = await mockSupabase(page);
  await page.goto('/?debug=god');
  await expect(page.locator('#ovName')).toHaveClass(/on/);
  await page.fill('#nameInput', 'Pim');
  await page.click('#nameOk');
  await expect(page.locator('#acctTxt')).toContainText('Pim');
  await expect(page.locator('#acctTxt')).not.toContainText(/offline|ออฟไลน์/);
  expect(f.calls.filter((c) => c === 'signup' || c === 'claim_session').slice(0, 2)).toEqual(['signup', 'claim_session']);
  expect(f.calls).toContain('get_live_state');
  await expect(page.locator('#bestTxt')).toContainText('300');
  await expect(page.locator('#news')).toContainText(/Blood Moon/);

  await page.click('#shopBtn1');
  await page.locator('#shopList .srow').first().locator('.buy').click();
  await expect(page.locator('#shopGold')).toContainText('270');
  await page.click('#shopBack');

  await page.click('#boardBtn');
  await expect(page.locator('#boardList li')).toHaveCount(2);
  await expect(page.locator('#boardList li.me')).toContainText('Pim');
  await page.click('#boardBack');

  await page.click('#startBtn');
  await expect(page.locator('#pauseBtn')).toBeVisible();
  expect(f.calls).toContain('start_run');
  await page.keyboard.press('KeyP');
  await page.click('#leaveBtn');
  await page.click('#leaveBtn');
  await expect.poll(() => f.calls.includes('submit_run')).toBe(true);
});

test('offline fallback when the server is unreachable', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (r) => r.abort('failed'));
  await page.addInitScript(() => localStorage.setItem('pixelhorde-named', '1'));
  await page.goto('/');
  await expect(page.locator('#acctTxt')).toContainText(/offline|ออฟไลน์/);
  await page.click('#startBtn');
  await expect(page.locator('#pauseBtn')).toBeVisible();
});
