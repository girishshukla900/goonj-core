// In-memory store for Phase 2. Postgres swap-in behind the same shape.
export const store = {
  accounts: new Map(),   // account_name -> signed balance (credit +, debit -)
  entries: [],           // the journal
  payouts: [],           // payout records
  channelUpi: new Map(), // channel_id -> upi_id (for daily runs)
};

export function newId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}

export function account(name) {
  if (!store.accounts.has(name)) store.accounts.set(name, 0);
  return store.accounts.get(name);
}

export function addToAccount(name, amount) {
  store.accounts.set(name, account(name) + amount);
}

export function balanceOf(name) {
  return account(name);
}
