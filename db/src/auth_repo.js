// Phone-OTP auth in SQL. Codes are stored hashed, expire, are single-use,
// lock out after too many wrong attempts, and are rate-limited per phone.
import crypto from 'node:crypto';
import { getDb } from './connect.js';
import { ensureSchema } from './migrate.js';

const SECRET = process.env.OTP_SECRET || 'dev-otp-secret';

export const OTP_TTL_SECONDS = 300;      // 5 minutes
export const MAX_ATTEMPTS = 5;
export const MAX_PER_WINDOW = 3;         // requests per phone per window
export const WINDOW_MINUTES = 10;

function badRequest(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function hashCode(phone, code) {
  return crypto.createHash('sha256').update(`${phone}:${code}:${SECRET}`).digest('hex');
}

function newCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

/** Request an OTP. Rate-limited per phone. Returns the code (dev) or null. */
export async function requestOtp({ phone, exposeCode = true }) {
  if (!phone) throw badRequest('phone_required');
  await ensureSchema();
  const db = await getDb();

  const { rows: recent } = await db.query(
    `SELECT count(*)::int AS n FROM otp_requests
      WHERE phone = $1 AND requested_at > now() - ($2 || ' minutes')::interval`,
    [phone, String(WINDOW_MINUTES)]);
  if (recent[0].n >= MAX_PER_WINDOW) throw badRequest('rate_limited', 429);

  const code = newCode();
  await db.query(`INSERT INTO otp_requests (phone) VALUES ($1)`, [phone]);
  await db.query(
    `INSERT INTO otp_codes (phone, code_hash, expires_at, attempts)
     VALUES ($1, $2, now() + ($3 || ' seconds')::interval, 0)
     ON CONFLICT (phone) DO UPDATE SET
       code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0`,
    [phone, hashCode(phone, code), String(OTP_TTL_SECONDS)]);

  return { phone, code: exposeCode ? code : null };
}

/** Verify an OTP. Single-use, expiring, attempt-limited. */
export async function verifyOtp({ phone, code }) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(`SELECT * FROM otp_codes WHERE phone = $1`, [phone]);
  const row = rows[0];
  if (!row) return { ok: false, error: 'no_otp' };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.query(`DELETE FROM otp_codes WHERE phone = $1`, [phone]);
    return { ok: false, error: 'expired' };
  }
  if (Number(row.attempts) >= MAX_ATTEMPTS) return { ok: false, error: 'too_many_attempts' };

  if (hashCode(phone, String(code)) !== row.code_hash) {
    await db.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = $1`, [phone]);
    return { ok: false, error: 'invalid_otp' };
  }
  await db.query(`DELETE FROM otp_codes WHERE phone = $1`, [phone]);   // single use
  return { ok: true };
}

/** Test/dev helper: force a code to expire. */
export async function expireOtp(phone) {
  await ensureSchema();
  const db = await getDb();
  await db.query(`UPDATE otp_codes SET expires_at = now() - interval '1 second' WHERE phone = $1`, [phone]);
}
