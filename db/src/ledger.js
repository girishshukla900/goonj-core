// Double-entry ledger in SQL. Amounts are integer paise.
// Convention: signed amounts, positive = credit, negative = debit.
import { getDb, withTransaction } from './connect.js';
import { ensureSchema } from './migrate.js';

const CREATOR_SHARE = 0.90;
export const PLATFORM_REVENUE = 'platform_revenue';
export const EXTERNAL_INCOME = 'external_income';
export const PAYOUTS_CLEARED = 'payouts_cleared';

const num = (v) => (v == null ? 0 : Number(v));

export function creatorPayable(channelId) {
  return `creator_payable:${channelId}`;
}

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

export function split(grossPaise) {
  if (!Number.isInteger(grossPaise) || grossPaise <= 0) {
    throw badRequest('gross_paise must be a positive integer');
  }
  const creator = Math.round(grossPaise * CREATOR_SHARE);
  return { creator, platform: grossPaise - creator };
}

function newTxnId() {
  return 'txn_' + Math.random().toString(36).slice(2, 12);
}

function makeUtr() {
  let s = '';
  for (let i = 0; i < 12; i++) s += Math.floor(Math.random() * 10);
  return 'UTR' + s;
}

/**
 * Post a balanced transaction. Throws if entries do not sum to zero.
 * Writes every entry and updates account balances inside one DB transaction.
 */
export async function postTransaction({ kind, source = null, channel_id = null, video_id = null, ref = null, entries }) {
  await ensureSchema();
  const sum = entries.reduce((n, e) => n + e.amount, 0);
  if (sum !== 0) throw badRequest(`unbalanced transaction: entries sum to ${sum}, expected 0`);

  const txnId = newTxnId();
  await withTransaction(async (q) => {
    for (const e of entries) {
      await q(
        `INSERT INTO ledger_entries (txn_id, account, amount_paise, kind, source, channel_id, video_id, ref)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [txnId, e.account, e.amount, kind, source, channel_id, video_id, ref]);
      await q(
        `INSERT INTO ledger_accounts (name, balance_paise) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET balance_paise = ledger_accounts.balance_paise + EXCLUDED.balance_paise`,
        [e.account, e.amount]);
    }
  });
  return { id: txnId, kind, source, channel_id, video_id, ref, entries };
}

/** Record an earning and split it 90/10. */
export async function recordEarning({ channel_id, video_id = null, source = 'ad', gross_paise, ref = null }) {
  const { creator, platform } = split(gross_paise);
  const tx = await postTransaction({
    kind: 'earning', source, channel_id, video_id, ref,
    entries: [
      { account: EXTERNAL_INCOME, amount: -gross_paise },
      { account: creatorPayable(channel_id), amount: +creator },
      { account: PLATFORM_REVENUE, amount: +platform },
    ],
  });
  return {
    txn_id: tx.id, channel_id, video_id, source, ref,
    gross_paise, creator_paise: creator, platform_paise: platform,
  };
}

/** A creator's balance is simply the sum of their payable account. */
export async function creatorBalance(channelId) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(amount_paise), 0)::bigint AS bal FROM ledger_entries WHERE account = $1`,
    [creatorPayable(channelId)]);
  return num(rows[0].bal);
}

export async function balanceOf(accountName) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(amount_paise), 0)::bigint AS bal FROM ledger_entries WHERE account = $1`,
    [accountName]);
  return num(rows[0].bal);
}

export async function requestPayout({ channel_id, upi_id, amount_paise, status = 'sent', utr = null }) {
  if (!channel_id) throw badRequest('channel_id required');
  if (!upi_id || !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi_id)) throw badRequest('valid upi_id required');
  if (!Number.isInteger(amount_paise) || amount_paise <= 0) throw badRequest('amount_paise must be a positive integer');

  const balance = await creatorBalance(channel_id);
  if (amount_paise > balance) throw badRequest(`insufficient balance: have ${balance}, asked ${amount_paise}`);

  await postTransaction({
    kind: 'payout', source: 'upi', channel_id, ref: upi_id,
    entries: [
      { account: creatorPayable(channel_id), amount: -amount_paise },
      { account: PAYOUTS_CLEARED, amount: +amount_paise },
    ],
  });

  await registerUpi({ channel_id, upi_id });
  const db = await getDb();
  const finalUtr = utr || makeUtr();
  const { rows } = await db.query(
    `INSERT INTO payouts (channel_id, amount_paise, upi_id, status, utr)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [channel_id, amount_paise, upi_id, status, finalUtr]);
  return rows[0];
}

// insertPayout is the plain insert-or-pay alias used by tests.
export const insertPayout = requestPayout;

export async function registerUpi({ channel_id, upi_id }) {
  if (!channel_id) throw badRequest('channel_id required');
  if (!upi_id || !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi_id)) throw badRequest('valid upi_id required');
  await ensureSchema();
  const db = await getDb();
  await db.query(
    `INSERT INTO channel_upi (channel_id, upi_id) VALUES ($1, $2)
     ON CONFLICT (channel_id) DO UPDATE SET upi_id = EXCLUDED.upi_id, updated_at = now()`,
    [channel_id, upi_id]);
  return { channel_id, upi_id };
}

export async function payoutsFor(channelId) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT * FROM payouts WHERE channel_id = $1 ORDER BY created_at DESC`, [channelId]);
  return rows;
}

/** Daily run: pay out every creator whose balance clears the threshold. */
export async function dailyRun({ min_paise = 100 } = {}) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT name, balance_paise FROM ledger_accounts
      WHERE name LIKE 'creator_payable:%' AND balance_paise > 0`);
  const paid = [];
  const skipped = [];
  for (const row of rows) {
    const channelId = row.name.slice('creator_payable:'.length);
    const balance = num(row.balance_paise);
    const { rows: upiRows } = await db.query(`SELECT upi_id FROM channel_upi WHERE channel_id = $1`, [channelId]);
    const upi = upiRows[0]?.upi_id;
    if (balance >= min_paise && upi) {
      paid.push(await requestPayout({ channel_id: channelId, upi_id: upi, amount_paise: balance }));
    } else {
      skipped.push({ channel_id: channelId, balance_paise: balance, reason: upi ? 'below_threshold' : 'no_upi' });
    }
  }
  return { paid, skipped };
}

export async function entriesFor(channelId) {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT * FROM ledger_entries WHERE channel_id = $1 ORDER BY created_at`, [channelId]);
  return rows;
}

export async function accounts() {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(`SELECT name AS account, balance_paise AS paise FROM ledger_accounts ORDER BY name`);
  return rows.map((r) => ({ account: r.account, paise: num(r.paise) }));
}

/** Invariant: the whole journal sums to zero. */
export async function journalBalances() {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(`SELECT COALESCE(SUM(amount_paise), 0)::bigint AS total FROM ledger_entries`);
  return num(rows[0].total) === 0;
}

export async function journalTotal() {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(`SELECT COALESCE(SUM(amount_paise), 0)::bigint AS total FROM ledger_entries`);
  return num(rows[0].total);
}

/** Invariant: gross == creator + platform across all earnings. */
export async function ledgerCheck() {
  await ensureSchema();
  const db = await getDb();
  const { rows } = await db.query(
    `SELECT COALESCE(-SUM(amount_paise) FILTER (WHERE account = 'external_income'), 0)::bigint AS gross,
            COALESCE(SUM(amount_paise) FILTER (WHERE account LIKE 'creator_payable:%' OR account = 'platform_revenue'), 0)::bigint AS parts
       FROM ledger_entries WHERE kind = 'earning'`);
  const gross = num(rows[0].gross);
  const parts = num(rows[0].parts);
  return { gross, parts, ok: gross === parts };
}
