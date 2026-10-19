# Goonj payments service (Phase 2)

The money layer: a double-entry ledger, a 90/10 revenue split, and daily UPI
payouts. Zero dependencies (Node `node:http` only).

## Rules
- Creator keeps **90%**, platform keeps **10%**.
- All money is integer **paise** — never floats.
- Every transaction is **double-entry** and must sum to zero; the journal is
  asserted balanced in tests.
- Rounding favours the creator; `creator + platform` always equals `gross`.
- Payouts are **daily and automatic**, and can be requested any time.

## Accounts
| Account | Meaning |
|---|---|
| `external_income` | Source of all money entering the platform |
| `creator_payable:{channel}` | What the platform owes a creator |
| `platform_revenue` | The platform's 10% |
| `payouts_cleared` | Money paid out via UPI |

## Run
```bash
cd payments
npm test        # 17 assertions: split, rounding, balance, payouts, daily run
npm start       # http://localhost:4200
```

## HTTP API
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness + whether the journal balances |
| POST | `/earnings` | Record an earning and split it 90/10 |
| GET | `/balance/:channel_id` | Creator's payable balance |
| GET | `/ledger/:channel_id` | Transaction history for a channel |
| POST | `/channels/upi` | Register the creator's payout UPI ID |
| POST | `/payouts` | Pay out (defaults to full balance) |
| POST | `/payouts/run` | Daily run: pay every eligible creator |
| GET | `/payouts/:channel_id` | Payout history |
| GET | `/journal` | Full account balances + balance check |

## Not wired yet
The UPI transfer itself is simulated (a UTR is generated). Wire a payments
partner's payout API in `payouts.js` — the ledger stays unchanged.
