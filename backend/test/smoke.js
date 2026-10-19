// Boots the API in-process and exercises the Phase 0 routes.
import { createApp } from '../src/app.js';

const app = createApp();
const server = app.listen(0, async () => {
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const post = (path, body, token) =>
    fetch(base + path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  try {
    const health = await fetch(base + '/health').then((r) => r.json());
    if (!health.ok) throw new Error('health failed');

    const otp = await post('/v1/auth/otp', { phone: '9999999999' });
    const verified = await post('/v1/auth/verify', { phone: '9999999999', code: otp.dev_otp });
    if (!verified.token) throw new Error('auth failed');

    const feed = await fetch(base + '/v1/feed?lang=hi').then((r) => r.json());
    const video = await post('/v1/videos', { title: 'Test video', source_lang: 'hi' }, verified.token);
    if (!video.id) throw new Error('video create failed');

    const dub = await post(`/v1/videos/${video.id}/dubs`, { target_langs: ['ta', 'bn'] }, verified.token);
    if (dub.status !== 'queued') throw new Error('dub request failed');

    console.log('SMOKE OK', {
      health: health.ok, token: !!verified.token,
      feed_items: feed.items.length, video: video.id, dub: dub.status,
    });
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('SMOKE FAIL', err);
    server.close(() => process.exit(1));
  }
});
