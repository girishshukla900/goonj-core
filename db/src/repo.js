// Repositories: all SQL lives here. Amounts are integer paise.
import { getDb } from './connect.js';
import { migrate } from './migrate.js';

const CREATOR_SHARE = 0.90;

let ready = null;
function ready_() {
  if (!ready) ready = migrate();
  return ready;
}

const num = (v) => (v == null ? 0 : Number(v));

export async function createUser({ phone, role = 'viewer' }) {
  await ready_();
  const db = await getDb();
  const { rows } = await db.query(
    `INSERT INTO users (phone, role) VALUES ($1, $2)
     ON CONFLICT (phone) DO UPDATE SET role = EXCLUDED.role
     RETURNING id, phone, role`, [phone, role]);
  return rows[0];
}

export async function createChannel({ user_id, handle, name, language, region }) {
  await ready_();
  const db = await getDb();
  const { rows } = await db.query(
    `INSERT INTO channels (user_id, handle, name, language, region)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [user_id, handle, name, language, region]);
  return rows[0];
}

export async function insertVideo({ channel_id, title, source_lang, duration_s = null, status = 'upload_pending' }) {
  await ready_();
  const db = await getDb();
  const { rows } = await db.query(
    `INSERT INTO videos (channel_id, title, source_lang, duration_s, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [channel_id, title, source_lang, duration_s, status]);
  return rows[0];
}

export async function publishVideo(id) {
  await ready_();
  const db = await getDb();
  const { rows } = await db.query(
    `UPDATE videos SET status = 'published', published_at = now() WHERE id = $1 RETURNING *`, [id]);
  return rows[0];
}

/** Regional-first feed: the viewer's language first, then their region, then newest. */
export async function feed({ lang, region = null, limit = 20 }) {
  await ready_();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT v.id, v.title, v.source_lang, v.published_at,
            c.name AS channel_name, c.region, c.language
       FROM videos v
       JOIN channels c ON c.id = v.channel_id
      WHERE v.status = 'published'
      ORDER BY (v.source_lang = $1) DESC,
               (c.region = $2) DESC,
               v.published_at DESC NULLS LAST
      LIMIT $3`, [lang, region, limit]);
  return rows;
}

export async function recordEarning({ channel_id, video_id = null, source = 'ad', gross_paise, ref = null }) {
  await ready_();
  const creator = Math.round(gross_paise * CREATOR_SHARE);
  const platform = gross_paise - creator;
  const db = await getDb();
  const { rows } = await db.query(
    `INSERT INTO earnings_ledger (channel_id, video_id, source, gross_paise, creator_paise, platform_paise, ref)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [channel_id, video_id, source, gross_paise, creator, platform, ref]);
  return rows[0];
}

export async function creatorBalance(channel_id) {
  await ready_();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(creator_paise), 0)::bigint AS earned,
            COALESCE((SELECT SUM(amount_paise) FROM payouts WHERE channel_id = $1), 0)::bigint AS paid
       FROM earnings_ledger WHERE channel_id = $1`, [channel_id]);
  return num(rows[0].earned) - num(rows[0].paid);
}

export async function insertPayout({ channel_id, amount_paise, upi_id, status = 'sent', utr = null }) {
  await ready_();
  const db = await getDb();
  const { rows } = await db.query(
    `INSERT INTO payouts (channel_id, amount_paise, upi_id, status, utr)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [channel_id, amount_paise, upi_id, status, utr]);
  return rows[0];
}

/** Invariant check: gross always equals creator + platform. */
export async function ledgerCheck() {
  await ready_();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(gross_paise), 0)::bigint AS gross,
            COALESCE(SUM(creator_paise + platform_paise), 0)::bigint AS parts
       FROM earnings_ledger`);
  return { gross: num(rows[0].gross), parts: num(rows[0].parts), ok: num(rows[0].gross) === num(rows[0].parts) };
}
