// End-to-end UI test: boots the whole stack, then drives the web client in
// headless Chromium over the DevTools Protocol through the full user journey,
// asserting what the UI actually renders. Skips if no browser is available.
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

const postJson = (port, p, body) => new Promise((resolve, reject) => {
  const data = JSON.stringify(body);
  const r = http.request({ host: '127.0.0.1', port, path: p, method: 'POST', agent: false,
    headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } },
    (res) => { let o = ''; res.on('data', (c) => (o += c)); res.on('end', () => { try { resolve(JSON.parse(o)); } catch { resolve(null); } }); });
  r.on('error', reject); r.write(data); r.end();
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
    // Give the creator a balance so the Studio screen has something to show.
    await postJson(pay.port, '/earnings', { channel_id: 'ch_meera', source: 'ad', gross_paise: 100000 });

    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'goonj-chrome-'));
    const url = `file://${INDEX}?api=http://127.0.0.1:${apiPort}`;
    child = spawn(browser, [
      '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--disable-web-security', '--allow-file-access-from-files',
      `--user-data-dir=${profile}`, '--remote-debugging-port=0', url,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    const devtools = await new Promise((resolve, reject) => {
      let buf = '';
      const t = setTimeout(() => reject(new Error('no devtools endpoint')), 15000);
      child.stderr.on('data', (c) => {
        buf += c.toString();
        const m = /ws:\/\/127\.0\.0\.1:(\d+)\/devtools\/browser/.exec(buf);
        if (m) { clearTimeout(t); resolve(Number(m[1])); }
      });
    });

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
        if (m.id === id) { ws.off('message', onMsg); resolve(m.result && m.result.result ? m.result.result.value : undefined); }
      };
      ws.on('message', onMsg);
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
      setTimeout(() => reject(new Error('evaluate timeout')), 8000);
    });

    const bodyText = () => evaluate('document.body.innerText');
    const click = (sel) => evaluate(`(function(){var e=document.querySelector(${JSON.stringify(sel)}); if(e){e.click(); return true;} return false;})()`);
    const waitFor = async (expr, ms = 8000) => {
      const end = Date.now() + ms;
      while (Date.now() < end) { const v = await evaluate(expr); if (v) return v; await wait(200); }
      return null;
    };

    const checks = [];
    const assert = (name, cond) => { checks.push([name, !!cond]); if (!cond) throw new Error('FAILED: ' + name); };

    // 1. Feed renders from the live API.
    const feedText = await waitFor(`document.body.innerText.includes('Rajma Chawal') && document.body.innerText`);
    assert('feed renders from the live API', !!feedText);
    assert('channel name shown in the feed', (await bodyText()).includes('Meera Cooks'));

    // 2. Sign in through the real OTP flow.
    await click('#loginBtn');
    const signedIn = await waitFor(`document.querySelector('#loginBtn') && document.querySelector('#loginBtn').innerText === 'Signed in'`);
    assert('sign-in works from the UI', !!signedIn);

    // 3. Studio shows the balance from the ledger.
    await click('[data-tab="studio"]');
    const balance = await waitFor(`(function(){var e=document.querySelector('#balance'); return e && e.innerText;})()`);
    assert('Studio shows a rupee balance', !!balance && /₹\d/.test(balance));

    // 4. Withdraw to UPI.
    await click('#payout');
    const paid = await waitFor(`(function(){var e=document.querySelector('#payoutNote'); return e && e.innerText.indexOf('Paid ₹')===0 ? e.innerText : null;})()`);
    assert('UPI payout succeeds from the UI', !!paid);

    // 5. Join a fan club and see it reflected.
    await click('[data-tab="clubs"]');
    await waitFor(`!!document.querySelector('[data-tier="silver"]')`);
    await click('[data-tier="silver"]');
    const joined = await waitFor(`(function(){var e=document.querySelector('#clubNote'); return e && e.innerText.indexOf('Joined')===0 ? e.innerText : null;})()`);
    assert('joining a fan club works', !!joined);

    // 6. Go live and run the AI Clip Factory.
    await click('[data-tab="live"]');
    await waitFor(`!!document.querySelector('#goLive')`);
    await click('#goLive');
    const liveOn = await waitFor(`(function(){var e=document.querySelector('#liveNote'); return e && e.innerText.indexOf('Live on')===0 ? e.innerText : null;})()`);
    assert('stream starts (simulcast destinations shown)', !!liveOn);
    // Post chat through the UI, so the Clip Factory has activity to cut.
    await waitFor(`!document.querySelector('#sendChat').disabled`);
    for (const msg of ['clutch!', 'lets go', 'insane play']) {
      await evaluate(`(function(){document.querySelector('#chatInput').value=${JSON.stringify(msg)}; document.querySelector('#sendChat').click(); return true;})()`);
      await wait(150);
    }
    const chatted = await waitFor(`(function(){var e=document.querySelector('#chatList'); return e && e.innerText.includes('clutch!');})()`);
    assert('live chat works from the UI', !!chatted);
    await click('#makeClips');
    const clipCount = await waitFor(`document.querySelectorAll('#clips .card').length || 0`);
    assert('AI Clip Factory produces clips in the UI', clipCount > 0);

    // 7. Request an AI dub from the watch overlay.
    await click('[data-tab="home"]');
    await waitFor(`!!document.querySelector('.card')`);
    await click('.card');
    await waitFor(`!!document.querySelector('#dubChips .chip')`);
    await click('#dubChips .chip');
    const dubNote = await waitFor(`(function(){var e=document.querySelector('#dubNote'); return e && e.innerText.indexOf('Queued')===0 ? e.innerText : null;})()`);
    assert('AI dub request works from the UI', !!dubNote);

    ws.close();
    console.log('CLIENT TEST OK');
    console.log('  checks passed:', checks.length);
    console.log('  journey: feed -> sign in -> studio payout -> club -> live clips -> dub');
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
