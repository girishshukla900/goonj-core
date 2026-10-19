// End-to-end test: fan clubs, badges, watch parties, and the money flow into payments.
import http from 'node:http';
import { createServer } from '../src/index.js';
import { createServer as createPayments } from '../../payments/src/index.js';

function req(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      { host: '127.0.0.1', port, method, path: urlPath, agent: false,
        headers: { 'content-type': 'application/json', ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) } },
      (res) => { let out = ''; res.on('data', (c) => (out += c)); res.on('end', () => { let b = null; try { b = out ? JSON.parse(out) : null; } catch { b = out; } resolve({ status: res.statusCode, body: b }); }); },
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  // Start the payments service too, so the money flow is real.
  const payments = createPayments();
  await new Promise((r) => payments.listen(0, r));
  process.env.PAYMENTS_URL = `http://127.0.0.1:${payments.address().port}`;

  const server = createServer();
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const payPort = payments.address().port;

  const checks = [];
  const assert = (name, cond) => { checks.push([name, !!cond]); if (!cond) throw new Error('FAILED: ' + name); };

  try {
    const CH = 'ch_meera';

    // 1. Default tiers.
    const tiers = await req(port, 'GET', `/channels/${CH}/tiers`);
    assert('three default tiers', tiers.body.tiers.length === 3);
    const silver = tiers.body.tiers.find((t) => t.name === 'silver');

    // 2. Join a tier -> membership + badge.
    const m1 = await req(port, 'POST', '/memberships', { user_id: 'u_ravi', channel_id: CH, tier: 'silver' });
    assert('membership created (201)', m1.status === 201);
    assert('silver member badge is "Regular"', m1.body.badge === 'Regular');
    assert('membership revenue posted to payments', m1.body.revenue_posted === true);

    // 3. The money actually landed in the ledger, split 90/10.
    const bal = await req(payPort, 'GET', `/balance/${CH}`);
    assert('creator balance = 90% of silver (13410 paise)', bal.body.balance_paise === Math.round(silver.price_paise * 0.9));

    // 4. Badge from tenure: a 7-month gold member is a Legend.
    const m2 = await req(port, 'POST', '/memberships', {
      user_id: 'u_sneha', channel_id: CH, tier: 'gold',
      joined_at: new Date(Date.now() - 7 * 30 * DAY).toISOString(),
    });
    assert('7-month gold member is a "Legend"', m2.body.badge === 'Legend');

    // 5. A brand-new supporter is "New".
    const m3 = await req(port, 'POST', '/memberships', { user_id: 'u_arjun', channel_id: CH, tier: 'supporter' });
    assert('new supporter badge is "New"', m3.body.badge === 'New');

    // 6. Leaderboard: highest tier first.
    const lb = await req(port, 'GET', `/channels/${CH}/leaderboard`);
    assert('leaderboard ranks gold first', lb.body.leaderboard[0].user_id === 'u_sneha' && lb.body.leaderboard[0].tier === 'gold');
    assert('leaderboard has 3 fans', lb.body.leaderboard.length === 3);

    // 7. Members-only posts are hidden from non-members.
    await req(port, 'POST', '/posts', { channel_id: CH, text: 'Members-only recipe!', members_only: true });
    await req(port, 'POST', '/posts', { channel_id: CH, text: 'Hello everyone', members_only: false });
    const guest = await req(port, 'GET', `/channels/${CH}/posts?viewer_id=u_guest`);
    const member = await req(port, 'GET', `/channels/${CH}/posts?viewer_id=u_ravi`);
    assert('non-member sees only the public post', guest.body.posts.length === 1 && guest.body.posts[0].text === 'Hello everyone');
    assert('member sees both posts', member.body.posts.length === 2);

    // 8. Watch party + RSVP.
    const party = await req(port, 'POST', '/parties', { channel_id: CH, video_id: 'vid_1', title: 'Rajma Chawal Live' });
    assert('watch party created (201)', party.status === 201);
    await req(port, 'POST', `/parties/${party.body.id}/rsvp`, { user_id: 'u_ravi' });
    await req(port, 'POST', `/parties/${party.body.id}/rsvp`, { user_id: 'u_sneha' });
    const fetched = await req(port, 'GET', `/parties/${party.body.id}`);
    assert('two RSVPs recorded', fetched.body.rsvps.length === 2);

    // 9. Cancel a membership.
    await req(port, 'POST', '/memberships/cancel', { user_id: 'u_arjun', channel_id: CH });
    const members = await req(port, 'GET', `/channels/${CH}/members`);
    assert('cancelled member is removed from active list', !members.body.members.some((m) => m.user_id === 'u_arjun'));

    // 10. Journal still balances after all membership revenue.
    const journal = await req(payPort, 'GET', '/journal');
    assert('payments journal still balanced', journal.body.balanced === true);

    console.log('COMMUNITY TEST OK');
    console.log('  checks passed:', checks.length);
    console.log('  creator balance from memberships (paise):', bal.body.balance_paise);
    server.close(() => payments.close(() => process.exit(0)));
  } catch (err) {
    console.error('COMMUNITY TEST FAILED:', err.message);
    console.error('  passed:', checks.filter(([, ok]) => ok).length, 'of', checks.length);
    server.close(() => payments.close(() => process.exit(1)));
  }
}

main();
