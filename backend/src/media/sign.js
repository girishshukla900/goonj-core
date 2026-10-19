// Signed media URLs. A playback URL carries an expiry and an HMAC over
// "<assetId>.<exp>", so a link cannot be forged or replayed forever. The secret
// is MEDIA_SIGNING_SECRET (falling back to JWT_SECRET in development).
import crypto from 'node:crypto';
import { config } from '../config.js';

const hmac = (payload) =>
  crypto.createHmac('sha256', config.mediaSigningSecret).update(payload).digest('hex');

export function signAssetToken(assetId, ttlSeconds = config.mediaUrlTtl) {
  const exp = Math.floor(Date.now() / 1000) + Number(ttlSeconds);
  return { exp, sig: hmac(`${assetId}.${exp}`) };
}

export function verifyAssetToken(assetId, exp, sig) {
  const e = Number(exp);
  if (!Number.isInteger(e) || e < Math.floor(Date.now() / 1000)) return false;
  const want = hmac(`${assetId}.${e}`);
  const got = String(sig || '');
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** The signed, expiring path a client can GET to stream the asset. */
export function playbackPath(assetId) {
  const { exp, sig } = signAssetToken(assetId);
  return `/media/${assetId}?exp=${exp}&sig=${sig}`;
}
