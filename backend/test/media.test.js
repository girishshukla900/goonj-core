// Media pipeline: real upload -> storage -> signed, range-capable playback.
// Uses node:http (not fetch) so it runs cleanly alongside the WASM database.
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

// Point storage at a throwaway directory. Must happen before config is read,
// hence the dynamic import below.
process.env.MEDIA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'goonj-media-'));
const { createApp } = await import('../src/app.js');
const { signAssetToken } = await import('../src/media/sign.js');

function request(port, method, urlPath, { body, token, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = Buffer.isBuffer(body) ? body : (body ? Buffer.from(JSON.stringify(body)) : null);
    const h = { ...headers };
    if (payload) {
      h['content-length'] = Buffer.byteLength(payload);
      if (!Buffer.isBuffer(body) && !h['content-type']) h['content-type'] = 'application/json';
    }
    if (token) h.authorization = 'Bearer ' + token;
    const r = http.request({ host: '127.0.0.1', port, method, path: urlPath, agent: false, headers: h }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let json = null;
        try { json = buf.length ? JSON.parse(buf.toString()) : null; } catch { /* not json */ }
        resolve({ status: res.statusCode, headers: res.headers, buffer: buf, body: json });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function main() {
  const app = createApp();
  const server = app.listen(0);
  await new Promise((r) => server.on('listening', r));
  const port = server.address().port;

  const checks = [];
  const assert = (name, cond) => { checks.push([name, !!cond]); if (!cond) throw new Error('FAILED: ' + name); };

  try {
    // Sign in.
    const otp = await request(port, 'POST', '/v1/auth/otp', { body: { phone: '9000000001' } });
    const verified = await request(port, 'POST', '/v1/auth/verify', { body: { phone: '9000000001', code: otp.body.dev_otp } });
    const token = verified.body.token;
    assert('login returns a token', !!token);

    // 1. Reserve an upload.
    const created = await request(port, 'POST', '/v1/videos', { body: { title: 'Media test', source_lang: 'hi' }, token });
    assert('video created (201)', created.status === 201 && !!created.body.id);
    assert('upload_url points at the media endpoint', created.body.upload_url === `/v1/videos/${created.body.id}/media`);

    // 2. Upload real bytes.
    const bytes = Buffer.concat([Buffer.from('GGGG'), Buffer.from(Array.from({ length: 4096 }, (_, i) => i % 251))]);
    const uploaded = await request(port, 'POST', created.body.upload_url, {
      body: bytes, token, headers: { 'content-type': 'video/mp4' },
    });
    assert('upload accepted (201)', uploaded.status === 201);
    assert('upload reports the stored size', uploaded.body.bytes === bytes.length);
    assert('upload returns a signed playback url', typeof uploaded.body.playback_url === 'string' && uploaded.body.playback_url.startsWith('/media/'));
    assert('bytes landed on disk', fs.existsSync(path.join(process.env.MEDIA_DIR, `videos/${created.body.id}/source`)));

    const url = uploaded.body.playback_url;

    // 3. Full playback.
    const full = await request(port, 'GET', url);
    assert('playback is 200', full.status === 200);
    assert('playback returns the exact bytes', Buffer.compare(full.buffer, bytes) === 0);
    assert('playback advertises range support', full.headers['accept-ranges'] === 'bytes');
    assert('playback keeps the content type', full.headers['content-type'] === 'video/mp4');

    // 4. Range request (what a player uses to seek).
    const part = await request(port, 'GET', url, { headers: { range: 'bytes=0-9' } });
    assert('range request is 206', part.status === 206);
    assert('range content-range header is correct', part.headers['content-range'] === `bytes 0-9/${bytes.length}`);
    assert('range body is the first 10 bytes', Buffer.compare(part.buffer, bytes.subarray(0, 10)) === 0);

    const tail = await request(port, 'GET', url, { headers: { range: `bytes=${bytes.length - 4}-` } });
    assert('open-ended range is 206', tail.status === 206 && tail.buffer.length === 4);
    assert('open-ended range body is the tail', Buffer.compare(tail.buffer, bytes.subarray(bytes.length - 4)) === 0);

    // 5. Unsigned and tampered links are refused.
    const assetId = url.slice('/media/'.length).split('?')[0];
    const bare = await request(port, 'GET', `/media/${assetId}`);
    assert('unsigned playback is 403', bare.status === 403);

    const sigAt = url.indexOf('sig=') + 4; // first character of the signature
    const tamperedUrl = url.slice(0, sigAt) + (url[sigAt] === 'a' ? 'b' : 'a') + url.slice(sigAt + 1);
    const tampered = await request(port, 'GET', tamperedUrl);
    assert('tampered signature is 403', tampered.status === 403);

    const { exp, sig } = signAssetToken(assetId, -10); // already expired
    const stale = await request(port, 'GET', `/media/${assetId}?exp=${exp}&sig=${sig}`);
    assert('expired link is 403', stale.status === 403);

    const missing = await request(port, 'GET', '/media/999999?exp=1&sig=x');
    assert('unknown asset is 404', missing.status === 404);

    // 6. Details expose the stored track, and the video is published.
    const details = await request(port, 'GET', `/v1/videos/${created.body.id}`);
    assert('details are 200', details.status === 200);
    assert('video is published after upload', details.body.status === 'published');
    assert('details list the stored track', details.body.tracks.length === 1 && details.body.tracks[0].bytes === bytes.length);
    assert('details carry a signed url', typeof details.body.tracks[0].url === 'string' && details.body.tracks[0].url.startsWith('/media/'));

    // 7. The uploaded video reaches the feed.
    const feed = await request(port, 'GET', '/v1/feed?lang=hi');
    assert('published upload appears in the feed', feed.body.items.some((v) => String(v.id) === String(created.body.id)));

    console.log('MEDIA TEST OK');
    console.log('  checks passed:', checks.length);
    console.log('  uploaded bytes:', bytes.length);
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('MEDIA TEST FAILED:', err.message);
    console.error('  passed:', checks.filter(([, ok]) => ok).length, 'of', checks.length);
    server.close(() => process.exit(1));
  }
}

main();
