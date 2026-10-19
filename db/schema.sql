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


-- ---- Live (Phase 3) ----
CREATE TABLE IF NOT EXISTS streams (
  id          TEXT PRIMARY KEY,
  channel_id  TEXT NOT NULL,
  title       TEXT NOT NULL,
  source_lang TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'created',
  ingest_key  TEXT NOT NULL,
  started_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stream_destinations (
  stream_id TEXT NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  label     TEXT NOT NULL,
  status    TEXT NOT NULL,
  rtmp      TEXT NOT NULL,
  PRIMARY KEY (stream_id, name)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         TEXT PRIMARY KEY,
  stream_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  text       TEXT NOT NULL,
  lang       TEXT,
  at_seconds INTEGER NOT NULL,
  blocked    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_stream_idx ON chat_messages (stream_id, at_seconds);

CREATE TABLE IF NOT EXISTS polls (
  id         TEXT PRIMARY KEY,
  stream_id  TEXT NOT NULL,
  question   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poll_options (
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label   TEXT NOT NULL,
  votes   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (poll_id, label)
);

CREATE TABLE IF NOT EXISTS clips (
  id         TEXT PRIMARY KEY,
  stream_id  TEXT NOT NULL,
  idx        INTEGER NOT NULL,
  start_s    INTEGER NOT NULL,
  end_s      INTEGER NOT NULL,
  duration_s INTEGER NOT NULL,
  score      INTEGER NOT NULL,
  lang       TEXT,
  title      TEXT NOT NULL,
  hook       TEXT NOT NULL,
  captions   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Community (Phase 4) ----
CREATE TABLE IF NOT EXISTS channel_tiers (
  channel_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  price_paise BIGINT NOT NULL,
  benefits    JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (channel_id, name)
);

CREATE TABLE IF NOT EXISTS memberships (
  user_id     TEXT NOT NULL,
  channel_id  TEXT NOT NULL,
  tier        TEXT NOT NULL,
  price_paise BIGINT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

CREATE TABLE IF NOT EXISTS watch_parties (
  id         TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  video_id   TEXT,
  title      TEXT NOT NULL,
  starts_at  TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS party_rsvps (
  party_id TEXT NOT NULL REFERENCES watch_parties(id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL,
  PRIMARY KEY (party_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_posts (
  id           TEXT PRIMARY KEY,
  channel_id   TEXT NOT NULL,
  author_id    TEXT NOT NULL,
  text         TEXT NOT NULL,
  members_only BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---- Dubbing (Phase 1) ----
CREATE TABLE IF NOT EXISTS voice_models (
  id         TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  consent_at TIMESTAMPTZ NOT NULL,
  status     TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dubbing_jobs (
  id             TEXT PRIMARY KEY,
  video_id       TEXT NOT NULL,
  channel_id     TEXT,
  source_lang    TEXT NOT NULL,
  target_lang    TEXT NOT NULL,
  voice_model_id TEXT,
  status         TEXT NOT NULL DEFAULT 'queued',
  step           TEXT,
  progress       INTEGER NOT NULL DEFAULT 0,
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dubbing_jobs_video_idx ON dubbing_jobs (video_id);

CREATE TABLE IF NOT EXISTS dubbing_tracks (
  id             TEXT PRIMARY KEY,
  video_id       TEXT NOT NULL,
  lang           TEXT NOT NULL,
  kind           TEXT NOT NULL DEFAULT 'dub_audio',
  audio          TEXT NOT NULL,
  subtitle       TEXT,
  voice_model_id TEXT,
  duration_s     NUMERIC,
  bytes          BIGINT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (video_id, lang)
);
