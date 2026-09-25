# Walking the product as the three people who actually use it

**Date:** 2026-08-31 · **Against:** production (`aoz.orangecat.ch`), real data
**Accounts created that day:** a Betreuerin with reach over every domain, a Jobcoach, a Freiwilligenarbeit coordinator

This is what happened when the real AOZ team was provisioned for the first
time and each account was signed into and used. It records what held, what
broke, and what was changed as a result. It is deliberately written as
findings rather than a checklist — a checklist tells you what was looked at, a
finding tells you what was true.

---

## The team, as the product now describes them

Three orthogonal facts per person (`role` · `scope` · `isSystemAdmin`):

| Person | Role | Scope | System admin |
|---|---|---|---|
| Betreuerin (all domains) | `BETREUUNG` | `ALL_DOMAINS` | no |
| Jobcoach | `JOBCOACH` | `OWN_DOMAIN` | no |
| Freiwilligenarbeit coordinator | `FREIWILLIGENARBEIT` | `OWN_DOMAIN` | no |

The all-domains Betreuerin's row is the one that was previously unsayable. Before the split,
"a Betreuerin who also sees every client" could only be written as `ADMIN`,
which erased that housing is that person's domain **and** handed them the settings page
as a side effect. The role is now true and the breadth is stated separately.

**Nobody on the care team administers the product.** Running the house is not
configuring the software. That stays with the operator account, and granting
it is a deliberate one-line change rather than something a care role implies.

**There is no Sozialarbeit staff member.** `ensure-aoz-team.ts` prints this
rather than leaving the seat quietly empty — an unstaffed domain looks
identical to a staffed one nobody has used yet. The SOCIAL seat is covered by
the all-domains Betreuerin's oversight.

Provisioning lives in `scripts/db/real/aoz-team.ts` (config) +
`scripts/maintenance/ensure-aoz-team.ts` (idempotent, matches by name, so it
is also how a reach is corrected later). Codes are generated at run time and
printed once — never committed, for the same reason the real apartment's
resident codes are not.

---

## What held

Everything below was verified by signing in, not by reading code.

**The domain boundary is real, at every layer that matters.**

| | Betreuerin (all domains) | Jobcoach | Freiwilligenarbeit coordinator |
|---|---|---|---|
| Nav areas | 20 | 9 | 11 |
| Care seats on a client | all 4 | Jobcoach only | Freiwilligenarbeit only |
| Seat pickers rendered | 4 | **1** | 1 |
| Einstellungen in nav | no | no | no |

The Jobcoach opening a client sees one `staffId` select, not four disabled ones. The
`CareWorkspace` boundary is an access boundary rather than a form with some
inputs greyed out — a job coach never reads Housing's "Schlüssel: fehlt" or
Sozialarbeit's next step.

**Scope limits which care seats you can work, not which clients you can list.**
The Jobcoach sees all 19 clients and can open any of them; what the Jobcoach cannot do is read
or write another discipline's notes on them. This is the intended reading of
`OWN_DOMAIN`, and CLAUDE.md's shorthand "whose files may I open?" is looser
than the behaviour.

**A specialist is not deadlocked.** The Jobcoach's "Meine Klient*innen" filter shows
0, but can assign their own seat from any client's Betreuungsteam panel. The
onboarding gap was discoverability, not permission — see below.

**The resident portal is in good shape.** Signed in as Fatima: personalised
greeting, unit with compatibility and house rules, "Dein Team" naming all four
domains, a working "Gespräch anfragen", open chores, roommates, a shared-
expense balance (`CHF 19.35`), her own marketplace listings and her reports —
in six languages, under "Mein Bereich" (the AOZ register, correctly not
"Mein Zuhause").

---

## What broke

### 1. Any signed-in colleague could read every staff login code

**Severity: high. Fixed in PR #135.**

Signed in as the Jobcoach — `JOBCOACH` / `OWN_DOMAIN` / not an admin, the narrowest
real role in the product — and typed `/settings`.

The nav correctly omitted the link. The route served the whole page anyway,
including a roster of every colleague's login **code**: `AOZ-ADMIN1`,
`WG-DEMO01`, and all three new accounts.

A staff code is not an identifier, it is the credential — `loginByCode` takes
it alone, with no password. So the narrowest role could read the system
administrator's code and sign in as them. Privilege escalation by typing a URL.

**Why it survived, which is the part worth keeping:** the page was not
careless. It gated the invite form and the config fields behind permissions.
Gating the *write* affordances looks like access control and reads as
thorough, while the page and its payload stay wide open. A write gate is not a
read boundary; a hidden link is not a gate.

Worse, an E2E test **required a staff code to be visible** on that page. The
suite called the vulnerability the passing state.

Fixed three ways, none redundant:

- `/settings` requires `system:configure`.
- The query stops **selecting** `code` at all. Even an administrator has no
  reason to read a colleague's credential — they can invite, deactivate and
  re-issue without ever seeing it. Removing it from the JSX alone would have
  left it in the server payload; the payload is what leaks, not the markup.
- The roster now shows role · reach · administration, which is what an
  administrator actually needs to know about a colleague.

Class closed by `admin-page-guards.test.ts`: every page under `(admin)` must
either enforce a permission or appear on an explicit *session-is-enough* list,
so a new admin page fails the suite until someone states what it requires.

### 2. A freshly seeded instance had no system administrator

**Fixed in PR #134 before merge.**

Caught by CI's E2E job, which `npm run verify` structurally cannot replace.
Splitting one enum into three columns invalidated all five staff-row creation
sites at once: the same `role: 'ADMIN'` line now yields the column *defaults*.
The migration backfilled rows that already existed; **seeding is the other way
an admin is born**, and it runs after the migration — so every newly created
database came out with nobody able to open the settings page.

Closed by `staff-row-states-its-reach.test.ts`, which discovers every creation
site by scanning and requires each to state its reach. Two blind spots were
found while building it and are pinned in the file: it read comments as code
(reporting the fix's own documentation as the offender), and it matched
`role:` but not the shorthand `role,` — which hid the one site still taking
the defaults.

### 3. The two specialists were congratulated on their first login

**Fixed in PR #137.**

The Jobcoach and the Freiwilligenarbeit coordinator each opened their first ever session and were shown
**"🎉 Alles unter Kontrolle! Keine dringenden Aufgaben"** — over an account
connected to no one.

`workspaceState` already distinguishes "nothing yet" from "nothing right now",
and `dashboard.ts` calls collapsing them "the single most misleading screen a
new AOZ team could be handed". It measures emptiness with a **global**
resident count, deliberately, so a Jobcoach is not told the workspace is empty
while 19 people sit in it. The consequence is that the same confusion returns
one level in: a specialist nobody has assigned is indistinguishable from a
specialist who has finished.

Added a fourth state, `unassigned`, as a separate axis rather than a
redefinition of the global count. It is neutral, never a tick, and it names
*where* the seat is filled — the Betreuungsteam panel on a client's page,
which is not somewhere you would guess from a dashboard. Real work outranks
it, so a specialist holding a critical incident sees the incident.

### 4. CLAUDE.md's brand block was wrong in both halves

**Fixed in PR #135.**

It named `aozh` the default while `DEFAULT_BRAND_ID` is `aoz`, and said the
live instance runs `wg` when the box says `aoz`.

That combination is worse than either error alone. The brand decides
`codePrefix`, and a maintenance script minting a staff code on a laptop takes
the **default** when `NEXT_PUBLIC_BRAND` is unset — which it always is
locally. The three codes issued that day came out `AOZ-` and were correct, but
only because the default happens to equal what production is set to. Believing
the live brand was `wg` would have made a correct result look like a bug to go
and "fix", issuing genuinely wrong codes to three real people.

A code outlives the brand that issued it and cannot be re-prefixed.
`ensure-aoz-team.ts` now refuses to mint unless the deployment's brand is
carried across, rather than guessing.

### 5. `/analytics` handed the smiley-faces problem to every role through a side door

**Fixed in PR #140.**

Signed in as the Freiwilligenarbeit coordinator (`FREIWILLIGENARBEIT` / `OWN_DOMAIN`) and opened
`/analytics` — reachable to that account because it requires only `dashboard:read`,
which every role holds, correctly, since most of the page is aggregate pilot
health (occupancy rate, satisfaction trend, conflict hotspots, algorithm
accuracy). One section is not aggregate: `RecentPlacementsTable` names
residents, links straight into their profile, and renders their satisfaction
check-in emoji — the exact surface `/placements` fences off behind
`placements:read`, which the Freiwilligenarbeit coordinator does not hold and never could reach directly.

Gating only the page and rendering that table unconditionally bypassed the
fence entirely. This is the identical concern that opened this whole
refactor — *"the employee sees smiley faces like they are client? really?"*
— resurfacing through a page the earlier fix never touched: the boundary was
built for `/placements`, and `/analytics` independently queried and rendered
the same underlying data without checking it.

Fixed on both halves, same discipline as `/settings`: the **query** is
conditioned on `placements:read`, not just the render — an unconditional
query still puts the data in the process even if the JSX hides it. Verified
live as the Freiwilligenarbeit coordinator: the section is now absent, not empty.

Class closed by extending `admin-page-guards.test.ts` to check both halves
are conditioned, mutation-proven against the exact shape that shipped.

---

## Deeper passes (the Freiwilligenarbeit coordinator, and the resident portal past the overview)

Marketplace, events, and Einsatzplätze all render correctly for the Freiwilligenarbeit coordinator with
the boundaries intended — no create-listing affordance on the marketplace
(residents post, staff moderate), an inline event-creation form scoped to
`events:write`, and the Einsatzplätze empty state correctly offering a create
button rather than a false "nothing to do here."

Signed back in as Fatima and exercised, rather than just observed:

- **Chores** — the fairness panel deliberately shows actual minutes rather
  than a ranking ("Fast alle überschätzen den eigenen Anteil...").
- **Expenses** — the balance math checks out exactly: four residents' balances
  sum to zero, and the settle-up plan (`simplifyDebts`) nets to precisely each
  person's balance.
- **Marketplace claim** — clicked "Ich nehme es" on a real listing; it moved
  to ÜBERNOMMEN with "Übernommen von: Fatima" immediately.
- **Decisions/voting** — cast a vote on a live ballot; the tally moved from
  3/4 to 4/4 and the UI correctly offered to change the vote while voting is
  open. The `STAFF_ONLY` gate held too: "Zweiter Schlüssel für den Veloraum"
  showed "Die Betreuung entscheidet", never a vote threshold.
- **Reports** — "Meine Meldungen" showed both an open report and a resolved
  one carrying the staff's actual answer, confirming the
  `mergeResidentReports()` fix holds live, not just in tests.

No new defects found in this pass — the resident-facing side held up under
actual use, not just inspection.

---

## Still open

Recorded rather than fixed, because each is a decision rather than a defect.

- **"Leitung" survives in the UI, and one instance of it was a real leak.**
  Reviewed on 2026-08-31: the settings roster and the demo door both label an
  account "Leitung" whenever `role === 'ADMIN'` — that's a true statement
  about the enum value on the row (`ROLE_LABELS.ADMIN`), not a claim that AOZ
  employs someone with that title, so both were left alone.

  `emptyNoSetupRights` was different — it told a Jobcoach or Freiwilligenarbeit
  account opening a genuinely empty workspace to wait for **"die Leitung"** to
  enter the first housing and clients. That names a person who does not exist
  at AOZ (the real team holds Betreuung/Jobcoach/Freiwilligenarbeit;
  ADMIN survives only as the retired system-administrator seat). Fixed to name
  the CAPABILITY instead of a job title — "jemand mit Zugriff auf Unterkünfte
  oder Klient*innen" — so it stays true regardless of who is actually staffed,
  on this deployment or after a rebrand.
- **The all-clear phrase appears twice** on a quiet dashboard — once in the
  greeting line ("Alles unter Kontrolle heute.") and once as the panel
  headline ("Alles unter Kontrolle!"). Reviewed on 2026-08-31 and left as-is:
  unlike the empty/unassigned bugs, both instances state a TRUE fact — this is
  stylistic (small muted line, then a celebratory card), not misleading. The
  header subtitle is symmetric across all four workspace states and the
  panel's own heading is needed for the same structural reason
  `EmptyWorkspaceState` and `UnassignedWorkspaceState` each have one; removing
  either loses something. Worth a copy pass later, not a fix.
- **`residents/[id]` has no page-level permission**, gating each section
  individually instead. Listed in the session-is-enough set so the choice is
  written down.
- **No notification path to residents.** An answer stored is still only an
  answer read if someone opens the page.
