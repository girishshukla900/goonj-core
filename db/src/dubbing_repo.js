// Dubbing repositories: voice models, jobs and tracks in SQL.
import { getDb } from './connect.js';
import { ensureSchema } from './migrate.js';

export function newId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

/** Cloning fails closed: no consent, no voice model. */
export async function createVoiceModel({ channel_id, consent }) {
  if (!consent) throw badRequest('consent_required');
  await ensureSchema();
  const db = await getDb();
  const id = newId('vm');
  const { rows } = await db.query(
    `INSERT INTO voice_models (id, channel_id, consent_at, status)
     VALUES ($1, $2, now(), 'active') RETURNING *`, [id, channel_id]);
  return rows[0];
}

export async function latestVoiceModel(channel_id) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT id FROM voice_models WHERE channel_id = $1 AND status = 'active'
      ORDER BY created_at DESC LIMIT 1`, [channel_id]);
  return rows[0] ? rows[0].id : null;
}

export async function createJob({ video_id, channel_id = null, source_lang, target_lang, voice_model_id = null }) {
  await ensureSchema();
  const db = await getDb();
  const id = newId('job');
  const { rows } = await db.query(
    `INSERT INTO dubbing_jobs (id, video_id, channel_id, source_lang, target_lang, voice_model_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'queued') RETURNING *`,
    [id, video_id, channel_id, source_lang, target_lang, voice_model_id]);
  return rows[0];
}

export async function updateJob(id, fields) {
  await ensureSchema();
  const db = await getDb();
  const sets = [];
  const vals = [];
  let i = 1;
  for (const [k, v] of Object.entries(fields)) { sets.push(`${k} = $${i++}`); vals.push(v); }
  vals.push(id);
  await db.query(`UPDATE dubbing_jobs SET ${sets.join(', ')} WHERE id = $${i}`, vals);
}

function trackFrom(row) {
  if (!row.audio) return null;
  return {
    video_id: row.video_id, lang: row.target_lang, kind: 'dub_audio',
    audio: row.audio, subtitle: row.subtitle, voice_model_id: row.voice_model_id,
    duration_s: row.duration_s == null ? null : Number(row.duration_s),
    bytes: row.bytes == null ? null : Number(row.bytes),
  };
}

export async function getJob(id) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT j.*, t.audio, t.subtitle, t.voice_model_id AS t_vm, t.duration_s, t.bytes
       FROM dubbing_jobs j
       LEFT JOIN dubbing_tracks t ON t.video_id = j.video_id AND t.lang = j.target_lang
      WHERE j.id = $1`, [id]);
  if (!rows[0]) return null;
  const r = rows[0];
  return { ...r, track: trackFrom({ ...r, voice_model_id: r.t_vm }) };
}

export async function listJobs() {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT j.*, t.audio, t.subtitle, t.voice_model_id AS t_vm, t.duration_s, t.bytes
       FROM dubbing_jobs j
       LEFT JOIN dubbing_tracks t ON t.video_id = j.video_id AND t.lang = j.target_lang
      ORDER BY j.created_at`);
  return rows.map((r) => ({ ...r, track: trackFrom({ ...r, voice_model_id: r.t_vm }) }));
}

export async function saveTrack(track) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `INSERT INTO dubbing_tracks (id, video_id, lang, kind, audio, subtitle, voice_model_id, duration_s, bytes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (video_id, lang) DO UPDATE SET
       audio = EXCLUDED.audio, subtitle = EXCLUDED.subtitle,
       duration_s = EXCLUDED.duration_s, bytes = EXCLUDED.bytes
     RETURNING *`,
    [newId('trk'), track.video_id, track.lang, track.kind || 'dub_audio',
     track.audio, track.subtitle, track.voice_model_id, track.duration_s, track.bytes]);
  return rows[0];
}

export async function tracksFor(video_id) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT video_id, lang, kind, audio, subtitle, voice_model_id, duration_s, bytes
       FROM dubbing_tracks WHERE video_id = $1 ORDER BY lang`, [video_id]);
  return rows.map((r) => ({ ...r, duration_s: Number(r.duration_s), bytes: Number(r.bytes) }));
}
