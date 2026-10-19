# Goonj — foundation

Five services and an app skeleton for **Goonj**, an India-first hybrid creator
platform. The wedge is AI dubbing in the creator's own voice; see
`docs/ARCHITECTURE.md` and `goonj-blueprint.pdf`.

## What's here
```
db/         Persistence: PostgreSQL schema, migrations, repositories
backend/    Node.js (Express) API: auth, upload, feed, earnings, live, community
dubbing/    AI dubbing service (Phase 1): ASR -> ... -> publish
payments/   Money layer (Phase 2): ledger, 90/10 split, daily UPI payouts
live/       Live service (Phase 3): simulcast, chat, AI Clip Factory
community/  Fan clubs (Phase 4): memberships, badges, watch parties
web/        Web client app (talks to the real API)
app/        Flutter app skeleton (Android, iOS, Web)
test/       System test + runner
docs/       Architecture notes
docker-compose.yml   Full local stack
```

## Data
Persistence runs on **PostgreSQL**. One connection handle, two backends:
`DATABASE_URL=postgres://...` uses a real Postgres server; anything else uses
**PGlite** (Postgres compiled to WASM, in-process) — so the same SQL runs in
dev, in tests and in production. **All five services run on it** — feed, money,
live, community and dubbing.

```bash
cd db && npm install && npm test      # 11 assertions against real Postgres
```

## Run the web client
```bash
cd web && npm install && node dev-server.js 4500
# open http://localhost:4500/
```

## Run everything with Docker (one command)
```bash
docker compose up --build
# API :4000 · dubbing :4100 · payments :4200 · live :4300 · community :4400
# web client: cd web && npm install && node dev-server.js 4500
```

## Run everything by hand
```bash
cd dubbing   && npm start     # :4100
cd payments  && npm start     # :4200
cd live      && npm start     # :4300
cd community && npm start     # :4400
cd backend   && npm install && npm start   # :4000
```
Point the API at the services in `backend/.env` (see `backend/.env.example`).

## Tests
```bash
npm test          # runs all six suites (root)
```
| Suite | What it proves |
|---|---|
| db | schema, regional-first feed query, ledger, payouts (real Postgres) |
| auth | hashed, expiring, single-use, attempt- and rate-limited OTP |
| export | a creator's whole body of work comes back in one bundle |
| backend | auth, upload, dub route, feed served from the database |
| media | upload to storage, signed playback URLs, HTTP Range, token expiry |
| dubbing | full pipeline writes real WAV + VTT tracks |
| payments | 90/10 split, balanced double-entry ledger, payouts |
| live | simulcast, moderated chat, polls, AI Clip Factory |
| community | memberships, badges, watch parties, money into the ledger |
| system | the full creator journey across all five services |
| web | drives the full user journey in a real browser (sign in, studio payout, club, live + clips, dub) |

CI (`.github/workflows/ci.yml`) runs `npm test` on every push.

## Key endpoints (API)
| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /health` | Liveness | none |
| `POST /v1/auth/otp` , `/verify` | Phone login | none |
| `POST /v1/videos` | Reserve an upload, get the upload URL | creator |
| `POST /v1/videos/{id}/media` | Upload the media bytes (stored, then published) | creator |
| `GET /media/{assetId}?exp=&sig=` | Stream an asset (Range-capable, signed) | signed URL |
| `GET /v1/videos/{id}` | Video details + signed playback URLs | none |
| `POST /v1/videos/{id}/dubs` | Request language dubs | creator |
| `GET /v1/feed?lang=&region=` | Regional-first feed | user |
| `GET /v1/earnings?channel_id=` | Balance + ledger | creator |
| `POST /v1/earnings/payouts` | Request a UPI payout | creator |
| `POST /v1/live/streams` | Create a live stream | creator |
| `POST /v1/live/streams/{id}/chat` | Live chat (moderated) | user |
| `POST /v1/live/streams/{id}/clips` | Generate shorts | creator |
| `POST /v1/community/memberships` | Join a fan club | user |
| `GET /v1/export?channel_id=` | Export everything a creator owns | creator |

## Status
- **Phase 0** (API skeleton): implemented; the feed reads from PostgreSQL; login is a hardened OTP flow (hashed codes, 5-minute expiry, attempt lockout, per-phone rate limiting). Uploads are real — bytes go through a storage adapter (local disk by default) and play back over signed, expiring, Range-capable URLs. Transcoding is still stubbed.
- **Phase 1** (dubbing): pipeline runs end-to-end with local providers; job and track state in PostgreSQL.
- **Phase 2** (money): double-entry ledger in PostgreSQL, 90/10 split, daily UPI payouts; UPI transfer simulated.
- **Phase 3** (live): simulcast, moderated chat, polls and the AI Clip Factory, stored in PostgreSQL; RTMP fan-out modelled.
- **Phase 4** (community): memberships, superfan badges, watch parties in PostgreSQL; revenue posted to the ledger.
- **Ownership**: a creator can export everything they own (videos, tracks, ledger, payouts, members, streams) as one JSON bundle — the "no lock-in" promise, implemented.

**Not real yet (needs credentials/infra):** SMS delivery for the OTP, ASR/TTS/voice-clone providers, the UPI transfer, RTMP fan-out, media transcoding (HLS + bitrates), and S3/R2 object storage — the `s3` storage adapter is declared but not implemented, so `MEDIA_PROVIDER=s3` fails closed. Persistence and local media storage are real. All sit behind adapters.
