// Co-op end to end (tickets 41/42): two browsers, the real room worker (`wrangler dev` on :8787).
// Skipped when that server is not running (CI starts it before Playwright).
import { expect, test, type Page } from '@playwright/test';

const ROOM = 'ws://127.0.0.1:8787';

test('host creates a room, a guest joins by invite link, both play the same world', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium', 'network flow: one browser is enough');
  const up = await fetch('http://127.0.0.1:8787/health').then((r) => r.ok).catch(() => false);
  test.skip(!up, 'room worker not running');
  const page = async (): Promise<Page> => {
    const p = await (await browser.newContext({ viewport: { width: 800, height: 450 } })).newPage();
    await p.route('**/*.supabase.co/**', (r) => r.abort());
    await p.addInitScript(() => localStorage.setItem('pixelhorde-named', '1'));
    return p;
  };
  const host = await page(), guest = await page();
  const q = 'debug=god&room=' + encodeURIComponent(ROOM);
  await host.goto('/?' + q);
  await host.click('#coopBtn');
  await host.click('#coopCreate');
  await expect(host.locator('#coopRoom')).toBeVisible();
  const code = (await host.textContent('#coopCodeTxt'))!;
  expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{5}$/);
  await guest.goto(`/?join=${code}&${q}`);
  await expect(guest.locator('#coopList li')).toHaveCount(2);
  await expect(host.locator('#coopGo')).toBeDisabled(); // the guest is not ready yet
  await guest.click('#coopGo');
  await expect(host.locator('#coopGo')).toBeEnabled();
  await host.click('#coopGo');
  await expect(host.locator('#ovCoop')).toBeHidden();
  await expect(guest.locator('#ovCoop')).toBeHidden();
  // play a little
  for (let i = 0; i < 20; i++) {
    for (const p of [host, guest]) if (await p.locator('#ovLevel.on').count()) await p.locator('#opts .opt').first().click();
    await guest.waitForTimeout(300);
  }
  await expect(guest.locator('#ovMsg')).toBeHidden(); // still connected and playing
  // the host leaves: the guest's room closes and they return to the title with a message
  await host.close();
  await expect(guest.locator('#ovMsg')).toBeVisible({ timeout: 15_000 });
});
