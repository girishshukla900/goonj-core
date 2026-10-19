// End-to-end client test: boots the whole stack, then drives the web client in
// headless Chromium over the DevTools Protocol and asserts the rendered DOM
// (after the async API calls resolve). Skips if no browser is available.
import { spawn } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INDEX = path.resolve(HERE, '..', 'index.html');
const BROWSERS = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];

function findBrowser() {
  for (const b of BROWSERS) {
    for (const dir of (process.env.PATH || '').split(':')) {
      const p = path.join(dir, b);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

const getJson = (port, p) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port, path: p, agent: false }, (res) => {
    let o = ''; res.on('data', (c) => (o += c)); res.on('end', () => { try { resolve(JSON.parse(o)); } catch (e) { reject(e); } });
  }).on('error', reject);
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(factory) {
  const server = factory();
  await new Promise((r) => server.listen(0, r));
  return { server, port: server.address().port };
}

async function main() {
  const browser = findBrowser();
  if (!browser) { console.log('CLIENT TEST SKIPPED (no chromium/chrome found)'); process.exit(0); }

  const servers = [];
  let child = null;
  try {
    const { createServer: dubbing } = await import('../../dubbing/src/index.js');
    const { createServer: payments } = await import('../../payments/src/index.js');
    const { createServer: live } = await import('../../live/src/index.js');
    const { createServer: community } = await import('../../community/src/index.js');
    const d = await boot(dubbing); servers.push(d.server);
    const pay = await boot(payments); servers.push(pay.server);
    const lv = await boot(live); servers.push(lv.server);
    const cm = await boot(community); servers.push(cm.server);

    process.env.DUBBING_URL = `http://127.0.0.1:${d.port}`;
    process.env.PAYMENTS_URL = `http://127.0.0.1:${pay.port}`;
    process.env.LIVE_URL = `http://127.0.0.1:${lv.port}`;
    process.env.COMMUNITY_URL = `http://127.0.0.1:${cm.port}`;

    const { createApp } = await import('../../backend/src/app.js');
    const api = createApp().listen(0);
    await new Promise((r) => api.on('listening', r));
    servers.push(api);
    const apiPort = api.address().port;

    const { seedDemo } = await import('../../db/src/seed.js');
    await seedDemo();

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'goonj-chrome-'));
    const url = `file://${INDEX}?api=http://127.0.0.1:${apiPort}`;
    child = spawn(browser, [
      '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--disable-web-security', '--allow-file-access-from-files',
      `--user-data-dir=${profile}`, '--remote-debugging-port=0', url,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    // The DevTools endpoint is printed on stderr.
    const devtools = await new Promise((resolve, reject) => {
      let buf = '';
      const t = setTimeout(() => reject(new Error('no devtools endpoint')), 15000);
      child.stderr.on('data', (c) => {
        buf += c.toString();
        const m = /ws:\/\/127\.0\.0\.1:(\d+)\/devtools\/browser/.exec(buf);
        if (m) { clearTimeout(t); resolve(Number(m[1])); }
      });
    });

    // Find the page target.
    let target = null;
    for (let i = 0; i < 40 && !target; i++) {
      try {
        const list = await getJson(devtools, '/json/list');
        target = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      } catch { /* not ready */ }
      if (!target) await wait(200);
    }
    if (!target) throw new Error('no page target');

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });

    let msgId = 0;
    const evaluate = (expression) => new Promise((resolve, reject) => {
      const id = ++msgId;
      const onMsg = (data) => {
        const m = JSON.parse(data.toString());
        if (m.id === id) { ws.off('message', onMsg); resolve(m.result); }
      };
      ws.on('message', onMsg);
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
      setTimeout(() => reject(new Error('evaluate timeout')), 8000);
    });

    // Wait for the feed to render from the live API.
    let text = '';
    for (let i = 0; i < 40; i++) {
      const r = await evaluate('document.body.innerText');
      text = (r && r.result && r.result.value) || '';
      if (text.includes('Rajma Chawal')) break;
      await wait(300);
    }

    const checks = [];
    const assert = (name, cond) => { checks.push([name, !!cond]); if (!cond) throw new Error('FAILED: ' + name); };

    assert('app shell rendered', text.includes('Goonj'));
    assert('navigation rendered', text.includes('For You') && text.includes('Studio') && text.includes('Clubs'));
    assert('feed loaded from the live API', text.includes('Rajma Chawal'));
    assert('channel name shown', text.includes('Meera Cooks'));
    assert('language tag shown', text.includes('hi'));

    ws.close();
    console.log('CLIENT TEST OK');
    console.log('  checks passed:', checks.length);
    console.log('  browser:', path.basename(browser));
    console.log('  rendered text bytes:', text.length);
    child.kill();
    servers.forEach((s) => s.close());
    setTimeout(() => process.exit(0), 100);
  } catch (err) {
    console.error('CLIENT TEST FAILED:', err.message);
    if (child) child.kill();
    servers.forEach((s) => s.close());
    setTimeout(() => process.exit(1), 100);
  }
}

main();
