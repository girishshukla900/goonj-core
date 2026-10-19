// UPI payouts. Daily and automatic; manual withdraw any time.
import { store, newId } from './store.js';
import { postTransaction, creatorPayable, creatorBalance, PAYOUTS_CLEARED } from './ledger.js';
import { badRequest } from './money.js';

function makeUtr() {
  let s = '';
  for (let i = 0; i < 12; i++) s += Math.floor(Math.random() * 10);
  return 'UTR' + s;
}

export function requestPayout({ channel_id, upi_id, amount_paise }) {
  if (!channel_id) throw badRequest('channel_id required');
  if (!upi_id || !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi_id)) throw badRequest('valid upi_id required');
  if (!Number.isInteger(amount_paise) || amount_paise <= 0) {
    throw badRequest('amount_paise must be a positive integer');
  }

  const balance = creatorBalance(channel_id);
  if (amount_paise > balance) throw badRequest(`insufficient balance: have ${balance}, asked ${amount_paise}`);

  store.channelUpi.set(channel_id, upi_id);

  // Move money out of the creator's payable account.
  postTransaction({
    kind: 'payout', source: 'upi', channel_id, ref: upi_id,
    entries: [
      { account: creatorPayable(channel_id), amount: -amount_paise },
      { account: PAYOUTS_CLEARED, amount: +amount_paise },
    ],
  });

  const payout = {
    id: newId('po'), channel_id, amount_paise, upi_id,
    status: 'sent', utr: makeUtr(), created_at: new Date().toISOString(),
  };
  store.payouts.push(payout);
  return payout;
}

/** Daily run: pay out every creator whose balance clears the threshold. */
export function dailyRun({ min_paise = 100 } = {}) {
  const paid = [];
  const skipped = [];
  for (const [name, balance] of store.accounts.entries()) {
    if (!name.startsWith('creator_payable:')) continue;
    const channelId = name.slice('creator_payable:'.length);
    const upi = store.channelUpi.get(channelId);
    if (balance >= min_paise && upi) {
      paid.push(requestPayout({ channel_id: channelId, upi_id: upi, amount_paise: balance }));
    } else if (balance > 0) {
      skipped.push({ channel_id: channelId, balance_paise: balance, reason: upi ? 'below_threshold' : 'no_upi' });
    }
  }
  return { paid, skipped };
}

export function payoutsFor(channelId) {
  return store.payouts.filter((p) => p.channel_id === channelId);
}

/** Register the UPI ID a creator wants payouts sent to. */
export function registerUpi({ channel_id, upi_id }) {
  if (!channel_id) throw badRequest('channel_id required');
  if (!upi_id || !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi_id)) throw badRequest('valid upi_id required');
  store.channelUpi.set(channel_id, upi_id);
  return { channel_id, upi_id };
}
