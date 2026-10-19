import { Router } from 'express';

const router = Router();

// Phase 0 stub. Replace with a Postgres query over videos + watch_events,
// ordered regional-first (source_lang = lang, then region).
router.get('/', (req, res) => {
  const { lang, region } = req.query;
  res.json({ lang: lang || null, region: region || null, items: [] });
});

export default router;
