import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';

const router = Router();

async function proxy(res, url, options) {
  try {
    const upstream = await fetch(url, options);
    res.status(upstream.status).json(await upstream.json());
  } catch (err) {
    res.status(502).json({ error: 'community_service_unreachable', detail: err.message });
  }
}

const post = (body) => ({
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

const notWired = (res, note) => res.status(503).json({ error: 'COMMUNITY_URL not set', note });

// Join a creator's fan club.
router.post('/memberships', requireAuth, (req, res) => {
  if (!config.communityUrl) return notWired(res, 'memberships not wired');
  proxy(res, `${config.communityUrl}/memberships`, post(req.body));
});

// Fan leaderboard for a channel.
router.get('/channels/:id/leaderboard', requireAuth, (req, res) => {
  if (!config.communityUrl) return notWired(res, 'leaderboard not wired');
  proxy(res, `${config.communityUrl}/channels/${req.params.id}/leaderboard`, { method: 'GET' });
});

// Members-only community posts.
router.get('/channels/:id/posts', requireAuth, (req, res) => {
  if (!config.communityUrl) return notWired(res, 'posts not wired');
  const viewer = req.query.viewer_id ? `?viewer_id=${encodeURIComponent(req.query.viewer_id)}` : '';
  proxy(res, `${config.communityUrl}/channels/${req.params.id}/posts${viewer}`, { method: 'GET' });
});

// Create a watch party.
router.post('/parties', requireAuth, (req, res) => {
  if (!config.communityUrl) return notWired(res, 'parties not wired');
  proxy(res, `${config.communityUrl}/parties`, post(req.body));
});

export default router;
