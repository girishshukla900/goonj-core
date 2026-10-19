// In-memory store for Phase 4. Postgres swap-in behind the same shape.
export const store = {
  tiers: new Map(),        // channel_id -> [tier]
  memberships: new Map(),  // `${user_id}:${channel_id}` -> membership
  parties: new Map(),      // party_id -> party
  posts: new Map(),        // channel_id -> [post]
};

export function newId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}
