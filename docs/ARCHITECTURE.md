# Goonj — Architecture

## Layers
1. **Clients** — Flutter app (Android, iOS, Web) + creator web studio.
2. **Edge** — CDN, API gateway, auth (signed media URLs, JWT sessions).
3. **Application** — stateless services: user, catalog, feed, engagement, live, monetisation, community.
4. **Media pipeline** — upload, transcode (HLS, multi-bitrate), packaging, storage.
5. **AI services** — ASR, translation, voice cloning, TTS, alignment, clip detection (GPU).
6. **Data** — PostgreSQL (source of truth), Redis (cache/queues/chat), object storage, analytics.

## Playback path
client -> API gateway -> catalog -> signed CDN URL -> CDN -> player.
The player never talks to the origin.

## Data layer (`db/`)
PostgreSQL via one connection handle: a real server when `DATABASE_URL` is a
`postgres://` URL, otherwise **PGlite** (Postgres in WASM) so the same SQL runs
in dev, tests and production. Repositories in `db/src/repo.js`; the API's feed
route reads from here. Live and community are also backed by it; dubbing is
the only in-memory service. Amounts are integer paise.

## Services
| Service | Phase | Responsibility |
|---|---|---|
| `db` | 0 | Schema, migrations, repositories (PostgreSQL / PGlite) |
| `backend` | 0 | Auth, upload, feed (from Postgres), earnings, live + community proxy |
| `dubbing` | 1 | ASR -> translate -> voice clone -> TTS -> align -> mix -> publish |
| `payments` | 2 | Double-entry ledger, 90/10 split, daily UPI payouts |
| `live` | 3 | Simulcast, moderated chat, polls, AI Clip Factory (Postgres) |
| `community` | 4 | Fan clubs, memberships, superfan badges, watch parties (Postgres) |

Providers sit behind fixed interfaces; defaults are local and credential-free.
Real ASR/TTS/voice-clone, a payments partner, and RTMP destinations are
selected by env and implemented as adapters. Voice cloning fails closed
without consent.

## Money model (`payments/` on `db/src/ledger.js`)
- Creator keeps 90%; platform keeps 10%. Amounts are integer **paise**.
- The ledger is **double-entry in PostgreSQL**: every transaction sums to zero,
  so the journal always balances (asserted in tests). A creator's balance is
  simply the sum of their `creator_payable:{channel}` account.
- Accounts: `external_income`, `creator_payable:{channel}`, `platform_revenue`, `payouts_cleared`.
- Tables: `ledger_accounts`, `ledger_entries`, `payouts`, `channel_upi`.
- Membership revenue from `community/` flows into the same ledger.

## Clip Factory (`live/`)
Peaks are detected from live-chat activity (10s buckets), then cut into
non-overlapping 30s clips with titles, hooks and captions.

## Status by phase
- **Phase 0** — implemented; the feed reads from PostgreSQL; media storage/transcode stubbed.
- **Phase 1** — dubbing pipeline implemented with local providers.
- **Phase 2** — double-entry ledger in PostgreSQL, split and daily UPI payouts; UPI transfer simulated.
- **Phase 3** — simulcast, chat, polls and clip factory implemented in PostgreSQL; RTMP fan-out modelled.
- **Phase 4** — memberships, badges and watch parties implemented in PostgreSQL; revenue posted to the ledger.

The four-phase plan in `goonj-blueprint.pdf` is now covered by working, tested code.
