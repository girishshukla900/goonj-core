// In-memory store for Phase 3. Redis/Postgres swap-in behind the same shape.
export const store = {
  streams: new Map(),   // stream_id -> stream
  chats: new Map(),     // stream_id -> [message]
  polls: new Map(),     // poll_id -> poll
  clips: new Map(),     // stream_id -> [clip]
};

export function newId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}
