# Goonj — foundation

Five services and an app skeleton for **Goonj**, an India-first hybrid creator
platform. The wedge is AI dubbing in the creator's own voice; see
`docs/ARCHITECTURE.md`.

## What's here
```
backend/    Node.js (Express) API: auth, upload, feed, earnings, live, community
dubbing/    AI dubbing service (Phase 1): ASR -> ... -> publish
payments/   Money layer (Phase 2): ledger, 90/10 split, daily UPI payouts
live/       Live service (Phase 3): simulcast, chat, AI Clip Factory
community/  Fan clubs (Phase 4): memberships, badges, watch parties
app/        Flutter app skeleton (Android, iOS, Web)
docs/       Architecture notes
docker-compose.yml   Postgres + Redis for local dev
```

## Run everything
```bash
cd dubbing   && npm test && npm start     # :4100
cd payments  && npm test && npm start     # :4200
cd live      && npm test && npm start     # :4300
cd community && npm test && npm start     # :4400
cd backend   && npm install && npm test && npm start   # :4000
```
Point the API at the services in `backend/.env`:
```
DUBBING_URL=http://localhost:4100
PAYMENTS_URL=http://localhost:4200
LIVE_URL=http://localhost:4300
COMMUNITY_URL=http://localhost:4400
```

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
| `GET /v1/community/channels/{id}/leaderboard` | Top fans | user |

## Status
- **Phase 0** (API skeleton): implemented; feed DB query and media provider stubbed.
- **Phase 1** (dubbing): pipeline runs end-to-end with local providers.
- **Phase 2** (money): double-entry ledger, 90/10 split, daily UPI payouts; UPI transfer simulated.
- **Phase 3** (live): simulcast, moderated chat, polls, AI Clip Factory; RTMP fan-out modelled.
- **Phase 4** (community): memberships, superfan badges, watch parties, members-only posts; revenue flows into the payments ledger.

Every service has a passing test suite (backend 6, dubbing 15, payments 17, live 19, community 15 assertions — 72 total).
