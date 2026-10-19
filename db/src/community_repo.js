// Community repositories: tiers, memberships, watch parties and posts in SQL.
import { getDb } from './connect.js';
import { ensureSchema } from './migrate.js';

export function newId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}

export async function getTiers(channelId) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT name, price_paise, benefits FROM channel_tiers WHERE channel_id = $1 ORDER BY price_paise`, [channelId]);
  return rows.map((r) => ({ name: r.name, price_paise: Number(r.price_paise), benefits: r.benefits }));
}

export async function saveTiers(channelId, tiers) {
  await ensureSchema();
  const db = await getDb();
  await db.query(`DELETE FROM channel_tiers WHERE channel_id = $1`, [channelId]);
  for (const t of tiers) {
    await db.query(
      `INSERT INTO channel_tiers (channel_id, name, price_paise, benefits) VALUES ($1, $2, $3, $4)`,
      [channelId, t.name, t.price_paise, JSON.stringify(t.benefits || [])]);
  }
  return getTiers(channelId);
}

export async function upsertMembership({ user_id, channel_id, tier, price_paise, joined_at }) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `INSERT INTO memberships (user_id, channel_id, tier, price_paise, status, joined_at)
     VALUES ($1, $2, $3, $4, 'active', COALESCE($5, now()))
     ON CONFLICT (user_id, channel_id) DO UPDATE
       SET tier = EXCLUDED.tier, price_paise = EXCLUDED.price_paise, status = 'active'
     RETURNING *`, [user_id, channel_id, tier, price_paise, joined_at || null]);
  return rows[0];
}

export async function setMembershipStatus({ user_id, channel_id, status }) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `UPDATE memberships SET status = $3 WHERE user_id = $1 AND channel_id = $2 RETURNING *`,
    [user_id, channel_id, status]);
  return rows[0] || null;
}

export async function getMembership(user_id, channel_id) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT * FROM memberships WHERE user_id = $1 AND channel_id = $2`, [user_id, channel_id]);
  return rows[0] || null;
}

export async function listActiveMembers(channel_id) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT user_id, channel_id, tier, price_paise, joined_at FROM memberships
      WHERE channel_id = $1 AND status = 'active'`, [channel_id]);
  return rows;
}

export async function createParty({ channel_id, video_id, title, starts_at }) {
  await ensureSchema();
  const db = await getDb();
  const id = newId('party');
  await db.query(
    `INSERT INTO watch_parties (id, channel_id, video_id, title, starts_at)
     VALUES ($1, $2, $3, $4, COALESCE($5, now() + interval '1 hour'))`,
    [id, channel_id, video_id || null, title || 'Watch party', starts_at || null]);
  return getParty(id);
}

export async function getParty(id) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(`SELECT * FROM watch_parties WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  const { rows: rsvps } = await db.query(`SELECT user_id FROM party_rsvps WHERE party_id = $1 ORDER BY user_id`, [id]);
  return { ...rows[0], rsvps: rsvps.map((r) => r.user_id) };
}

export async function addRsvp(partyId, userId) {
  await ensureSchema();
  const db = await getDb();
  await db.query(
    `INSERT INTO party_rsvps (party_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [partyId, userId]);
  return getParty(partyId);
}

export async function createPost({ channel_id, author_id, text, members_only }) {
  await ensureSchema();
  const db = await getDb();
  const id = newId('post');
  const { rows } = await db.query(
    `INSERT INTO community_posts (id, channel_id, author_id, text, members_only)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [id, channel_id, author_id || 'creator', String(text || ''), !!members_only]);
  return rows[0];
}

export async function listPosts(channel_id, { membersOnlyVisible = false } = {}) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT * FROM community_posts WHERE channel_id = $1 ${membersOnlyVisible ? '' : 'AND members_only = false'}
      ORDER BY created_at DESC`, [channel_id]);
  return rows;
}

export async function listMembershipsForUser(user_id) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT user_id, channel_id, tier, price_paise, status, joined_at FROM memberships WHERE user_id = $1`, [user_id]);
  return rows.map((r) => ({ ...r, price_paise: Number(r.price_paise) }));
}
