# AOZ Begleitung

created_date: 2025-06-01
last_modified_date: 2026-09-04
last_modified_summary: Two repo-wide rules from posting the first real listing — a server action must RETURN what the user has to act on (a throw reaches the error boundary and destroys the form), and ids use idSchema rather than a shape assertion that the cuid2 migration invalidated for 96% of rows.

@~/.claude/CLAUDE.md

---

## Where this runs (read before touching the database)

The live product is **https://aoz.orangecat.ch** on the Hetzner box
**bitbaum** (`root@167.233.22.31`). App: `/opt/aoz-wohnen/`. Unit:
`aoz-wohnen-app.service`. Database: **PostgreSQL on that box**,
`127.0.0.1:5432`, name **`aoz_wohnen`**. Credentials SSOT:
`/opt/aoz-wohnen/shared/.env` on the box.

Neon, Vercel and hosted Supabase were decommissioned on 2026-06-12. A laptop
`.env` that still names `neon.tech` is leftover garbage. The db client will
load it and time out; that is not "production is down". Do not restore those URLs.
Do not treat gitignored env files as SSOT. This laptop's Postgres is not
`aoz_wohnen`.

Uncommitted work, and any branch that is not `master`, is not what residents
see. Deploy is push to `master` → `.github/workflows/deploy.yml` (waits for
CI, applies pending `drizzle/*.sql` via loki's apply-schema.sh, build,
rsync). Manual:
`gh workflow run deploy.yml -R bitbaum/aoz-begleitung`.

Full table: `docs/INFRASTRUCTURE.md`.

### Languages

`src/lib/i18n/` is the **resident portal**. Staff UI (`(admin)`, megamenu,
matching) stays German. Admins speak Swiss state languages plus English;
Tigrinya, Arabic, Farsi and the other origin languages stay off the staff
side. `LanguageSwitcher` / `LocaleProvider` live only under `src/app/portal/`.

---

## Why This Matters for AOZ

### The Problem AOZ Faces Today

AOZ staff place asylum seekers into shared housing based on **gut feeling and availability**. This leads to:

- **Frequent conflicts** between incompatible roommates (noise, cleanliness, lifestyle clashes)
- **Staff time wasted** mediating disputes and relocating residents
- **Resident stress** from living with incompatible people during an already difficult time
- **High turnover** in problematic units, creating instability

### What This System Does

**Compatibility-based matching** - Instead of random placement, the system:

1. **Captures preferences** - Sleep schedule, noise tolerance, cleanliness level, social style
2. **Calculates compatibility** - Scores how well a new resident fits with existing roommates
3. **Recommends placements** - Shows best matches first, flags potential conflicts
4. **Tracks outcomes** - Records incidents to improve future recommendations

### Measuring Success - What AOZ Should Track

**Before pilot (baseline - 1 month):**
| Metric | How to Measure | Example |
|--------|----------------|---------|
| Incidents per month | Count all roommate conflicts reported | 15 incidents |
| Relocations due to conflict | Count moves caused by incompatibility | 4 relocations |
| Staff hours on mediation | Log time spent resolving disputes | 12 hours/week |
| Time to place new resident | Average days from arrival to placement | 2 days |

**After pilot (3 months with system):**
| Metric | Target | Proves Value If... |
|--------|--------|---------------------|
| Incidents per month | -30% | 15 → 10 incidents |
| Relocations due to conflict | -50% | 4 → 2 relocations |
| Staff hours on mediation | -40% | 12 → 7 hours/week |
| Placement decision time | Same or faster | No slower than before |

⚠️ **Those four are HOUSING KPIs, and for a long time they were the only ones.**
Implemented in `lib/analytics/mission-kpis.ts`, rendered by `MissionKPISection`
— and a Jobcoach or a Freiwilligenarbeit coordinator could open `/analytics`
and find nothing on it about their work, while labour-market integration is
half of what AOZ is measured on by its funder.

`lib/analytics/role-kpis.ts` now carries the other domains, as LEADING
indicators anchored to the Integrationsagenda Schweiz Wirkungsziele (which
themselves resolve at five and seven years and cannot be steered on):

| Domain | Indicators |
|---|---|
| Jobcoach | contact rate · median days to first contact · course-without-work (IAB lock-in) · German level recorded |
| Freiwilligenarbeit | active engagement rate · event participation |
| Sozialarbeit | **none yet** — a visible gap, pinned by a test rather than left to be noticed |

Two rules these follow, and both are load-bearing:

- **Shares of a caseload, never counts.** A count rewards holding more clients;
  a share asks whether the people you hold are moving.
- **An empty caseload reports `null`, never `0`.** Zero says "nobody is
  progressing"; null says "nobody is assigned". They look identical on a tile
  and mean opposite things about whose problem it is.

⚠️ **And no KPI is trustworthy until the demo world is excluded.** The pilot
numbers were computed over demo AND real rows: measured 2026-09-03, seven of
eight interpersonal incidents in 180 days belonged to `DEMO-U12`/`DEMO-U09`,
re-seeded nightly at 04:05, and the page reported "67% mehr Konflikte ·
Verschlechterung" off them. `lib/analytics/real-data.ts` excludes demo rows by
the same CODE PREFIX the scoped reset deletes by, so a row the reset can clean
is exactly a row the KPIs ignore. Any new metric must pass through it.

**Cost of NOT solving this:**
- 1 relocation = ~2 staff hours (packing, transport, paperwork) = CHF 100+
- 1 conflict mediation = ~1 staff hour = CHF 50+
- 4 relocations + 15 incidents/month = **CHF 1,150/month minimum**
- Plus: resident stress, staff burnout, reputation risk

**ROI calculation:**
If system reduces incidents by 30% and relocations by 50%:
- Savings: ~CHF 400-500/month per housing location
- Staff can focus on support instead of firefighting

### Pilot Proposal for AOZ

**Phase 1 (1 month):** Baseline measurement
- Track incidents, relocations, staff time manually
- No system changes yet

**Phase 2 (3 months):** Pilot at 1-2 locations
- Use system for all new placements
- Continue tracking same metrics
- Compare to baseline

**Phase 3:** Decision
- If metrics improve → roll out to more locations
- If no improvement → analyze why, adjust algorithm

### Example Workflow

**Before**: Staff member has a new resident. Checks which beds are free. Places them wherever.

**After**: Staff member enters resident preferences. System shows "Unit A: 85% compatible (similar sleep schedule, shared language)" vs "Unit B: 40% compatible (smoker with non-smokers, conflicting schedules)". Staff makes informed decision.

---

## First Principles

This system serves **vulnerable populations** (asylum seekers). Every decision must prioritize:

1. **Human Dignity** - People are not data points. Track only what the support work needs.
2. **Harm Reduction** - Reduce conflicts, don't optimize for efficiency at the cost of wellbeing.
3. **Transparency** - Decisions must be explainable. No black-box algorithms.
4. **Privacy** - Collect minimum data. Never track religion, politics, medical diagnoses, or
   asylum CASE details (procedure, stage, decision, grounds). A client may record their own
   permit type and expiry — see "What a CLIENT may keep about themselves" below for the rule
   that makes that safe: it is their record, and no decision the product makes can read it.

---

## Core Mission

**Reduce housing conflicts and improve wellbeing** through compatibility-based placement.

**NOT**: Maximize occupancy, minimize costs, or optimize throughput.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS (mobile-first) |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod (SSOT for types) |
| Testing | Vitest + Playwright |

---

## Project Structure

```
src/
├── app/                    # Next.js pages (App Router)
│   ├── (admin)/           # Staff interface (sidebar layout)
│   │   ├── residents/     # Resident CRUD
│   │   ├── housing/       # Housing units
│   │   ├── placements/    # Placement history
│   │   ├── incidents/     # Conflict tracking
│   │   ├── matching/      # Compatibility UI
│   │   ├── maintenance/   # Maintenance tickets
│   │   ├── rules/         # AOZ rule catalog + staff decision queue
│   │   └── transfer-requests/ # Staff transfer approval queue
│   ├── portal/            # Resident self-service (simple layout)
│   │   ├── rules/         # House rule book + acknowledgement
│   │   ├── decisions/     # Proposals and voting
│   │   ├── expenses/      # Shared expenses: split, balances, settle up
│   │   ├── apartment/     # Apartment profile (resident-named, rooms, people)
│   │   ├── profile/       # Resident self-profile (name, photo, bio)
│   │   └── transfer/      # Resident transfer request
│   └── api/
│       ├── cron/          # Daily notification cron
│       ├── export/        # CSV export routes
│       └── import/        # CSV import routes
├── components/
│   ├── ui/               # Generic UI (Card, Badge, Tabs)
│   ├── forms/            # Config-driven form components
│   ├── layout/           # MobileNav, headers
│   ├── dashboard/        # Dashboard widgets
│   ├── housing/          # Housing-specific components
│   ├── portal/           # Portal-specific components
│   └── residents/        # Resident-specific components
└── lib/
    ├── config/           # SSOT for all config
    │   ├── types.ts
    │   ├── resident-factors.ts
    │   ├── housing-factors.ts
    │   └── thresholds.ts
    ├── compatibility/    # Scoring algorithm
    ├── expenses/         # Shared-expense money/split/balance logic (pure, tested)
    ├── governance/       # House rules, decisions, conflict ladder (pure logic)
    ├── actions/          # Server actions (auth-guarded)
    ├── email/            # Email service (Resend) + templates
    ├── export/           # CSV export (papaparse)
    ├── validation/       # Zod schemas
    └── constants/        # Labels (German UI text)
```

---

## Branding (re-badging is config, not code)

The product ships under a neutral brand and can be handed to AOZ badged as AOZ.
Neither is a fork; both are presets.

```bash
NEXT_PUBLIC_BRAND=aoz    # DEFAULT (`DEFAULT_BRAND_ID`), and what the live
                         # instance runs — verified on the box 2026-08-31.
NEXT_PUBLIC_BRAND=aozh   # neutral pitch badge
NEXT_PUBLIC_BRAND=wg     # real shared-flat deployments — "WG Wohnen /
                         # Gemeinsam wohnen", no placement-system register.
```

⚠️ **This block was wrong in both halves** until 2026-08-31: it named `aozh`
the default while `DEFAULT_BRAND_ID` has been `aoz`, and said the live instance
ran `wg`. That combination is worse than either alone, because the brand
decides `codePrefix`, and a maintenance script minting a staff code on a laptop
takes the DEFAULT when `NEXT_PUBLIC_BRAND` is unset. Believing the live brand
was `wg` while the default silently produced `AOZ-` would have read as a bug to
go fix, and "fixing" it would have issued genuinely wrong codes. A code outlives
the brand that issued it and cannot be re-prefixed, so this is not a cosmetic
drift. `WG-DEMO01` is a legacy code from when the instance did run `wg`; it
keeps working precisely because login resolves by exact string.

**Check the box, never this file, before minting anything branded**, and never
run a code-minting script without carrying the deployment's brand across —
`ensure-aoz-team.ts` now refuses rather than guessing.

AOZH ships the **same palette** as AOZ deliberately — the brief was to keep
AOZ's colours and change only the name and the design language — so it defines
no colour override at all. Only the acronym differs.

**Switching the live deployment** — `NEXT_PUBLIC_*` is inlined at build time, so
this needs a redeploy, not a restart. The box holds the authoritative runtime
env and the deploy pulls it into the build:

```bash
# 1. set the brand in the box's env (the SSOT the build reads)
ssh root@167.233.22.31 \
  "grep -q '^NEXT_PUBLIC_BRAND=' /opt/aoz-wohnen/shared/.env \
     && sed -i 's/^NEXT_PUBLIC_BRAND=.*/NEXT_PUBLIC_BRAND=aoz/' /opt/aoz-wohnen/shared/.env \
     || echo 'NEXT_PUBLIC_BRAND=aoz' >> /opt/aoz-wohnen/shared/.env"

# 2. rebuild + redeploy
gh workflow run deploy.yml -R bitbaum/aoz-begleitung

# 3. confirm what a user actually sees
curl -s https://aoz.orangecat.ch/login | grep -oE 'AOZH?' | sort -u
```

- **SSOT**: `src/lib/config/brand.ts`. Every field has a direct visible
  effect: `shortName` (product compound copy), `codePrefix`,
  **`residentCodePrefix`** (NEW client codes — AOZ issues `KL-`, WG `MB-`),
  **`clientTerm` / `clientTermPlural`** (what this register calls the person —
  gender star, never a colon), `productName` (**the wordmark reads this; never
  hardcode the product word in `Logo.tsx` again**), **`portalName` /
  `portalTitleKey`** (the portal is "Mein Bereich" in the AOZ register and
  "Mein Zuhause" only in a real WG — the software does not get to tell someone
  their temporary accommodation is home), `tagline`, `metaDescription`, and
  **`orgName` — the rule-issuing
  organization, distinct from the product**: the WG-branded product runs under
  AOZ's rule catalog, so ALL governance copy ("AOZ-Regel", "AOZ-Thema", org
  contact info) reads `orgName`, never `shortName`. A config field you can set
  with no visible effect is a trap; don't add speculative ones.
  `APP_LABELS`/`LOGIN_LABELS` derive from `BRAND` — never restate brand copy.
- **`ALL_RESIDENT_CODE_PREFIXES`** is the client-side twin, and it carries
  `LEGACY_RESIDENT_CODE_PREFIXES = ['RES-']` forever: every code in every live
  database starts with `RES-`, printed on paper and handed to a person. Login,
  registration, log redaction and the demo reset all match the FULL list;
  only code GENERATION reads `BRAND.residentCodePrefix`. Matching the active
  prefix alone would answer "Ungültiger Code" to every existing resident.
- **`ALL_CODE_PREFIXES`** is the list of every prefix any brand has ever
  issued. Anything that must recognise codes *across* a rebrand — log
  redaction, code parsing — reads that, never `BRAND.codePrefix`. Codes outlive
  the brand that issued them: the log redactor matched a literal `/AOZ-…/` and
  would have silently stopped redacting staff codes the day this shipped.
- **Colours**: the `:root` palette in `globals.css` is the **original AOZ
  palette, byte-for-byte** and stays the default, so switching back is lossless
  rather than a reconstruction. A brand overrides only `--color-brand-*` inside
  `:root[data-brand='<id>']`. `<html data-brand>` is stamped in `layout.tsx`.
- Components use semantic `brand-primary` / `brand-secondary` / `brand-accent`
  classes. **Never** reintroduce `aoz-*` class names or hardcode a hex.

### What must NOT be rebranded

These are identifiers, not branding — renaming them breaks live things for zero
user benefit:

| Thing | Why it stays |
|---|---|
| Deploy app `aoz-wohnen`, domain, DB `aoz_wohnen`, systemd units | Addresses. Renaming means DNS/Caddy/service churn. |
| ~~Repo~~ — **renamed to `aoz-begleitung` on 2026-09-15** | It was listed here as an address, but nothing keyed on it: no systemd unit, Caddy file or database name contains the repo name, so the rename cost no churn at all. It was also the last public place the product was still called Housing. `JWT_ISSUER` below is a different matter and did not move. |
| `JWT_ISSUER` (`aoz-housing`) | Changing it invalidates every live session. |
| Theme key `aoz-theme` | Changing it silently resets everyone's light/dark choice. |
| **Existing resident codes** | `codePrefix` applies to NEW codes only; login resolves by exact string, so old `AOZ-` codes keep working forever. |

---

## Design System

**Design language:** technical, flat, high-contrast — the register of x.ai /
SpaceX / Tesla, carrying AOZ's colours. Concretely that means four decisions,
and every one of them is a token, not a component edit:

| Decision | Where it lives |
|---|---|
| **Near-square geometry** — `rounded-lg` is 4px, not 8px | `--radius-*` |
| **No shadows on in-page surfaces** — hairline borders separate everything | only `--shadow-overlay` exists |
| **Tight display type, wide micro-labels** | `--tracking-*`, `.eyebrow` |
| **Mono tabular figures for all data** | `.numeric`, `.metric` |

Colour is *rationed*: brand red marks the one action that matters on a screen
and nothing else. That is what keeps warning/error legible as signals in a tool
whose whole job is surfacing conflict.

**Tailwind v3** — config at `tailwind.config.ts`, which holds **zero** literal
design values; it only maps utilities onto CSS vars. Both themes share one
class surface — only the var values flip.

### CSS Custom Properties (SSOT — `src/app/globals.css`)

Colors are space-separated RGB channels (e.g. `230 57 70`) so Tailwind's
opacity modifier (`bg-brand-primary/15`) works.

```css
:root {
  /* Surfaces — canvas and surface are BOTH pure white: cards are separated
     by their border, not by floating above a tinted background. */
  --color-ui-canvas:        255 255 255;
  --color-ui-surface:       255 255 255;
  --color-ui-subtle:        246 246 246;
  --color-ui-border:        226 226 226;
  --color-ui-border-strong: 168 168 168;
  --color-ui-text:           10  10  10;
  --color-ui-muted:         112 112 112;

  /* Brand — THE ORIGINAL AOZ PALETTE, BYTE-FOR-BYTE. Do not edit.
     Guarded by src/lib/__tests__/design-system.test.ts. */
  --color-brand-primary:    230 57 70;   /* red   — CTAs, active marks */
  --color-brand-secondary:   25 82 82;   /* teal  */
  --color-brand-accent:     235 244 243; /* mint  */

  /* Geometry — near-square. `rounded-lg` is the workhorse (200+ uses), so
     this one line re-skins the whole product. */
  --radius-sm: 2px;  --radius-md: 3px;  --radius-lg: 4px;
  --radius-xl: 6px;  --radius-2xl: 8px;

  /* Typography — the gap between display and label is the hierarchy. */
  --tracking-display: -0.032em;   --tracking-heading: -0.02em;
  --tracking-label:    0.08em;    --tracking-eyebrow:  0.14em;

  /* Depth — the ONLY shadow in the system, for content that genuinely
     floats (menus, dialogs, drawers). In-page surfaces are flat. */
  --shadow-overlay: 0 8px 24px -6px rgb(0 0 0 / 0.12), 0 0 0 1px rgb(0 0 0 / 0.06);

  /* Score / status / severity tokens — see the file for the full set.
     Paired *-text variants ship readable shades for tinted backgrounds. */
}
```

Dark mode (`[data-theme='dark']` or `prefers-color-scheme: dark`) is a **true
black** canvas and overrides the same tokens. The brand red holds 5.0:1 against
black, so the palette needs no per-theme hue shift — only the surfaces move.
**Never** branch on `dark:` in components.

### Component classes (SSOT in `src/app/globals.css`)

**Typographic primitives** — the two signature moves.
```
.eyebrow  → text-2xs font-semibold uppercase tracking-eyebrow text-ui-muted
.numeric  → font-mono tabular-nums tracking-tight   (anything compared down a column)
.metric   → numeric + text-3xl font-semibold        (the big number in a stat block)
```

**Surfaces** — flat. A hover affordance is a border/fill change, never a shadow.
```
.card          → bg-ui-surface rounded-lg border border-ui-border p-4 sm:p-5
.card-hover    → card + hover:border-ui-border-strong hover:bg-ui-subtle
.overlay-panel → bg-ui-elevated border rounded-lg shadow-overlay  (menus/dialogs ONLY)
.scrim         → fixed inset-0 bg-black/50  (the modal dimmer — one definition)
.chrome-bar    → sticky translucent header with a hairline underline
```

**Buttons** — all variants enforce `min-h-[44px]`.
```
.btn-primary   → NEUTRAL near-black button — the default action everywhere
.btn-secondary → BRAND-COLOURED button — for emphasis
.btn-outline / .btn-ghost / .btn-danger / .btn-warning / .btn-icon
```
The naming is historical and 121 files depend on it: **primary ≠ brand colour.**

**Navigation** — one definition of "where am I", shared by the admin megamenu,
the mobile drawer and the portal nav.
```
.nav-item / .nav-item-active
```

**Badges (outline) & chips (tinted fill)** — both near-square, uppercase
micro-type, so they read as machine states rather than prose. Colours come from
the `status-*` tokens; never Tailwind's raw palette.
```
.badge-active / -success / -pending / -info / -ended / -alert
.chip-success / -warning / -error / -info / -neutral
```

**Meters** — occupancy, capacity, score and fairness bars.
```
.meter / .meter-lg  → the track          .meter-fill → the filled portion
```
Square-ended on purpose: a rounded cap misreports the value, because at 3% the
pill is all cap and reads as more than nothing.

**Alerts** `.alert-error|success|warning|info` · **Avatars** `.avatar[-sm|-lg]`
(square, not circular — initials are data like anything else) · **Icon
containers** `.icon-container[-sm|-lg]` · **Scores** `.score-excellent…critical`

**`rounded-full` is now reserved for true circles only** — status dots, timeline
markers, notification counters. Pills and bars are square. If you are reaching
for it on something with padding, you want `.chip` or `.meter`.

### Layout primitives (`src/components/ui/Page.tsx`)

```tsx
<PageShell>      → max-width container with vertical rhythm
<PageHeader      → SSOT for <h1>: eyebrow, display title, description, actions, backHref
<SectionHeader   → SSOT for <h2> inside a page — never hand-roll one, never skip a level
<Toolbar>        → filter/action row
<EmptyState>     → dashed-hairline empty state
<ListShell>      → hairline list container
```

### SSOT rules — never violate

1. **All design tokens live in `globals.css` only.** `tailwind.config.ts`
   references CSS vars; it contains no hex, no `rgb()` triple, no literal.
2. **Components use semantic classes.** Never `bg-[#hex]`, never a raw Tailwind
   palette colour (`text-gray-500`), never `style={{ color: '#hex' }}`.
3. **Use the existing component classes** rather than rebuilding `.card`,
   `.btn`, `.badge`, `.chip`, `.alert`, `.avatar`, `.scrim` from primitives.
4. **Touch targets ≥ 44px.** Don't override `.btn-*` padding; use `.btn-icon`.
5. **No shadow but `shadow-overlay`,** and only on genuinely floating content.
6. **Email is the one exception** — mail clients can't read CSS vars, so email
   colour is literal hex confined to `src/lib/email/tokens.ts`.

All six are enforced by **`src/lib/__tests__/design-system.test.ts`**, which
also verifies that every `var(--x)` in the Tailwind config actually exists (an
unresolvable CSS variable is invisible to both tsc and ESLint) and that the AOZ
palette has not drifted. Run it with `pnpm run test` — not a style opinion, a
gate.

⚠️ `pnpm run verify` does **not** run `next build`. A `'use client'` placed below
an import passes lint, typecheck and Vitest, and fails only at build. Run a build
before declaring UI work done; `src/lib/__tests__/use-client-directive.test.ts`
guards that specific class.

**Building locally needs one env var, and without it the failure lies about
its cause.** A bare `pnpm run build` dies with `Failed to collect configuration
for /api/auth/demo` — a route that queries the user table, so the obvious
reading is "this laptop has no `aoz_wohnen` database, builds are impossible
here". That reading is wrong, and it was believed twice on 2026-09-01 before
anyone read far enough down the log to the real `[cause]`:
`SESSION_SECRET environment variable must be set in production`.

```bash
SESSION_SECRET=local-build-only pnpm run build   # exit 0, 56 static pages
```

Two traps stacked on that one:

- **Never pipe the build.** `pnpm run build | tail -25` exits with *tail's*
  status, so a failed build reports success. Redirect to a file and read `$?`,
  or run it unpiped.
- **A build error naming a route that touches the database is not evidence
  about the database.** Read down to `[cause]` before concluding anything
  about the environment — the first line names where it broke, not why.

## Mobile-First Design (MANDATORY)

All UI must work on mobile FIRST, then enhance for larger screens.

### Breakpoint Strategy

```
Mobile:    < 640px   (default styles, no prefix)
Tablet:    >= 640px  (sm:)
Desktop:   >= 768px  (md:)
Large:     >= 1024px (lg:)
```

### Required Patterns

**1. Touch Targets**
```tsx
// WRONG - too small for touch
<button className="p-1 text-xs">Click</button>

// RIGHT - minimum 44x44px
<button className="min-h-[44px] min-w-[44px] p-3">Click</button>
```

**2. Responsive Navigation**
```tsx
// Desktop: horizontal nav or sidebar
// Mobile: hamburger menu with drawer
<nav className="hidden sm:flex">...</nav>        // Desktop
<button className="sm:hidden">Menu</button>     // Mobile trigger
```

**3. Responsive Grids**
```tsx
// Always start with single column
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

**4. Responsive Typography**
```tsx
<h1 className="text-xl sm:text-2xl lg:text-3xl">
```

**5. Responsive Spacing**
```tsx
<div className="p-4 sm:p-6 lg:p-8">
<div className="gap-4 sm:gap-6">
```

### Testing Checklist

Before marking any UI task complete:
- [ ] Test at 375px width (iPhone SE)
- [ ] Test at 414px width (iPhone Plus)
- [ ] Test at 768px width (iPad portrait)
- [ ] Test at 1024px+ (desktop)
- [ ] All touch targets >= 44px
- [ ] No horizontal scroll on mobile
- [ ] Text readable without zooming

---

## Config-Driven Architecture (SSOT)

### Factor System

All compatibility factors live in `src/lib/config/`:

```typescript
// src/lib/config/resident-factors.ts
export const RESIDENT_FACTORS = {
  ageRange: {
    id: 'ageRange',
    type: 'select',
    options: ['YOUNG_ADULT', 'ADULT', 'MIDDLE_AGED', 'SENIOR'],
    labels: { YOUNG_ADULT: '18-25', ADULT: '26-40', ... },
    weight: 0.15,
  },
  // ... all other factors
}
```

### Adding a New Factor

**Maximum 2 files to change:**
1. `src/lib/config/resident-factors.ts` - Define factor
2. `src/lib/db/schema.ts` - Add column (then `pnpm run db:generate` for the migration)

**If you need to edit more files, the architecture is wrong.**

### Labels (German UI)

All user-facing text in `src/lib/constants/labels.ts`:

```typescript
// WRONG - hardcoded in component
<span>Aktiv</span>

// RIGHT - from constants
import { STATUS_LABELS } from '@/lib/constants/labels'
<span>{STATUS_LABELS.ACTIVE}</span>
```

---

## Compatibility Algorithm

### Scoring Dimensions

SSOT: `RESIDENT_DIMENSIONS` in `src/lib/config/resident-factors.ts` — the
table below mirrors it and goes stale before the config does; trust the config.

| Dimension | Weight | Factors |
|-----------|--------|---------|
| Lebensstil | 35% | Sleep schedule, noise tolerance, cleanliness (3 dimensions), guests |
| Soziales | 25% | Communication, privacy, interaction, conflict style |
| Praktisches | 20% | Smoking, dietary, shared space preferences |
| Anforderungen | 20% | Hard requirements that must be met (blocking) |

### Score Thresholds

| Score | Level | UI Color | Action |
|-------|-------|----------|--------|
| 80-100 | Sehr gut | Green | Recommend |
| 60-79 | Gut | Blue | Good option |
| 40-59 | Mittel | Yellow | Review carefully |
| 20-39 | Niedrig | Orange | Avoid if possible |
| 0-19 | Kritisch | Red | Do not place |

### Cleanliness is directional (not a difference)

Cleanliness is **three** fields, because a single scale conflates things that
behave differently:

| Field | Meaning |
|-------|---------|
| `cleanlinessPractice` | How much order this person keeps themselves |
| `cleanlinessExpectation` | How much they expect from the people they live with |
| `chaosTolerance` | How much mess and disorder they can live with |

Friction is computed **per direction**: `max(0, expectation(A) − practice(B))`,
damped by A's `chaosTolerance`. A pair scores as its *unhappier* member; a
household scores by its *worst pairing*, never the average — averaging hides the
one pairing that generates the incidents.

Why it must not be symmetric:
- tidy but relaxed + messy → **no friction** (nobody's expectation goes unmet),
  yet an absolute-difference model calls it the worst possible match
- two equally messy people, one demanding → **standing conflict**, yet a
  difference model calls it a perfect match

Staff also get the *direction* (who will be bothered by whom), plus
`hasDoubleStandard` (expects more than they contribute) and `isHighMaintenance`.

**Never** reintroduce `Math.abs(a.cleanliness - b.cleanliness)`.
@see `src/lib/compatibility/cleanliness.ts`

---

## House Rules & Decisions (Governance)

Two tiers, one rule book. `src/lib/governance/` holds the pure logic; server
actions and API routes only do I/O.

### The hierarchy is real, not two lists

Every AOZ rule declares how much room a house has on that topic:

| `delegation` | Meaning |
|--------------|---------|
| `FIXED` | Non-negotiable. No house rule may attach. |
| `UNIT_MAY_STRENGTHEN` | AOZ rule is the minimum; a house may go stricter (staff confirm). |
| `UNIT_DECIDES` | AOZ names the topic only; the house sets the norm. |

A unit rule **always** points at the AOZ rule it specialises (`parentRuleId`),
so every house rule is traceable to the topic that permits it. `checkUnitLegislation()`
is the gate, and it runs when a proposal is *created* — never after a week of
voting. "Stricter, never looser" cannot be verified on free text, so those cases
route to a human instead of pretending to validate.

### Who decides what

`CATEGORY_DECISION_MODE` in `lib/config/decisions.ts` is the SSOT:

- `RESIDENT_BINDING` — everyday life together (kitchen, cleaning, quiet times)
- `RESIDENT_ADVISORY` — consequences beyond the house (guests, costs); staff confirm
- `STAFF_ONLY` — **safety and non-discrimination are never put to a vote.** A
  majority must not be able to vote away a minority's safety. Proposals on these
  topics are still created, and staff must answer them.

Decisions snapshot their policy (`threshold`, `quorumPercent`, `approvalPercent`,
`eligibleVoterCount`) when voting opens, so a past decision stays explainable
after the policy changes. Every tally carries a plain-German explanation that
residents and staff both see — no black-box outcomes.

A `BLOCK` (veto) stops a **consensus** proposal; under a majority threshold it
counts as a No and raises a mediation flag, but does not veto — otherwise any
one resident could block every house decision.

**A vote threshold is only shown where a vote actually happens.**
`DECISION_MODE_IS_VOTED` gates it: a `STAFF_ONLY` proposal used to render
"Mehrheit — mehr als die Hälfte der abgegebenen Stimmen" directly beside "Die
Betreuung entscheidet", promising residents a majority that will never be
counted, on precisely the topics where a majority must not decide. Pinned by
`src/lib/config/__tests__/decision-mode-voting.test.ts`.

### Acknowledgement (the cheapest prevention)

Acknowledgements are per **rule version**. Amending a rule bumps its version and
asks everyone bound by it to read it again — nobody is held to wording they never
saw. Unit coverage is the *leading* indicator for norm conflicts; incidents are
the lagging one.

### Conflict resolution is a ladder

`REPORTED → SELF_RESOLUTION → PEER_MEDIATION → STAFF_MEDIATION → FORMAL_MEASURE → CLOSED`

Two hard limits, both deliberate:
1. **Safety never starts at the bottom.** Safety reports and high/critical
   incidents enter at staff level. Nobody is asked to negotiate with someone who
   threatened them (`determineEntryStage`).
2. **Escalation is not punishment.** Moving up a rung means the previous step did
   not hold; it says nothing about fault.

Each rung ends in a `ConflictAgreement` — concrete terms, named parties, a review
date, and an explicit *did it hold?*. A broken agreement escalates; one that held
closes the conflict and can seed a house rule. A free-text resolution note cannot
be followed up on, which is why "resolved" used to mean nothing.

### A report goes to the desk that can act on it

A resident report is **not** always an incident. `/api/portal/report` routes on
category (`src/lib/reports/routing.ts` is the SSOT for the mapping):

| Category | Lands as | Worked on |
|---|---|---|
| `MAINTENANCE` | `MaintenanceRequest` | the staff maintenance board |
| everything else | `Incident` | the conflict ladder |

Filing a dripping tap as an `Incident` cost twice, and both showed up in
production: it never appeared on the board built to fix it, and it inflated the
incident count — **the single number the AOZ pilot is judged on**. A broken
appliance is not a conflict, and counting it as one corrupts the metric.

The resident still sees ONE list. `mergeResidentReports()` folds both tables
into "Deine Meldungen" and carries `resolution` with it — **an answer stored and
never rendered is the same as no answer**. Never re-split that list by table:
residents do not know which desk works their report, and must not have to.

---

## Navigation: a group is named for what it IS

SSOT: `src/lib/config/navigation.ts`. Both sides of the product share one
vocabulary — "Gemeinschaft" means the same thing to staff and to residents, and
a word that differs between the two surfaces is how a shared language rots.

**The rule, and it is load-bearing: never name a group for what you DO there.**
A verb heading breaks the day its verb is feature-flagged away — silently, with
everything still green. That is not hypothetical. The portal shipped a group
called **"Zusammen entscheiden"** which, on the AOZ brand, held Regeln,
Nachrichten, Melden and Meine Meldungen and nothing to decide: `householdVotes:
false` had removed Abstimmen, the one item the name described, and the heading
stayed. Types, coverage and route-reachability were all green throughout.

The five portal groups each answer one question a resident arrives with:

| Group | The question |
|---|---|
| `living` — Wohnen | the roof over my head, and running this household |
| `community` — Gemeinschaft | the people I live with |
| `concerns` — Anliegen | I raised something; where did it go |
| `integration` — Integration | where I am going next |
| `account` — Mein Konto | me and this app |

Messages sit under **Anliegen, not Gemeinschaft**: a `MessageThread` belongs to
one resident and the other side is always STAFF, so it is not community at all.

Gates: `portal-nav-groups.test.ts` checks every group against EVERY brand's
flags (the flags are what empties a group; the built brand is what hides that
from you) and requires ≥2 items — a one-item accordion is a link wearing a hat.
`nav-labels-distinct.test.ts` compares rendered headings AND item labels per
locale: `navGroup.integration` was a verbatim copy of `navGroup.concerns` in fr,
uk, ar and tr, so those readers had two accordions with the same name while the
labels inside them were perfectly distinct.

Group headings live ONLY in the dictionaries. `PORTAL_LABELS.navGroups` was a
second copy read by nothing but a test; the sidebar resolves headings through an
`as MessageKey` cast, and a cast is not a check — an unkeyed group renders an
EMPTY heading, because the German fallback misses too.

---

## Marketplace: two halves, and no money

SSOT: `src/lib/config/marketplace.ts`. The board carries **goods and services**,
because the thing people in a shared house pass around most is not a toaster —
it is half an hour. Translating a letter, watching a child, carrying a wardrobe.

**There is no price field and there must never be one.** The people using this
hold permits that constrain paid work, and a neighbour-help board where one
resident quotes another turns into informal employment nobody has checked,
inside a population that cannot afford to have that go wrong.

**The other half of that safeguard now exists.** This paragraph twice described
a gap that has since been closed, so read the code before trusting it again:
`Opportunity` has FOUR kinds — `VOLUNTEERING`, `COMMUNITY_SERVICE`,
`EMPLOYMENT`, `INTERNSHIP` — and the last two are what paid and formal work is
filed under, in a channel separate from the no-price marketplace.

The decision this file called live has been taken, and the condition it set was
met. `permitRequirementIsStated()` refuses a work listing that leaves
`permitRequirement` at its `NONE` default, because `NONE` renders to a resident
as "Keine Bewilligung nötig" — true and useful on unpaid volunteering, and on a
job a legal claim about that person's situation which this product must never
make by accident. A coach who does not know which route applies cannot publish;
the unknown case belongs with Sozialarbeit before it reaches a resident.

Enforced in three places, not by convention: the zod schema
(`validation/schemas.ts`), the publish action (`actions/opportunities.ts`), and
`opportunities/__tests__/work-permit-gate.test.ts`.

The board was EMPTY on the live instance until 2026-09-04 — zero places, zero
applications — and it is the binding constraint on the Jobcoach and
Freiwilligenarbeit KPIs, which cannot rise while there is nowhere to place
anyone. It now holds ONE listing: AOZ's own real vacancy
`Programmleiter*in 90-100%, Pilotprojekt «Begleitung im regulären Wohnraum»`
(jobs.aoz.ch job 4057371), entered through the UI as the end-to-end proof.
Everything else is still AOZ's data to enter. **Do not seed it with invented
employers to make a number move** — a real vacancy from the organisation that
runs this product is not that; a plausible-sounding Velowerkstatt is.

What reduced the cost of entering one is AI form assist on the opportunity
form — paste an ad, correct it — with `permitRequirement` and `status`
`aiExcluded`, because a model must never assert an authorisation route (see
below) nor decide to publish. Measured on the real ad: 11 fields filled,
hours/seats/start left BLANK because the ad did not state them, and one real
error (the HR contact's name paired with the line manager's phone). That last
one is why the form says «überprüfe jede Angabe».

### A refusal that reaches nobody is not a gate, it is a crash

⚠️ **Found by using the product, not by reading it.** Publishing an
Arbeitsstelle whose Bewilligungsweg was still the `NONE` default correctly hit
the work-permit gate — and rendered "Etwas ist schiefgelaufen. Bitte versuchen
Sie es erneut."

`validateFormData` throws a `ValidationError` carrying the one sentence that
names the next step. Nothing caught it, so Next's error boundary replaced it
with a shrug AND unmounted the route, losing all fourteen fields — most of them
written seconds earlier by the assistant. Adding AI fill turned a bad message
into an expensive one.

- **A failed save RETURNS `OpportunityFormState`; it does not throw.** The
  `<form>` lives inside the client component that holds every value, so a
  rejection leaves that store alone and the coach fixes one field.
- **The publish BUTTON keeps its throwing guard** (`publishOpportunity`, pinned
  by `work-permit-gate.test.ts`) and is wrapped by `publishOpportunityFromEdit`,
  which carries the gate's own words back as a URL param.
- **`redirect()` works by throwing**, so the fallible work sits in its own
  function and redirect is never called inside the `try` that would catch it.
  Same split as `expressInterest`.

The general lesson, and it applies to every action in this repo: a server
action that throws a *message a user must act on* has no way to deliver it.
Return it.

### Copy defaults describe the form they were written for

`AiFormBar`'s title and hint come from `AI_FORM_LABELS`, written for resident
intake. Only the placeholder was overridable, so the Einsatzplatz form told a
job coach to "beschreibe das Aufnahmegespräch in eigenen Worten" above a box
for a job advert, and offered «doch Nichtraucherin» as an example edit — copy
about a PERSON on a form describing a PLACE. Pass `fillTitle` / `refineTitle` /
`fillHint` / `refineHint` on any new assisted form.

### A click is a request for contact, not contact

⚠️ **The single worst bug this area has had, because it hid itself and
flattered the numbers while doing it.** `hasLabourMarketContact` counted an
`INTERESTED` application as labour-market contact. `recordInterest` writes
exactly that row — `createdBy: 'RESIDENT'`, `INTERESTED`, `supportedByUserId`
null — when a resident presses "Ich habe Interesse". **Nothing anywhere read
`supportedByUserId`**; the comment in `recordInterest` claiming the queue
filtered on it was aspirational, and it was written in three places and read in
none.

So the one action a resident can take on this board REMOVED them from
`NO_LABOUR_MARKET_CONTACT` and RAISED `LABOUR_MARKET_CONTACT_RATE`, with no
member of staff having done anything. The person most in need of a reply became
the person the product had stopped mentioning. The Freiwilligenarbeit coordinator's `ENGAGEMENT_RATE` had
the same inversion, and `MEDIAN_DAYS_TO_FIRST_CONTACT` was measuring how fast
residents click — a client who clicked on day one and waited two months
reported one day, so the tile improved fastest exactly where the service was
slowest.

Same class as [demo rows in the pilot KPI], from the other side: there the
numerator held rows nobody was working, here rows nobody had answered.

The rule now, `isAwaitingAnswer()` in `lib/jobcoach/queue.ts` and its SQL twin
`awaitingAnswerFilter()` in `lib/data/opportunities.ts`, held together by
`awaiting-answer-agrees.test.ts`:

- **Contact means a person engaged.** A resident-raised `INTERESTED` row with
  no `supportedByUserId` is a REQUEST for contact and counts as none.
- **`INTEREST_UNANSWERED` is first in `JOB_SIGNAL_IDS`**, and that order is the
  queue's priority — the dashboard hero renders `jobQueue[0]` and nothing else,
  so an unsorted queue handed that slot to whichever client the query returned
  first.
- **It fires from day one.** `NO_CONTACT_GRACE_DAYS` exists because nothing has
  been asked of anyone yet; here a person has asked, and the clock is theirs.
- **It replaces the contact signals rather than adding a row.** "Find this
  person something" is the wrong next move for someone who already found it.
- It promoted `client-preference` from `documented` to `signal`: the product
  could detect a stated preference all along and was saying nothing about it.
- **The demo must be able to produce the state.** `lib/seed/opportunities.ts`
  set `supportedByUserId` on resident-created `INTERESTED` rows — a row the
  running code can never write, and a demo where "Wartet auf Antwort" is
  permanently empty.

### What a resident may see of their own thread

- **Contact details are withheld until `ACCEPTED`, and stripped from the
  PAYLOAD** (`maySeeContact()`), not hidden in the JSX — `with: { opportunity:
  true }` selects every column, so the board was shipping employers' direct
  lines to anyone who pressed "Interesse". Not about secrecy: these residents
  hold permits that constrain work, and arranging something directly at
  `INTERESTED` goes around the one person who checks which route applies.
  `ENDED` keeps it (a reference is normal); `DECLINED` does not.
- **The practical facts must render.** `location`, `schedule`, `hoursPerWeek`
  and `startsAt` were loaded and never shown, so somebody already accepted onto
  a place could not learn where to go or when.
- **`residentNextStep()` is four states, not seven.** What differs between
  stages is whether the next move is theirs, ours or nobody's.

### Listing prose is machine-translated; the permit sentence never is

`lib/opportunities/translation.ts`. Every label around a listing was translated
into eleven locales while the title, description and requirement note — the
strings carrying what the place IS — stayed the coach's German.

- **Only the coach's free text.** `PERMIT_REQUIREMENT_LABELS` is a statement
  about what the PLACE requires, hand-translated per locale, and must never
  pass through a model: "Keine Bewilligung nötig" mistranslated is a wrong
  answer to the exact question `permitRequirementIsStated` refuses to guess at.
  Structured facts and names are not translated either.
- **A translation that outlives its source is not shown.** Each entry carries a
  hash of the German it came from. Without it, editing "dienstags" to
  "mittwochs" leaves the Arabic on Tuesday with no error and no way for the
  reader to tell. The hash covers ALL translatable fields together — per-field
  hashes would allow a fresh title above a stale description.
- **The reader is told**, with the German original one tap away, marked
  `lang="de" dir="ltr"` so it is not laid out backwards inside an RTL card.
- **Never blocks a publish.** A model that is down costs one resident a
  translation; a publish that failed because of it costs every resident the
  listing.
- Locales come from `availableLocales()`, so the unfinished dictionaries
  (ti, fa, so, sq, tr — NOT offered) cost nothing and are included the day
  somebody finishes them.

- **`kind` is an enum, `category` is config.** Not the same kind of thing: a
  category is vocabulary (adding "Fahrrad" is one line, never a migration — same
  rule as the expense categories), a kind is behaviour (it decides who claims
  from whom and what the button says).
- **The button reverses with the direction.** On a `GIVE_AWAY` the poster holds
  the thing; on a `WANTED` or `NEED_HELP` the poster is the one asking, and
  answering means offering. `claimLabelKey` per kind.
- **`contactNote` is how the two people actually meet.** There is no
  resident-to-resident messaging in this product, so without it a match
  stranded both sides at "claimed". It reaches the poster, the claimer and
  staff — and is dropped from the payload for everyone else, not hidden in the
  JSX. The payload is the leak, not the markup.
- You cannot claim your own post; a claimer may release rather than only close
  (closing destroyed the offer for everyone); the poster may withdraw an
  untouched post or reopen one that fell through; other units show OPEN only.

---

## Shared Expenses, Resident Profiles & Apartment Profiles

Splitwise-style expense sharing per housing unit, plus optional self-chosen
identity. `src/lib/expenses/` holds the pure logic; routes only do I/O.

### Money rules (non-negotiable)

- **Integer Rappen end to end.** Parse once at the input boundary
  (`chfToRappen`), format once at display (`formatRappen`). No floats, ever.
- **Shares always sum to the total.** `splitEqually` distributes Rappen
  remainders deterministically (+1 to the first ids in sorted order).
- **Balances are computed over the FULL history** — a balance over a
  paginated slice is a wrong number. `computeBalances` sums to exactly zero;
  `simplifyDebts` yields a stable ≤ n−1 transfer plan (greedy, id-tiebreak).
- **Resident FKs are `Restrict`, not `Cascade`** — deleting a payer would
  silently change everyone else's balance. Residents exit via status.
- Categories are **config, not a database enum** (`lib/config/expenses.ts`):
  a new category is a config change, never a migration.

Who may do what: any current unit member records expenses (also on behalf of
the payer) and settlements (always `from = self`). Only the payer or creator
may delete an expense. Everything unit-scoped via `getPortalAuth()`.

### Resident self-profile (privacy by design)

Residents have **no name field by default** — the code is the identity. The
portal lets them OPTIONALLY set `displayName`, `bio` and a photo:

- `residentName()` / `residentInitials()` in `lib/utils/resident-name.ts` are
  the SSOT for display — never inline `displayName || code`, and never render
  `resident.code` directly. Both helpers already fall back to the code, so the
  privacy default is preserved for free. **Selecting only `{ code: true }` in
  a query causes the same bug one layer earlier** — spread `RESIDENT_NAME_SELECT`
  into any query whose rows reach the UI, and use `ResidentSummary` (which
  carries `displayName`) for compatibility cards.
  **`NamedResident.displayName` is REQUIRED, not optional — this is the load-
  bearing part.** `null` means "this person chose no name"; a missing field
  means "the query never asked", and those are different facts. While it was
  optional, a `select: { code: true }` produced a row that satisfied the type,
  so `residentName()` fell back to the code and the staff resident list showed
  "RES-DEMO1" for someone whose name sat in the same row — with tsc, ESLint and
  the render all green. Requiring it moves the whole class from "a regex might
  catch it" to "it does not compile", and it caught 28 more sites the moment it
  landed. Any resident-shaped type that reaches the UI must declare
  `displayName: string | null`; never widen it back to `?:`.
  This is enforced by `src/lib/__tests__/resident-name-ssot.test.ts`: it failed
  on 50+ surfaces, because rendering a bare code type-checks, lints and looks
  fine — it just tells Georgy that "RES-LCCM7A" did the dishes instead of the flatmate by name,
  and shows AOZ staff codes for people whose names sat in the same row. The few
  places where the login code *is* the point (the portal's own "your code" card,
  the staff breadcrumb) opt out with a `resident-code-intentional` comment, so
  showing a code stays a decision rather than an accident.
  **The rule is a DENYLIST of things that own a code without being a person**
  (units, spots, rooms, staff). Its first version listed the resident-ish
  accessor names instead and reported all-clear while missing `candidate.code`
  in the agreements panel — an allowlist cannot catch the name nobody thought
  of. Any new non-person code holder goes in that list; everything else must
  use the helpers.
- Photos live in `ResidentPhoto` (separate table so Bytes never load on list
  queries), client-resized via canvas before upload, server-capped at 500 KB,
  and served ONLY to self + current roommates by
  `/api/portal/residents/[id]/photo` (404 for everyone else — no existence
  leak). `ResidentAvatar` renders photo-or-initials everywhere.

### Apartment profile

`HousingUnit.nickname` is the resident-chosen apartment name (e.g.
"Singapur") — any current resident may set it from `/portal/apartment`
(audited). The page shows rooms (from the spot hierarchy), occupants and
profiles.

### Real deployments vs demo

`scripts/db/seed-real.ts` seeds a REAL apartment from `scripts/db/real/*.ts` config
(layout + who lives where; login codes are generated at runtime and printed
once — never committed). `--wipe` converts a demo instance in place. A real
instance must run with `DEMO_ACCESS_ENABLED=false` and the reset timer
disabled — the daily demo reset would truncate real data. The production
instance `aoz.orangecat.ch` runs in REAL mode since 2026-08-13
(the pilot flat); the demo remains fully env-switchable for a future
dedicated demo deployment.

---

### Blocking Conflicts

Some incompatibilities are **blocking** (cannot place together):
- Wheelchair user + no wheelchair access
- Smoker in non-smoking unit
- Extreme lifestyle mismatch (diff > threshold)

---

## Ethical Boundaries

### What We Track (Functional Only)

- Compatibility-relevant preferences (sleep, noise, cleanliness)
- Languages spoken (for communication)
- Mobility needs (for unit matching)
- Self-reported preferences
- Anonymized conflict outcomes

### What We NEVER Track

- Medical diagnoses (only functional needs like "needs ground floor")
- Asylum case details — the procedure, its stage, the decision, the grounds
- Political or religious beliefs
- Personal history beyond housing relevance
- Anything that could be used for discrimination

### What a CLIENT may keep about themselves (and the rule that makes it safe)

⚠️ **This section used to read "Immigration status or case details" as one
absolute line, and that was too blunt to survive contact with the product.**
Extending a health insurance every six months, or getting a dentist
appointment, meant writing to your Betreuerin and waiting — the facts lived in
their inbox rather than in the profile of the person they belong to.

The distinction that holds is between **what is wrong with you** and **who you
call and when a form is due.** A diagnosis is a judgment about a person and
stays forbidden outright; no column in `ClientInsurance`, `ClientHealthContact`
or `ClientPermit` can hold one. An insurer, a policy number, a dentist's phone
number, a permit category and its expiry are administrative facts a person
already carries in their wallet.

**Permit is TYPE AND EXPIRY ONLY.** No case number, no decision history, no
grounds, no procedural stage. Those remain "case details" above.

**What makes this consistent rather than an exception is the mechanism.** The
harm the rule is about runs through a field that a decision can see. So these
tables are readable by a person looking at one client, and by **nothing that
ranks, scores, sorts or aggregates**:

| Forbidden to touch them | Why |
|---|---|
| `lib/compatibility/**` | decides who lives with whom |
| `lib/analytics/**` | the numbers the pilot is judged on |
| `lib/export/**` | a spreadsheet leaves the product and stops being governed |

Enforced by `src/lib/client-facts/__tests__/never-an-input-to-a-decision.test.ts`,
which scans those directories for the table names and fails with the reason
attached. "We promise not to" is not a mechanism. If someone later joins
`ClientPermit` into the matching query — the most plausible way this goes
wrong, because permit type correlates with things a matcher would love — the
build goes red.

**Visibility is per fact, never per person** (`lib/client-facts/policy.ts`):

| | Betreuung | Sozialarbeit | Jobcoach | Liegenschaften |
|---|---|---|---|---|
| Krankenversicherung | ✓ | ✓ | — | — |
| Gesundheitsfachpersonen | ✓ | ✓ | — | — |
| Aufenthaltsstatus | ✓ | ✓ | ✓ | — |

The Jobcoach holds the permit and only the permit: which work is lawful is that role's
job, and `permitRequirement` on an opportunity is already a claim about exactly
this. It has no business knowing which doctors somebody visits. A single "the
care team may see the client's facts" grant reads as reasonable and hands that role
both — which is why `clientFacts:read` is its own permission and not
`residents:read`, a check all four care roles pass.

**"Bestätigt" means SEEN, never TRUE.** A Betreuerin cannot ring the insurer to
verify a policy number. Every label says *geprüft* / *gesehen*, never *gültig*,
and both surfaces spell the difference out. A product that implied more would
be asserting something about a person's insurance or permit that it cannot
know — the same failure as an opportunity defaulting to «Keine Bewilligung
nötig». Editing a confirmed fact returns it to PENDING, because the check was
about the values that were there.

### Audit Trail

All placements logged with:
- Who made the decision
- Compatibility scores at time of placement
- Any override reasons
- Timestamp

---

## Code Quality Standards

### TypeScript

```typescript
// Types derived from Zod schemas (SSOT)
const residentSchema = z.object({...})
type Resident = z.infer<typeof residentSchema>

// No separate type definitions that can drift
```

### Component Patterns

```typescript
// Props interface at top
interface CardProps {
  title: string
  children: React.ReactNode
}

// Functional component
export function Card({ title, children }: CardProps) {
  return (...)
}
```

### File Organization

```
ComponentName/
├── index.tsx      # Main component (or just ComponentName.tsx)
├── types.ts       # Types if complex
└── utils.ts       # Helper functions if needed
```

---

## Language Rules

| Context | Language |
|---------|----------|
| UI labels, buttons, messages | German (Swiss) |
| Code, comments, docs | English |
| Variable/function names | English |
| Error messages (user-facing) | German (Swiss) |
| Error messages (logs) | English |

### Swiss German Spelling (MANDATORY)

All user-facing German text MUST use correct **Swiss German** spelling:

- **Always use umlauts**: ä, ö, ü, Ä, Ö, Ü — NEVER skip them
  - Menü (NOT Menu), Übersicht (NOT Ubersicht), Rückzugsort (NOT Ruckzugsort), Wünsche (NOT Wunsche), für (NOT fur), öffnen (NOT offnen)
- **Swiss German uses `ss` instead of `ß`**: schliessen (NOT schließen), Strasse (NOT Straße), grösser (NOT größer), Aussenbereich (NOT Außenbereich)
- **Common aria-label mistakes to avoid**: "Menü öffnen" (NOT "Menu öffnen"), "Menü schliessen" (NOT "Menu schliessen")

**Pre-commit check**: Before writing ANY German text, verify every word has correct umlauts. If unsure, check against a German dictionary.

---

## Authentication

### One human, one login, one or two roles

The CODE is the root identity and works forever; an **`Account`** (one email,
one password) is optional credentials laid ON TOP of it. Registration never
creates identities — provisioning (staff invites, resident intake) stays where
it is. `src/lib/auth/account.ts` holds the flows; passwords are bcrypt cost 12
(`lib/auth/passwords.ts`), reset/verify tokens are single-use SHA-256-at-rest
rows belonging to the ACCOUNT (`lib/auth/tokens.ts`, `AuthToken.accountId`).

| Role | Root identity | Session cookie |
|------|--------------|----------------|
| **Staff** | `AOZ-XXXXXX` / `WG-XXXXXX` code → `User` | `staff_session` (JWT) |
| **Resident** | `RES-XXXXXX` code → `Resident` | `resident_code` |

**An account may carry BOTH.** `Account.userId` and `Account.residentId` are
each unique and each optional. The person running a real shared flat is its
admin *and* one of its flatmates; a caseworker may live in one of the houses.
Credentials on the identity rows forced them to pick one, and guaranteed two
password hashes for one human that would drift apart — so **never put `email`
or `passwordHash` back on `User` or `Resident`.**

Linking needs no separate flow, no invite and no admin: **register again with
your second code and the same email.** A finished account must prove itself
with its own password before absorbing another identity
(`AUTH_LINK_PASSWORD_MISMATCH`) — holding a stray code is not enough to attach
yourself to someone else's login. A role slot that is already filled refuses
(`AUTH_ROLE_ALREADY_LINKED`).

`establishSessions()` (`lib/auth/sessions.ts`) is the SSOT for "you are now
signed in": it sets every cookie the account's identities call for and reports
`roles`. Staff wins the landing page (bigger surface); the nav offers the
switch. A deactivated staff identity grants nothing but must **not** cost the
person their resident access — they are different roles.

### Staff: three facts, never one

A staff member is described by **three orthogonal fields**, and mixing them is
the mistake this section exists to prevent:

| Field | Answers | Values |
|---|---|---|
| `User.role` | which CARE DOMAIN am I staffed for? | `BETREUUNG` · `SOZIALARBEIT` · `JOBCOACH` · `FREIWILLIGENARBEIT` · `LIEGENSCHAFTEN` (no care domain — runs the buildings) |
| `User.scope` | whose files may I open? | `OWN_DOMAIN` · `ALL_DOMAINS` |
| `User.isSystemAdmin` | may I reconfigure the product? | boolean |

`role` maps 1:1 onto `CareRole`, and that bijection is DERIVED
(`STAFF_ROLE_CARE_DOMAIN`), never restated.

**Why it is split.** The house this runs for has four people and the old
single enum could not describe them. One is a **Betreuerin who
also sees every client**; the only way to say that was `ADMIN`, which erased
that housing is that person's domain *and* handed them the settings page as a side effect.
The Jobcoach and the Freiwilligenarbeit coordinator work one domain each.
The Liegenschaften lead is the fourth, and that role is the reason `role` cannot simply mean "care
domain": it runs the housing STOCK — which flats exist, who is placed where,
what is broken — and supports nobody. `LIEGENSCHAFTEN` maps to no `CareRole`
at all, which is why `STAFF_ROLE_CARE_DOMAIN` is a `Partial<Record<…>>`.

```
Betreuerin (all domains)   BETREUUNG          + ALL_DOMAINS
Jobcoach                   JOBCOACH           + OWN_DOMAIN
Freiwilligenarbeit coord.  FREIWILLIGENARBEIT + OWN_DOMAIN
Liegenschaften lead        LIEGENSCHAFTEN     + OWN_DOMAIN   (no caseload)
```

⚠️ **This file used to say "There is no Leitung" here, as settled fact. That
is false at AOZ and was corrected 2026-08-31.** AOZ is a ~2000-employee
institution, and its `Pilotprojekt «Begleitung im regulären Wohnraum»` — the
project this product is named after — was recruiting a **Programmleiter\*in**
and a **Teamleiter\*in Betreuung** when this was checked (jobs.aoz.ch). What
was true is narrower: *these three people* have no lead among them.

The split holds up anyway, which is the point worth keeping: a
**Teamleiter\*in Betreuung is `BETREUUNG` + `ALL_DOMAINS` + NOT
`isSystemAdmin`** — the all-domains Betreuerin's exact shape. Leading a care team is reach over
that team's clients, not the right to reconfigure the product, and the three
axes say so without a new role. Do not add a `LEITUNG` enum value for it; that
is the mistake this section exists to prevent, and `ADMIN` is retired for
exactly this reason.

What the axes genuinely cannot express yet is a **Programmleiter\*in** over
several teams, and a `Springer*in` who covers some sites but not others —
both need a site/scope dimension the schema does not have (`User` has no
relation to a `HousingUnit`; `HousingUnit.buildingCode` is a placeholder).
Decide that before the second real apartment, not after.

Rules that follow, all enforced by `role-policy.test.ts`:

- **`ADMIN` is retired.** It survives in the enum ONLY so live JWTs and
  existing rows resolve; `/api/auth/register` refuses to mint a new one, and
  `ASSIGNABLE_STAFF_ROLES` excludes it. The migration gave every existing
  ADMIN row `ALL_DOMAINS + isSystemAdmin`, so nobody's access changed.
- **No role grants a system permission.** `users:manage`, `system:configure`
  and `import:write` live in `SYSTEM_ADMIN_PERMISSIONS` and are granted by
  `isSystemAdmin` alone — not even by oversight over every domain.
- **`hasPermission` takes the SUBJECT, not a role.** A bare role can no longer
  answer "may they?", and the type makes that impossible to forget.
- **`scope` and `isSystemAdmin` are read from the ROW on every request, never
  from the JWT.** Privileges in a token go stale: revoking oversight would not
  take effect until expiry, which with sliding refresh is indefinitely — the
  same failure the `active` re-check already prevents. `getCurrentUser` fetches
  that row anyway.
- **Care seats follow `scope`, not the role name.** `canWriteCareDomain` used
  to special-case `role === 'ADMIN'`; that special case is what made "a
  Betreuerin who covers every seat" unexpressible.

Permissions: `src/lib/auth/role-policy.ts`. Nav, invites, export/import and the
algorithm page follow them.

One email namespace across the whole product, because there is exactly one
`Account.email` unique index; email login can never guess which table you meant.

### Flows

```
/login                       → email+password (primary) or code (toggle); demo doors
/register                    → claim your code: { code, email, password } → auto-login
/forgot-password             → request reset link (generic success, no enumeration)
/reset-password?token=…      → set new password (also verifies the email)
/api/auth/login              → { email, password } or { code } — same endpoint
/api/auth/signup             → registration (public, rate-limited)
/api/auth/forgot-password    → 503 LOUDLY when RESEND_API_KEY missing (never a
                               fake "sent" — that is a silent lockout)
/api/auth/reset-password     → token + password
/api/auth/verify-email       → GET, redirects /login?verified=1|0
/api/auth/logout             → Clears both cookies
/api/auth/register           → Admin-only staff provisioning (POST { name, code? })
/api/auth/invite             → Admin-only staff invite by email (sends code)
```

- Codes trimmed + uppercased; emails trimmed + lowercased (zod, `lib/validation/auth.ts`)
- Rate limiting per IP on every public auth route (`getClientIp` SSOT)
- Login failures are ONE generic message — anything specific is an enumeration oracle
- Email login for a resident sets the same `resident_code` cookie: the portal
  is unchanged, and demo residents can register/reset too (daily reset wipes them)
- A code-only account with a known email (the seeded admin) bootstraps its
  first password via forgot-password — mailbox control is the proof

### Email transport

Resend (`lib/email/service.ts`), fleet key, sender on the verified
`loki.orangecat.ch` domain. `EMAIL_CONFIG.enabled` is false without
`RESEND_API_KEY` — notification emails then no-op quietly, but the
password-reset flow REFUSES loudly (see above). Absolute links come from
`NEXT_PUBLIC_APP_URL` (`lib/config/app-url.ts`).

### Demo Access — invented people live on their own instance, never beside real ones

**The rule (2026-09-25): no-account testing, on a separate app and database.**
Anyone must be able to try the product without registering, and nothing they
do there may touch a real person. Both hold only because the demo is its own
deployment:

| | Production `aoz-wohnen` | Demo `aoz-demo` |
|---|---|---|
| Domain | aoz.orangecat.ch | demo.aoz.orangecat.ch |
| Database | `aoz_wohnen` — real staff, real residents | `aoz_demo` — invented people only |
| `DEMO_INSTANCE` | unset | `true` |
| Demo doors | **never** (hard gate in `isDemoEnabled()`, #256) | all role doors + Klient*in |
| Nightly reset | refused by the route | `POST /api/cron/reset-demo`, 04:05 |

- **`isDemoInstance()` is the only key.** A production build opens doors, and
  the reset route truncates, ONLY with `DEMO_INSTANCE=true`. Copying
  `DEMO_ACCESS_ENABLED=true` into production's env opens nothing — pinned by
  `api/auth/__tests__/demo.test.ts` and `api/cron/__tests__/reset-demo.test.ts`.
- **Until 2026-09-25 the doors opened into production**, as a full system
  admin over real staff and residents. A session testing "the demo" published
  an invented listing onto the live board. Do not reintroduce a door there.
- **The invented world names no real place, organisation or phone number.**
  Flats sit on `Beispielstrasse`, organisations say `(erfunden)`, phones are
  `000 …`. A demo naming a real address points at a real building where real
  people live.
- Deployed by the `deploy-demo` job in `deploy.yml`, gated on the repo variable
  `AOZ_DEMO_DEPLOY`; the app row and the reset timer live in loki
  (`apps.conf`, `install-app-crons.sh`).
- The wipe keeps `_deploy_schema_history`; emptying it made the next deploy
  try to re-apply every migration.

**On production: claimable placeholder profiles.** What follows describes the
real instance, where invented rows were deleted on 2026-09-08.

**What was removed from production and why.** `lib/demo/seed-data.ts` invented 15 residents in
5 `DEMO-` units with incidents, expenses and a governance narrative, truncated
and re-seeded nightly at 04:05. Measured on the live database that morning:
**fabricated rows outnumbered real ones three to one** (15 residents vs 5, 5
units vs 118, 13 placements vs 4, 7 incidents vs 1). George's instruction was
"no fake data anytime anywhere". The rows were deleted in one transaction and
the `appcron-aoz-wohnen-reset-demo.timer` stopped and disabled, because
deleting seeded data while its re-seeding timer is armed buys you one night.

**What replaced it: CLAIMABLE PLACEHOLDER PROFILES.** The point of the old demo
was a lived-in flat to look at. The point of the new one is a flat somebody can
MOVE INTO. Seeded profiles carry a plausible first name and a real login code,
sit in real AOZ stock, and are marked `Resident.isPlaceholder`. When the person
who actually arrives registers with that code at `/register`, the flag clears
and the profile — with its placement, its flat and its history — is theirs.
Exactly the staff shape: the code is minted first, the human arrives later.

- **Real addresses, placeholder people.** `scripts/db/real/witikonerstrasse-426.ts`
  activates `WIT-426-01` and `WIT-426-03`, rows already in the database from
  AOZ's own stock import. Nothing invents an address. Seeded by
  `scripts/db/seed-placeholders.ts`, which REFUSES any flat holding a
  non-placeholder resident — real clients are never in a seed script's blast
  radius.
- **Neutral factors, always.** Not one seeded preference is a statement about
  anybody. Inventing that a placeholder sleeps lightly would feed fiction into
  the compatibility algorithm and back out as a recommendation staff act on.
- **A bed is left free on purpose.** A flat seeded to exactly full cannot
  demonstrate placing anyone, which is the product's whole subject.
- **`isPlaceholder` is PROVENANCE, not "has no account."** Four of the five
  real clients have never registered; deriving personhood from an
  `Account` would erase them from the people actually being served. The flag
  is set when the row is created and cleared when the code is claimed.
- **Every KPI excludes them** (`lib/analytics/real-data.ts`). This matters in a
  direction that is easy to miss: a seeded profile nobody is serving reads as a
  client with no labour-market contact and no German level recorded, so the
  more placeholders exist to show the product off, the WORSE the service looks
  in the numbers it is judged on.
- **Staff see "Platzhalter"** beside the name. Without it "Amir" reads exactly
  like a real client on the same list, and a Betreuerin could open a case for somebody
  who does not exist yet.
- **Server-driven buttons**: the login page asks `GET /api/auth/demo` which
  doors exist; there is **no build-time flag**, so a button appears only when
  pressing it can succeed. On production it answers no doors at all.
- **Testers see the Verwaltung side on the DEMO instance**, never here.
  George wants the staff side testable without an account; that is what
  demo.aoz.orangecat.ch is for. Sessions of deactivated users die immediately
  (`getCurrentUser()` re-checks `User.active`).

### Resident Portal

**What residents can do:**
- View their profile and preferences
- See current roommates
- Update preferences (triggers staff review)
- Report issues (goes to staff queue)
- Request transfer to different housing (goes to staff approval queue), **and
  read the decision when it comes back** — `/portal/transfer` loads the LATEST
  request whatever its status, not just a `PENDING` one. Filtering to `PENDING`
  meant every approval or denial vanished from the resident's view the instant
  staff made it, `staffNotes` included: they were told "du wirst benachrichtigt"
  and then never were. Same rule as reports — an answer stored and never
  rendered is the same as no answer.
- Manage chore assignments
- View help/FAQ

**Implementation:**
```
/portal             → Resident dashboard (redirects to /login if no code)
/portal/preferences → Update own preferences
/portal/roommates   → See current roommates
/portal/chores      → View/manage chore assignments
/portal/housing     → Browse available housing
/portal/transfer    → Request transfer (if placed)
/portal/report      → Submit issue to staff
/portal/help        → FAQ and help info
```

**Security considerations:**
- Codes are semi-public (like a hotel room number)
- Residents can only see/edit their OWN data
- Sensitive actions (transfers, incidents) go to staff for approval
- Rate limiting on code entry to prevent guessing

### Database Model

```
// src/lib/db/schema.ts (excerpt, Drizzle; shown here in Prisma-style shorthand)
model User {
  id           String    @id @default(cuid())
  code         String    @unique  // AOZ-XXXXXX login code — the identity
  name         String
  role         StaffRole @default(ADMIN)
  active       Boolean   @default(true)
  lastLoginAt  DateTime?
  account      Account?           // credentials, if this person claimed them
  // ...
  @@index([code])
}

// One human's credentials. Either side may be absent; both may be present,
// which is how one login carries both a staff and a resident role.
model Account {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String?            // null = known email, not claimed yet
  emailVerifiedAt DateTime?
  userId          String?   @unique
  residentId      String?   @unique
  authTokens      AuthToken[]
}
```

### Auth Status: FULLY IMPLEMENTED

| Component | Status | Location |
|-----------|--------|----------|
| Email+password login | Active | `src/lib/auth/account.ts` (`loginWithEmail()`) |
| Registration (claim code) | Active | `src/app/api/auth/signup/route.ts` + `/register` |
| Password reset | Active | `src/lib/auth/{account,tokens}.ts` + `/forgot-password`, `/reset-password` |
| Email verification | Active | `src/app/api/auth/verify-email/route.ts` |
| Unified code login | Active | `src/lib/auth/index.ts` (`loginByCode()`) |
| Staff JWT auth | Active | `src/lib/auth/jwt.ts` |
| Middleware enforcement | Active | `src/proxy.ts` (Next 16 renamed it from `middleware.ts`) |
| View as a colleague | Active | `src/lib/auth/impersonation.ts` + `/api/auth/impersonate` |
| Login page (unified) | Working | `src/app/(auth)/login/page.tsx` |
| Staff provisioning | Working | `src/app/api/auth/register/route.ts` |
| Rate limiting | Active | `src/lib/auth/rate-limit.ts` |
| Role-based access | Active | `src/lib/auth/role-policy.ts` |
| Portal code auth | Active | `src/lib/portal-auth.ts` |
| Session refresh | Active | Middleware handles sliding sessions |
| Audit logging | Active | `src/lib/audit.ts` |
| Role switching | Active | UserMenu + PortalNav show cross-links |

**To create initial admin:** Run `pnpm run db:seed:admin` (default code: `AOZ-ADMIN1`)

---

## Testing Strategy

### Unit Tests (Vitest) — 4065 tests in 240 files (verified 2026-09-07)

Representative coverage by area (not an exhaustive suite list):

| Area | Coverage |
|------|----------|
| Server actions | All CRUD actions for residents, housing, placements, incidents, maintenance, matching, satisfaction, spots, transfers |
| API routes | Auth (login, register, session, logout), portal (logout, chores, report, satisfaction, preferences, transfer), cron notifications, CSV export, CSV import |
| Compatibility | Algorithm, conversion, aggregate scoring, unit fit-concerns / blocking logic |
| Auth utilities | JWT (create/verify/refresh), rate limiting, role policy, route boundaries, code generation |
| Email | Templates (German content, structure), Brevo send service (retry/no-op), cron notifications (auth, triggering) |
| CSV export/import | CSV generation (papaparse), export routes (auth, content type), import routes (validation, duplicates) |
| Analytics | Unit metrics calculation |
| UI components | Dialogs (a11y), filters, BedGrid, style utilities |
| Config | Labels, formatting, factor config |

### E2E Tests (Playwright) — 201 tests, 18 specs (CI 2026-09-02)

- Auth flow (code-based login)
- Resident creation
- Matching workflow
- Incident reporting + detail
- Placement check-in
- Housing detail
- Dashboard
- Navigation
- Mobile responsiveness
- Accessibility

### Manual Testing

- Mobile responsiveness (real devices preferred)
- Screen reader accessibility
- Keyboard navigation

---

## Performance Guidelines

### Database

- Select only needed columns
- Use proper indexes (already defined in schema)
- Paginate lists (default 20 items)
- Avoid N+1 queries (use includes)

### Frontend

- Server components by default
- Client components only when needed (interactivity)
- Lazy load heavy components
- Optimize images with next/image

---

## Quick Reference

### Commands

```bash
pnpm run dev             # Development server (port 3000)
pnpm run build           # Production build
pnpm run db:generate     # Generate a migration from schema.ts changes
pnpm run db:migrate      # Run pending migrations
pnpm run db:push         # Push schema changes (development only)
pnpm run db:studio       # Database browser
pnpm run db:seed         # Seed demo data
pnpm run test            # Run Vitest tests (4065 tests, verified 2026-09-07)
pnpm run test:e2e        # Run Playwright tests (201 tests)
```

### Key Files

| Purpose | Location |
|---------|----------|
| Resident factors | `src/lib/config/resident-factors.ts` |
| Housing factors | `src/lib/config/housing-factors.ts` |
| Score thresholds | `src/lib/config/thresholds.ts` |
| German labels | `src/lib/constants/labels/` |
| Error messages | `src/lib/constants/error-messages.ts` |
| Compatibility calc | `src/lib/compatibility/index.ts` |
| Email service | `src/lib/email/service.ts` |
| Email templates | `src/lib/email/templates.ts` |
| CSV export | `src/lib/export/csv.ts` |
| Export column config | `src/lib/export/config.ts` |
| Transfer actions | `src/lib/actions/transfers.ts` |
| Auth guards | `src/lib/auth/index.ts` (`requireStaffAuth()`) |
| Route boundaries | `src/lib/auth/route-boundaries.ts` |
| Drizzle schema | `src/lib/db/schema.ts` |

---

## Don'ts

- Hardcode labels in JSX → Use `lib/constants/labels/`
- Hardcode error messages → Use `lib/constants/error-messages.ts`
- Hardcode factor options → Use `lib/config/`
- Track medical diagnoses → Track functional needs only
- Edit 5+ files for new factor → Should be 2 max
- Desktop-first CSS → Always mobile-first
- Skip mobile testing → Test at 375px minimum
- Use `any` type → Use proper types or `unknown`
- Commit without testing → Verify in browser
- Validate an id by its SHAPE → Use `idSchema` (see below)
- Throw a user-facing rule from a server action → Return it (see below)

---

## Server actions: return what the user must act on

⚠️ **A thrown error cannot be delivered.** `validateFormData` throws a
`ValidationError` carrying the sentence that names the field and the next step.
Nothing caught it, so React's error boundary rendered "Etwas ist
schiefgelaufen. Bitte versuchen Sie es erneut." AND unmounted the route,
destroying every field the user had entered.

The boundary cannot tell a system fault from a rule the user must read, so it
says the same thing to both. Therefore:

- **Return `{ error, fieldErrors }` for anything the USER must act on.** Throw
  only for genuine faults. `OpportunityFormState` is the pattern.
- **Put the `<form>` inside the client component that owns the values**
  (`useActionState`), never in the page. On a returned error the component does
  not unmount, so the store survives and the user fixes one field. With AI form
  fill this is the difference between one correction and fourteen.
- **`redirect()` works BY throwing.** Keep the fallible work in its own
  function so redirect is never called inside the `try` that would catch it —
  `expressInterest` / `publishOpportunityFromEdit` show the split.
- Where a throwing guard must stay because it is the real enforcement and a
  test pins it, wrap it at the button and pass the reason back as a URL param.

**This class hides other bugs.** Within an hour of fixing it, the first edit
attempted reported `id: Invalid cuid` — the entry below, which had made 96% of
all rows uneditable and had been invisible behind this same shrug.

## Ids: `idSchema`, never a shape assertion

⚠️ Every id field validated `z.string().cuid()` — cuid **v1**, which requires a
leading `c`. Prisma minted cuid v1, so it held. The Drizzle migration switched
generation to `@paralleldrive/cuid2` (`$defaultFn(createId)` in `db/schema.ts`),
whose ids begin with any letter. `.cuid()` accepts **70 of 2000** of them.

Measured on the live database 2026-09-04: **1 of 123** housing units, 5 of 20
residents, 6 of 17 placements and **0 of 4** maintenance requests could be
edited at all. The rows that still worked were the Prisma-era ones, so it read
as flakiness rather than a rule.

- **Use `idSchema`** (`z.string().min(1).max(64)`). An id is an opaque key: its
  shape proves nothing the row lookup and the permission check — which run
  anyway — do not already prove. Asserting it bought no safety and cost most of
  the database.
- **After ANY change to an id, key or token generator, grep for validators
  asserting the old shape.** The generator and its validator are two copies of
  one decision, and only one of them moved.
- **Test ids with the REAL generator, in bulk.** Every existing test used
  hand-written fixtures, and a fixture is written by the same person who chose
  the validator — it agrees by construction. `id-schema.test.ts` draws a
  thousand `createId()` values, because at a 3.5% pass rate a single draw looks
  like success.
- Legacy cuid v1 ids are still in the database and must keep working.

---

## Troubleshooting

### Schema changes workflow
1. Edit `src/lib/db/schema.ts`
2. Run `pnpm run db:generate` to create the migration in `drizzle/`
3. Run `pnpm run db:migrate` to apply it locally
4. Restart dev server

### "Column not found" errors after schema change
1. Run `pnpm run db:migrate` (the migration may not be applied yet)
2. Restart dev server

### Mobile nav not showing
- Check for `sm:hidden` / `hidden sm:flex` patterns
- Verify hamburger button has `sm:hidden`

### Compatibility scores seem wrong
- Check `lib/config/thresholds.ts` for current values
- Verify weights in factor config
- Check for blocking conflicts

---

**Last Updated**: 2026-08-25
