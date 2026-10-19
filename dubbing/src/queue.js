// Sequential in-process job queue. Swap for Redis/BullMQ behind the same shape.
import { store } from './store.js';
import { runDubJob } from './pipeline.js';

const pending = [];
let running = false;

export function enqueue(job) {
  job.status = 'queued';
  job.progress = 0;
  job.step = null;
  store.jobs.set(job.id, job);
  pending.push(job);
  setImmediate(drain);
  return job;
}

async function drain() {
  if (running) return;
  running = true;
  while (pending.length) {
    const job = pending.shift();
    job.status = 'processing';
    try {
      const track = await runDubJob(job, (step, pct) => {
        job.step = step;
        job.progress = pct;
      });
      job.status = 'ready';
      job.track = track;
      const list = store.tracks.get(job.video_id) || [];
      list.push(track);
      store.tracks.set(job.video_id, list);
    } catch (err) {
      job.status = 'failed';
      job.error = err.message;
    }
  }
  running = false;
}

export function queueSize() { return pending.length; }
