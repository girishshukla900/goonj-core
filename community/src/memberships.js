// Memberships, superfan badges and the fan leaderboard.
import { store } from './store.js';
import { findTier, tierRank, tiersFor } from './tiers.js';
import { postJson } from './paymentsClient.js';

const DAY = 24 * 60 * 60 * 1000;

/** Badge from tenure + tier. Tenure is what makes a superfan. */
export function badgeFor(membership, now = Date.now()) {
  const months = (now - new Date(membership.joined_at).getTime()) / (30 * DAY);
  const rank = tierRank(membership.tier);
  if (rank >= 3 && months >= 6) return 'Legend';
  if (rank >= 3 || months >= 6) return 'Superfan';
  if (rank >= 2 || months >= 2) return 'Regular';
  return 'New';
}

export async function join({ user_id, channel_id, tier, joined_at }) {
  const t = findTier(channel_id, tier);
  if (!t) { const e = new Error('unknown_tier'); e.status = 400; throw e; }

  const membership = {
    user_id, channel_id, tier: t.name, price_paise: t.price_paise,
    joined_at: joined_at || new Date().toISOString(),
    status: 'active', revenue_posted: false,
  };
  membership.badge = badgeFor(membership);

  // Send the membership revenue to the payments service (creator gets 90%).
  if (process.env.PAYMENTS_URL) {
    try {
      const res = await postJson(`${process.env.PAYMENTS_URL}/earnings`, {
        channel_id, source: 'membership', gross_paise: t.price_paise,
        ref: `membership:${user_id}`,
      });
      membership.revenue_posted = res.status === 201;
    } catch {
      membership.revenue_posted = false;
    }
  }

  store.memberships.set(`${user_id}:${channel_id}`, membership);
  return membership;
}

export function cancel({ user_id, channel_id }) {
  const key = `${user_id}:${channel_id}`;
  const m = store.memberships.get(key);
  if (!m) { const e = new Error('membership_not_found'); e.status = 404; throw e; }
  m.status = 'cancelled';
  return m;
}

export function membershipOf(user_id, channel_id) {
  return store.memberships.get(`${user_id}:${channel_id}`) || null;
}

export function membersFor(channel_id) {
  return [...store.memberships.values()]
    .filter((m) => m.channel_id === channel_id && m.status === 'active')
    .map((m) => ({ ...m, badge: badgeFor(m) }));
}

export function leaderboard(channel_id) {
  return membersFor(channel_id)
    .sort((a, b) => tierRank(b.tier) - tierRank(a.tier)
      || new Date(a.joined_at) - new Date(b.joined_at))
    .map((m, i) => ({ rank: i + 1, user_id: m.user_id, tier: m.tier, badge: m.badge }));
}
