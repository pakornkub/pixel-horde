// Admin Console smoke (demo data): pages load, the tuning lab stages → publishes a change, flags toggle.
import { expect, test } from '@playwright/test';

const ADMIN = 'http://localhost:4175/?demo';

test('admin: control room, tuning lab publish, flags, leaderboard', async ({ page }) => {
  await page.goto(ADMIN);
  await expect(page.getByRole('heading', { name: 'ห้องควบคุม' })).toBeVisible();
  await expect(page.locator('.alert')).not.toHaveCount(0);

  await page.goto(ADMIN + '#/balance');
  await page.fill('.tree input', 'bossAt');
  await page.locator('.tree .it').first().click();
  const num = page.locator('.center input[type=number]');
  await num.fill('3');
  await num.press('Enter');
  await expect(page.locator('.center .err')).toContainText('ต้องอยู่ระหว่าง');
  await num.fill('0.6');
  await num.press('Enter');
  await expect(page.locator('.stage')).toContainText('รอ publish (1)');
  await expect(page.locator('.stage a.btn')).toHaveAttribute('href', /#draftcfg=/);
  await page.click('.stage button.pri');
  await expect(page.locator('#toast')).toContainText('โน้ต');
  await page.fill('.stage input', 'boss a bit later');
  await page.click('.stage button.pri');
  await expect(page.locator('#toast')).toContainText('Publish v3');

  await page.goto(ADMIN + '#/flags');
  await page.getByRole('switch', { name: 'Co-op' }).click();
  await expect(page.locator('#toast')).toContainText('มีผลทันที');

  await page.goto(ADMIN + '#/leaderboard');
  await expect(page.locator('table tbody tr')).not.toHaveCount(0);
  await page.goto(ADMIN + '#/audit');
  await expect(page.locator('table tbody')).toContainText('balance_configs');
});

test('admin: mobile nav is a scrollable top bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto(ADMIN);
  const nav = page.locator('.shell nav');
  const box = await nav.boundingBox();
  expect(box!.height).toBeLessThan(120);
  expect(await nav.evaluate((n) => getComputedStyle(n).overflowX)).toBe('auto');
});

test('admin: AI assistant proposes changes that land in the tuning lab draft', async ({ page }) => {
  await page.goto(ADMIN + '#/ai');
  await page.fill('textarea', 'บอสด่านแรกแรงไป');
  await page.getByRole('button', { name: 'ส่ง', exact: true }).click();
  await expect(page.locator('table tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: /ส่งเข้าฉบับร่าง/ }).click();
  await expect(page.locator('.stage')).toContainText('รอ publish (2)');
  await expect(page.locator('.stage')).toContainText('overtimeUltMul');
  await expect(page.locator('.stage input')).toHaveValue('ตามคำแนะนำของผู้ช่วย AI');
});
