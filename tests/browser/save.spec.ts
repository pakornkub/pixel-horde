// Suspend / resume (ticket 31): save and quit from the pause menu, then continue from the title.
import { expect, test, type Page, type Route } from '@playwright/test';

test('save and quit, then continue from the same Chapter (offline copy)', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (r) => r.abort());
  await page.addInitScript(() => localStorage.setItem('pixelhorde-named', '1'));
  await page.goto('/?debug=god');
  await expect(page.locator('#continueBtn')).toBeHidden();
  await page.click('#startBtn');
  await page.waitForTimeout(1500);
  await page.keyboard.press('KeyP');
  await expect(page.locator('#ovPause')).toBeVisible();
  await page.click('#saveQuitBtn');
  await expect(page.locator('#ovTitle')).toBeVisible();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('pixelhorde-save') || 'null'));
  expect(save?.chapter).toBe(1);
  await expect(page.locator('#continueBtn')).toBeVisible();
  await expect(page.locator('#continueBtn')).toContainText('1');
  await page.click('#continueBtn');
  await expect(page.locator('#pauseBtn')).toBeVisible();
  // the save slot is used up once the Run continues
  expect(await page.evaluate(() => localStorage.getItem('pixelhorde-save'))).toBe('');
});

test('a new Run asks before discarding a save', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (r) => r.abort());
  await page.addInitScript(() => localStorage.setItem('pixelhorde-named', '1'));
  await page.goto('/?debug=god');
  await page.click('#startBtn');
  await page.waitForTimeout(1000);
  await page.keyboard.press('KeyP');
  await page.click('#saveQuitBtn');
  let asked = '';
  page.once('dialog', (d) => { asked = d.message(); void d.dismiss(); });
  await page.click('#startBtn');
  await page.waitForTimeout(300);
  expect(asked).toMatch(/Chapter 1|ทิ้งรอบ/);
  await expect(page.locator('#ovTitle')).toBeVisible(); // dismissed: still on the title, save kept
  await expect(page.locator('#continueBtn')).toBeVisible();
});

// continueRun() against a mocked online backend: resume_run failures must not all look the same
// (a genuinely stale checkpoint vs. a transient network hiccup while the local save is still good).
const USER = '11111111-1111-4111-8111-111111111111';
function jwt(sessionId: string): string {
  const b64 = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER, role: 'authenticated', session_id: sessionId, is_anonymous: true, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}
const LOCAL_SAVE = {
  runId: '22222222-2222-4222-8222-222222222222', token: '33333333-3333-4333-8333-333333333333',
  seed: 12345, hero: 'mage', weapon: 'judgement', crack: 0,
  chapter: 2, configVersion: 0, hash: 'localhash', data: '{}',
  savedAt: Date.now(), clientRunId: 'client-1',
};

/** resume: how the mocked `resume_run` RPC responds to the one resume attempt this test drives. */
async function mockSupabase(page: Page, resume: 'ok' | 'stale' | 'offline'): Promise<void> {
  const json = (route: Route, body: unknown, status = 200): Promise<void> =>
    route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  await page.route('**/*.supabase.co/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.pathname.endsWith('/auth/v1/signup')) {
      return json(route, { access_token: jwt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: USER, aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } });
    }
    const m = url.pathname.match(/\/rest\/v1\/rpc\/(\w+)/);
    if (m) {
      const fn = m[1];
      switch (fn) {
        case 'claim_session': return json(route, { id: USER, nickname: 'Hero#0001', role: 'player' });
        case 'check_session': return json(route, true);
        case 'get_live_state': return json(route, { flags: {}, configVersion: 0, announcements: [] });
        case 'get_meta': return json(route, { gold: 0, shop: {}, heroes: ['mage'], weapons: [], legacyImported: true });
        case 'get_checkpoint': return json(route, null); // continue from the local save instead
        case 'resume_run':
          if (resume === 'offline') { await route.abort('failed'); return; }
          if (resume === 'stale') return json(route, { message: 'STALE_CHECKPOINT', code: '22023' }, 400);
          return json(route, { ok: true, seasonChanged: false });
        default: return json(route, { message: 'unknown rpc ' + fn }, 404);
      }
    }
    return json(route, {}, 404);
  });
}

test('continueRun: a genuinely stale checkpoint clears the local save and says so', async ({ page }) => {
  await mockSupabase(page, 'stale');
  await page.addInitScript((save) => { localStorage.setItem('pixelhorde-named', '1'); localStorage.setItem('pixelhorde-save', JSON.stringify(save)); }, LOCAL_SAVE);
  await page.goto('/');
  await expect(page.locator('#acctTxt')).not.toContainText(/offline|ออฟไลน์/);
  await expect(page.locator('#continueBtn')).toBeVisible();
  await page.click('#continueBtn');
  await expect(page.locator('#ovMsg')).toBeVisible();
  await expect(page.locator('#msgTxt')).toContainText(/no longer be continued|เล่นต่อไม่ได้แล้ว/);
  expect(await page.evaluate(() => localStorage.getItem('pixelhorde-save'))).toBe('');
  await page.click('#msgBtn');
  await expect(page.locator('#continueBtn')).toBeHidden(); // the (now cleared) save is gone
});

test('continueRun: a transient failure keeps the local save and offers a retry, not "stale"', async ({ page }) => {
  await mockSupabase(page, 'offline');
  await page.addInitScript((save) => { localStorage.setItem('pixelhorde-named', '1'); localStorage.setItem('pixelhorde-save', JSON.stringify(save)); }, LOCAL_SAVE);
  await page.goto('/');
  await expect(page.locator('#acctTxt')).not.toContainText(/offline|ออฟไลน์/);
  await expect(page.locator('#continueBtn')).toBeVisible();
  await page.click('#continueBtn');
  await expect(page.locator('#ovMsg')).toBeVisible();
  await expect(page.locator('#msgTxt')).toContainText(/Couldn't reach the server|ต่อกับ server ไม่ได้/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pixelhorde-save') || 'null')?.hash)).toBe(LOCAL_SAVE.hash);
  await page.click('#msgBtn');
  await expect(page.locator('#continueBtn')).toBeVisible(); // the save survived: still offered
});
