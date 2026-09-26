# Roadmap — from AOZ pilot to an integration operations system

Related: [Changelog](../CHANGELOG.md) · [Blog](blog/README.md) · [AOZ pitch](AOZ-PITCH.md) · [Integration research framework](./INTEGRATION-RESEARCH-FRAMEWORK.md)

created_date: 2026-01-15
last_modified_date: 2026-09-07
last_modified_summary: Marketplace ist geliefert, Rollen auf drei Achsen, angebotene Sprachen korrigiert.

## The thesis

Housing shortage in Zürich, New York, San Francisco — and weakening family
structures everywhere — mean more people who are **not related to each other
sharing territory**: rooms, apartments, buildings, subdivisions. Wherever two
people share territory, there must be a common understanding of how living
together works. Today that understanding lives in gut feeling, paper
Hausordnungen, and staff who firefight conflicts after they explode.

The product is an **integration operations system for Fachpersonen** with
housing stability as the base layer: who lives where (placement & vacancy), who
fits whom (compatibility matching), what the rules are (layered governance),
what happens when stability breaks (conflict ladder, maintenance, incidents),
and how language, capability, participation and coordinated guidance progress
over time. AOZ asylum housing is the first vertical — deliberately the hardest
one: vulnerable residents, high conflict cost, strict privacy duties, and
published research to build on. A system that works there works anywhere.

The scientific basis is now broader than cohabitation alone: see
`docs/INTEGRATION-RESEARCH-FRAMEWORK.md` for the product's five research pillars
(housing stability, language/orientation, capability/work readiness,
participation, and coordinated guidance).

**Not the mission:** maximizing occupancy or throughput at the cost of
wellbeing. Reduced conflict *is* the business case (see CLAUDE.md ROI
figures); dignity, transparency and data minimalism are the moat, not the
constraint — property managers buy risk reduction, and residents only feed
the matching system honest data if it never punishes honesty.

## What generalizes (and already does)

The architecture bet is that **verticals are config packs, not forks**:

| Layer | Mechanism today | Generalization |
|---|---|---|
| Branding | `BRAND` presets (`aoz`/`aozh`/`wg`) | Org-level theming, `orgName` separate from product |
| Rules | `ORG_RULE_CATALOG` + delegation (`FIXED` / `UNIT_MAY_STRENGTHEN` / `UNIT_DECIDES`) | Any org's rulebook is a catalog seed; the delegation hierarchy models campus→building→unit→room |
| Matching | Factor configs with weights (`resident-factors.ts`) | Per-vertical factor packs (student, senior, coliving) |
| Space | Unit → room → spot hierarchy | Shared rooms (student/army), whole units, buildings, subdivisions |
| Money | Pure Rappen-integer expense engine | Currency is a formatting concern; engine is portable |
| Reports | Category → desk routing | Desk set is org config |

## Horizons

### H1 — Win the AOZ pilot (now → Q4 2026)

The only thing that matters: **prove the metrics** (incidents −30%,
relocations −50%, mediation hours −40%) at 1–2 locations against the
baseline. Everything in H1 serves that.

- ✅ Real deployment (the pilot flat), demo doors, governance,
  expenses, report routing.
- ✅ Signed Hausordnung as the in-app org rule catalog, with per-version
  acknowledgement — done (see changelog).
- ✅ AOZ vs WG surfaces (nav, expenses/votes, code-first login, fast matching).
- ✅ Staff roles on THREE orthogonal axes: care domain (Betreuung, Sozialarbeit, Jobcoach, Freiwilligenarbeit, Liegenschaften), scope (own domain / all domains) and isSystemAdmin. `ADMIN` is retired and unassignable.
- ✅ Learning records (tests, courses, informal) for residents and Jobcoach.
- ✅ Learning achievements and volunteering/community-service hours; language offers reuse Aktivitäten.
- ✅ Role-shaped integration evidence boards: overview, Jobcoach, and Freiwilligenarbeit with filters for own clients, source, status, and category.
- ✅ Care team (Wohnen, Sozialarbeit, Jobcoach, Freiwilligenarbeit) visible to the resident.
- ✅ Care workspace: appointments and catalog attributes per domain; one login can carry both a staff and a client identity.
- ✅ Portal chrome: collapsible sidebar + header account/language; dead Wohnung/Mitbewohner pages removed.
- ✅ Room-level matching and a short intake as the default.
- ✅ Locale packs offered once COMPLETE: DE, EN, FR, UK, RU, AR. Farsi, Tigrinya, Turkish, Albanian and Somali exist in the repo and are deliberately NOT offered — half a portal in your language is worse than all of it in German, because you cannot tell which half you are missing.
- ✅ Baseline/outcome dashboard on the staff home and analytics.
- Close the loop from incidents to matching: recorded conflict outcomes
  feeding the risk dimension per factor pair (transparent weights, no black
  box — every score explainable in German). Wait for AOZ outcome data.
- Acknowledgement coverage as the leading indicator on the staff dashboard.

### H2 — Multi-tenancy without forks (2027)

One deployment currently serves one org. The multibillion path requires one
*platform* serving many:

- **Organization as a first-class row** (not env config): rule catalog,
  contact sheet, factor weights, brand, locale per org. `organization.ts`
  and `house-rules.ts` become per-org seeds — the code paths already read
  them as data.
- **Property hierarchy**: org → property → unit → room → spot, with rule
  delegation at every level (a building Hausordnung between org floor and
  house rules — the AOZ paper document already implies this level).
- **i18n**: resident chrome has locale packs (DE/EN/FR vouched; AR, FA, TI,
  UK, RU, TR complete). Swiss High German stays the binding Hausordnung
  text. Incomplete files (sq, so) stay hidden.
- **Vertical factor packs**: student housing (semester rhythm, study/party
  axis), coliving (profession, guest frequency), senior co-housing
  (care-adjacent functional needs — never diagnoses).
- Self-serve onboarding for small operators (a WG can already run it — the
  live instance proves it; make that a product, not a favor).

### H3 — The network (2028+)

- **Resident-consented portable profiles**: preferences travel with the
  person across orgs (they, not the org, own their compatibility profile).
- **Portable community across sites**: the marketplace SHIPPED (goods and
  services, deliberately with no price field); what is still ahead is carrying
  it beyond a single Standort.
- **Outcome dataset as a public good**: anonymized, aggregate conflict/
  compatibility research back to the field the product came from.
- Vacancy network across operators in one city — minimizing vacancies
  city-wide, matching people to *homes*, not just beds.

## Engineering invariants (any horizon)

1. Verticalization by config, never by fork. If a new customer needs a code
   change beyond a config pack, the architecture lost.
2. Every score explainable in the resident's language. No black boxes —
   trust is the product.
3. Track functional needs only; never diagnoses, immigration status,
   religion, politics. Data minimalism scales trust across verticals.
4. Money is integers, balances are computed over full history, votes
   snapshot their policy — auditability everywhere a dispute can happen.
5. Safety is never put to a vote, and safety conflicts never enter the
   ladder at the bottom.
