// End-to-end test for the money layer: split, ledger balance, UPI payouts.
import http from 'node:http';
import { createServer } from '../src/index.js';

function request(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      { host: '127.0.0.1', port, method, path: urlPath, agent: false,
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
    // 1. 90/10 split on a clean amount.
    const e1 = await request(port, 'POST', '/earnings', { channel_id: 'ch_meera', video_id: 'vid_1', source: 'ad', gross_paise: 100000 });
    assert('earning accepted (201)', e1.status === 201);
    assert('creator keeps 90% (90000)', e1.body.creator_paise === 90000);
    assert('platform keeps 10% (10000)', e1.body.platform_paise === 10000);
    assert('balance is 90000 paise', e1.body.balance_paise === 90000);

    // 2. Rounding: parts must sum back to gross exactly.
    const e2 = await request(port, 'POST', '/earnings', { channel_id: 'ch_meera', video_id: 'vid_2', source: 'ad', gross_paise: 999 });
    assert('odd amount: creator+platform == gross', e2.body.creator_paise + e2.body.platform_paise === 999);
    assert('odd amount favours creator (899)', e2.body.creator_paise === 899);

    // 3. Validation.
    const bad1 = await request(port, 'POST', '/earnings', { channel_id: 'ch_meera', gross_paise: -5 });
    assert('negative gross rejected (400)', bad1.status === 400);
    const bad2 = await request(port, 'POST', '/earnings', { channel_id: 'ch_meera', gross_paise: 10.5 });
    assert('non-integer gross rejected (400)', bad2.status === 400);

    // 4. Journal must always balance.
    const j1 = await request(port, 'GET', '/journal');
    assert('journal balances (sum of entries == 0)', j1.body.balanced === true);

    // 5. Over-payout rejected.
    const over = await request(port, 'POST', '/payouts', { channel_id: 'ch_meera', upi_id: 'meera@okaxis', amount_paise: 99999999 });
    assert('over-payout rejected (400)', over.status === 400);

    // 6. Full withdraw to UPI.
    const before = (await request(port, 'GET', '/balance/ch_meera')).body.balance_paise;
    const payout = await request(port, 'POST', '/payouts', { channel_id: 'ch_meera', upi_id: 'meera@okaxis', amount_paise: before });
    assert('payout sent (202)', payout.status === 202 && payout.body.status === 'sent');
    assert('payout has a UTR', typeof payout.body.utr === 'string' && payout.body.utr.startsWith('UTR'));
    assert('balance is now 0', payout.body.balance_paise === 0);

    // 7. Daily run: pays eligible creators, skips those without a UPI.
    await request(port, 'POST', '/earnings', { channel_id: 'ch_ravi', video_id: 'vid_9', source: 'ad', gross_paise: 50000 });
    await request(port, 'POST', '/earnings', { channel_id: 'ch_no_upi', video_id: 'vid_10', source: 'ad', gross_paise: 50000 });
    await request(port, 'POST', '/channels/upi', { channel_id: 'ch_ravi', upi_id: 'ravi@okhdfc' });
    const run = await request(port, 'POST', '/payouts/run', { min_paise: 100 });
    assert('daily run paid ch_ravi', run.body.paid.some((x) => x.channel_id === 'ch_ravi' && x.amount_paise === 45000));
    assert('daily run skipped ch_no_upi (no UPI)', run.body.skipped.some((x) => x.channel_id === 'ch_no_upi' && x.reason === 'no_upi'));

    // 8. Journal still balances after all payouts.
    const j2 = await request(port, 'GET', '/journal');
    assert('journal balances after payouts', j2.body.balanced === true);

    // 9. Ledger history is queryable.
    const led = await request(port, 'GET', '/ledger/ch_meera');
    assert('ledger has entries for ch_meera', led.body.entries.length >= 2);

    const platform = j2.body.accounts.find((a) => a.account === 'platform_revenue');
    console.log('PAYMENTS TEST OK');
    console.log('  checks passed:', checks.length);
    console.log('  platform revenue (paise):', platform.paise);
    console.log('  journal balanced:', j2.body.balanced);
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('PAYMENTS TEST FAILED:', err.message);
    console.error('  passed:', checks.filter(([, ok]) => ok).length, 'of', checks.length);
    server.close(() => process.exit(1));
  }
}

main();
