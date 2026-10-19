// Repositories: all SQL lives here. Money functions come from the ledger.
import { getDb } from './connect.js';
import { ensureSchema } from './migrate.js';

const ready_ = ensureSchema;

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

// Money lives in the double-entry ledger.
export {
  recordEarning, creatorBalance, insertPayout, requestPayout, ledgerCheck,
  balanceOf, accounts, journalBalances, journalTotal, entriesFor, registerUpi,
  dailyRun, payoutsFor, postTransaction, creatorPayable, split,
} from './ledger.js';
