# Goonj — Architecture (Phase 0)

## Layers
1. **Clients** — Flutter app (Android, iOS, Web) + creator web studio.
2. **Edge** — CDN, API gateway, auth (signed media URLs, JWT sessions).
3. **Application** — stateless services: user, catalog, feed, engagement, live, monetisation.
4. **Media pipeline** — upload, transcode (HLS, multi-bitrate), packaging, storage.
5. **AI services** — ASR, translation, voice cloning, TTS, alignment, clip detection (GPU).
6. **Data** — PostgreSQL (source of truth), Redis (cache/queues/chat), object storage, analytics.

## Playback path
client -> API gateway -> catalog -> signed CDN URL -> CDN -> player.
The player never talks to the origin.

## AI dubbing pipeline (Phase 1)
1. Upload / select video
2. ASR + diarisation; detect source language
3. Translate to each target language (reviewable draft)
4. Clone voice from a consented sample
5. TTS in cloned voice, time-aligned to the original
6. Mix over the preserved music/SFX bed
7. Render per language; publish as alternate audio tracks
8. Creator approves each language before it goes live

## Money model
- Creator keeps 90%; platform keeps 10%.
- Payouts are daily and automatic, to the creator's verified UPI ID.
- `earnings_ledger` is double-entry; amounts stored as integer **paise**, never float.
- `payouts` records each UPI transfer with its UTR.

## What Phase 0 (this repo) does not yet include
- Real SMS/OTP delivery (in-memory store only)
- Real media storage/transcode (signed-URL stub returned)
- Database queries in the feed (stub returns an empty list)
- Payments and AI providers (interfaces stubbed, credentials via env)
