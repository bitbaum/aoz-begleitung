# AOZ Begleitung

created_date: 2025-06-01
last_modified_date: 2026-09-04
last_modified_summary: Docs truth-sweep — prerequisites now match engines/.nvmrc (Node 24, pnpm 11).

A support platform for refugee care work, built on four pillars: **housing
stability** (compatibility-based placement, conflict resolution), **capability**
(language, courses, qualifications), **participation** (volunteering, events,
activities), and **guidance** (care teams, follow-ups, resident portal).
Placement matching is the flagship capability — every score decomposes into
research-backed factors — but housing is the beginning, not the whole picture.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![Vitest](https://img.shields.io/badge/Tests-4065%20unit-green.svg)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/E2E-201%20tests-green.svg)](https://playwright.dev/)

## What It Does

**Stability** — the flagship: compatibility-based placement.
- Scores compatibility between residents across weighted dimensions (lifestyle, social, practical, hard requirements) before placement — the factor set lives in `src/lib/config/resident-factors.ts`, the SSOT the algorithm actually runs on
- Detects blocking conflicts (e.g., smoker placed with asthmatic) and flags them before they happen
- Evaluates apartment-level fit, not just pairwise — a new resident is matched against the entire existing group, and the worst pairing decides
- Runs conflicts through a resolution ladder (self-resolution → mediation → formal measures) with concrete agreements instead of free-text notes
- Audits every placement with who, what, when, why, and the compatibility score at decision time

**Daily life** — chores with a fairness balance (not a leaderboard), shared
expenses in integer Rappen, maintenance tickets routed to the right desk.

**Together** — two-tier house rules (org rules delegate room to each
household), proposals and votes with snapshotted policy, and the hard rule
that safety is never put to a vote.

**Capability & participation** — learning records (language, courses,
qualifications), jobcoach boards, volunteering and events — the integration
evidence that otherwise lives in spreadsheets.

---

## Ethical Boundaries

This section comes first because it defines what this system is and is not.

Housing placement for refugees carries real power over real lives. The algorithm must be constrained by principle, not just by code. We draw a hard line.

### What We Track (Functional Only)

- **Compatibility-relevant preferences**: sleep schedule, noise tolerance, cleanliness standards
- **Languages spoken**: for communication matching, not profiling
- **Mobility needs**: ground floor, wheelchair access -- functional requirements, not diagnoses
- **Medical equipment needs**: CPAP, dialysis -- only when it requires space or power, never the underlying condition
- **Self-reported preferences**: residents define their own needs
- **Anonymized conflict outcomes**: to improve the algorithm, never to profile individuals

### What We Never Track

- Medical diagnoses
- Asylum case details — the procedure, its stage, the decision, the grounds
- Political or religious beliefs
- Personal history beyond what the support work needs
- Any factor that could enable discrimination

> "Collect minimum data. Never track religion, politics, medical diagnoses, or asylum case details."

This is not a disclaimer. It is a design constraint enforced in code.

**One thing a client may keep about themselves.** Health insurance, the health
professionals they see, and their permit — type and expiry only. Those exist
because extending an insurance every six months otherwise meant messaging your
Betreuer\*in and waiting. What makes them consistent with the list above is a
mechanism rather than a promise: they are unreadable from `lib/compatibility`,
`lib/analytics` and `lib/export`, so no placement, score, ranking or statistic
can see them, and a test fails if that stops being true.

---

## Where it runs

Production is self-hosted on Hetzner (box `bitbaum`, app `/opt/aoz-wohnen/`,
Postgres database **`aoz_wohnen`**). Not Vercel. Not Neon. Env SSOT is
`/opt/aoz-wohnen/shared/.env` on the box. A laptop `.env` naming `neon.tech`
is stale. Details: [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md).

Resident-portal i18n (Tigrinya, Arabic, Farsi, …) does not apply to the staff
UI — that stays German.

---

## Architecture

### Config-Driven Design (2-File Changes)

All factor definitions, labels, options, thresholds, and colors live in `src/lib/config/`. Adding a new compatibility factor requires editing at most 2 files: config + Drizzle schema. Forms, scoring, display, and validation auto-generate from config.

Key config files:
- `resident-factors.ts` (550+ lines) -- 38 resident factors organized by form section (basic, lifestyle, social, practical, household, health, preferences, notes)
- `housing-factors.ts` -- 20+ housing unit factors by category
- `thresholds.ts` (150+ lines) -- all numeric boundaries, score colors, display limits, problem detection
- `apartment-thresholds.ts` -- blocking conflict definitions (cleanliness, noise, sleep schedule)
- `scoring-scales.ts` -- weight adjustments per dimension

### 4-Dimensional Compatibility Scoring

`src/lib/compatibility/scoring.ts` (676 lines)

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| Lifestyle | 35% | Sleep schedule, noise tolerance, cleanliness |
| Social | 25% | Languages, social style, privacy needs |
| Practical | 25% | Smoking, dietary needs, shared spaces, chores |
| Risk | 20% | Age gap, language barrier, smoking mismatch |

Score range: 0--100. Thresholds: Excellent (80+), Good (60-79), Moderate (40-59), Low (20-39), Critical (0-19).

### Apartment Aggregate Matching

`src/lib/compatibility/aggregate.ts` (400+ lines)

A new resident is evaluated against the entire apartment profile, not just individual pairwise scores:

- Calculates apartment averages for noise, cleanliness, chores, privacy
- Identifies dominant sleep schedule and social style
- Detects common languages across current residents
- Classifies conflicts: BLOCKING (cannot place), HIGH (needs review), MEDIUM (flag), LOW (acceptable)
- Small group bonus: +5 points for groups of 2 or fewer (easier integration)

### Lingua Franca Support

German/English speakers score 75+ even without an exact language match. In the refugee context, a common bridge language matters more than perfect overlap.

### Conflict Prediction

The system detects when conflicts are likely to emerge and estimates timeframes. A placement that looks acceptable on day one may degrade -- the algorithm surfaces this before it happens.

### Audit Trail

`src/lib/audit.ts` -- all placements logged with who, what, when, why. Compatibility scores recorded at placement time. Override reasons tracked. Non-blocking: failures are logged but never throw.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Database | PostgreSQL 17 on Hetzner (`aoz_wohnen`) + Drizzle ORM |
| Styling | Tailwind CSS (mobile-first) |
| Validation | Zod |
| Auth | JWT sessions (bcryptjs + jose) |
| Testing | Vitest (4065 unit) + Playwright (201 E2E) |
| CI/CD | GitHub Actions |

---

<details>
<summary><strong>Quick Start</strong></summary>

### Prerequisites

- Node.js 24+ (see `.nvmrc`)
- PostgreSQL 16
- pnpm 11 (pinned via `packageManager`)

### Setup

```bash
git clone <repo-url> && cd aoz-begleitung
pnpm install
cp .env.example .env          # local Postgres; production is aoz_wohnen on Hetzner — see docs/INFRASTRUCTURE.md
pnpm db:migrate
pnpm dev
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Local Postgres. Live is `aoz_wohnen` on Hetzner, not Neon. |
| `JWT_SECRET` | Session signing key |
| `NEXTAUTH_URL` | Application URL |

</details>

---

## Testing

Testing is not an afterthought. The compatibility algorithm makes placement decisions that affect people's daily lives. Every scoring path, every threshold boundary, every conflict classification is tested.

### Unit Tests: 4065 passed in 240 files (verified 2026-09-07, Vitest)

| Area | Suites | What They Cover |
|------|--------|-----------------|
| Server Actions | 9 | CRUD for residents, housing, placements, incidents, maintenance, matching, satisfaction, spots, transfers |
| API Routes | 9 | Auth, portal, cron, CSV export/import |
| Compatibility | 3 | Scoring algorithm, conversion, aggregate matching |
| Auth | 3 | JWT handling, rate limiting, role policy, route boundaries |
| Email | 2 | German content/structure, cron notifications |
| CSV | 3 | Export generation, routing, import validation |
| Analytics | 1 | Unit metrics calculation |
| UI | 2 | BedGrid component, style utilities |
| Config | 3 | Labels, formatting, factor configuration |

### E2E Tests: 201 passed (CI 2026-09-02, Playwright)

- Auth flow, resident creation, matching workflow, incident reporting
- Placement check-in, housing detail, dashboard, navigation
- Mobile responsiveness (375px, 414px, 768px, 1024px+)
- Accessibility via axe-core

### CI Pipeline

`.github/workflows/ci.yml` runs on every push:

1. **Lint + Type Check** -- ESLint + TypeScript strict mode
2. **Unit Tests** -- Vitest with coverage reporting
3. **Build** -- Next.js production build
4. **E2E Tests** -- Playwright against PostgreSQL 16 service container

---

## Project Structure

```
src/
  app/                    # Next.js App Router pages and API routes
  lib/
    config/               # Factor definitions, thresholds, scoring scales
    compatibility/        # Scoring engine, aggregate matching, conflict detection
    audit.ts              # Placement audit trail
    auth/                 # JWT sessions, role policy, rate limiting
  components/             # UI components (mobile-first)
src/lib/db/
  schema.ts               # Single source of truth for data model (drizzle/ holds its SQL migrations)
src/**/__tests__/         # 4065 unit tests, colocated with the code (Vitest)
tests/
  *.spec.ts               # 201 Playwright E2E tests
.github/
  workflows/ci.yml        # Lint, test, build, E2E pipeline
```

---

## License

MIT
