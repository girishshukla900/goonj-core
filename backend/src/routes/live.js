import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';

const router = Router();

async function proxy(res, url, options) {
  try {
    const upstream = await fetch(url, options);
    res.status(upstream.status).json(await upstream.json());
  } catch (err) {
    res.status(502).json({ error: 'live_service_unreachable', detail: err.message });
  }
}

const post = (body) => ({
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

// Create a live stream (with simulcast destinations).
router.post('/streams', requireAuth, (req, res) => {
  if (!config.liveUrl) return res.status(202).json({ status: 'created', note: 'LIVE_URL not set' });
  proxy(res, `${config.liveUrl}/streams`, post(req.body));
});

router.get('/streams/:id', requireAuth, (req, res) => {
  if (!config.liveUrl) return res.status(503).json({ error: 'LIVE_URL not set' });
  proxy(res, `${config.liveUrl}/streams/${req.params.id}`, { method: 'GET' });
});

// AI Clip Factory: turn the stream into shorts.
router.post('/streams/:id/clips', requireAuth, (req, res) => {
  if (!config.liveUrl) return res.status(202).json({ stream_id: req.params.id, clips: [], note: 'LIVE_URL not set' });
  proxy(res, `${config.liveUrl}/streams/${req.params.id}/clips`, post(req.body));
});

router.get('/streams/:id/clips', requireAuth, (req, res) => {
  if (!config.liveUrl) return res.status(503).json({ error: 'LIVE_URL not set' });
  proxy(res, `${config.liveUrl}/streams/${req.params.id}/clips`, { method: 'GET' });
});

export default router;
