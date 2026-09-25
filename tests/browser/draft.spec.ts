// "Test live" from the Admin tuning lab: the game runs a local draft config, offline, with a badge.
import { expect, test } from '@playwright/test';

test('game runs a draft Balance Config from #draftcfg without contacting the server', async ({ page }) => {
  const calls: string[] = [];
  await page.route('**/*.supabase.co/**', (r) => { calls.push(r.request().url()); return r.abort(); });
  const patch = Buffer.from(JSON.stringify({ shared: { stage: { durBase: 30 } } })).toString('base64url');
  await page.addInitScript(() => localStorage.setItem('pixelhorde-named', '1'));
  await page.goto('/#draftcfg=' + patch);
  await expect(page.locator('#draftBadge')).toBeVisible();
  await page.click('#startBtn');
  await expect(page.locator('#pauseBtn')).toBeVisible();
  expect(calls).toEqual([]);
});
