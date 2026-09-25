// Chapter flow (ticket 19): a short draft Stage ends (King killed or escaped), the clear screen
// explains it, and the route screen offers two Realms whose choice starts Chapter 2 or a re-pick.
import { expect, test } from '@playwright/test';

test('clear screen → route screen with two Realms → next Stage starts', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (r) => r.abort());
  const patch = Buffer.from(JSON.stringify({ shared: { stage: { durBase: 4, overtime: 2 } } })).toString('base64url');
  await page.addInitScript(() => localStorage.setItem('pixelhorde-named', '1'));
  await page.goto('/?debug=god#draftcfg=' + patch); // god: the King must not end the Run
  await page.click('#startBtn');
  // Level-ups and chests interrupt; Chapter 1 replays Greenvale after an escape, so keep going
  // through clear screens until the route screen shows.
  const route = page.locator('#ovRoute.on');
  let clears = 0;
  for (let i = 0; i < 160 && !(await route.count()); i++) {
    if (await page.locator('#ovLevel.on').count()) await page.locator('#opts .opt').first().click();
    if (await page.locator('#ovClear.on').count()) {
      await expect(page.locator('#clearTitle')).toHaveText(/CHAPTER 1 CLEAR|KING ESCAPED|ราชาหนี/);
      clears++;
      await page.click('#nextBtn');
    }
    await page.waitForTimeout(200);
  }
  expect(clears).toBeGreaterThan(0);
  await expect(route).toBeVisible();
  await expect(page.locator('#routeOpts .opt')).toHaveCount(2);
  await expect(page.locator('#routeOpts .opt').first()).toContainText(/ราชา|King/i);
  await page.locator('#routeOpts .opt').first().click();
  await expect(route).toBeHidden();
  await expect(page.locator('#pauseBtn')).toBeVisible();
});
