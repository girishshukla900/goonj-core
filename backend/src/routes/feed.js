import { Router } from 'express';
import { feed } from '../../../db/src/repo.js';

const router = Router();

// Regional-first feed, served from Postgres (PGlite in dev).
// The viewer's language first, then their region, then newest.
router.get('/', async (req, res, next) => {
  const { lang, region } = req.query;
  try {
    if (!lang) return res.json({ lang: null, region: region || null, items: [] });
    const items = await feed({ lang, region: region || null });
    res.json({ lang, region: region || null, items });
  } catch (err) {
    next(err);
  }
});

export default router;
