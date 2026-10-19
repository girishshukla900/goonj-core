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
app/        Flutter app skeleton (Android, iOS, Web)
test/       System test + runner
docs/       Architecture notes
docker-compose.yml   Full local stack
```

## Data
Persistence runs on **PostgreSQL**. One connection handle, two backends:
`DATABASE_URL=postgres://...` uses a real Postgres server; anything else uses
**PGlite** (Postgres compiled to WASM, in-process) — so the same SQL runs in
dev, in tests and in production. The **feed, the money ledger, live and
community** all run on it; dubbing is the one service still in memory.

```bash
cd db && npm install && npm test      # 11 assertions against real Postgres
```

## Run everything with Docker (one command)
```bash
docker compose up --build
# API :4000 · dubbing :4100 · payments :4200 · live :4300 · community :4400
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
| backend | auth, upload, dub route, feed served from the database |
| dubbing | full pipeline writes real WAV + VTT tracks |
| payments | 90/10 split, balanced double-entry ledger, payouts |
| live | simulcast, moderated chat, polls, AI Clip Factory |
| community | memberships, badges, watch parties, money into the ledger |
| system | the full creator journey across all five services |

CI (`.github/workflows/ci.yml`) runs `npm test` on every push.

## Key endpoints (API)
| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /health` | Liveness | none |
| `POST /v1/auth/otp` , `/verify` | Phone login | none |
| `POST /v1/videos` | Create upload, get signed URL | creator |
| `POST /v1/videos/{id}/dubs` | Request language dubs | creator |
| `GET /v1/feed?lang=&region=` | Regional-first feed | user |
| `GET /v1/earnings?channel_id=` | Balance + ledger | creator |
| `POST /v1/earnings/payouts` | Request a UPI payout | creator |
| `POST /v1/live/streams` | Create a live stream | creator |
| `POST /v1/live/streams/{id}/clips` | Generate shorts | creator |
| `POST /v1/community/memberships` | Join a fan club | user |

## Status
- **Phase 0** (API skeleton): implemented; the feed now reads from PostgreSQL; media storage/transcode still stubbed.
- **Phase 1** (dubbing): pipeline runs end-to-end with local providers.
- **Phase 2** (money): double-entry ledger in PostgreSQL, 90/10 split, daily UPI payouts; UPI transfer simulated.
- **Phase 3** (live): simulcast, moderated chat, polls and the AI Clip Factory, stored in PostgreSQL; RTMP fan-out modelled.
- **Phase 4** (community): memberships, superfan badges, watch parties in PostgreSQL; revenue posted to the ledger.

**Not real yet (needs credentials/infra):** ASR/TTS/voice-clone providers, the UPI transfer, and RTMP fan-out. Persistence is real for the feed, money, live and community; only dubbing keeps its state in memory. All sit behind adapters.
