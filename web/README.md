# Goonj web client

A working client app that talks to the real API — no build step, no framework.
Open it against a running API:

```bash
# 1. start the backend (and its services) — see the root README
# 2. serve this folder
node dev-server.js 4500
# 3. open http://localhost:4500/
```

The API base URL can also be set once and remembered (stored in localStorage).

## Screens
- **For You** — the regional-first feed, from `GET /v1/feed`
- **Watch** — tap a card; request an AI dub in any language (`POST /v1/videos/{id}/dubs`)
- **Live** — create a stream, chat live, and run the AI Clip Factory (`POST /v1/live/streams`, `.../chat`, `.../clips`)
- **Studio** — balance and UPI payout, live from the ledger (`GET /v1/earnings`, `POST .../payouts`), plus **Export my data** (`GET /v1/export/summary`)
- **Clubs** — join a tier and see the fan leaderboard (`POST /v1/community/memberships`)

"Sign in" runs the phone-OTP flow against the API (dev OTP).

## Test
```bash
npm install        # installs ws (test-only)
npm test           # drives the client in headless Chromium against a live API
```
The test boots the whole stack, seeds the database, then drives this page in a
real browser over the DevTools Protocol through the **full user journey** — feed
loads, sign in, Studio payout, joining a club, going live, posting chat,
generating clips, and requesting a dub — asserting what the UI actually
renders. It skips cleanly if no Chromium/Chrome is installed.
