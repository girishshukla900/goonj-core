// Double-entry ledger.
// Convention: signed amounts, positive = credit, negative = debit.
// Every transaction's entries must sum to zero, so the journal always balances.
import { store, newId, addToAccount, balanceOf } from './store.js';
import { badRequest } from './money.js';

export const PLATFORM_REVENUE = 'platform_revenue';
export const EXTERNAL_INCOME = 'external_income';
export const PAYOUTS_CLEARED = 'payouts_cleared';

export function creatorPayable(channelId) {
  return `creator_payable:${channelId}`;
}

/** Post a balanced transaction. Throws if the entries do not sum to zero. */
export function postTransaction({ kind, source, channel_id = null, video_id = null, ref = null, entries }) {
  const sum = entries.reduce((n, e) => n + e.amount, 0);
  if (sum !== 0) throw badRequest(`unbalanced transaction: entries sum to ${sum}, expected 0`);

  const tx = {
    id: newId('txn'), kind, source, channel_id, video_id, ref,
    entries, created_at: new Date().toISOString(),
  };
  store.entries.push(tx);
  for (const e of entries) addToAccount(e.account, e.amount);
  return tx;
}

/** Record an earning and split it 90/10. */
export function recordEarning({ channel_id, video_id, source, gross_paise, ref, splitFn }) {
  const { creator, platform } = splitFn(gross_paise);
  return postTransaction({
    kind: 'earning', source, channel_id, video_id, ref,
    entries: [
      { account: EXTERNAL_INCOME, amount: -gross_paise },
      { account: creatorPayable(channel_id), amount: +creator },
      { account: PLATFORM_REVENUE, amount: +platform },
    ],
  });
}

export function creatorBalance(channelId) {
  return balanceOf(creatorPayable(channelId));
}

/** Invariant: the whole journal must always sum to zero. */
export function journalBalances() {
  let total = 0;
  for (const tx of store.entries) for (const e of tx.entries) total += e.amount;
  return total === 0;
}

export function journalTotal() {
  let total = 0;
  for (const tx of store.entries) for (const e of tx.entries) total += e.amount;
  return total;
}
