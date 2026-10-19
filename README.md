# Goonj — foundation

Backend, dubbing service and app skeleton for **Goonj**, an India-first hybrid
creator platform. The wedge is AI dubbing in the creator's own voice; see
`docs/ARCHITECTURE.md`.

## What's here
```
backend/   Node.js (Express) API: auth, upload, feed, earnings
dubbing/   AI dubbing service (Phase 1): ASR -> ... -> publish
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

## Run the dubbing service
```bash
cd dubbing
npm test          # dubs one video into 3 languages; 15 assertions
npm start         # http://localhost:4100
```
Point the API at it with `DUBBING_URL=http://localhost:4100` in `backend/.env`.

## Local database (optional)
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
| `POST /v1/videos/{id}/dubs` | Request language dubs (proxies to the dubbing service) | creator |
| `GET /v1/feed?lang=&region=` | Regional-first feed | user |
| `GET /v1/earnings` , `POST /v1/earnings/payouts` | Balance, UPI payout | creator |

## Status
- **Phase 0** (backend skeleton): accounts, upload, feed, earnings — implemented; feed DB query and media provider still stubbed.
- **Phase 1** (dubbing): pipeline runs end-to-end with local providers; real ASR/TTS/voice-clone drop in behind the provider interface.
