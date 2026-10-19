import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { exportChannel, exportSummary } from '../../../db/src/export_repo.js';

const router = Router();

// Everything a creator owns, as one JSON bundle. "No lock-in."
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const channelId = req.query.channel_id;
    if (!channelId) return res.status(400).json({ error: 'channel_id required' });
    const bundle = await exportChannel(channelId);
    if (req.query.download === '1') {
      res.setHeader('content-disposition', `attachment; filename="goonj-export-${channelId}.json"`);
    }
    res.json(bundle);
  } catch (err) { next(err); }
});

// A short summary (used by the Studio screen).
router.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const channelId = req.query.channel_id;
    if (!channelId) return res.status(400).json({ error: 'channel_id required' });
    res.json(await exportSummary(channelId));
  } catch (err) { next(err); }
});

export default router;
