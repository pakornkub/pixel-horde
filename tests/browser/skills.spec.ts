// Skill board (ticket 53): with Awakened-only slots (awaken.lineSlots) the Stage-end screen shows Attack / Awakened /
// Passive / Bench rows; tapping a Bench entry makes only the slots of its group blink, and a tap there swaps it in.
// The pause menu opens the same board read-only.
import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.PT_SHOTS; // optional folder for screenshots (manual layout checks)
if (process.env.PT_PHONE) test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); // phone layout check
const tag = (): string => test.info().project.name + (process.env.PT_PHONE ? '-phone' : '');
const draft = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url');

async function start(page: Page, patch: object): Promise<void> {
  await page.route('**/*.supabase.co/**', (r) => r.abort());
  await page.addInitScript(() => localStorage.setItem('pixelhorde-named', '1'));
  await page.goto('/?offline&debug=awaken,god#draftcfg=' + draft(patch)); // Awakened from the start; god: the King must not end the Run
  await page.click('#startBtn');
}

test('Stage end: a benched Skill swaps only into a blinking attack slot; the Awakened row holds the Awakened skills', async ({ page }) => {
  // two attack slots (Signature + 1) so a new Skill goes to the Bench; free swaps; a short Stage with fast level-ups
  await start(page, { shared: { maxAttackSlots: 2, bench: { swapBase: 0 }, stage: { durBase: 12, overtime: 2 }, difficulty: { xp: 6 }, awaken: { lineSlots: 3, slots: 0, keep: 1 } } });
  const clear = page.locator('#ovClear.on');
  for (let i = 0; i < 200 && !(await clear.count()); i++) {
    if (await page.locator('#ovLevel.on').count()) {
      const opts = page.locator('#opts .opt');
      const bench = opts.filter({ hasText: /Bench/ });
      await ((await bench.count()) ? bench.first() : opts.first()).click({ timeout: 2000 }).catch(() => {}); // overlays fade in/out
    }
    if (await page.locator('#ovChest.on').count()) await page.locator('#ovChest').click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  await expect(clear).toBeVisible();
  const board = page.locator('#benchBox');
  await expect(board.locator('.row.awk .sk:not(.empty)')).toHaveCount(3); // the three Awakened skills (debug=awaken)
  await expect(board.locator('.row.awk > .lbl')).toContainText('3/3');
  if (SHOTS) await board.screenshot({ path: `${SHOTS}/board-${tag()}.png` });
  await expect(board.locator('.row').first()).toHaveClass(/bench-row/); // step ① starts at the Bench: it comes first
  await expect(board.locator('.row.atk .sk.sig')).toHaveAttribute('title', /.+/); // the Signature is locked (tooltip only, no inline tag)
  const benched = board.locator('.bench-row .sk:not(.empty):not(.del)');
  test.skip(!(await benched.count()), 'no Skill reached the Bench this Run');
  await benched.first().click();
  await expect(board).toHaveClass(/picking/);
  // only the non-Signature attack slot blinks; Awakened and passive slots are disabled
  await expect(board.locator('.row.atk .sk.target')).toHaveCount(1);
  await expect(board.locator('.row.awk .sk.target')).toHaveCount(0);
  await expect(board.locator('.row.awk button.sk:disabled')).toHaveCount(3);
  if (SHOTS) await board.screenshot({ path: `${SHOTS}/board-pick-${tag()}.png` });
  const before = await board.locator('.row.atk .sk.target .nm').textContent();
  const incoming = await benched.first().locator('.nm').textContent();
  await board.locator('.row.atk .sk.target').click();
  await expect(board.locator('.row.atk')).toContainText(incoming!);
  await expect(board.locator('.bench-row')).toContainText(before!);
  await expect(board).not.toHaveClass(/picking/);
});

test('pause menu: View skills shows the board read-only (Awakened row, no swapping)', async ({ page }) => {
  await start(page, { shared: { awaken: { lineSlots: 3, slots: 0, keep: 1 } } });
  await expect(page.locator('#pauseBtn')).toBeVisible();
  await page.click('#pauseBtn');
  await page.click('#skillsBtn');
  const view = page.locator('#ovSkills.on #skillsView');
  await expect(view).toBeVisible();
  await expect(view).toHaveClass(/ro/);
  await expect(view.locator('.row.awk > .lbl')).toContainText('3/3');
  await expect(view.locator('button')).toHaveCount(0); // nothing to press
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/pause-view-${tag()}.png` });
  await page.click('#skillsBack');
  await expect(page.locator('#ovPause.on')).toBeVisible();
  await page.click('#resumeBtn');
  await expect(page.locator('#ovPause.on')).toHaveCount(0);
});

test('before Awakening: the three Awakened slots are one compact locked row with the progress checklist', async ({ page }) => {
  await page.route('**/*.supabase.co/**', (r) => r.abort());
  await page.addInitScript(() => localStorage.setItem('pixelhorde-named', '1'));
  await page.goto('/?offline&debug=god#draftcfg=' + draft({ shared: { awaken: { lineSlots: 3, slots: 0, keep: 1 } } }));
  await page.click('#startBtn');
  await expect(page.locator('#pauseBtn')).toBeVisible();
  await page.click('#pauseBtn');
  await page.click('#skillsBtn');
  const view = page.locator('#ovSkills.on #skillsView');
  const locks = view.locator('.row.awk.locked .sk.lock');
  await expect(locks).toHaveCount(3);
  const ys = await locks.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(ys).size).toBe(1); // all three on one line, even on a phone
  await expect(view.locator('.awk-prog')).toContainText('☐');
  if (SHOTS) await view.screenshot({ path: `${SHOTS}/locked-${tag()}.png` });
});
