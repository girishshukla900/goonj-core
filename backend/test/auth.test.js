// Auth security tests: hashed, expiring, single-use, attempt-limited, rate-limited OTP.
import http from 'node:http';
import { createApp } from '../src/app.js';
import { expireOtp, MAX_ATTEMPTS } from '../../db/src/auth_repo.js';

function req(port, method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(
      { host: '127.0.0.1', port, method, path: urlPath, agent: false,
        headers: { 'content-type': 'application/json', ...(data ? { 'content-length': Buffer.byteLength(data) } : {}) } },
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
    // 1. Happy path: request then verify.
    const otp = await req(port, 'POST', '/v1/auth/otp', { phone: '9000000001' });
    assert('OTP issued (200)', otp.status === 200 && otp.body.dev_otp);
    const good = await req(port, 'POST', '/v1/auth/verify', { phone: '9000000001', code: otp.body.dev_otp });
    assert('correct code issues a token', good.status === 200 && !!good.body.token);
    assert('login creates a user', good.body.user && good.body.user.phone === '9000000001');

    // 2. Single use: the same code cannot be reused.
    const reuse = await req(port, 'POST', '/v1/auth/verify', { phone: '9000000001', code: otp.body.dev_otp });
    assert('a code cannot be reused', reuse.status === 401);

    // 3. Wrong code is rejected and counted.
    const otp2 = await req(port, 'POST', '/v1/auth/otp', { phone: '9000000002' });
    const wrong = await req(port, 'POST', '/v1/auth/verify', { phone: '9000000002', code: '000000' === otp2.body.dev_otp ? '111111' : '000000' });
    assert('wrong code rejected (401)', wrong.status === 401 && wrong.body.error === 'invalid_otp');

    // 4. Expiry.
    const otp3 = await req(port, 'POST', '/v1/auth/otp', { phone: '9000000003' });
    await expireOtp('9000000003');
    const expired = await req(port, 'POST', '/v1/auth/verify', { phone: '9000000003', code: otp3.body.dev_otp });
    assert('expired code rejected', expired.status === 401 && expired.body.error === 'expired');

    // 5. Attempt lockout: after MAX_ATTEMPTS wrong tries, even the right code fails.
    const otp4 = await req(port, 'POST', '/v1/auth/otp', { phone: '9000000004' });
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await req(port, 'POST', '/v1/auth/verify', { phone: '9000000004', code: '000000' === otp4.body.dev_otp ? '111111' : '000000' });
    }
    const locked = await req(port, 'POST', '/v1/auth/verify', { phone: '9000000004', code: otp4.body.dev_otp });
    assert('account locks out after too many attempts', locked.status === 401 && locked.body.error === 'too_many_attempts');

    // 6. Rate limiting: a 4th request in the window is refused.
    const phone = '9000000005';
    await req(port, 'POST', '/v1/auth/otp', { phone });
    await req(port, 'POST', '/v1/auth/otp', { phone });
    await req(port, 'POST', '/v1/auth/otp', { phone });
    const fourth = await req(port, 'POST', '/v1/auth/otp', { phone });
    assert('OTP requests are rate-limited (429)', fourth.status === 429);

    console.log('AUTH TEST OK');
    console.log('  checks passed:', checks.length);
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('AUTH TEST FAILED:', err.message);
    console.error('  passed:', checks.filter(([, ok]) => ok).length, 'of', checks.length);
    server.close(() => process.exit(1));
  }
}

main();
