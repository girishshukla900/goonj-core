// Memberships, superfan badges and the fan leaderboard. Stored in PostgreSQL.
import * as repo from '../../db/src/community_repo.js';
import { findTier, tierRank } from './tiers.js';
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
  const t = await findTier(channel_id, tier);
  if (!t) { const e = new Error('unknown_tier'); e.status = 400; throw e; }

  const row = await repo.upsertMembership({
    user_id, channel_id, tier: t.name, price_paise: t.price_paise, joined_at,
  });
  const membership = {
    user_id: row.user_id, channel_id: row.channel_id, tier: row.tier,
    price_paise: Number(row.price_paise), joined_at: row.joined_at,
    status: row.status, revenue_posted: false,
  };
  membership.badge = badgeFor(membership);

  // Send the membership revenue to the payments service (creator gets 90%).
  if (process.env.PAYMENTS_URL) {
    try {
      const res = await postJson(`${process.env.PAYMENTS_URL}/earnings`, {
        channel_id, source: 'membership', gross_paise: t.price_paise, ref: `membership:${user_id}`,
      });
      membership.revenue_posted = res.status === 201;
    } catch {
      membership.revenue_posted = false;
    }
  }
  return membership;
}

export async function cancel({ user_id, channel_id }) {
  const row = await repo.setMembershipStatus({ user_id, channel_id, status: 'cancelled' });
  if (!row) { const e = new Error('membership_not_found'); e.status = 404; throw e; }
  return { ...row, price_paise: Number(row.price_paise) };
}

export function membershipOf(user_id, channel_id) {
  return repo.getMembership(user_id, channel_id);
}

export async function membersFor(channel_id) {
  const rows = await repo.listActiveMembers(channel_id);
  return rows.map((r) => ({
    user_id: r.user_id, channel_id: r.channel_id, tier: r.tier,
    price_paise: Number(r.price_paise), joined_at: r.joined_at,
    status: 'active', badge: badgeFor(r),
  }));
}

export async function leaderboard(channel_id) {
  const members = await membersFor(channel_id);
  return members
    .sort((a, b) => tierRank(b.tier) - tierRank(a.tier) || new Date(a.joined_at) - new Date(b.joined_at))
    .map((m, i) => ({ rank: i + 1, user_id: m.user_id, tier: m.tier, badge: m.badge }));
}
