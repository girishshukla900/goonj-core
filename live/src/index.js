// Goonj live service — HTTP API (zero dependencies, node:http).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { store } from './store.js';
import { createStream, startStream, stopStream, DESTINATIONS } from './simulcast.js';
import { postMessage, chatFor, createPoll, vote } from './chat.js';
import { generateClips, clipsFor, OUTPUT_DIR } from './clips.js';

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

const TYPES = { '.json': 'application/json', '.vtt': 'text/vtt' };

export function createServer() {
  return http.createServer(async (req, res) => {
    const p = new URL(req.url, 'http://localhost').pathname;
    const getStream = (id) => {
      const s = store.streams.get(id);
      if (!s) { const e = new Error('stream_not_found'); e.status = 404; throw e; }
      return s;
    };

    try {
      if (req.method === 'GET' && p === '/health') {
        return json(res, 200, { ok: true, service: 'goonj-live', destinations: DESTINATIONS });
      }

      if (req.method === 'POST' && p === '/streams') {
        const b = await readJson(req);
        if (!b.channel_id) return json(res, 400, { error: 'channel_id required' });
        const stream = createStream(b);
        store.streams.set(stream.id, stream);
        return json(res, 201, stream);
      }

      const mStream = p.match(/^\/streams\/([^/]+)$/);
      if (req.method === 'GET' && mStream) return json(res, 200, getStream(mStream[1]));

      const mStart = p.match(/^\/streams\/([^/]+)\/start$/);
      if (req.method === 'POST' && mStart) return json(res, 200, startStream(getStream(mStart[1])));

      const mStop = p.match(/^\/streams\/([^/]+)\/stop$/);
      if (req.method === 'POST' && mStop) return json(res, 200, stopStream(getStream(mStop[1])));

      const mChat = p.match(/^\/streams\/([^/]+)\/chat$/);
      if (mChat && req.method === 'POST') {
        const b = await readJson(req);
        const msg = postMessage(getStream(mChat[1]), b);
        return json(res, msg.blocked ? 202 : 201, msg);
      }
      if (mChat && req.method === 'GET') {
        return json(res, 200, { stream_id: mChat[1], messages: chatFor(mChat[1]) });
      }

      const mPolls = p.match(/^\/streams\/([^/]+)\/polls$/);
      if (req.method === 'POST' && mPolls) {
        const b = await readJson(req);
        return json(res, 201, createPoll(getStream(mPolls[1]), b));
      }

      const mVote = p.match(/^\/polls\/([^/]+)\/vote$/);
      if (req.method === 'POST' && mVote) {
        const poll = store.polls.get(mVote[1]);
        if (!poll) return json(res, 404, { error: 'poll_not_found' });
        const b = await readJson(req);
        return json(res, 200, vote(poll, b.option));
      }

      const mGetPoll = p.match(/^\/polls\/([^/]+)$/);
      if (req.method === 'GET' && mGetPoll) {
        const poll = store.polls.get(mGetPoll[1]);
        return poll ? json(res, 200, poll) : json(res, 404, { error: 'poll_not_found' });
      }

      const mClips = p.match(/^\/streams\/([^/]+)\/clips$/);
      if (mClips && req.method === 'POST') {
        const b = await readJson(req);
        return json(res, 201, { stream_id: mClips[1], clips: generateClips(getStream(mClips[1]), b) });
      }
      if (mClips && req.method === 'GET') {
        return json(res, 200, { stream_id: mClips[1], clips: clipsFor(mClips[1]) });
      }

      if (req.method === 'GET' && p.startsWith('/clips/')) {
        const full = path.join(OUTPUT_DIR, p.slice('/clips/'.length));
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
  const port = Number(process.env.LIVE_PORT || 4300);
  createServer().listen(port, () => console.log(`Goonj live service on :${port}`));
}
