// Data export: everything a creator owns comes back in one bundle.
import http from 'node:http';
import { createApp } from '../src/app.js';
import { seedDemo } from '../../db/src/seed.js';
import { recordEarning, insertPayout } from '../../db/src/ledger.js';
import { upsertMembership } from '../../db/src/community_repo.js';
import { createStream, postMessage } from '../../db/src/live_repo.js';

function req(port, method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      { host: '127.0.0.1', port, method, path: urlPath, agent: false,
        headers: { 'content-type': 'application/json',
          ...(token ? { authorization: 'Bearer ' + token } : {}),
          ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) } },
      (res) => { let o = ''; res.on('data', (c) => (o += c)); res.on('end', () => { let b = null; try { b = o ? JSON.parse(o) : null; } catch { b = o; } resolve({ status: res.statusCode, body: b }); }); });
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
    const seeded = await seedDemo();          // two channels, two videos
    const ch = String(seeded.channels[0]);    // the creator's real channel id

    // Give the creator a body of work: earnings, a payout, a member, a stream.
    await recordEarning({ channel_id: ch, source: 'ad', gross_paise: 100000 });
    await insertPayout({ channel_id: ch, amount_paise: 50000, upi_id: 'meera@okaxis' });
    await upsertMembership({ user_id: 'u_ravi', channel_id: ch, tier: 'silver', price_paise: 14900 });
    const stream = await createStream({ channel_id: ch, title: 'Live', source_lang: 'hi' });
    await postMessage(stream, { user: 'u1', text: 'hello', at: 10 });

    // Authenticate.
    const otp = await req(port, 'POST', '/v1/auth/otp', { phone: '9111111111' });
    const auth = await req(port, 'POST', '/v1/auth/verify', { phone: '9111111111', code: otp.body.dev_otp });
    assert('signed in for the export', !!auth.body.token);

    // Export.
    const ex = await req(port, 'GET', `/v1/export?channel_id=${ch}`, null, auth.body.token);
    assert('export succeeds (200)', ex.status === 200);
    const c = ex.body.counts;
    assert('export includes videos', c.videos >= 1);
    assert('export includes the earnings ledger', c.ledger_entries >= 2);
    assert('export includes payouts', c.payouts >= 1);
    assert('export includes memberships', c.memberships >= 1);
    assert('export includes streams and chat', c.streams >= 1 && c.chat_messages >= 1);
    assert('export carries the data itself, not just counts', ex.body.data.videos.length === c.videos);

    // Summary endpoint.
    const sum = await req(port, 'GET', `/v1/export/summary?channel_id=${ch}`, null, auth.body.token);
    assert('summary reports videos', sum.body.videos >= 1);
    assert('summary reports amount paid out', sum.body.paid_out_paise === 50000);
    assert('summary reports earnings', sum.body.earned_paise === 90000);

    // Requires auth.
    const noAuth = await req(port, 'GET', `/v1/export?channel_id=${ch}`);
    assert('export requires auth (401)', noAuth.status === 401);

    console.log('EXPORT TEST OK');
    console.log('  checks passed:', checks.length);
    console.log('  bundle counts:', JSON.stringify(c));
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('EXPORT TEST FAILED:', err.message);
    console.error('  passed:', checks.filter(([, ok]) => ok).length, 'of', checks.length);
    server.close(() => process.exit(1));
  }
}

main();
