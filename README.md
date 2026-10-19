# Goonj — foundation

Five services and an app skeleton for **Goonj**, an India-first hybrid creator
platform. The wedge is AI dubbing in the creator's own voice; see
`docs/ARCHITECTURE.md` and `goonj-blueprint.pdf`.

## What's here
```
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
| backend | auth, upload, feed, dub + payout routes |
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
- **Phase 0** (API skeleton): implemented; feed DB query and media provider stubbed.
- **Phase 1** (dubbing): pipeline runs end-to-end with local providers.
- **Phase 2** (money): double-entry ledger, 90/10 split, daily UPI payouts; UPI transfer simulated.
- **Phase 3** (live): simulcast, moderated chat, polls, AI Clip Factory; RTMP fan-out modelled.
- **Phase 4** (community): memberships, superfan badges, watch parties; revenue posted to the ledger.

**Not real yet (needs credentials/infra):** ASR/TTS/voice-clone providers, the UPI transfer, RTMP fan-out, and Postgres/Redis persistence (services are in-memory). All sit behind adapters.
