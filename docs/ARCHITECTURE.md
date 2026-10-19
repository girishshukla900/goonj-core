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

## AI dubbing pipeline (implemented in `dubbing/`)
```
ASR -> translate -> voice clone -> TTS -> align -> mix -> publish
```
1. Upload / select video
2. ASR + diarisation; detect source language
3. Translate to each target language (reviewable draft)
4. Clone voice from a consented sample
5. TTS in cloned voice, time-aligned to the original
6. Mix over the preserved music/SFX bed
7. Render per language; publish as alternate audio tracks
8. Creator approves each language before it goes live

Providers sit behind a fixed interface. Defaults are local and credential-free
(they write real WAV audio and VTT subtitles); real ASR/TTS/voice-clone
services are selected by env and must be implemented as adapters. Voice
cloning fails closed without consent.

## Money model
- Creator keeps 90%; platform keeps 10%.
- Payouts are daily and automatic, to the creator's verified UPI ID.
- `earnings_ledger` is double-entry; amounts stored as integer **paise**, never float.
- `payouts` records each UPI transfer with its UTR.

## Status by phase
- **Phase 0** — accounts, upload, transcode, playback, feed, watch, search.
  Implemented: API skeleton, schema, auth, upload/dub/feed/earnings routes.
  Stubbed: feed DB query, media storage/transcode.
- **Phase 1** — dubbing pipeline implemented with local providers; real
  providers drop in behind the interface.
- **Phase 2+** — monetisation payouts, live, clip factory, fan clubs: designed, not yet built.
