# Goonj — Phase 0 foundation

Backend + app skeleton for **Goonj**, an India-first hybrid creator platform.
The wedge is AI dubbing in the creator's own voice; see `docs/ARCHITECTURE.md`.

## What's here
```
backend/   Node.js (Express) API: auth, upload, feed, earnings
app/       Flutter app skeleton (Android, iOS, Web)
docs/      Architecture notes
docker-compose.yml   Postgres + Redis for local dev
```

## Run the API
```bash
cd backend
npm install
npm test          # boots the API in-process and exercises the routes
npm start         # http://localhost:4000
```

## Local database (optional in Phase 0)
```bash
docker compose up -d          # Postgres (5432) + Redis (6379)
# migrations/001_init.sql is applied automatically on first boot
```

## Key endpoints
| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /health` | Liveness | none |
| `POST /v1/auth/otp` , `/verify` | Phone login | none |
| `POST /v1/videos` | Create upload, get signed URL | creator |
| `POST /v1/videos/{id}/publish` | Finalise + transcode | creator |
| `POST /v1/videos/{id}/dubs` | Request a language dub | creator |
| `GET /v1/feed?lang=&region=` | Regional-first feed | user |
| `GET /v1/earnings` , `POST /v1/earnings/payouts` | Balance, UPI payout | creator |

## Phase 0 scope
Accounts, upload, transcode, playback, feed, watch, search. See the product
blueprint (`goonj-blueprint.pdf`) for the full four-phase plan.
