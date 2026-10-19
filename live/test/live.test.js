// End-to-end test: simulcast, moderated chat, polls, and the AI Clip Factory.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from '../src/index.js';
import { OUTPUT_DIR } from '../src/clips.js';

function request(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host: '127.0.0.1', port, method, path: urlPath,
        headers: { 'content-type': 'application/json', ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) } },
      (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => { let b = null; try { b = out ? JSON.parse(out) : null; } catch { b = out; } resolve({ status: res.statusCode, body: b }); });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  const server = createServer();
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const checks = [];
  const assert = (name, cond) => { checks.push([name, !!cond]); if (!cond) throw new Error('FAILED: ' + name); };

  try {
    // 1. Simulcast: one stream, four destinations.
    const created = await request(port, 'POST', '/streams', {
      channel_id: 'ch_gamer', title: 'PUBG Scrim Finals', source_lang: 'te',
      destinations: ['goonj', 'youtube', 'instagram', 'twitch'],
    });
    assert('stream created (201)', created.status === 201);
    assert('four destinations configured', created.body.destinations.length === 4
      && created.body.destinations.every((d) => d.status === 'configured'));
    const sid = created.body.id;

    const started = await request(port, 'POST', `/streams/${sid}/start`);
    assert('stream is live', started.body.status === 'live');
    assert('all destinations live', started.body.destinations.every((d) => d.status === 'live'));

    // 2. Chat + moderation.
    const burst = async (at, n, prefix) => {
      for (let i = 0; i < n; i++) {
        await request(port, 'POST', `/streams/${sid}/chat`, { user: 'u' + i, text: `${prefix} ${i}`, at });
      }
    };
    await burst(20, 2, 'hello');
    await burst(120, 9, 'clutch');   // the big peak
    await burst(300, 5, 'nice');     // second peak
    await request(port, 'POST', `/streams/${sid}/chat`, { user: 'bot', text: 'buy spamword now', at: 121 });

    const chat = await request(port, 'GET', `/streams/${sid}/chat`);
    assert('chat has 16 clean messages', chat.body.messages.length === 16);
    assert('blocked message was not stored', !chat.body.messages.some((m) => m.text.includes('spamword')));

    // 3. Polls.
    const poll = await request(port, 'POST', `/streams/${sid}/polls`, {
      question: 'Who wins this round?', options: ['Team Alpha', 'Team Omega'],
    });
    assert('poll created (201)', poll.status === 201 && poll.body.options.length === 2);
    await request(port, 'POST', `/polls/${poll.body.id}/vote`, { option: 'Team Alpha' });
    await request(port, 'POST', `/polls/${poll.body.id}/vote`, { option: 'Team Alpha' });
    await request(port, 'POST', `/polls/${poll.body.id}/vote`, { option: 'Team Omega' });
    const polled = await request(port, 'GET', `/polls/${poll.body.id}`);
    const alpha = polled.body.options.find((o) => o.label === 'Team Alpha');
    assert('poll counted votes (Alpha = 2)', alpha.votes === 2);

    // 4. AI Clip Factory.
    const clips = await request(port, 'POST', `/streams/${sid}/clips`, { count: 3 });
    assert('3 clips generated (201)', clips.status === 201 && clips.body.clips.length === 3);
    const top = clips.body.clips[0];
    assert('top clip covers the big peak (~120s)', top.start <= 120 && top.end > 120);
    assert('top clip scored 9 reactions', top.score === 9);
    assert('clip is 30s long', top.duration_s === 30);
    assert('clip has a title and hook', top.title.length > 0 && top.hook.length > 0);
    assert('clips do not overlap', clips.body.clips.every((c, i, a) => a.every((o, j) => i === j || c.end <= o.start || c.start >= o.end)));

    // 5. Real files written.
    const dir = path.join(OUTPUT_DIR, sid);
    assert('clip_01.json written', fs.existsSync(path.join(dir, 'clip_01.json')));
    assert('clip_01.vtt is a valid caption file', fs.readFileSync(path.join(dir, 'clip_01.vtt'), 'utf8').startsWith('WEBVTT'));
    assert('clips_manifest.json written', fs.existsSync(path.join(dir, 'clips_manifest.json')));

    // 6. Clips are served over HTTP.
    const served = await request(port, 'GET', `/streams/${sid}/clips`);
    assert('clips endpoint returns 3', served.body.clips.length === 3);

    // 7. End the stream.
    const ended = await request(port, 'POST', `/streams/${sid}/stop`);
    assert('stream ended', ended.body.status === 'ended');

    console.log('LIVE TEST OK');
    console.log('  checks passed:', checks.length);
    console.log('  clips:', clips.body.clips.map((c) => `${c.index}:${c.start}-${c.end}s(${c.score})`).join(', '));
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('LIVE TEST FAILED:', err.message);
    console.error('  passed:', checks.filter(([, ok]) => ok).length, 'of', checks.length);
    server.close(() => process.exit(1));
  }
}

main();
