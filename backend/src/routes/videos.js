import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Create an upload: returns a signed upload URL from the media provider.
router.post('/', requireAuth, (req, res) => {
  const { title, source_lang } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title_required' });
  const id = 'vid_' + Math.random().toString(36).slice(2, 10);
  const uploadUrl = `https://media.goonj.dev/upload/${id}
  res.status(201).json({
    id, title, source_lang: source_lang || 'hi',
    status: 'upload_pending', upload_url: uploadUrl,
  });
});

router.post('/:id/publish', requireAuth, (req, res) => {
  res.json({
    id: req.params.id, status: 'transcoding',
    note: 'enqueue transcode job: HLS, 3 bitrates',
  });
});

// Request AI dubbing into target languages (Phase 1 pipeline).
router.post('/:id/dubs', requireAuth, (req, res) => {
  const { target_langs } = req.body || {};
  res.status(202).json({
    video_id: req.params.id, target_langs: target_langs || [], status: 'queued',
    note: 'ASR -> translate -> voice clone -> TTS -> align -> mix',
  });
});

router.get('/:id', (req, res) => {
  res.json({
    id: req.params.id, status: 'published',
    tracks: [{ lang: 'hi', kind: 'source' }],
  });
});

export default router;
