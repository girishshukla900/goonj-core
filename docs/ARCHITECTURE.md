# Goonj — Architecture

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

## AI dubbing pipeline (`dubbing/`)
```
ASR -> translate -> voice clone -> TTS -> align -> mix -> publish
```
Providers sit behind a fixed interface; defaults are local and credential-free
(they write real WAV audio and VTT subtitles). Real ASR/TTS/voice-clone
services are selected by env and implemented as adapters. Voice cloning fails
closed without consent.

## Money model (`payments/`)
- Creator keeps 90%; platform keeps 10%. Amounts are integer **paise**.
- The ledger is **double-entry**: every transaction sums to zero, so the
  journal always balances (asserted in tests).
- Payouts are daily and automatic to the creator's verified UPI ID.
- Accounts: `external_income`, `creator_payable:{channel}`, `platform_revenue`,
  `payouts_cleared`.
- The UPI transfer is simulated; wire a payments partner in `payouts.js`.

## Status by phase
- **Phase 0** — accounts, upload, transcode, playback, feed, watch, search.
  Implemented: API skeleton, schema, auth, upload/dub/feed/earnings routes.
  Stubbed: feed DB query, media storage/transcode.
- **Phase 1** — dubbing pipeline implemented with local providers.
- **Phase 2** — ledger, split and daily UPI payouts implemented; UPI transfer simulated.
- **Phase 3+** — live, clip factory, fan clubs: designed, not yet built.
