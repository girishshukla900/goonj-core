import { Router } from 'express';
import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import {
  insertVideo, publishVideo, videoById, insertAsset, setAssetUrl, assetsForVideo, channelForUser,
} from '../../../db/src/repo.js';
import { getStorage } from '../media/storage.js';
import { playbackPath } from '../media/sign.js';

const router = Router();

// Uploads arrive as raw bytes, not JSON, so parse the body as a Buffer here.
// (The global express.json() ignores non-JSON content types.)
const rawBody = express.raw({ type: () => true, limit: '512mb' });

// Step 1 of an upload: reserve a video row and hand back the URL to PUT bytes to.
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, source_lang, channel_id } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title_required' });
    const lang = source_lang || 'hi';
    const channel = channel_id
      ? { id: channel_id }
      : await channelForUser(req.user.uid, { source_lang: lang });
    const video = await insertVideo({ channel_id: channel.id, title, source_lang: lang });
    res.status(201).json({
      id: video.id,
      title: video.title,
      source_lang: video.source_lang,
      status: video.status,
      upload_url: `/v1/videos/${video.id}/media`,
      note: 'POST the media bytes to upload_url to finish the upload',
    });
  } catch (err) {
    next(err);
  }
});

// Step 2: the bytes. Stored through the storage adapter, then the video is
// published and a signed, expiring playback URL is returned.
router.post('/:id/media', requireAuth, rawBody, async (req, res, next) => {
  try {
    const video = await videoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'video_not_found' });
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!buf.length) return res.status(400).json({ error: 'empty_body' });

    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const key = `videos/${video.id}/source`;
    const { size } = await getStorage().put(key, buf);

    const asset = await insertAsset({
      video_id: video.id, kind: 'source', lang: video.source_lang,
      storage_key: key, content_type: contentType, bytes: size,
    });
    const url = playbackPath(asset.id);
    await setAssetUrl(asset.id, url);
    await publishVideo(video.id);

    res.status(201).json({
      id: asset.id, video_id: video.id, kind: asset.kind,
      bytes: size, content_type: contentType, playback_url: url,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/publish', requireAuth, async (req, res, next) => {
  try {
    const video = await videoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'video_not_found' });
    const published = await publishVideo(video.id);
    res.json({ id: published.id, status: published.status });
  } catch (err) {
    next(err);
  }
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

// Video details, with signed playback URLs for every stored track.
router.get('/:id', async (req, res, next) => {
  try {
    const video = await videoById(req.params.id);
    if (!video) return res.status(404).json({ error: 'video_not_found' });
    const assets = await assetsForVideo(video.id);
    res.json({
      id: video.id,
      title: video.title,
      source_lang: video.source_lang,
      status: video.status,
      duration_s: video.duration_s,
      tracks: assets.map((a) => ({
        id: a.id, kind: a.kind, lang: a.lang, bytes: a.bytes,
        content_type: a.content_type, url: playbackPath(a.id),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
