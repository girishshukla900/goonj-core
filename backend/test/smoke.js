// Boots the API in-process, seeds the database, and exercises the routes.
// Uses node:http (not fetch) so it runs cleanly alongside the WASM database.
import http from 'node:http';
import { createApp } from '../src/app.js';
import { seedDemo } from '../../db/src/seed.js';

function req(port, method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      { host: '127.0.0.1', port, method, path: urlPath, agent: false,
        headers: { 'content-type': 'application/json',
          ...(token ? { authorization: 'Bearer ' + token } : {}),
          ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) } },
      (res) => { let out = ''; res.on('data', (c) => (out += c)); res.on('end', () => { let b = null; try { b = out ? JSON.parse(out) : null; } catch { b = out; } resolve({ status: res.statusCode, body: b }); }); },
    );
    r.on('error', reject);
    if (data) r.write(data);
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
    const health = await req(port, 'GET', '/health');
    assert('health ok', health.body.ok === true);

    const otp = await req(port, 'POST', '/v1/auth/otp', { phone: '9999999999' });
    const verified = await req(port, 'POST', '/v1/auth/verify', { phone: '9999999999', code: otp.body.dev_otp });
    assert('phone login returns a token', !!verified.body.token);
    const token = verified.body.token;

    const video = await req(port, 'POST', '/v1/videos', { title: 'Test video', source_lang: 'hi' }, token);
    assert('video upload created', !!video.body.id);

    const dub = await req(port, 'POST', `/v1/videos/${video.body.id}/dubs`, { target_langs: ['ta', 'bn'] }, token);
    assert('dub request accepted', dub.body.status === 'queued');

    // Feed now reads from Postgres (PGlite in dev).
    await seedDemo();
    const feed = await req(port, 'GET', '/v1/feed?lang=hi');
    assert('feed returns seeded videos from the database', feed.body.items.length >= 1);
    assert('feed is regional-first (Hindi video first)', feed.body.items[0].source_lang === 'hi');

    console.log('SMOKE OK', { health: true, token: !!token, feed_items: feed.body.items.length, video: video.body.id });
    console.log('  checks passed:', checks.length);
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('SMOKE FAIL', err.message);
    console.error('  passed:', checks.filter(([, ok]) => ok).length, 'of', checks.length);
    server.close(() => process.exit(1));
  }
}

main();
