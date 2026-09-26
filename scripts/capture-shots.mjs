// Captures the website / README screenshots from the real game with a scripted bot.
//   npm run build && npx vite preview apps/game --port 4190     (game)
//   npm run dev -w @pixel-horde/site                            (site, only for og.png)
//   node scripts/capture-shots.mjs [gameUrl] [siteUrl]
// Uses the installed Edge/Chrome (PW_CHANNEL=chrome|msedge, default msedge) or PW_CHROMIUM_PATH.
// Runs offline (?offline) in god mode so nothing reaches the live backend or leaderboards.
/* global document, localStorage -- used inside page.evaluate / addInitScript callbacks */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const GAME = process.argv[2] || 'http://localhost:4190';
const SITE = process.argv[3] || 'http://localhost:5180';
const OUT = 'apps/site/public/shots';
const ONLY = process.env.ONLY?.split(',');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : { channel: process.env.PW_CHANNEL || 'msedge' });

async function openGame(flags = '') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
  page.on('pageerror', (e) => console.log('  page error:', e.message));
  await page.addInitScript(() => {
    localStorage.setItem('pixelhorde-settings', JSON.stringify({ tips: false, tipsSeen: [] }));
  });
  await page.goto(`${GAME}/?offline&debug=god${flags ? ',' + flags : ''}`);
  await page.waitForTimeout(1200);
  if (await page.isVisible('#nameInput')) { await page.fill('#nameInput', 'Lyra'); await page.click('#nameOk'); }
  await page.waitForTimeout(800);
  return page;
}

const overlays = (page) => page.evaluate(() => [...document.querySelectorAll('.overlay.on')].map((e) => e.id));

/** Walks in wide circles for `secs`, picking the first level-up card; `onLevel` may screenshot it. */
async function play(page, secs, onLevel) {
  const keys = [['d'], ['d', 's'], ['s'], ['s', 'a'], ['a'], ['a', 'w'], ['w'], ['w', 'd']];
  const end = Date.now() + secs * 1000;
  let i = 0;
  while (Date.now() < end) {
    const k = keys[Math.floor(i / 2) % keys.length];
    for (const x of k) await page.keyboard.down(x);
    await page.waitForTimeout(300);
    for (const x of k) await page.keyboard.up(x);
    i++;
    const on = await overlays(page);
    if (on.includes('ovLevel')) {
      if (onLevel && (await onLevel(page)) === 'stop') return;
      await page.click('#opts > *:first-child').catch(() => {});
    } else if (on.length) {
      await page.click(`#${on[0]} .btn`).catch(() => {});
    }
  }
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const want = (n) => !ONLY || ONLY.includes(n);

if (want('title') || want('hero')) {
  const page = await openGame();
  if (want('title')) await shot(page, 'title');
  if (want('hero')) { await page.click('#heroBtn'); await page.waitForTimeout(700); await shot(page, 'hero'); }
  await page.close();
}

if (want('play') || want('level') || want('king')) {
  const page = await openGame();
  await page.click('#startBtn');
  let levels = 0;
  await play(page, 22, async (p) => { if (++levels === 1 && want('level')) await shot(p, 'level'); });
  if (want('play')) await shot(page, 'play');
  await play(page, 16);
  if (want('king')) await shot(page, 'king');
  await page.close();
}

if (want('realm')) {
  const page = await openGame('realm:emberforge');
  await page.click('#startBtn');
  await play(page, 26);
  await shot(page, 'realm');
  await page.close();
}

if (want('og')) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, locale: 'en-US' });
  await page.goto(SITE + '/?lang=en');
  await page.addStyleTag({ content: '.top,.scroll-hint,.badges,.cta-row{display:none!important}.hero{min-height:630px!important}' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'apps/site/public/img/og.png' });
  await page.close();
}

await browser.close();
console.log('done →', OUT);
