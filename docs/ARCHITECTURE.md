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

## Services
| Service | Phase | Responsibility |
|---|---|---|
| `backend` | 0 | Auth, upload, feed, earnings, live proxy |
| `dubbing` | 1 | ASR -> translate -> voice clone -> TTS -> align -> mix -> publish |
| `payments` | 2 | Double-entry ledger, 90/10 split, daily UPI payouts |
| `live` | 3 | Simulcast, moderated chat, polls, AI Clip Factory |

Providers sit behind fixed interfaces; defaults are local and credential-free.
Real ASR/TTS/voice-clone, a payments partner, and RTMP destinations are
selected by env and implemented as adapters. Voice cloning fails closed
without consent.

## Money model (`payments/`)
- Creator keeps 90%; platform keeps 10%. Amounts are integer **paise**.
- The ledger is double-entry: every transaction sums to zero (asserted in tests).
- Accounts: `external_income`, `creator_payable:{channel}`, `platform_revenue`, `payouts_cleared`.

## Clip Factory (`live/`)
Peaks are detected from live-chat activity (10s buckets), then cut into
non-overlapping 30s clips with titles, hooks and captions.

## Status by phase
- **Phase 0** — implemented; feed DB query and media storage/transcode stubbed.
- **Phase 1** — dubbing pipeline implemented with local providers.
- **Phase 2** — ledger, split and daily UPI payouts implemented; UPI transfer simulated.
- **Phase 3** — simulcast, chat, polls, clip factory implemented; RTMP fan-out modelled.
- **Phase 4** — fan clubs, memberships, watch parties: designed, not yet built.
