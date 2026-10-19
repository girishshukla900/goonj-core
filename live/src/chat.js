// Live chat with multilingual moderation, and interactive polls.
import { store, newId } from './store.js';

// Neutral placeholder tokens — swap for a real multilingual moderation model.
const BLOCKED = ['spamword', 'scamlink', 'abuse1', 'gaali'];

export function moderate(text) {
  const lower = String(text || '').toLowerCase();
  const hit = BLOCKED.find((w) => lower.includes(w));
  return hit ? { ok: false, reason: 'blocked_word', hit } : { ok: true };
}

export function postMessage(stream, { user, text, at }) {
  const verdict = moderate(text);
  const message = {
    id: newId('msg'),
    stream_id: stream.id,
    user: user || 'anon',
    text: String(text || ''),
    lang: stream.source_lang,
    at: Number.isFinite(at) ? at : elapsedSeconds(stream),
    blocked: !verdict.ok,
    created_at: new Date().toISOString(),
  };
  if (verdict.ok) {
    const list = store.chats.get(stream.id) || [];
    list.push(message);
    store.chats.set(stream.id, list);
  }
  return message;
}

export function elapsedSeconds(stream) {
  if (!stream.started_at) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(stream.started_at).getTime()) / 1000));
}

export function chatFor(streamId, { includeBlocked = false } = {}) {
  const list = store.chats.get(streamId) || [];
  return includeBlocked ? list : list.filter((m) => !m.blocked);
}

export function createPoll(stream, { question, options }) {
  const poll = {
    id: newId('poll'),
    stream_id: stream.id,
    question: question || 'Poll',
    options: (options || []).map((label) => ({ label, votes: 0 })),
    created_at: new Date().toISOString(),
  };
  store.polls.set(poll.id, poll);
  return poll;
}

export function vote(poll, optionLabel) {
  const opt = poll.options.find((o) => o.label === optionLabel);
  if (!opt) { const e = new Error('unknown_option'); e.status = 400; throw e; }
  opt.votes += 1;
  return poll;
}
