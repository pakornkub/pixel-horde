// Title screen (ticket 43): big Play, animated Hero, Hero & Weapon panel, fits portrait and landscape.
import { expect, test } from '@playwright/test';

for (const [name, viewport] of [['landscape', { width: 1280, height: 720 }], ['portrait', { width: 390, height: 844 }]] as const) {
  test(`title screen layout (${name})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route('**/*.supabase.co/**', (r) => r.abort());
    await page.addInitScript(() => localStorage.setItem('pixelhorde-named', '1'));
    await page.goto('/');
    for (const id of ['#startBtn', '#heroBtn', '#boardBtn', '#shopBtn1', '#collBtn', '#settingsBtn1']) await expect(page.locator(id)).toBeInViewport();
    await expect(page.locator('#coopBtn')).toBeDisabled();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    await expect(page.locator('#titleSel')).toContainText('Judgement');
    await page.click('#heroBtn');
    await expect(page.locator('#ovHero')).toBeVisible();
    await page.locator('#chars .ch').nth(1).click(); // Bram is free
    await page.click('#heroDone');
    await expect(page.locator('#ovTitle')).toBeVisible();
    await expect(page.locator('#titleSel')).toContainText('Bram');
  });
}
