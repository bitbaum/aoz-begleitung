/**
 * What each care domain is actually trying to move — and how we would know.
 *
 * ## The asymmetry this closes
 *
 * `mission-kpis.ts` implements the four numbers from CLAUDE.md's pilot table:
 * conflicts, relocations, mediation hours, placement time. Every one is
 * HOUSING. Walked live on 2026-09-03, the Jobcoach and the Freiwilligenarbeit coordinator
 * (Freiwilligenarbeit) can both open `/analytics` and not one metric on it is
 * about their work — while labour-market integration is half of what AOZ is
 * measured on by its funder.
 *
 * So a coach had no answer to "is this month better than last month", and no
 * way to argue for their own caseload. That is not a reporting gap; it decides
 * what gets attention.
 *
 * ## Why these numbers and not others
 *
 * Each KPI below names the sources in `JOB_RESEARCH_SOURCES` that justify it.
 * The rule is the same one `job-integration-docs.ts` sets: a metric with no
 * evidence behind it is a hunch wearing a citation, and a principle with no
 * metric is decoration.
 *
 * Two design choices worth defending:
 *
 * **Leading, not lagging.** The Integrationsagenda's own Wirkungsziele are at
 * five and seven years — real, binding, and useless as a work signal, because
 * nobody can steer on a number that resolves after the pilot ends. So these
 * measure the things the evidence says PREDICT that outcome: early contact,
 * language recorded, no lock-in. The long targets are what they are FOR, and
 * `LAGGING_TARGETS` states them so the connection is not lost.
 *
 * **Shares of a caseload, not counts.** A count rewards holding more clients.
 * A share asks whether the people you hold are moving, which is the actual job.
 * Every value therefore carries its denominator, and a KPI over an empty
 * caseload is `null` — NOT zero. Zero says "nobody is progressing"; null says
 * "nobody is assigned", and on this instance three of five real residents have
 * no care team at all. Reporting that as 0% would blame a coach for an empty
 * seat.
 */

import { isGermanLanguageTest } from '@/lib/config/learning'
import {
  hasLabourMarketContact,
  isAwaitingAnswer,
  type JobApplicationInput,
  type JobClientInput,
} from '@/lib/jobcoach/queue'

export type KpiDirection = 'up' | 'down'
export type KpiFormat = 'percent' | 'days'

export interface RoleKpiDef {
  id: string
  /** German, staff-facing. Says the THING, not the calculation. */
  label: string
  /** One line: what moving this number would mean. */
  help: string
  /** Which way is better. Drives the arrow, never the colour alone. */
  direction: KpiDirection
  format: KpiFormat
  /** Into JOB_RESEARCH_SOURCES. Empty is not allowed — see the docstring. */
  sourceIds: string[]
  /**
   * What a dash MEANS for this particular number.
   *
   * Shipped without this and it was wrong on screen within the hour: the Jobcoach's
   * median-days tile read "noch niemand zugewiesen" while he plainly had a
   * client. Its denominator is the people who have HAD contact, so nought there
   * means "nobody has started yet" — a different fact from an empty caseload,
   * and the one a coach would act on. One shared empty string cannot say both.
   */
  emptyHint: string
}

export interface KpiValue {
  id: string
  /** null = not measurable yet (empty caseload), which is not the same as 0. */
  value: number | null
  /** How many people this is a share of. Shown, so 1/1 never reads as 100%. */
  denominator: number
}

/** Days without labour-market contact before it counts against the share. */
export const CONTACT_WINDOW_DAYS = 90

// ─────────────────────────────────────────────────────────────────────────────
// Jobcoach
// ─────────────────────────────────────────────────────────────────────────────

export const JOB_KPI_DEFS: readonly RoleKpiDef[] = [
  {
    id: 'LABOUR_MARKET_CONTACT_RATE',
    label: 'Mit Arbeitsmarktkontakt',
    help: 'Anteil der begleiteten Personen mit Bewerbung, Praktikum oder Anstellung.',
    direction: 'up',
    format: 'percent',
    sourceIds: ['ips-supported-employment', 'iab-fluchtmigration-erwerbsverlauf'],
    emptyHint: 'noch niemand zugewiesen',
  },
  {
    id: 'MEDIAN_DAYS_TO_FIRST_CONTACT',
    label: 'Tage bis zum ersten Kontakt',
    help: 'Median von der Erfassung bis zum ersten Arbeitsmarktkontakt.',
    direction: 'down',
    format: 'days',
    sourceIds: ['iab-fluchtmigration-erwerbsverlauf', 'ips-supported-employment'],
    // NOT "niemand zugewiesen": this one is nought when a caseload exists but
    // nobody in it has reached the labour market yet — which is the state a
    // coach acts on.
    emptyHint: 'noch kein Kontakt erfasst',
  },
  {
    id: 'COURSE_WITHOUT_WORK_RATE',
    label: 'Nur Kurs, ohne Arbeitsmarkt',
    help: 'Anteil in einer laufenden Massnahme ohne parallelen Arbeitsmarktkontakt.',
    direction: 'down',
    format: 'percent',
    sourceIds: ['iab-lock-in', 'language-and-work-parallel'],
    emptyHint: 'noch niemand zugewiesen',
  },
  {
    id: 'GERMAN_LEVEL_RECORDED_RATE',
    label: 'Deutschstand erfasst',
    help: 'Anteil mit erfasstem Deutsch-Niveau — ohne das ist keine Planung möglich.',
    direction: 'up',
    format: 'percent',
    sourceIds: ['integrationsagenda-schweiz', 'language-and-work-parallel'],
    emptyHint: 'noch niemand zugewiesen',
  },
]

/**
 * The binding outcomes these leading indicators serve.
 *
 * Stated separately and NOT rendered as a gauge, because nothing in this
 * product can measure them yet: they need years of history and a definition of
 * "nachhaltig im Arbeitsmarkt" that belongs to the canton, not to us. Writing
 * them down keeps the leading indicators honest about what they are FOR.
 */
export const LAGGING_TARGETS = [
  {
    sourceId: 'integrationsagenda-schweiz',
    text: 'Die Hälfte der erwachsenen Geflüchteten ist sieben Jahre nach Einreise nachhaltig im Arbeitsmarkt integriert.',
  },
  {
    sourceId: 'integrationsagenda-schweiz',
    text: 'Zwei Drittel der 16- bis 25-Jährigen sind fünf Jahre nach Einreise in einer postobligatorischen Ausbildung.',
  },
] as const

/**
 * A learning record as these KPIs read it: exactly the queue's view, plus the
 * language code the German-level KPI needs.
 *
 * Derived from `JobClientInput` rather than restated, so the `kind` and
 * `status` unions stay the database's and cannot drift into `string` — which
 * is what widening them to `string` would have done here, silently costing the
 * compile-time check that a typo in 'IN_PROGRESS' is caught.
 */
export type KpiLearningRecord = JobClientInput['learningRecords'][number] & {
  languageCode?: string | null
}

export interface JobKpiClient extends JobClientInput {
  learningRecords: KpiLearningRecord[]
  /** When contact first happened, if it has. null = never. */
  firstContactAt?: Date | null
}

function share(matching: number, total: number): KpiValue['value'] {
  return total === 0 ? null : Math.round((matching / total) * 1000) / 10
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

const DAY_MS = 24 * 60 * 60 * 1000

export function computeJobKpis(clients: readonly JobKpiClient[]): KpiValue[] {
  const total = clients.length

  const withContact = clients.filter((c) => hasLabourMarketContact(c))

  // A running course with no parallel contact. Deliberately the same shape as
  // the COURSE_WITHOUT_WORK signal a coach already sees on the dashboard — the
  // KPI is the count of that queue, so the number and the work agree.
  const courseOnly = clients.filter(
    (c) =>
      !hasLabourMarketContact(c) &&
      c.learningRecords.some((r) => r.kind === 'COURSE' && r.status === 'IN_PROGRESS'),
  )

  const germanRecorded = clients.filter((c) => c.learningRecords.some(isGermanLanguageTest))

  const daysToContact = clients
    .filter((c) => c.firstContactAt)
    .map((c) => Math.max(0, (c.firstContactAt!.getTime() - c.createdAt.getTime()) / DAY_MS))

  return [
    {
      id: 'LABOUR_MARKET_CONTACT_RATE',
      value: share(withContact.length, total),
      denominator: total,
    },
    {
      id: 'MEDIAN_DAYS_TO_FIRST_CONTACT',
      value: median(daysToContact) === null ? null : Math.round(median(daysToContact)!),
      denominator: daysToContact.length,
    },
    {
      id: 'COURSE_WITHOUT_WORK_RATE',
      value: share(courseOnly.length, total),
      denominator: total,
    },
    {
      id: 'GERMAN_LEVEL_RECORDED_RATE',
      value: share(germanRecorded.length, total),
      denominator: total,
    },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Freiwilligenarbeit
// ─────────────────────────────────────────────────────────────────────────────

export const VOLUNTEERING_KPI_DEFS: readonly RoleKpiDef[] = [
  {
    id: 'ENGAGEMENT_RATE',
    label: 'Mit laufendem Engagement',
    help: 'Anteil der begleiteten Personen mit einem aktiven Einsatz.',
    direction: 'up',
    format: 'percent',
    sourceIds: ['ips-supported-employment'],
    emptyHint: 'noch niemand zugewiesen',
  },
  {
    id: 'EVENT_PARTICIPATION_RATE',
    label: 'Teilnahme an Anlässen',
    help: 'Anteil der Personen, die für einen Anlass zugesagt haben.',
    direction: 'up',
    format: 'percent',
    sourceIds: ['language-and-work-parallel'],
    emptyHint: 'noch niemand zugewiesen',
  },
]

/** Application stages that mean an engagement is live, not history. */
export const ACTIVE_ENGAGEMENT_STAGES = [
  'INTERESTED',
  'APPLIED',
  'INTERVIEW',
  'ACCEPTED',
  'STARTED',
]

export interface VolunteeringKpiClient {
  residentId: string
  applications: JobApplicationInput[]
  /** GOING counts; MAYBE and DECLINED do not — a maybe is not attendance. */
  rsvpStatuses: string[]
}

export function computeVolunteeringKpis(clients: readonly VolunteeringKpiClient[]): KpiValue[] {
  const total = clients.length

  // The same rule the Jobcoach side follows, for the same reason: an interest
  // nobody has answered is a person waiting, not a running engagement. Without
  // this, a resident's own click would raise the Freiwilligenarbeit coordinator's ENGAGEMENT_RATE while
  // nothing had been arranged for them.
  const engaged = clients.filter((c) =>
    c.applications.some((a) => ACTIVE_ENGAGEMENT_STAGES.includes(a.stage) && !isAwaitingAnswer(a)),
  )
  const attending = clients.filter((c) => c.rsvpStatuses.includes('GOING'))

  return [
    { id: 'ENGAGEMENT_RATE', value: share(engaged.length, total), denominator: total },
    {
      id: 'EVENT_PARTICIPATION_RATE',
      value: share(attending.length, total),
      denominator: total,
    },
  ]
}

/** Which KPI set belongs to a care domain. Null where none is defined yet. */
export function kpiDefsForDomain(domain: string): readonly RoleKpiDef[] | null {
  if (domain === 'JOB') return JOB_KPI_DEFS
  if (domain === 'VOLUNTEERING') return VOLUNTEERING_KPI_DEFS
  return null
}
