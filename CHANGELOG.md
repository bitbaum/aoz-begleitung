# Changelog

All notable changes to this project are documented here, newest first.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the
project does not tag semver releases yet — entries are grouped by deploy date
(the product deploys continuously from `master`).

Related documents: [Roadmap](docs/ROADMAP.md) · [Blog](docs/blog/README.md)

created_date: 2026-01-15
last_modified_date: 2026-09-07
last_modified_summary: Three weeks the log had missed — client-managed admin facts, a readable audit trail, placements and rankings that explain themselves.

## 2026-09-07 — The client's own record, and decisions that explain themselves

Three weeks in which the product stopped being only about who lives where.

### Added
- **A client keeps their own admin facts** (`/portal/unterlagen`): health
  insurance with its renewal date, the health professionals they see, and their
  residence permit — type and expiry only, never case details. Betreuung checks
  them in a queue at `/approvals`. Extending an insurance every six months used
  to mean writing to your Betreuerin and waiting; the facts lived in her inbox
  rather than in the profile of the person they belong to (#212).
  - **"Geprüft" means seen, not true.** Nobody here can ring the insurer, and
    the copy never implies otherwise. Editing a checked entry un-checks it.
  - **Visibility is per fact, not per person.** A Jobcoach sees the permit —
    which work is lawful is their job — and never the insurance or the doctors.
  - **These facts reach no decision.** Unreadable from `lib/compatibility`,
    `lib/analytics` and `lib/export`, enforced by a test rather than a promise.
- **Renewals say so before they lapse** (#213): 60 days out, on the staff
  dashboard, in the approval queue, and on the client's own page. In-app rather
  than by email, because staff notifications had no configured recipient.
- **The audit trail became readable** (#211, #214). 120 sites wrote to it and
  nothing read it — including the record of one staff member opening another's
  view, whose reviewability *is* the safeguard for that feature. `/audit` for
  the system-wide view, plus a per-record "Änderungsverlauf" on a client and on
  a flat.
- **Einsatzplätze work end to end** (#181, #183): a coach publishes, a client
  applies, and the board carries the first real vacancy. Listing prose is
  machine-translated into the offered portal languages, while the permit
  sentence never is (#184).
- **AI form assist for a listing** — paste an advert, correct it. Permit route
  and publication are excluded on purpose: a model must not assert an
  authorisation route (#187).
- **LIEGENSCHAFTEN**, a fourth staff role: running the buildings is not a care
  domain (#196, #197).

### Changed
- **Placements and matches explain themselves.** The reasoning composed for
  every placement was stored and never shown (#208); the ranking of the match
  list is not the score printed on the card, and now says so (#209).
- **Each board opens on the viewer's own half**, and the message inbox is
  gated — both message surfaces had no permission check at all (#191, #192).
- **The dashboard names who has been waiting** for an answer, which review
  dates have slipped, and whether an interpreter can still be arranged
  (#205, #207).
- **A client's team may only name people who could do that job** (#206).
- **The person is a Klient\*in**; "Bewohner" is reserved for who lives in a
  flat (#200).

### Fixed
- **Nobody could create a client.** The intake form never asked for
  `socialStyle`, which the schema required — every submission failed and took
  the form with it (#199).
- **Ids stopped matching their own validator** at the Drizzle move: `.cuid()`
  accepted 70 of 2000 generated ids, so most rows could not be edited (#186).
- **A work-permit refusal reached nobody** and destroyed the form it refused
  (#183).
- **The compatibility engine had a finding and withheld it** — a demanding,
  low-tolerance client was flagged internally and never mentioned to whoever
  was placing them (#210).
- A CLOSED building advertised free beds (#180); the placement page crossed the
  demo boundary (#178); "Aktiv" meant two different things eight lines apart
  (#175); an intake placeholder produced clients who could never sign in (#177).

### Infrastructure
- One package manager for the fleet: pnpm (#179). `@bitbaum/ai-kit` and the AI
  form package come from npm, leaving no git dependencies (#176, #188). Mail
  goes through `@bitbaum/mail-kit` (#195).
- `verify` and CI were running different bundles; a test now pins that CI runs
  every check `verify` names (#189, #190).

## 2026-08-19 — Launch hardening, portal chrome, role split

Previously filed under "Unreleased" while every item below was already live —
a public changelog saying "not yet released" about shipped behaviour is worse
than saying nothing.

### Changed
- **Workflow feedback for launch.** Portal layout shows URL-driven success/error toasts (e.g. missing account, chore created). Activity category filters and staff integration board show empty states with a clear reset. Transfer request list links back to open requests when a status tab is empty.
- **Staff admin URL feedback.** Layout-wide toasts after placements, check-ins, incidents, and spot changes — pathname-scoped so `?created=true` means the right message on the right page. Resident learning page confirms saved evidence and offers empty states with next steps.
- **Fleet AI provider for all surfaces.** Staff chat and form assist now use Groq → OpenRouter (OpenAI-compatible API). Anthropic removed. Same keys as other OrangeCat apps on the box.
- **Resident portal i18n (expenses, profile, transfer, preferences).** 181 new dictionary keys; `buildExpenseLabels`, `buildProfileLabels`, `buildTransferLabels`, `buildPreferencesLabels` and related helpers in `lib/i18n/portal-surfaces.ts`. Remaining portal pages and dashboard cards no longer read `PORTAL_LABELS` for resident copy.
- **Public positioning now matches the expanded product.** The public narrative no longer treats the software as only a placement or housing tool. It is framed through four operational pillars: Stability, Capability, Participation and Guidance.
- **Infrastructure SSOT.** Production is Postgres on Hetzner (`aoz_wohnen` on bitbaum). Docs, `.env.example` and `src/lib/db.ts` describe that host. A leftover laptop `.env` pointing at Neon is not the database. i18n dictionaries stay on the resident portal; staff UI stays German.
- **Resident portal chrome.** Header keeps brand, a compact language select, and an account dropdown (Profil, Einstellungen, Hilfe, Abmelden). Destinations moved into a **collapsible left sidebar** on desktop and the same accordion in the mobile Mehr sheet. Wohnung and Mitbewohner pages are gone from the menu — they had no profiles behind the names; old bookmarks redirect to Übersicht.
- **AOZ and WG are different surfaces of the same product.** On AOZ/AOZH the portal pins Übersicht, Melden, Regeln, Hilfe — not chores/expenses/votes. Login opens on the code first; email stays the other door. Matching opens in compact Top-3 mode.
- **Staff roles are no longer one ADMIN blob.** Betreuung, Sozialarbeit, Jobcoach and Freiwilligenarbeit each have a permission set; `ADMIN` survives only so existing rows and live JWTs resolve, and cannot be assigned to anyone new. What it used to grant now lives on two separate axes — `scope` (whose files may I open) and `isSystemAdmin` (may I reconfigure the product). Nav, invites, export/import and the algorithm page follow it. Existing JWTs keep working. (Liegenschaften joined later — see 2026-09-07.)
- **Complete languages are offered before a native speaker vouches.** A locale reaches the picker once every string is translated — Arabic, Ukrainian and Russian cleared that bar alongside German, English and French. Farsi, Tigrinya, Turkish, Albanian and Somali are in the repo and stay hidden until finished. Help, report and rules chrome are translated; the signed Hausordnung body stays German.
- **The org rule catalog now IS the signed AOZ Hausordnung.** The in-app
  AOZ tier of the rule book was rewritten against the official two-page
  Hausordnung every resident signs on paper (Stand Januar 2026). Materially
  corrected rules: visiting hours are 08:00–22:00 with **no overnight
  guests** (previously "with permission"), pets are **not permitted**
  (previously "with permission"), quiet hours now include the midday rest
  12:00–13:00 and Sundays/holidays. Amended rules bump their version, so
  every resident is asked to re-acknowledge exactly the wording that
  changed — nobody stays bound to text they never saw.
- **Real contact channels replace invented ones.** The portal help page and
  every "contact us" fallback now carry the channels from the signed
  document — Bewirtschaftung 044 415 67 31 / bewirtschaftung@aoz.ch
  (office hours 09:00–11:00, 14:00–16:00) and the out-of-hours emergency
  number 044 415 63 30 — sourced from a single new config
  (`src/lib/config/organization.ts`) instead of numbers hardcoded in labels.

### Added
- **Public roadmap and changelog routes.** Blog already existed; roadmap and changelog are now first-class public pages too, so product direction and shipped changes are readable from the site itself.
- **Integration research framework.** `docs/INTEGRATION-RESEARCH-FRAMEWORK.md` defines the broader scientific basis beyond housing alone: stability, capability, participation and guidance.
- **New blog post on the four-pillar model.** The public blog now explains why the product expanded beyond pure housing operations.
- New AOZ rules covering the previously missing Hausordnung sections: keys
  and entrance doors, unattended cooking, waste & recycling (Züri-Säcke,
  ERZ), daily airing, care of property & repairs, staff access &
  appointments, reachability & absence.
- "Sanktionen und Konsequenzen" section on the portal rule book — the
  enforcement ladder (warning → termination) is shown with the rules it
  enforces.
- Catalog guard test pinning the Hausordnung coverage and the
  non-negotiable rules (`src/lib/config/__tests__/house-rules.test.ts`).
- This changelog, the [roadmap](docs/ROADMAP.md) and the
  [engineering blog](docs/blog/README.md).
- **Learning records** on the resident profile — language tests, courses, informal learning, qualifications. Residents can add their own; Sozialarbeit and Jobcoach see a queue (`/learning`) and missing Deutsch tests.
- **Room-level matching.** Placement scores the Zimmer, not only the Wohnung average, and the fast-place action uses that bed.
- **Short intake** as the default: sleep, noise, directional cleanliness, smoking, languages, mobility first; the rest behind "Weitere Angaben".
- **Gebäudecode** on housing units — enough to group a Standort without a Building CRUD.
- **Pilot evidence** on the staff dashboard: baseline vs now for the mission KPIs.
- **Care team** on the resident file and in the portal: Wohnen/Betreuung, Sozialarbeit, Jobcoach — one named person per seat.
- **Care workspace** on the resident file: appointments (Zurich wall-clock) and catalog-driven work attributes per domain. Adding a field is a line in `CARE_ATTRIBUTE_CATALOG`, not a migration. Residents see team + upcoming appointments.
- **Learning achievements** in the portal: completed tests, courses, qualifications, volunteering and community-service hours, plus language activity offers next to existing Aktivitäten.

## 2026-08-13 — Real deployment + full-product demo

- The live instance switched to REAL mode: one actual shared flat
  (the pilot flat) under the `wg` brand, with the demo doors kept
  alongside via prefix-scoped daily reset (#37–#39, #43–#44).
- Reports route to the desk that can act on them: maintenance reports land
  on the maintenance board, conflicts on the incident ladder — residents
  still see one merged list (#43).
- One account, two roles: email+password credentials live on `Account`,
  optionally linked to both a staff and a resident identity (#40, #42).
- Admin megamenu navigation (#41).

## 2026-07 — Governance, expenses, identity

- Two-tier house rules (org floor + house rules), house decisions with
  quorum/threshold snapshots, and the conflict-resolution ladder (#19,
  #21, #24).
- Brand becomes config: `aoz` / `aozh` / `wg` presets, AOZ palette
  preserved byte-for-byte; flat/technical design language re-skin (#22,
  #30, #38).
- Shared expenses (integer Rappen, full-history balances, debt
  simplification), resident self-profiles with photos, apartment profiles
  (#35, #36).
- AI-assisted intake: fill the resident form from prose (#29, #31).
- CI: green PRs merge and deploy themselves; merge queue drains
  oldest-first (#18, #20, #25, #28).

## 2026-06 — Self-hosting and hardening

- Migrated off Vercel/Neon/Supabase to a self-hosted Hetzner box
  (2026-06-12); deploy on push to `master` (#15).
- Security, accessibility, DB performance and i18n hardening across four
  audit sweeps; env validation, `/api/health`, Sentry tagging, JWT schema
  validation.
- E2E gate made real and green (#14, #26).

## 2026-05-28 — Initial build

- Compatibility-based placement: config-driven resident/housing factors,
  directional cleanliness model, weighted scoring with blocking conflicts.
- Staff admin (residents, housing, placements, incidents, matching,
  maintenance) and resident portal (preferences, roommates, chores,
  reports, transfers).
- Jest + Playwright suites, mobile-first design system, German (Swiss) UI.
