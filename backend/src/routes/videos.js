import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';

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
// Proxies to the dubbing service when DUBBING_URL is configured.
router.post('/:id/dubs', requireAuth, async (req, res) => {
  const { target_langs, channel_id, voice_model_id, source_lang } = req.body || {};
  const langs = target_langs || [];
  if (!config.dubbingUrl) {
    return res.status(202).json({
      video_id: req.params.id, target_langs: langs, status: 'queued',
      note: 'DUBBING_URL not set; pipeline not wired. ASR -> translate -> voice clone -> TTS -> align -> mix',
    });
  }
  try {
    const upstream = await fetch(`${config.dubbingUrl}/dub`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        video_id: req.params.id, channel_id, source_lang,
        target_langs: langs, voice_model_id,
      }),
    });
    const body = await upstream.json();
    res.status(upstream.status).json(body);
  } catch (err) {
    res.status(502).json({ error: 'dubbing_service_unreachable', detail: err.message });
  }
});

router.get('/:id', (req, res) => {
  res.json({
    id: req.params.id, status: 'published',
    tracks: [{ lang: 'hi', kind: 'source' }],
  });
});

export default router;
