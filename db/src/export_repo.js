// Content ownership: export everything a creator owns, as one JSON bundle.
// This backs the "no lock-in — take your data any time" promise.
import { getDb } from './connect.js';
import { ensureSchema } from './migrate.js';

const num = (v) => (v == null ? 0 : Number(v));

export async function exportChannel(channelId) {
  await ensureSchema();
  const db = await getDb();
  const q = async (text, params) => (await db.query(text, params)).rows;

  // Channel id may be a numeric id (channels.id) or a handle.
  const channel = (await q(
    `SELECT * FROM channels WHERE id::text = $1 OR handle = $1 LIMIT 1`, [channelId]))[0] || null;

  // Resolve a handle to the real channel id so child rows are found either way.
  const key = channel ? String(channel.id) : channelId;
  const byChannel = (table) => q(`SELECT * FROM ${table} WHERE channel_id::text = $1`, [key]);
  const byVideo = (table) => q(
    `SELECT * FROM ${table} WHERE video_id::text IN (SELECT id::text FROM videos WHERE channel_id::text = $1)`,
    [key]);

  const [videos, assets, tracks, jobs, voiceModels, ledger, payouts,
    memberships, tiers, posts, parties, streams] = await Promise.all([
    byChannel('videos'),
    byVideo('video_assets'),
    byVideo('dubbing_tracks'),
    byChannel('dubbing_jobs'),
    byChannel('voice_models'),
    byChannel('ledger_entries'),
    byChannel('payouts'),
    byChannel('memberships'),
    byChannel('channel_tiers'),
    byChannel('community_posts'),
    byChannel('watch_parties'),
    byChannel('streams'),
  ]);

  const streamIds = streams.map((s) => s.id);
  const chat = streamIds.length
    ? await q(`SELECT * FROM chat_messages WHERE stream_id = ANY($1)`, [streamIds])
    : [];
  const clips = streamIds.length
    ? await q(`SELECT * FROM clips WHERE stream_id = ANY($1)`, [streamIds])
    : [];

  return {
    exported_at: new Date().toISOString(),
    channel_id: channelId,
    channel,
    counts: {
      videos: videos.length, video_assets: assets.length, dubbing_tracks: tracks.length,
      dubbing_jobs: jobs.length, voice_models: voiceModels.length,
      ledger_entries: ledger.length, payouts: payouts.length,
      memberships: memberships.length, tiers: tiers.length, posts: posts.length,
      watch_parties: parties.length, streams: streams.length,
      chat_messages: chat.length, clips: clips.length,
    },
    data: {
      videos, video_assets: assets, dubbing_tracks: tracks, dubbing_jobs: jobs,
      voice_models: voiceModels, ledger_entries: ledger,
      payouts, memberships, channel_tiers: tiers, community_posts: posts,
      watch_parties: parties, streams, chat_messages: chat, clips,
    },
  };
}

/** Total rupee value a creator has earned through the ledger. */
export async function exportSummary(channelId) {
  const bundle = await exportChannel(channelId);
  const payable = bundle.data.ledger_entries.filter((e) => String(e.account).startsWith('creator_payable:'));
  const earned = payable.filter((e) => num(e.amount_paise) > 0).reduce((n, e) => n + num(e.amount_paise), 0);
  const balance = payable.reduce((n, e) => n + num(e.amount_paise), 0);
  return {
    channel_id: channelId,
    videos: bundle.counts.videos,
    tracks: bundle.counts.dubbing_tracks,
    ledger_entries: bundle.counts.ledger_entries,
    earned_paise: earned,          // gross, credited to the creator
    paid_out_paise: bundle.data.payouts.reduce((n, p) => n + num(p.amount_paise), 0),
    balance_paise: balance,        // earned minus paid out
  };
}
