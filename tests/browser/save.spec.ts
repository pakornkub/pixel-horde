// Suspend / resume (ticket 31): save and quit from the pause menu, then continue from the title.
import { expect, test } from '@playwright/test';

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
