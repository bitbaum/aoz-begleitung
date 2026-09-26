# AOZ Begleitung

created_date: 2025-06-01
last_modified_date: 2026-09-26
last_modified_summary: Rewritten person-centred. Stale numbers removed (factor and test counts drift; they are now read from the code or CI), dimensions corrected, AI and the demo instance described, real env variables listed.

A platform for **accompanying people** in refugee accommodation and
integration work. It is organised around the two questions staff arrive with —
*who is waiting for me?* and *how is this person doing?* — and the things staff
maintain for people: places to go (work, internships, volunteering,
activities), a roof (housing and placement), and living together (conflicts,
rules, chores, events).

It is meant to sit **beside** an organisation's case-management system
(Tutoris, KLIBnet/KiSS, Citysoftnet), not replace it: the accommodation and
integration layer those systems do not cover, plus a portal residents use in
their own language.

**Try it without an account:** <https://aoz.orangecat.ch/login#demo> — pick a
role and use the real product. The invented people there are reset every night.
**Where AI is used and what it sends:** <https://aoz.orangecat.ch/ki-datenschutz>.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## What it does

**For staff**
- **Eingang** — one inbox of people waiting for an answer: Einsatzplatz
  requests, Freigaben, messages, transfer requests. The nav badge counts the
  same set.
- **Klient\*innen** — the person as the hub: dossier, care team, learning and
  work record, self-entered facts to review.
- **Einsatzplätze & Angebote** — one catalogue of jobs, internships,
  volunteering and activities. An AI assistant fills a listing from a pasted
  advert; the permit route and publishing stay human decisions.
- **Wohnen** — units, explainable compatibility matching, placements,
  transfers, maintenance.
- **Zusammenleben** — incidents on a conflict ladder with concrete agreements,
  house rules with versions and acknowledgement, chores with a fairness
  balance, events, a no-money marketplace.

**For residents** — a portal in six languages (German, English and French
reviewed by speakers; Ukrainian, Russian and Arabic complete and marked as
machine-assisted; more in progress): find and ask about a place in one tap,
report a problem and see the answer, read the house rules, keep one's own
insurance and permit dates.

## Principles, enforced in code

- **Minimum data.** No diagnoses, no asylum-procedure details, no religion,
  politics or origin. Food is a kitchen note, never a match factor;
  `no-religion-or-origin-in-matching.test.ts` holds that.
- **No verdicts about people.** Fit notes describe a household and its
  patterns, never rank a person; `no-verdicts-about-people.test.ts`.
- **Explainable, human decisions.** Every compatibility score decomposes into
  named factors; the matcher recommends, staff decide. Every placement is
  audited with the score at decision time.
- **Client facts are never an input to a decision.** Insurance, health
  contacts and permit dates are unreadable from `lib/compatibility`,
  `lib/analytics` and `lib/export` — a test fails if that changes.
- **AI is disclosed where it is used** and listed on `/ki-datenschutz`;
  `ai-disclosure.test.ts` fails if a new AI call site is not.

## Compatibility matching

The factor set, weights and rules live in `src/lib/config/resident-factors.ts`
— the SSOT the algorithm runs on and every public number is derived from
(`SCORED_FACTOR_COUNT`). Four dimensions: **Lebensstil 35 %, Soziales 25 %,
Praktisches 20 %, Anforderungen 20 %** (hard requirements block rather than
average). Cleanliness is directional (whose expectation goes unmet), and a
household scores by its worst pairing, never the average. Details and sources:
`/algorithm` in the product.

## Where it runs

One app: **aoz.orangecat.ch** (`aoz-wohnen`, database `aoz_wohnen`). The demo
lives there too — invented residents and flats beside the real ones, marked by
their codes and reset every night without touching anything real
(`src/lib/demo/scoped-reset.ts`).

Self-hosted on Hetzner (box `bitbaum`). Deploy is push to `master` → CI →
`.github/workflows/deploy.yml`. Env SSOT is `/opt/<app>/shared/.env` on the
box. Details: [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md).

## Development

```bash
pnpm install
cp .env.example .env    # local Postgres; never point it at production
pnpm db:migrate
pnpm dev                # http://localhost:3000
pnpm run verify         # format, lint, typecheck, tests — what CI runs
```

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection |
| `SESSION_SECRET` | Session signing key (a production build refuses to start without it) |
| `NEXT_PUBLIC_APP_URL` | Absolute links in emails |
| `NEXT_PUBLIC_BRAND` | Brand preset, inlined at build time (`src/lib/config/brand.ts`) |
| `DEMO_ACCESS_ENABLED` | `true` opens the no-account demo doors on `/login` |
| `GROQ_API_KEY`, `OPENROUTER_API_KEY` | AI features (test access; see `/ki-datenschutz`) |

The full list with comments is `.env.example`. Test counts are what CI
reports — they are not typed into this file, because typed numbers drift.

## License

MIT
