# Implementation Summary — superseded

created_date: 2026-01-24
last_modified_date: 2026-09-25
last_modified_summary: Reduced to a pointer; a point-in-time snapshot of the product goes stale the day after it is taken.

This file no longer describes the product. Current sources:

| Question | Where the answer lives |
|---|---|
| What shipped, and when | [CHANGELOG.md](CHANGELOG.md) (also the public `/changelog`) |
| What the product is and does | [README.md](README.md) |
| Where it runs | [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) |
| Where it is going | [docs/ROADMAP.md](docs/ROADMAP.md) (also the public `/roadmap`) |
| How to work in this repo | [CLAUDE.md](CLAUDE.md) |

Setting up a real apartment: see `scripts/db/seed-real.ts`; the apartment data
lives outside the documentation.

The live instance holds REAL client data. Never treat it as demo data.
