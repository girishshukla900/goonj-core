-- Goonj schema (PostgreSQL). Idempotent: safe to run repeatedly.
-- Money is stored as integer paise, never float.

CREATE TABLE IF NOT EXISTS users (
  id         BIGSERIAL PRIMARY KEY,
  phone      TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL DEFAULT 'viewer',
  kyc_status TEXT NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channels (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
  handle     TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  language   TEXT NOT NULL,
  region     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS videos (
  id           BIGSERIAL PRIMARY KEY,
  channel_id   BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  source_lang  TEXT NOT NULL,
  duration_s   INTEGER,
  status       TEXT NOT NULL DEFAULT 'upload_pending',
  visibility   TEXT NOT NULL DEFAULT 'public',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS videos_lang_idx ON videos (source_lang, status);
CREATE INDEX IF NOT EXISTS videos_channel_idx ON videos (channel_id);

CREATE TABLE IF NOT EXISTS video_assets (
  id           BIGSERIAL PRIMARY KEY,
  video_id     BIGINT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  lang         TEXT,
  url          TEXT NOT NULL,
  bitrate_kbps INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Double-entry ledger (the money layer) ----
-- Convention: signed amounts, positive = credit, negative = debit.
-- Every transaction's entries must sum to zero, so the journal always balances.
CREATE TABLE IF NOT EXISTS ledger_accounts (
  name          TEXT PRIMARY KEY,
  balance_paise BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id           BIGSERIAL PRIMARY KEY,
  txn_id       TEXT NOT NULL,
  account      TEXT NOT NULL,
  amount_paise BIGINT NOT NULL,
  kind         TEXT NOT NULL,
  source       TEXT,
  channel_id   TEXT,
  video_id     TEXT,
  ref          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_txn_idx ON ledger_entries (txn_id);
CREATE INDEX IF NOT EXISTS ledger_account_idx ON ledger_entries (account);
CREATE INDEX IF NOT EXISTS ledger_channel_idx ON ledger_entries (channel_id, created_at);

CREATE TABLE IF NOT EXISTS payouts (
  id           BIGSERIAL PRIMARY KEY,
  channel_id   TEXT NOT NULL,
  amount_paise BIGINT NOT NULL,
  upi_id       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'sent',
  utr          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channel_upi (
  channel_id TEXT PRIMARY KEY,
  upi_id     TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id  BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  tier        TEXT NOT NULL,
  price_paise BIGINT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel_id)
);
