// The golden replays must reproduce the exact hash sequence inside real browser engines.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { build } from 'vite';

const root = fileURLToPath(new URL('../../', import.meta.url));
const outDir = fileURLToPath(new URL('./.out/', import.meta.url));
let bundle = '';

test.beforeAll(async () => {
  await build({
    root,
    logLevel: 'error',
    configFile: false,
    build: {
      outDir,
      emptyOutDir: true,
      minify: false,
      lib: { entry: root + 'packages/sim/src/index.ts', name: 'PixelHordeSim', formats: ['iife'], fileName: () => 'sim.js' },
    },
  });
  bundle = readFileSync(outDir + 'sim.js', 'utf8');
});

const goldenDir = fileURLToPath(new URL('../golden/', import.meta.url));
for (const name of readdirSync(goldenDir).filter((f) => f.endsWith('.json'))) {
  test(`golden replay ${name}`, async ({ page }) => {
    const replay = readFileSync(goldenDir + name, 'utf8');
    await page.setContent('<!doctype html><title>replay</title>');
    await page.addScriptTag({ content: bundle });
    const hashes = await page.evaluate((json) => {
      const r = JSON.parse(json);
      // @ts-expect-error global from the IIFE bundle
      return PixelHordeSim.runReplay(r).replay().hashes as number[];
    }, replay);
    expect(hashes).toEqual(JSON.parse(replay).hashes);
  });
}
