// Playtest runner: `node scripts/playtest/main.mjs <suite> [seeds] [out.json]`
// Builds the instrumented bundle, runs every Job of the suite on all CPU cores, writes the metrics.
import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { suites } from './suites.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
await import('./build.mjs');

const [suiteName = 'heroes', seedsArg = '12', outArg] = process.argv.slice(2);
const make = suites[suiteName];
if (!make) { console.error('unknown suite', suiteName, Object.keys(suites)); process.exit(1); }
const jobs = make(Number(seedsArg));
const out = outArg || path.join(here, '.out', `${suiteName}.json`);
await mkdir(path.dirname(out), { recursive: true });

const n = Math.max(1, Math.min(cpus().length, jobs.length));
const results = [];
let next = 0, done = 0;
const t0 = Date.now();
await Promise.all(Array.from({ length: n }, () => new Promise((resolve) => {
  const w = new Worker(process.env.PT_OUT || path.join(here, '.out', 'worker.mjs'));
  const feed = () => { if (next < jobs.length) w.postMessage(jobs[next++]); else { w.terminate(); resolve(); } };
  w.on('message', (r) => {
    done++;
    if (r.ok) results.push(r.m); else console.error('job failed', r.job, r.err);
    if (done % 4 === 0 || done === jobs.length) process.stderr.write(`\r${done}/${jobs.length} runs, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    feed();
  });
  w.on('error', (e) => { console.error(e); resolve(); });
  feed();
})));
process.stderr.write('\n');
await writeFile(out, JSON.stringify(results));
console.log('wrote', out);
