// Ending after beating Umbra (ticket 55): story pictures, the "Unlocked" page, and the title's Endless button.
import { expect, test } from '@playwright/test';

const SIZES = [['landscape', { width: 1280, height: 720 }], ['portrait', { width: 390, height: 844 }]] as const;
/** Story + Unlocked page also on a small phone and a phone held sideways. */
const ENDING_SIZES = [...SIZES, ['phone375', { width: 375, height: 667 }], ['phoneLand', { width: 844, height: 390 }]] as const;

for (const [name, viewport] of ENDING_SIZES) {
  test(`first win: four story pictures, then what the win unlocked (${name})`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.route('**/*.supabase.co/**', (r) => r.abort());
    await page.addInitScript(() => localStorage.setItem('pixelhorde-named', '1'));
    await page.goto('/?offline&debug=ending');
    const ov = page.locator('#ovEnding.on.story');
    await expect(ov).toBeVisible();
    const pic = (): Promise<string> => page.locator('#endPic').evaluate((e) => (e as HTMLElement).style.backgroundImage);
    expect(await pic()).toContain(viewport.height > viewport.width ? 'p1-tall.webp' : 'p1-wide.webp');
    // every picture is served (a missing file would leave a blank screen)
    for (let i = 1; i <= 4; i++) {
      const res = await page.request.get(`/ending/p${i}-${viewport.height > viewport.width ? 'tall' : 'wide'}.webp`);
      expect(res.ok()).toBe(true);
      expect((await res.body()).length).toBeLessThan(300 * 1024);
    }
    const caps: string[] = [];
    for (let i = 0; i < 4; i++) {
      await expect(page.locator('#endNext')).toBeInViewport();
      caps.push(await page.locator('#endCap').innerText());
      await page.screenshot({ path: info.outputPath(`story-${i + 1}.png`) });
      await page.click('#endNext');
    }
    expect(new Set(caps).size).toBe(4);
    await expect(page.locator('#endUnlock')).toBeVisible();
    await expect(page.locator('#endList li')).toHaveCount(6); // Heart Crack 1, Endless, special shop, Mora on sale, a Weapon, the achievements folded into one line
    await expect(page.locator('#finishBtn')).toBeInViewport();
    await expect(page.locator('#endlessBtn')).toBeInViewport();
    await page.screenshot({ path: info.outputPath('unlocked.png') });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.click('#finishBtn');
    await expect(page.locator('#ovEnding')).toBeHidden();
  });
}

test('a later win opens on the Unlocked page; the story can be replayed or skipped', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (r) => r.abort());
  await page.addInitScript(() => localStorage.setItem('pixelhorde-named', '1'));
  await page.goto('/?offline&debug=ending:later');
  await expect(page.locator('#endUnlock')).toBeVisible();
  await expect(page.locator('#endList li').first()).toContainText(/2/); // Heart Crack 2
  await expect(page.locator('#endList')).not.toContainText(/Endless/);
  await page.click('#endReplay');
  await expect(page.locator('#ovEnding.story')).toBeVisible();
  await page.click('#endSkip');
  await expect(page.locator('#endUnlock')).toBeVisible();
});

test('the title shows Endless only after a win, and it starts an Endless Run', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (r) => r.abort());
  await page.addInitScript(() => localStorage.setItem('pixelhorde-named', '1'));
  await page.goto('/?offline');
  await expect(page.locator('#startBtn')).toBeVisible();
  await expect(page.locator('#endlessRunBtn')).toBeHidden();
  await page.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('pixelhorde-meta') || '{}');
    localStorage.setItem('pixelhorde-meta', JSON.stringify({ ...m, crackMax: 1 }));
  });
  for (const viewport of [...SIZES.map(([, v]) => v), { width: 375, height: 667 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/?offline');
    await expect(page.locator('#endlessRunBtn')).toBeInViewport();
    await expect(page.locator('#startBtn')).toBeInViewport();
    // the label stays inside the button on small phones
    expect(await page.locator('#endlessRunBtn').evaluate((b) => b.scrollWidth <= b.clientWidth), `${viewport.width}px`).toBe(true);
  }
  await page.click('#endlessRunBtn');
  await expect(page.locator('#ovTitle')).toBeHidden();
  await expect(page.locator('#pauseBtn')).toBeVisible();
});

test('a title Endless Run that falls before Chapter 9 shows the Chapter reached, not a 0 Score', async ({ page }, info) => {
  await page.route('**/*.supabase.co/**', (r) => r.abort());
  const patch = Buffer.from(JSON.stringify({ shared: { player: { hp: 1 } } })).toString('base64url');
  await page.addInitScript(() => {
    localStorage.setItem('pixelhorde-named', '1');
    const m = JSON.parse(localStorage.getItem('pixelhorde-meta') || '{}');
    localStorage.setItem('pixelhorde-meta', JSON.stringify({ ...m, crackMax: 1 }));
  });
  await page.goto('/?offline#draftcfg=' + patch);
  await page.click('#endlessRunBtn');
  const over = page.locator('#ovOver.on');
  for (let i = 0; i < 300 && !(await over.count()); i++) {
    if (await page.locator('#ovRevive.on').count()) await page.click('#giveUpBtn');
    if (await page.locator('#ovLevel.on').count()) await page.locator('#opts .opt').first().click();
    await page.waitForTimeout(200);
  }
  await expect(over).toBeVisible();
  await expect(page.locator('#scoreBox')).toBeHidden();
  await expect(page.locator('#endlessBox .reach')).toHaveText(/Chapter( reached)? 1$/); // "Chapter reached 1" / "ไปถึง Chapter 1"
  await expect(page.locator('#endlessBox .sub')).toContainText('9');
  await expect(page.locator('#endlessBox .tot')).toHaveCount(0); // no big 0
  await page.screenshot({ path: info.outputPath('endless-over.png') });
});
