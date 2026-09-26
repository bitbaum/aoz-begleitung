# Roadmap

Related: [Changelog](../CHANGELOG.md) · [Blog](blog/README.md) · [Integration research framework](./INTEGRATION-RESEARCH-FRAMEWORK.md)

created_date: 2026-01-15
last_modified_date: 2026-09-26
last_modified_summary: Rewritten for the person-centred product and the people who fund and run this work. Investor framing removed; pilot targets are stated as hypotheses the pilot tests; language status corrected (6 offered, 3 speaker-reviewed).

## What this is for

People who arrive in Switzerland through the asylum system spend months or
years in accommodation run by an operator on behalf of a city, a canton or the
Confederation. What happens there — whether a house is calm, whether someone
gets an answer, whether they take a first step into language and work — shapes
how the rest of their life here goes, and what it costs everyone.

This product is the everyday layer of that work: who is waiting for an answer,
how each person is doing, where they could go next, who lives with whom, and
how a house settles its conflicts. It sits beside an operator's
case-management system and gives residents a portal in their own language.

**Not the goal:** occupancy, throughput or fewer staff. The goal is that the
time staff have goes to people rather than to searching and firefighting — and
that the difference can be measured.

## How we will know whether it helps

Measured in a pilot, against a baseline, not asserted:

| Question | Measure | What the product can do about it |
|---|---|---|
| Are houses calmer? | Incidents per 100 resident-months; conflict-related moves | Influence (matching, conflict ladder, house rules) |
| Do people get answers? | Median time from request to first staff answer | Influence (Eingang) |
| Do people take steps? | Documented language and work/volunteering steps per quarter | Contribute |
| Are staff relieved? | Minutes spent on documentation and searching, sampled | Influence |
| Do residents feel heard? | Short anonymous survey in their language | Contribute |

The targets written into earlier versions of this page (−30 % incidents,
−50 % relocations, −40 % mediation hours) are **hypotheses**, not results. A
pilot that finds no improvement is a valid result and will be reported as one.

## Now (to end of 2026)

Done:
- Person-centred staff navigation: Eingang, Klient\*innen, Einsatzplätze &
  Angebote, Wohnen, Zusammenleben.
- Eingang: every request a resident raised reaches everyone who may answer it,
  with a one-press "Übernehmen".
- Einsatzplätze: AI-assisted entry from a pasted advert (permit route and
  publishing stay human), one catalogue with activities, one-tap interest in
  the portal.
- Household fit notes instead of per-person problem flags; no religion or
  origin proxies in matching.
- Resident portal offered in 6 languages: German, English and French reviewed
  by speakers; Ukrainian, Russian and Arabic complete and marked as
  machine-assisted. Farsi/Dari, Tigrinya, Turkish, Albanian and Somali are in
  progress and not offered until complete.
- A no-account demo on its own instance with invented data.
- AI use disclosed at `/ki-datenschutz` and wherever staff meet it.

Next:
- Pilot measurement tooling: baseline import, staff time sampling, an
  anonymous resident survey, aggregate-only reporting (no cell below six
  people).
- Human review of the portal languages most asylum seekers read — Tigrinya
  and Dari first.
- Impressum and privacy statement; a subprocessor list.

## Later (2027)

- One installation serving several operators, each with its own data,
  rule book and settings — needed before a second organisation uses it.
- Hosting in Switzerland and an AI model under a data-processing agreement
  (or AI switched off) before real data is processed in regular operation.
- CSV exchange with the case-management systems operators already use.
- Aggregated indicators aligned with the Integrationsagenda Schweiz, for the
  city, canton and integration offices — never personal data.

## Engineering invariants

1. Every score is explainable; the product recommends, a person decides.
2. Functional needs only — never diagnoses, asylum-procedure details,
   religion, politics or origin.
3. No verdicts about individuals from counts; aggregates only for reporting.
4. Money is integers, balances are computed over full history, votes
   snapshot their policy.
5. Safety is never put to a vote, and safety conflicts never start at the
   bottom of the ladder.
