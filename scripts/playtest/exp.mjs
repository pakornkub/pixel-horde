// Tuning experiments: `node scripts/playtest/exp.mjs <patches.json> [seeds] [shop] [out]`
// patches.json = { "<label>": <Balance Config patch>, ... }; every patch runs every Hero with the same
// seeds (on top of the live config), so differences come from the patch, not luck.
// Uses its own bundle (.out/exp.mjs) built from the current code.
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const [file, seeds = '12', shop = 'mid', out = path.join(here, '.out', 'exp.json')] = process.argv.slice(2);
const patches = JSON.parse(await readFile(file, 'utf8'));
const env = { ...process.env, PT_OUT: path.join(here, '.out', 'exp.mjs') };
spawnSync('node', [path.join(here, 'build.mjs')], { env, stdio: 'inherit' });
const all = [];
for (const [label, patch] of Object.entries(patches)) {
  const tmp = path.join(here, '.out', `exp-${label}.json`);
  const r = spawnSync('node', [path.join(here, 'main.mjs'), 'patch', seeds, tmp], {
    env: { ...env, PT_LABEL: label, PT_SHOP: shop, PT_PATCH_JSON: JSON.stringify(patch.patch ?? patch), ...(patch.crack ? { PT_CRACK: String(patch.crack) } : {}), ...(patch.noAwaken ? { PT_NOAWAKEN: '1' } : {}), ...(patch.random ? { PT_RANDOM: '1' } : {}) },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (r.status !== 0) { console.error('failed', label); continue; }
  all.push(...JSON.parse(await readFile(tmp, 'utf8')));
}
await writeFile(out, JSON.stringify(all));
console.log('wrote', out);
