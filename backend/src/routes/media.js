// Playback. Streams a stored asset, honouring HTTP Range so players can seek.
// Every request must carry a valid signed token (see media/sign.js).
import { Router } from 'express';
import { assetById } from '../../../db/src/repo.js';
import { verifyAssetToken } from '../media/sign.js';
import { getStorage } from '../media/storage.js';

const router = Router();

router.get('/:id', async (req, res, next) => {
  try {
    const asset = await assetById(req.params.id);
    if (!asset) return res.status(404).json({ error: 'asset_not_found' });
    if (!verifyAssetToken(asset.id, req.query.exp, req.query.sig)) {
      return res.status(403).json({ error: 'invalid_or_expired_token' });
    }

    const storage = getStorage();
    const { size } = await storage.stat(asset.storage_key);
    const type = asset.content_type || 'application/octet-stream';
    const range = req.headers.range;

    if (range) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!m || (m[1] === '' && m[2] === '')) {
        return res.status(416).set('content-range', `bytes */${size}`).end();
      }
      const start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
      const end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
        return res.status(416).set('content-range', `bytes */${size}`).end();
      }
      res.status(206).set({
        'content-range': `bytes ${start}-${end}/${size}`,
        'accept-ranges': 'bytes',
        'content-length': String(end - start + 1),
        'content-type': type,
      });
      storage.createReadStream(asset.storage_key, { start, end }).on('error', next).pipe(res);
      return;
    }

    res.set({ 'accept-ranges': 'bytes', 'content-length': String(size), 'content-type': type });
    storage.createReadStream(asset.storage_key).on('error', next).pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
