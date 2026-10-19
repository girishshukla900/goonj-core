# Goonj community service (Phase 4)

Fan clubs: memberships, tiers, superfan badges, watch parties and members-only
posts. Zero dependencies (Node `node:http`).

## Tiers
Defaults per channel (creators can override):
| Tier | Price | Highlights |
|---|---|---|
| Supporter | Rs. 49/mo | Badge, members-only posts |
| Silver | Rs. 149/mo | Weekly watch parties, ad-free |
| Gold | Rs. 499/mo | Monthly 1:1 call, name in credits |

## Superfan badges
Computed from **tenure + tier** — tenure is what makes a superfan:
| Badge | Rule |
|---|---|
| New | just joined |
| Regular | 2+ months, or Silver |
| Superfan | 6+ months, or Gold |
| Legend | Gold for 6+ months |

## Money flow
Joining a tier posts the revenue to the **payments** service, which splits it
90/10 and adds it to the creator's ledger. Set `PAYMENTS_URL` to enable it; the
membership still succeeds if payments is unreachable (`revenue_posted: false`).

## Run
```bash
cd community
npm test        # 15 assertions, including the cross-service money flow
npm start       # http://localhost:4400
```

## HTTP API
| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| GET/POST | `/channels/:id/tiers` | Read / set tiers |
| POST | `/memberships` , `/memberships/cancel` | Join / cancel |
| GET | `/users/:id/memberships` | A user's memberships |
| GET | `/channels/:id/members` | Active members with badges |
| GET | `/channels/:id/leaderboard` | Top fans |
| GET/POST | `/channels/:id/posts` , `/posts` | Members-only posts |
| POST | `/parties` , `/parties/:id/rsvp` | Watch parties |
