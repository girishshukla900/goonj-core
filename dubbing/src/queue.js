// Sequential job queue. Job and track state live in PostgreSQL.
import * as repo from '../../db/src/dubbing_repo.js';
import { runDubJob } from './pipeline.js';

const pending = [];
let running = false;

export function enqueue(job) {
  pending.push(job);
  setImmediate(drain);
  return job;
}

async function drain() {
  if (running) return;
  running = true;
  while (pending.length) {
    const job = pending.shift();
    await repo.updateJob(job.id, { status: 'processing' });
    try {
      const track = await runDubJob(job, (step, pct) => {
        job.step = step;
        job.progress = pct;
        repo.updateJob(job.id, { step, progress: pct }).catch(() => {});
      });
      await repo.saveTrack(track);
      await repo.updateJob(job.id, { status: 'ready', step: 'publish', progress: 100 });
    } catch (err) {
      await repo.updateJob(job.id, { status: 'failed', error: err.message });
    }
  }
  running = false;
}

export function queueSize() { return pending.length; }
