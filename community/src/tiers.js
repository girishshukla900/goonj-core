// Membership tiers (Patreon-style). Persisted in PostgreSQL.
import * as repo from '../../db/src/community_repo.js';

export const DEFAULT_TIERS = [
  { name: 'supporter', price_paise: 4900, benefits: ['Badge next to your name', 'Members-only posts'] },
  { name: 'silver', price_paise: 14900, benefits: ['Everything in Supporter', 'Weekly watch parties', 'Ad-free on Goonj'] },
  { name: 'gold', price_paise: 49900, benefits: ['Everything in Silver', 'Monthly 1:1 call', 'Name in video credits'] },
];

const RANK = { supporter: 1, silver: 2, gold: 3 };

export function tierRank(name) {
  return RANK[name] || 0;
}

export async function setTiers(channelId, tiers) {
  const clean = tiers.map((t) => ({
    name: String(t.name).toLowerCase(),
    price_paise: t.price_paise,
    benefits: t.benefits || [],
  }));
  for (const t of clean) {
    if (!Number.isInteger(t.price_paise) || t.price_paise <= 0) {
      const e = new Error('price_paise must be a positive integer');
      e.status = 400;
      throw e;
    }
  }
  return repo.saveTiers(channelId, clean);
}

export async function tiersFor(channelId) {
  const rows = await repo.getTiers(channelId);
  return rows.length ? rows : DEFAULT_TIERS;
}

export async function findTier(channelId, name) {
  const tiers = await tiersFor(channelId);
  return tiers.find((t) => t.name === String(name).toLowerCase());
}
