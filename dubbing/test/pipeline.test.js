// End-to-end test: runs the dubbing pipeline and asserts real output files.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/index.js';
import { OUTPUT_DIR } from '../src/pipeline.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function request(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host: '127.0.0.1', port, method, path: urlPath,
        headers: { 'content-type': 'application/json', ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) } },
      (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => {
          let parsed = null;
          try { parsed = out ? JSON.parse(out) : null; } catch { parsed = out; }
          resolve({ status: res.statusCode, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const server = createServer();
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const checks = [];
  const assert = (name, cond) => { checks.push([name, !!cond]); if (!cond) throw new Error('FAILED: ' + name); };

  try {
    // 1. Consent is mandatory.
    const noConsent = await request(port, 'POST', '/voice-models', { channel_id: 'ch_meera', consent: false });
    assert('voice clone without consent is rejected (400)', noConsent.status === 400);

    // 2. Create a consented voice model.
    const model = await request(port, 'POST', '/voice-models', { channel_id: 'ch_meera', consent: true });
    assert('voice model created (201)', model.status === 201 && model.body.id);

    // 3. Request dubbing into 3 languages.
    const dub = await request(port, 'POST', '/dub', {
      video_id: 'vid_demo', channel_id: 'ch_meera',
      source_lang: 'hi', target_langs: ['ta', 'bn', 'te'],
    });
    assert('dub accepted (202) with 3 jobs', dub.status === 202 && dub.body.jobs.length === 3);

    // 4. Wait for the queue to finish.
    let jobs = [];
    for (let i = 0; i < 60; i++) {
      jobs = (await request(port, 'GET', '/jobs')).body.jobs;
      if (jobs.every((j) => j.status === 'ready' || j.status === 'failed')) break;
      await wait(100);
    }
    assert('all jobs reached "ready"', jobs.length === 3 && jobs.every((j) => j.status === 'ready'));

    // 5. Output files exist and are real.
    const dir = path.join(OUTPUT_DIR, 'vid_demo');
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    assert('manifest lists 3 language tracks', manifest.tracks.length === 3);
    for (const t of manifest.tracks) {
      const wav = path.join(dir, `dub_${t.lang}.wav`);
      const vtt = path.join(dir, `dub_${t.lang}.vtt`);
      assert(`${t.lang}: wav written and non-empty`, fs.existsSync(wav) && fs.statSync(wav).size > 44);
      assert(`${t.lang}: vtt written`, fs.existsSync(vtt) && fs.readFileSync(vtt, 'utf8').startsWith('WEBVTT'));
      assert(`${t.lang}: wav is RIFF/WAVE`, fs.readFileSync(wav).slice(0, 4).toString() === 'RIFF');
    }

    // 6. The manifest is served over HTTP.
    const served = await request(port, 'GET', '/tracks/vid_demo');
    assert('tracks endpoint returns 3 tracks', served.body.tracks.length === 3);

    const langs = manifest.tracks.map((t) => `${t.lang}(${t.duration_s}s, ${t.bytes}B)`).join(', ');
    console.log('DUBBING TEST OK');
    console.log('  tracks:', langs);
    console.log('  checks passed:', checks.length);
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('DUBBING TEST FAILED:', err.message);
    console.error('  passed so far:', checks.filter(([, ok]) => ok).length, 'of', checks.length);
    server.close(() => process.exit(1));
  }
}

main();
