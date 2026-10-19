# Goonj — foundation

Backend, dubbing and payments services, and an app skeleton for **Goonj**, an
India-first hybrid creator platform. The wedge is AI dubbing in the creator's
own voice; see `docs/ARCHITECTURE.md`.

## What's here
```
backend/    Node.js (Express) API: auth, upload, feed, earnings
dubbing/    AI dubbing service (Phase 1): ASR -> ... -> publish
payments/   Money layer (Phase 2): ledger, 90/10 split, daily UPI payouts
app/        Flutter app skeleton (Android, iOS, Web)
docs/       Architecture notes
docker-compose.yml   Postgres + Redis for local dev
```

## Run everything
```bash
# 1. dubbing service
cd dubbing && npm test && npm start        # :4100

# 2. payments service
cd payments && npm test && npm start       # :4200

# 3. API
cd backend && npm install && npm test && npm start   # :4000
```
Point the API at the services in `backend/.env`:
```
DUBBING_URL=http://localhost:4100
PAYMENTS_URL=http://localhost:4200
```

## Key endpoints (API)
| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /health` | Liveness | none |
| `POST /v1/auth/otp` , `/verify` | Phone login | none |
| `POST /v1/videos` | Create upload, get signed URL | creator |
| `POST /v1/videos/{id}/publish` | Finalise + transcode | creator |
| `POST /v1/videos/{id}/dubs` | Request language dubs (proxies dubbing service) | creator |
| `GET /v1/feed?lang=&region=` | Regional-first feed | user |
| `GET /v1/earnings?channel_id=` | Balance + ledger (proxies payments service) | creator |
| `POST /v1/earnings/payouts` | Request a UPI payout | creator |

## Status
- **Phase 0** (API skeleton): accounts, upload, feed, earnings — implemented; feed DB query and media provider still stubbed.
- **Phase 1** (dubbing): pipeline runs end-to-end with local providers; real ASR/TTS/voice-clone drop in behind the provider interface.
- **Phase 2** (money): double-entry ledger, 90/10 split, daily UPI payouts — implemented; the UPI transfer itself is simulated.
