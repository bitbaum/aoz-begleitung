# Demo guide

created_date: 2026-01-24
last_modified_date: 2026-09-26
last_modified_summary: The demo is back on the main site (George's decision): invented people beside the real flat, removed nightly by a scoped reset that never touches a real row. The separate demo instance is retired.

The demo is **the real product, with invented people living beside the real
flat**. What a visitor clicks is what staff use.

## The doors

On <https://aoz.orangecat.ch/login#demo>. The page asks the server which doors
exist, so a button only appears when pressing it can succeed. There is one door
per staff role (Leitung, Betreuung, Sozialarbeit, Jobcoach, Freiwilligenarbeit,
Liegenschaften) plus the Klient\*in portal.

- **No account needed**, and none should be — that is the point.
- **Every invented person, flat, organisation and phone number says so:** flats
  sit on `Beispielstrasse` with `DEMO-` codes, organisations are marked
  `(erfunden)`, phones are `000 …`.
- **Reset every night at 04:05.** Only invented rows are removed and re-created
  — whatever a visitor changed on them, and any listing posted through a demo
  door. Real residents and the real flat are never touched.
- **The Klient\*in door opens an invented resident**, never a real one.
- **The staff doors see the whole product**, the real flat included. That is
  deliberate: testers should see what staff see.

## What the demo is actually showing

Lead with the problem, not the algorithm. Placement is the base layer, not the
product:

1. **Stability** — who lives where, who fits whom, and what happens when it
   breaks: the conflict ladder, incidents, maintenance.
2. **Capability** — Einsatzplätze, learning records, what a person can show an
   employer.
3. **Participation** — house rules the household actually votes on, chores,
   shared expenses, the marketplace.
4. **Guidance** — one care team across domains, appointments, and the client's
   own record: insurance, health professionals, permit.

Every score is explainable, and that is the point worth making out loud: open a
placement and it says *why this home*; open the match list and it says what
ranked it. `/algorithm` documents the dimensions and their weights.

## The narrative is code, not prose

The seeded story lives in `src/lib/demo/seed-data.ts` and
`src/lib/demo/seed-governance.ts` — five units, fifteen residents, incidents,
expenses, chores with an uneven completion record, and proposals at every
stage. Read those files rather than a script that paraphrases them; a
paraphrase is what let the previous version of this guide go stale.

Two details in the seed are deliberate and worth knowing before you present:

- **A vote is already open, backdated.** Voting opens only after a three-day
  discussion window and the world is wiped nightly, so a proposal created fresh
  could never reach a ballot in a demo. One seat is left empty on purpose — the
  visitor casts the deciding vote.
- **Outcome text comes from the real `tallyVotes()`.** A demo that explained a
  result differently from the product would be a demo of something that does
  not exist.

## What NOT to say

- ~~"This is our intelligent matching system."~~ It undersells the product by
  about four fifths, and it is the framing this guide used to open with.
- Do not quote resident codes from memory. The demo prefix follows the brand
  (`KL-DEMO…` on the AOZ brand, `RES-DEMO…` historically); Ahmed, the unplaced
  client in the placement story, is `KL-DEMO14` on the demo instance, not the
  `RES-AH014` this guide claimed for months.
- There is no ROI dashboard route. Pilot evidence lives on `/analytics`.

## Running it locally

```bash
pnpm install
pnpm run dev            # port 3000
pnpm run db:seed        # demo data
```

`pnpm`, not `npm` — the fleet has one package manager.
