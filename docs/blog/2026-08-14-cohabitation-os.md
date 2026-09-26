# An operating system for living together

*2026-08-14*

Housing is scarce in every city that matters, and the family structures that
used to absorb that scarcity are thinner than they were. The result is a
quiet demographic fact: more and more people share territory with people
they are not related to — a room in student housing, an apartment in a WG,
a floor in asylum accommodation, a building, a subdivision.

Wherever two people share territory, there has to be a common understanding
of how living together works. Today that understanding is improvised. The
right people living together unlock each other — language practice, shared
meals, someone who notices when you're not okay. The wrong people living
together are devastating: mental health, physical health, property damage,
staff burnout, churn. Conflicts in cohabitation are more frequent than
anyone likes to admit, and almost all of them are *predictable* — a night
worker placed with an early riser, a smoker with asthmatics, two people
with irreconcilable ideas of "clean."

## Why asylum housing first

We built the first vertical for AOZ's asylum housing in Zürich, and that
was not a compromise — it was the point. It is the hardest version of the
problem: residents under maximum stress, zero choice in roommates, strict
privacy obligations, real research literature on refugee housing conflict
to build on, and a cost of failure measured in human harm, not just churn.
A matching-and-governance system that holds there will hold in student
housing, coliving, army barracks or a condo association.

It also forced the right values into the architecture, where marketing
can't dilute them:

- **Explainability over accuracy theater.** Every compatibility score
  decomposes into named factors with visible weights, in the resident's
  language. Staff overrule the algorithm freely — and the override is
  logged, not hidden.
- **Data minimalism as product design.** No diagnoses, no case details, no
  religion. Functional needs only ("ground floor", "quiet after 22:00").
  Residents feed honest data into matching only if honesty can never be
  used against them.
- **Safety is not majoritarian.** A house can vote on kitchen rules; it
  cannot vote away a minority's safety. The decision-mode config makes
  that structural, not editorial.

## What "operating system" means concretely

Five loops, one product:

1. **Placement** — who lives where; vacancies minimized *subject to*
   compatibility, never the other way around.
2. **Matching** — config-driven factors (sleep, noise, directional
   cleanliness, language, risk) scoring person×household, worst-pairing
   first, blocking conflicts hard-stopped.
3. **Governance** — layered rules: the organization's floor, the house's
   own legislation underneath it, per-version acknowledgement so nobody is
   held to text they never saw. (As of today, the org tier is the literal
   signed AOZ Hausordnung — see the companion post.)
4. **Money & work** — shared expenses in integer Rappen, chore fairness,
   full-history balances.
5. **Repair** — maintenance to the desk that fixes it, conflicts onto a
   ladder that starts with talking and ends in agreements with review
   dates — escalation is a signal, not a punishment.

The architectural bet that makes this a platform rather than a bespoke AOZ
tool: **verticals are config packs, not forks.** The brand is config. The
rule catalog is config. The factor weights are config. The contact sheet is
config. The same codebase already runs three presentations — AOZ-badged,
neutral, and a real Zürich shared flat — and the day another organization
arrives, it should bring a seed file, not a fork.

Where this goes — multi-org tenancy, portable resident-owned compatibility
profiles, a cross-operator vacancy network — is in the
[roadmap](../ROADMAP.md). But the order matters: first, measure at one or two
locations whether placements informed by compatibility cut incidents,
relocations and mediation hours — and report the result either way.
Everything else rests on one boring, verifiable sentence: *the conflicts
stopped happening.*
