// Goonj dubbing service — HTTP API. Jobs and tracks live in PostgreSQL.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import * as repo from '../../db/src/dubbing_repo.js';
import { enqueue, queueSize } from './queue.js';
import { OUTPUT_DIR } from './pipeline.js';

function json(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) reject(new Error('payload_too_large')); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const TYPES = { '.json': 'application/json', '.vtt': 'text/vtt', '.wav': 'audio/wav' };

export function createServer() {
  return http.createServer(async (req, res) => {
    const p = new URL(req.url, 'http://localhost').pathname;
    try {
      if (req.method === 'GET' && p === '/health') {
        return json(res, 200, { ok: true, service: 'goonj-dubbing', queue: queueSize() });
      }

      if (req.method === 'POST' && p === '/voice-models') {
        const body = await readJson(req);
        const model = await repo.createVoiceModel({ channel_id: body.channel_id, consent: !!body.consent });
        return json(res, 201, model);
      }

      if (req.method === 'POST' && p === '/dub') {
        const body = await readJson(req);
        if (!body.video_id || !body.source_lang || !Array.isArray(body.target_langs)) {
          return json(res, 400, { error: 'video_id, source_lang, target_langs required' });
        }
        let voiceModelId = body.voice_model_id;
        if (!voiceModelId && body.channel_id) voiceModelId = await repo.latestVoiceModel(body.channel_id);
        const jobs = [];
        for (const lang of body.target_langs) {
          const job = await repo.createJob({
            video_id: body.video_id, channel_id: body.channel_id, source_lang: body.source_lang,
            target_lang: lang, voice_model_id: voiceModelId,
          });
          enqueue(job);
          jobs.push({ id: job.id, target_lang: job.target_lang, status: job.status });
        }
        return json(res, 202, { jobs });
      }

      if (req.method === 'GET' && p === '/jobs') {
        return json(res, 200, { jobs: await repo.listJobs() });
      }

      const jobMatch = p.match(/^\/jobs\/([^/]+)$/);
      if (req.method === 'GET' && jobMatch) {
        const job = await repo.getJob(jobMatch[1]);
        return job ? json(res, 200, job) : json(res, 404, { error: 'not_found' });
      }

      const trackMatch = p.match(/^\/tracks\/([^/]+)$/);
      if (req.method === 'GET' && trackMatch) {
        return json(res, 200, { video_id: trackMatch[1], tracks: await repo.tracksFor(trackMatch[1]) });
      }

      if (req.method === 'GET' && p.startsWith('/outputs/')) {
        const full = path.join(OUTPUT_DIR, p.slice('/outputs/'.length));
        if (!full.startsWith(OUTPUT_DIR) || !fs.existsSync(full)) return json(res, 404, { error: 'not_found' });
        res.writeHead(200, { 'content-type': TYPES[path.extname(full)] || 'application/octet-stream' });
        return fs.createReadStream(full).pipe(res);
      }

      return json(res, 404, { error: 'not_found' });
    } catch (err) {
      return json(res, err.status || 500, { error: err.message || 'internal_error' });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.DUBBING_PORT || 4100);
  createServer().listen(port, () => console.log(`Goonj dubbing service on :${port}`));
}
