// Worker thread: runs the Jobs it is sent and posts back their metrics.
import { parentPort } from 'node:worker_threads';
import { runOne, type Job } from './run';

parentPort!.on('message', (job: Job) => {
  try { parentPort!.postMessage({ ok: true, m: runOne(job) }); } catch (e) { parentPort!.postMessage({ ok: false, err: String((e as Error)?.stack || e), job }); }
});
