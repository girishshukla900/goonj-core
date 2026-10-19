// Live service repositories: streams, chat, polls and clips in SQL.
import { getDb } from './connect.js';
import { ensureSchema } from './migrate.js';

export const DESTINATIONS = ['goonj', 'youtube', 'instagram', 'twitch'];
const LABEL = { goonj: 'Goonj', youtube: 'YouTube', instagram: 'Instagram', twitch: 'Twitch' };

export function newId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}

export async function createStream({ channel_id, title, source_lang, destinations }) {
  await ensureSchema();
  const db = await getDb();
  const wanted = (destinations && destinations.length ? destinations : DESTINATIONS)
    .filter((d) => DESTINATIONS.includes(d));
  const id = newId('str');
  await db.query(
    `INSERT INTO streams (id, channel_id, title, source_lang, status, ingest_key)
     VALUES ($1, $2, $3, $4, 'created', $5)`,
    [id, channel_id, title || 'Untitled live', source_lang || 'hi', newId('ingest')]);
  for (const name of wanted) {
    await db.query(
      `INSERT INTO stream_destinations (stream_id, name, label, status, rtmp)
       VALUES ($1, $2, $3, 'configured', $4)`,
      [id, name, LABEL[name], `rtmp://ingest.goonj.dev/${name}`]);
  }
  return getStream(id);
}

export async function getStream(id) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(`SELECT * FROM streams WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  const { rows: dests } = await db.query(
    `SELECT name, label, status, rtmp FROM stream_destinations WHERE stream_id = $1 ORDER BY name`, [id]);
  return { ...rows[0], destinations: dests };
}

export async function setStreamStatus(id, status) {
  await ensureSchema();
  const db = await getDb();
  if (status === 'live') {
    await db.query(`UPDATE streams SET status = 'live', started_at = now() WHERE id = $1`, [id]);
  } else {
    await db.query(`UPDATE streams SET status = $2 WHERE id = $1`, [id, status]);
  }
  await db.query(`UPDATE stream_destinations SET status = $2 WHERE stream_id = $1`, [id, status]);
  return getStream(id);
}

export async function postMessage(stream, { user, text, at, blocked, lang }) {
  await ensureSchema();
  const db = await getDb();
  const message = {
    id: newId('msg'), stream_id: stream.id, user: user || 'anon',
    text: String(text || ''), lang: lang || stream.source_lang,
    at: Number.isFinite(at) ? at : 0, blocked: !!blocked,
  };
  if (!message.blocked) {
    await db.query(
      `INSERT INTO chat_messages (id, stream_id, user_id, text, lang, at_seconds, blocked)
       VALUES ($1, $2, $3, $4, $5, $6, false)`,
      [message.id, message.stream_id, message.user, message.text, message.lang, message.at]);
  }
  return message;
}

export async function chatFor(streamId, { includeBlocked = false } = {}) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT id, stream_id, user_id AS "user", text, lang, at_seconds AS at, blocked
       FROM chat_messages WHERE stream_id = $1 ${includeBlocked ? '' : 'AND blocked = false'}
      ORDER BY at_seconds, created_at`, [streamId]);
  return rows.map((r) => ({ ...r, at: Number(r.at) }));
}

export async function createPoll(stream, { question, options }) {
  await ensureSchema();
  const db = await getDb();
  const id = newId('poll');
  await db.query(`INSERT INTO polls (id, stream_id, question) VALUES ($1, $2, $3)`,
    [id, stream.id, question || 'Poll']);
  for (const label of options || []) {
    await db.query(`INSERT INTO poll_options (poll_id, label, votes) VALUES ($1, $2, 0)`, [id, label]);
  }
  return getPoll(id);
}

export async function getPoll(id) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(`SELECT * FROM polls WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  const { rows: options } = await db.query(
    `SELECT label, votes FROM poll_options WHERE poll_id = $1 ORDER BY label`, [id]);
  return { ...rows[0], options: options.map((o) => ({ label: o.label, votes: Number(o.votes) })) };
}

export async function vote(pollId, optionLabel) {
  await ensureSchema();
  const db = await getDb();
  const { rowCount } = await db.query(
    `UPDATE poll_options SET votes = votes + 1 WHERE poll_id = $1 AND label = $2`, [pollId, optionLabel]);
  if (rowCount === 0) { const e = new Error('unknown_option'); e.status = 400; throw e; }
  return getPoll(pollId);
}

export async function saveClips(streamId, clips) {
  await ensureSchema();
  const db = await getDb();
  await db.query(`DELETE FROM clips WHERE stream_id = $1`, [streamId]);
  for (const c of clips) {
    await db.query(
      `INSERT INTO clips (id, stream_id, idx, start_s, end_s, duration_s, score, lang, title, hook, captions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [c.id, streamId, c.index, c.start, c.end, c.duration_s, c.score, c.lang, c.title, c.hook, c.captions]);
  }
  return clips;
}

export async function clipsFor(streamId) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT id, stream_id, idx AS index, start_s AS start, end_s AS end, duration_s, score, lang, title, hook, captions
       FROM clips WHERE stream_id = $1 ORDER BY idx`, [streamId]);
  return rows;
}
