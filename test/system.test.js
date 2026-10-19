// System test: boots all five services in one process and runs the full
// creator journey end to end, across service boundaries.
import http from 'node:http';

function req(port, method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      { host: '127.0.0.1', port, method, path: urlPath,
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

async function boot(factory) {
  const server = factory();
  await new Promise((r) => server.listen(0, r));
  return { server, port: server.address().port };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const checks = [];
  const assert = (name, cond) => { checks.push([name, !!cond]); if (!cond) throw new Error('FAILED: ' + name); };
  const servers = [];

  try {
    // --- boot the four downstream services ---
    const { createServer: dubbing } = await import('../dubbing/src/index.js');
    const { createServer: payments } = await import('../payments/src/index.js');
    const { createServer: live } = await import('../live/src/index.js');
    const { createServer: community } = await import('../community/src/index.js');
    const d = await boot(dubbing); servers.push(d.server);
    const pay = await boot(payments); servers.push(pay.server);
    const lv = await boot(live); servers.push(lv.server);
    const cm = await boot(community); servers.push(cm.server);

    // --- wire the API to them, then boot the API ---
    process.env.DUBBING_URL = `http://127.0.0.1:${d.port}`;
    process.env.PAYMENTS_URL = `http://127.0.0.1:${pay.port}`;
    process.env.LIVE_URL = `http://127.0.0.1:${lv.port}`;
    process.env.COMMUNITY_URL = `http://127.0.0.1:${cm.port}`;
    const { createApp } = await import('../backend/src/app.js');
    const api = createApp().listen(0);
    await new Promise((r) => api.on('listening', r));
    servers.push(api);
    const P = api.address().port;

    const CH = 'ch_meera';
    const TIER_PAISE = 14900; // silver

    // 1. Sign in.
    const otp = await req(P, 'POST', '/v1/auth/otp', { phone: '9876543210' });
    const auth = await req(P, 'POST', '/v1/auth/verify', { phone: '9876543210', code: otp.body.dev_otp });
    assert('creator signs in and gets a token', !!auth.body.token);
    const token = auth.body.token;

    // 2. Upload a video.
    const video = await req(P, 'POST', '/v1/videos', { title: 'Rajma Chawal', source_lang: 'hi' }, token);
    assert('video upload created', !!video.body.id);

    // 3. Consent + create a voice model (dubbing service).
    const vm = await req(d.port, 'POST', '/voice-models', { channel_id: CH, consent: true });
    assert('voice model created with consent', vm.status === 201);

    // 4. Request dubs through the API (proxied to the dubbing service).
    const dub = await req(P, 'POST', `/v1/videos/${video.body.id}/dubs`,
      { channel_id: CH, source_lang: 'hi', target_langs: ['ta', 'bn'] }, token);
    assert('API proxied the dub request (202)', dub.status === 202 && dub.body.jobs.length === 2);

    let jobs = [];
    for (let i = 0; i < 60; i++) {
      jobs = (await req(d.port, 'GET', '/jobs')).body.jobs;
      if (jobs.length && jobs.every((j) => j.status === 'ready' || j.status === 'failed')) break;
      await wait(100);
    }
    assert('both dubs finished and produced tracks', jobs.length === 2 && jobs.every((j) => j.status === 'ready' && j.track.bytes > 44));

    // 5. Go live and build chat activity.
    const stream = await req(P, 'POST', '/v1/live/streams',
      { channel_id: CH, title: 'Rajma Chawal Live', source_lang: 'hi' }, token);
    assert('live stream created via the API', stream.status === 201 && stream.body.destinations.length === 4);
    await req(lv.port, 'POST', `/streams/${stream.body.id}/start`);
    for (let i = 0; i < 8; i++) {
      await req(lv.port, 'POST', `/streams/${stream.body.id}/chat`, { user: 'u' + i, text: 'clutch ' + i, at: 200 });
    }
    for (let i = 0; i < 4; i++) {
      await req(lv.port, 'POST', `/streams/${stream.body.id}/chat`, { user: 'v' + i, text: 'nice ' + i, at: 60 });
    }

    // 6. AI Clip Factory through the API.
    const clips = await req(P, 'POST', `/v1/live/streams/${stream.body.id}/clips`, { count: 2 }, token);
    assert('clip factory produced shorts via the API', clips.status === 201 && clips.body.clips.length === 2);
    assert('top clip lands on the chat peak', clips.body.clips[0].start <= 200 && clips.body.clips[0].end > 200);

    // 7. A fan joins the club (community -> payments).
    const member = await req(P, 'POST', '/v1/community/memberships',
      { user_id: 'u_ravi', channel_id: CH, tier: 'silver' }, token);
    assert('fan joined the club', member.status === 201 && member.body.badge === 'Regular');
    assert('membership revenue posted to the ledger', member.body.revenue_posted === true);

    // 8. The creator's balance reflects the 90% split.
    const earnings = await req(P, 'GET', `/v1/earnings?channel_id=${CH}`, null, token);
    assert('balance = 90% of the membership (13410 paise)', earnings.body.balance_paise === Math.round(TIER_PAISE * 0.9));

    // 9. Withdraw to UPI through the API.
    const payout = await req(P, 'POST', '/v1/earnings/payouts',
      { channel_id: CH, upi_id: 'meera@okaxis' }, token);
    assert('UPI payout sent', payout.status === 202 && payout.body.status === 'sent' && payout.body.utr.startsWith('UTR'));
    assert('balance cleared to zero', payout.body.balance_paise === 0);

    // 10. The money ledger still balances after the whole journey.
    const journal = await req(pay.port, 'GET', '/journal');
    assert('payments journal balanced end to end', journal.body.balanced === true);

    console.log('SYSTEM TEST OK');
    console.log('  checks passed:', checks.length);
    console.log('  journey: signin -> upload -> dub(ta,bn) -> live -> clips -> membership -> payout');
    console.log('  platform revenue (paise):', journal.body.accounts.find((a) => a.account === 'platform_revenue').paise);
    servers.forEach((s) => s.close());
    setTimeout(() => process.exit(0), 100);
  } catch (err) {
    console.error('SYSTEM TEST FAILED:', err.message);
    console.error('  passed:', checks.filter(([, ok]) => ok).length, 'of', checks.length);
    servers.forEach((s) => s.close());
    setTimeout(() => process.exit(1), 100);
  }
}

main();
