# Goonj persistence (PostgreSQL)

Schema, migrations and repositories. One connection handle, two backends:

| `DATABASE_URL` | Backend |
|---|---|
| `postgres://...` | a real Postgres server (`node-postgres`) |
| anything else / unset | **PGlite** — Postgres compiled to WASM, in-process |

So the same code and the same SQL run in development, in tests, and in
production. Money is stored as integer **paise**, never float.

## Run
```bash
cd db
npm install
npm test          # 11 assertions against real Postgres (PGlite)
npm run migrate   # apply schema.sql (idempotent)
npm run seed      # insert a small demo dataset
```

## Schema
`users`, `channels`, `videos`, `video_assets`, `memberships`, and the money
tables `ledger_accounts`, `ledger_entries`, `payouts`, `channel_upi` — see
`schema.sql`.

## Repositories (`src/repo.js`)
`createUser`, `createChannel`, `insertVideo`, `publishVideo`,
`feed({lang, region})`.

The double-entry ledger lives in `src/ledger.js`: `postTransaction`,
`recordEarning`, `creatorBalance`, `requestPayout`, `dailyRun`, `registerUpi`,
`journalBalances`, `ledgerCheck`. The payments service is built on it.

`src/live_repo.js` (streams, chat, polls, clips) and `src/community_repo.js`
(tiers, memberships, watch parties, posts) back the live and community
services.

`feed` is the regional-first query: the viewer's language first, then their
region, then newest.

## Wiring a service
```js
import { feed, recordEarning } from '../db/src/repo.js';
```
The API's `/v1/feed` route already reads from here. Other services still use
in-memory stores and can adopt the same repositories.
