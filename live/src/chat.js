// Live chat with multilingual moderation, and interactive polls. Stored in SQL.
import * as repo from '../../db/src/live_repo.js';

// Neutral placeholder tokens — swap for a real multilingual moderation model.
const BLOCKED = ['spamword', 'scamlink', 'abuse1', 'gaali'];

export function moderate(text) {
  const lower = String(text || '').toLowerCase();
  const hit = BLOCKED.find((w) => lower.includes(w));
  return hit ? { ok: false, reason: 'blocked_word', hit } : { ok: true };
}

export async function postMessage(stream, { user, text, at }) {
  const verdict = moderate(text);
  return repo.postMessage(stream, { user, text, at, blocked: !verdict.ok });
}

export const chatFor = (streamId, opts) => repo.chatFor(streamId, opts);
export const createPoll = (stream, opts) => repo.createPoll(stream, opts);
export const vote = (pollId, label) => repo.vote(pollId, label);
