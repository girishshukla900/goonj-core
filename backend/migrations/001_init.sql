-- Goonj Phase 0 schema (PostgreSQL 15+)
-- Money tables (earnings_ledger, payouts) are designed first: they are the
-- hardest to change later.

CREATE TABLE users (
  id           BIGSERIAL PRIMARY KEY,
  phone        TEXT UNIQUE NOT NULL,
  role         TEXT NOT NULL DEFAULT 'viewer',      -- viewer | creator | admin
  kyc_status   TEXT NOT NULL DEFAULT 'none',        -- none | pending | verified
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE channels (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  handle       TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  language     TEXT NOT NULL,                        -- source language code, e.g. 'hi'
  region       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE videos (
  id           BIGSERIAL PRIMARY KEY,
  channel_id   BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  source_lang  TEXT NOT NULL,
  duration_s   INTEGER,
  status       TEXT NOT NULL DEFAULT 'upload_pending', -- upload_pending | transcoding | published | blocked
  visibility   TEXT NOT NULL DEFAULT 'public',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);
CREATE INDEX videos_channel_idx ON videos (channel_id);
CREATE INDEX videos_lang_idx    ON videos (source_lang, status);

CREATE TABLE video_assets (
  id           BIGSERIAL PRIMARY KEY,
  video_id     BIGINT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,                        -- hls | source | dub_audio | thumb
  lang         TEXT,
  url          TEXT NOT NULL,
  bitrate_kbps INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX video_assets_video_idx ON video_assets (video_id, kind);

-- One row per dubbed language track.
CREATE TABLE dubs (
  id             BIGSERIAL PRIMARY KEY,
  video_id       BIGINT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  target_lang    TEXT NOT NULL,
  voice_model_id BIGINT,
  status         TEXT NOT NULL DEFAULT 'queued',     -- queued | processing | ready | approved | failed
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (video_id, target_lang)
);

-- The creator's cloned voice. Their asset; deleted on request.
CREATE TABLE voice_models (
  id           BIGSERIAL PRIMARY KEY,
  channel_id   BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  consent_at   TIMESTAMPTZ NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',       -- active | revoked | deleted
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE follows (
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id   BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

CREATE TABLE watch_events (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  video_id     BIGINT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  seconds      INTEGER NOT NULL,
  lang         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX watch_events_video_idx ON watch_events (video_id, created_at);

-- Double-entry money record. Every rupee traceable to a source and a video.
CREATE TABLE earnings_ledger (
  id           BIGSERIAL PRIMARY KEY,
  channel_id   BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  video_id     BIGINT REFERENCES videos(id) ON DELETE SET NULL,
  source       TEXT NOT NULL,                        -- ad | membership | tip | brand_deal
  amount_paise BIGINT NOT NULL,                      -- integer paise; never float
  ref          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX earnings_channel_idx ON earnings_ledger (channel_id, created_at);

CREATE TABLE payouts (
  id           BIGSERIAL PRIMARY KEY,
  channel_id   BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  amount_paise BIGINT NOT NULL,
  upi_id       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'queued',       -- queued | sent | failed
  utr          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id   BIGINT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  tier         TEXT NOT NULL,                        -- supporter | silver | gold
  price_paise  BIGINT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel_id)
);

CREATE TABLE comments (
  id           BIGSERIAL PRIMARY KEY,
  video_id     BIGINT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  text         TEXT NOT NULL,
  lang         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_video_idx ON comments (video_id, created_at);
