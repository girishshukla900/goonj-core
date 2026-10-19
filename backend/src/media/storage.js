// Media storage adapter. One interface, two backends:
//   - MEDIA_PROVIDER=local (default): files on local disk under MEDIA_DIR.
//     Credential-free; used in development and in tests.
//   - MEDIA_PROVIDER=s3: an S3-compatible bucket (S3 / Cloudflare R2 / MinIO).
//     Needs credentials and is not implemented yet, so it fails closed rather
//     than pretending to have stored anything.
// Both expose { kind, put(key, buffer), stat(key), createReadStream(key, range) }.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

function localRoot() {
  return path.resolve(config.mediaDir);
}

// Resolve a storage key to a path, refusing anything that escapes the root.
function resolveKey(key) {
  if (typeof key !== 'string' || !/^[A-Za-z0-9._/-]+$/.test(key) || key.includes('..')) {
    throw Object.assign(new Error('invalid_storage_key'), { status: 400 });
  }
  const full = path.resolve(localRoot(), key);
  if (full !== localRoot() && !full.startsWith(localRoot() + path.sep)) {
    throw Object.assign(new Error('invalid_storage_key'), { status: 400 });
  }
  return full;
}

const local = {
  kind: 'local',
  async put(key, buffer) {
    const full = resolveKey(key);
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await fsp.writeFile(full, buffer);
    return { key, size: buffer.length };
  },
  async stat(key) {
    const st = await fsp.stat(resolveKey(key));
    return { size: st.size };
  },
  createReadStream(key, range) {
    return fs.createReadStream(resolveKey(key), range);
  },
};

const s3 = {
  kind: 's3',
  _notConfigured() {
    return Object.assign(new Error(
      's3_storage_not_configured: set S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID and ' +
      'S3_SECRET_ACCESS_KEY, and implement the s3 adapter in backend/src/media/storage.js'), { status: 501 });
  },
  async put() { throw this._notConfigured(); },
  async stat() { throw this._notConfigured(); },
  createReadStream() { throw this._notConfigured(); },
};

let chosen = null;

export function getStorage() {
  if (!chosen) chosen = config.mediaProvider === 's3' ? s3 : local;
  return chosen;
}
