// Careers: `node scripts/playtest/career.mjs [careers] [runs] [out.json]` — a fresh account plays Runs in a row and
// spends its Gold in the shop after each (career.ts). Env: PT_PASS (as main.mjs), PT_HEROES, PT_PATCH_JSON, PT_LABEL,
// PT_RANDOM=1 (random picks, slower reactions: closer to an average player).
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.join(here, '.out', 'career.mjs');
spawnSync('node', [path.join(here, 'build.mjs')], { env: { ...process.env, PT_ENTRY: path.join(here, 'career.ts'), PT_OUT: bundle }, stdio: 'inherit' });

const [nArg = '8', runsArg = '12', outArg] = process.argv.slice(2);
const heroes = (process.env.PT_HEROES || 'mage').split(',');
const jobs = heroes.flatMap((hero) => Array.from({ length: Number(nArg) }, (_, i) => ({
  id: i, hero, seed: i + 1, runs: Number(runsArg), pass: process.env.PT_PASS, label: process.env.PT_LABEL || 'career',
  patch: JSON.parse(process.env.PT_PATCH_JSON || '{}'), ...(process.env.PT_RANDOM ? { profile: { pick: 'random', react: 0.4 } } : {}),
})));
const out = outArg || path.join(here, '.out', 'career.json');
await mkdir(path.dirname(out), { recursive: true });
const results = [];
let next = 0;
const t0 = Date.now();
await Promise.all(Array.from({ length: Math.min(cpus().length, jobs.length) }, () => new Promise((resolve) => {
  const w = new Worker(bundle);
  const feed = () => { if (next < jobs.length) w.postMessage(jobs[next++]); else { w.terminate(); resolve(); } };
  w.on('message', (r) => { if (r.ok) results.push(r.m); else console.error('career failed', r.err); process.stderr.write(`\r${results.length}/${jobs.length} careers, ${((Date.now() - t0) / 1000).toFixed(0)} s`); feed(); });
  w.on('error', (e) => { console.error(e); resolve(); });
  feed();
})));
process.stderr.write('\n');
await writeFile(out, JSON.stringify(results));
console.log('wrote', out);
