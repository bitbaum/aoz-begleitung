/**
 * Who may see which of a client's own admin facts, and what "confirmed" means.
 *
 * These facts exist because extending an insurance every six months, or getting
 * a dentist appointment, meant writing to your Betreuerin and waiting. Putting
 * them in the client's profile only helps if the rules around them are as
 * careful as the reason they were kept out until now.
 *
 * Three rules, all load-bearing.
 *
 * 1. NEVER AN INPUT TO A DECISION. CLAUDE.md forbids tracking anything that
 *    could be used for discrimination. The mechanism of that harm is a field
 *    the placement algorithm, the KPIs or a staff filter can see. So these
 *    facts are readable by a person looking at one client, and by nothing that
 *    ranks, scores, sorts or aggregates. Enforced by
 *    `__tests__/never-an-input-to-a-decision.test.ts`, not by good intentions.
 *
 * 2. PER FACT, NOT PER PERSON. A Jobcoach needs the permit — it decides which
 *    work is lawful, and `permitRequirement` on an opportunity is already a
 *    claim about exactly this. A Jobcoach has no business seeing which doctors
 *    someone visits. One blanket "care team" grant would have handed over both.
 *
 * 3. CONFIRMED MEANS SEEN, NOT TRUE. The all-domains Betreuerin cannot ring the insurer to check
 *    a policy number. A product that implied they had would be asserting
 *    something about a person's insurance or permit that it cannot know — the
 *    same failure as an opportunity defaulting to "Keine Bewilligung nötig".
 *    Every label for this state says *geprüft*, never *gültig*.
 */

import type { CareRoleId } from '@/lib/config/care'

export const CLIENT_FACT_KINDS = ['INSURANCE', 'HEALTH_CONTACT', 'PERMIT'] as const
export type ClientFactKind = (typeof CLIENT_FACT_KINDS)[number]

export const CLIENT_FACT_STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED'] as const
export type ClientFactStatus = (typeof CLIENT_FACT_STATUSES)[number]

/**
 * The care domains that may read each kind of fact.
 *
 * VOLUNTEERING is absent everywhere on purpose: volunteering is the channel
 * this product deliberately keeps free of permit questions, so a coordinator
 * has no reason to hold any of it. Minimum data is a rule here, not a default.
 */
export const CLIENT_FACT_READERS: Record<ClientFactKind, readonly CareRoleId[]> = {
  INSURANCE: ['HOUSING', 'SOCIAL'],
  HEALTH_CONTACT: ['HOUSING', 'SOCIAL'],
  // The Jobcoach is here and only here: which work is lawful is their job.
  PERMIT: ['HOUSING', 'SOCIAL', 'JOB'],
}

/** The domains that may CONFIRM a fact. Reading a permit is not vouching for it. */
export const CLIENT_FACT_REVIEWERS: readonly CareRoleId[] = ['HOUSING', 'SOCIAL']

export interface FactViewer {
  /** ALL_DOMAINS sees every client; OWN_DOMAIN sees the seats they hold. */
  scope: string
  /** The care seats this viewer holds FOR THIS CLIENT. Empty means none. */
  seatsForClient: readonly CareRoleId[]
}

/**
 * May this staff member see this kind of fact about this client?
 *
 * `ALL_DOMAINS` is oversight over every care domain, which is what the all-domains Betreuerin
 * holds — it answers "whose files may I open", so it carries here. It is NOT a
 * system-admin grant: `isSystemAdmin` deliberately gives nothing, because
 * configuring the product is not a reason to read someone's insurance.
 */
export function mayReadFact(kind: ClientFactKind, viewer: FactViewer): boolean {
  const readers = CLIENT_FACT_READERS[kind]
  if (viewer.scope === 'ALL_DOMAINS') return true
  return viewer.seatsForClient.some((seat) => readers.includes(seat))
}

/** May this staff member record that they have SEEN this fact? */
export function mayReviewFact(kind: ClientFactKind, viewer: FactViewer): boolean {
  if (!mayReadFact(kind, viewer)) return false
  if (viewer.scope === 'ALL_DOMAINS') return true
  return viewer.seatsForClient.some((seat) => CLIENT_FACT_REVIEWERS.includes(seat))
}

/** The kinds this viewer may see for this client, in a stable order. */
export function readableFactKinds(viewer: FactViewer): ClientFactKind[] {
  return CLIENT_FACT_KINDS.filter((kind) => mayReadFact(kind, viewer))
}

/**
 * How long before an expiry the product should start saying something.
 *
 * Sixty days because a Swiss insurance change has a notice period and a permit
 * renewal needs an appointment — a warning that arrives in the last week is a
 * warning about something already too late to do calmly, which is the exact
 * situation this feature exists to end.
 */
export const RENEWAL_NOTICE_DAYS = 60

/** Days until `validUntil`, or null when nothing is dated. Negative = expired. */
export function daysUntil(validUntil: Date | null, now: Date): number | null {
  if (!validUntil) return null
  const msPerDay = 24 * 60 * 60 * 1000
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const end = Date.UTC(
    validUntil.getUTCFullYear(),
    validUntil.getUTCMonth(),
    validUntil.getUTCDate(),
  )
  return Math.round((end - start) / msPerDay)
}

export type RenewalState = 'none' | 'ok' | 'due' | 'expired'

/**
 * Whether a dated fact needs attention.
 *
 * `none` for an undated fact — a health contact never expires, and an insurance
 * whose date the client does not know yet must not read as a problem with them.
 */
export function renewalState(validUntil: Date | null, now: Date): RenewalState {
  const days = daysUntil(validUntil, now)
  if (days === null) return 'none'
  if (days < 0) return 'expired'
  return days <= RENEWAL_NOTICE_DAYS ? 'due' : 'ok'
}
