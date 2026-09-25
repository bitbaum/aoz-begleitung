/**
 * Care work — SSOT for the four domains a resident actually meets.
 *
 * Housing, Sozialarbeit, Jobcoach and Freiwilligenarbeit are not four apps.
 * They are four seats on one person, with appointments and a small catalog
 * of operational facts. Adding a field is a line in CARE_ATTRIBUTE_CATALOG,
 * never a new column and never a one-off form. Nothing here is a diagnosis
 * or an asylum status.
 */

import type { StaffCapabilities, StaffRole } from '@/lib/auth/role-policy'

export const CARE_ROLES = ['HOUSING', 'SOCIAL', 'JOB', 'VOLUNTEERING'] as const
export type CareRoleId = (typeof CARE_ROLES)[number]

/**
 * Which staff role owns which seat.
 *
 * Working EVERY seat is no longer a role — it is `scope: 'ALL_DOMAINS'`, which
 * any role can carry. That is what makes the all-domains Betreuerin sayable: the domain of
 * record is housing and the account also covers the rest, a shape the old "Leitung
 * works every seat" reading could not express without erasing that domain.
 */
export const CARE_DOMAIN_STAFF_ROLE: Record<CareRoleId, Exclude<StaffRole, 'ADMIN'>> = {
  HOUSING: 'BETREUUNG',
  SOCIAL: 'SOZIALARBEIT',
  JOB: 'JOBCOACH',
  VOLUNTEERING: 'FREIWILLIGENARBEIT',
}

/**
 * The same mapping read the other way: which seat a staff role works in.
 *
 * DERIVED, never written out. This used to be a second hand-maintained literal
 * in `config/care-role-domain.ts` — the inverse of the map above, with nothing
 * deriving it and no test comparing the two. Adding a fifth seat could update
 * one file and ship green, and a role would then write into a domain the other
 * half of the app believed belonged to someone else.
 *
 * ADMIN is absent on purpose. The retired all-in-one role has no single domain
 * of its own, and a caller asking "which one is theirs?" must handle that
 * rather than be handed an arbitrary answer. Breadth is `scope`, and it is
 * asked about separately.
 *
 * LIEGENSCHAFTEN is absent for the opposite reason, and it is the more
 * interesting one: ADMIN has no seat because it works ALL of them, and
 * Liegenschaften has none because it works NONE. The Liegenschaften lead is responsible for the
 * buildings — which flats exist, who is placed where, what is broken — and
 * never for a person's care. `undefined` here is therefore a fact about the
 * job, not a gap to fill in later, and `roleHasCaseload()` below is how the
 * rest of the product should ask.
 */
export const STAFF_ROLE_CARE_DOMAIN: Partial<Record<StaffRole, CareRoleId>> = Object.fromEntries(
  CARE_ROLES.map((domain) => [CARE_DOMAIN_STAFF_ROLE[domain], domain]),
)

/**
 * Does this role carry a caseload at all?
 *
 * Asked instead of counting someone's assignments and inferring from zero.
 * Those are different facts: the Freiwilligenarbeit coordinator with no clients is WAITING to be assigned
 * and the dashboard should say so; the Liegenschaften lead with no clients is doing the job,
 * and telling that role "Ihnen ist noch niemand zugewiesen" would be the product
 * misunderstanding what the role is for.
 */
export function roleHasCaseload(role: StaffRole): boolean {
  return STAFF_ROLE_CARE_DOMAIN[role] !== undefined
}

export const CARE_ROLE_LABELS: Record<CareRoleId, string> = {
  HOUSING: 'Wohnen / Betreuung',
  SOCIAL: 'Sozialarbeit',
  JOB: 'Jobcoach',
  VOLUNTEERING: 'Freiwilligenarbeit',
}

/**
 * Must match the `AppointmentStatus` pgEnum in src/lib/db/schema.ts exactly.
 *
 * `mapAppointment` casts the database value into this union, and a cast is not
 * a check: a status present in the database and missing here renders its label
 * as `undefined` — a blank where a state should be, with tsc, ESLint and the
 * page all green. Pinned by appointment-statuses.test.ts.
 */
export const APPOINTMENT_STATUSES = [
  'REQUESTED',
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const
export type AppointmentStatusId = (typeof APPOINTMENT_STATUSES)[number]

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatusId, string> = {
  REQUESTED: 'Angefragt',
  SCHEDULED: 'Geplant',
  COMPLETED: 'Stattgefunden',
  CANCELLED: 'Abgesagt',
  NO_SHOW: 'Nicht erschienen',
}

export const APPOINTMENT_STATUS_BADGES: Record<AppointmentStatusId, string> = {
  REQUESTED: 'badge-pending',
  SCHEDULED: 'badge-active',
  COMPLETED: 'badge-ended',
  CANCELLED: 'badge-ended',
  NO_SHOW: 'badge-alert',
}

export type CareAttributeKind = 'text' | 'textarea' | 'select'

export interface CareAttributeOption {
  value: string
  label: string
}

export interface CareAttributeDef {
  key: string
  label: string
  hint?: string
  kind: CareAttributeKind
  options?: readonly CareAttributeOption[]
}

export const CARE_ATTRIBUTE_CATALOG: Record<CareRoleId, readonly CareAttributeDef[]> = {
  HOUSING: [
    {
      key: 'reachability',
      label: 'Erreichbarkeit',
      hint: 'Wann und wie die Person erreichbar ist — keine privaten Nummern ohne Absprache.',
      kind: 'textarea',
    },
    {
      key: 'keys',
      label: 'Schlüssel',
      kind: 'select',
      options: [
        { value: 'received', label: 'Erhalten' },
        { value: 'missing', label: 'Fehlt' },
        { value: 'replacement', label: 'Ersatz unterwegs' },
      ],
    },
    {
      key: 'housing_focus',
      label: 'Aktueller Wohnfokus',
      hint: 'Was als Nächstes im Wohnen zu klären ist.',
      kind: 'textarea',
    },
  ],
  SOCIAL: [
    {
      key: 'next_step',
      label: 'Nächster Schritt',
      hint: 'Konkret und operational — keine Diagnosen, keine Verfahrensdetails.',
      kind: 'textarea',
    },
    {
      key: 'check_in_cadence',
      label: 'Rhythmus',
      kind: 'select',
      options: [
        { value: 'weekly', label: 'Wöchentlich' },
        { value: 'biweekly', label: 'Alle zwei Wochen' },
        { value: 'monthly', label: 'Monatlich' },
        { value: 'as_needed', label: 'Nach Bedarf' },
      ],
    },
  ],
  JOB: [
    {
      key: 'job_goal',
      label: 'Berufsziel',
      kind: 'text',
    },
    {
      key: 'work_status',
      label: 'Stand Arbeit',
      kind: 'select',
      options: [
        { value: 'searching', label: 'Suche' },
        { value: 'course', label: 'Kurs / Qualifikation' },
        { value: 'employed', label: 'Erwerbstätig' },
        { value: 'other', label: 'Anderes' },
      ],
    },
    {
      key: 'german_focus',
      label: 'Deutsch-Fokus',
      kind: 'select',
      options: [
        { value: 'none', label: 'Kein aktueller Fokus' },
        { value: 'A1', label: 'A1' },
        { value: 'A2', label: 'A2' },
        { value: 'B1', label: 'B1' },
        { value: 'B2', label: 'B2+' },
      ],
    },
  ],
  VOLUNTEERING: [
    {
      key: 'interest_area',
      label: 'Interessengebiet',
      hint: 'Wofür sich die Person engagieren möchte oder engagiert.',
      kind: 'text',
    },
    {
      key: 'engagement_status',
      label: 'Stand Engagement',
      kind: 'select',
      options: [
        { value: 'interested', label: 'Interessiert' },
        { value: 'matched', label: 'Vermittelt' },
        { value: 'active', label: 'Aktiv' },
        { value: 'paused', label: 'Pausiert' },
      ],
    },
  ],
}

export function attributeDef(domain: CareRoleId, key: string): CareAttributeDef | undefined {
  return CARE_ATTRIBUTE_CATALOG[domain].find((item) => item.key === key)
}

export function isCatalogKey(domain: CareRoleId, key: string): boolean {
  return CARE_ATTRIBUTE_CATALOG[domain].some((item) => item.key === key)
}

/**
 * May this person work this seat?
 *
 * Asks the SCOPE, not the role name. It used to special-case `role === 'ADMIN'`,
 * which is why "a Betreuerin who also covers every seat" could only be
 * expressed by making the account an administrator. Now the axis that means breadth is
 * the axis that answers.
 */
export function canWriteCareDomain(viewer: StaffCapabilities, domain: CareRoleId): boolean {
  if (viewer.scope === 'ALL_DOMAINS') return true
  return CARE_DOMAIN_STAFF_ROLE[domain] === viewer.role
}

/**
 * Could this person be put on a client's team for this domain?
 *
 * The mirror of `canWriteCareDomain`, which asks whether a VIEWER may edit a
 * seat. This asks whether a CANDIDATE could hold it — and the answer is the
 * same rule from the other side: their role works that domain, or they cover
 * every domain.
 *
 * Without it the picker offered every active account for every seat. The Liegenschaften lead
 * appeared under Jobcoach though `LIEGENSCHAFTEN` maps to no care domain and
 * it can never work one; the Jobcoach appeared under Freiwilligenarbeit. Nothing
 * stopped the assignment either — `saveCareSeat` checks who is EDITING, not
 * who is being named — so the mistake was one click away and would have looked
 * like a staffed seat forever after.
 */
export function canStaffWorkDomain(
  candidate: { role: string; scope: string },
  domain: CareRoleId,
): boolean {
  if (candidate.scope === 'ALL_DOMAINS') return true
  return CARE_DOMAIN_STAFF_ROLE[domain] === candidate.role
}

export function writableCareDomains(viewer: StaffCapabilities): CareRoleId[] {
  return CARE_ROLES.filter((domain) => canWriteCareDomain(viewer, domain))
}

export const CARE_LABELS = {
  title: 'Betreuungsteam',
  workspaceTitle: 'Begleitung',
  /**
   * Names the seats actually on the page.
   *
   * This was a fixed sentence — "Wohnen, Sozialarbeit, Jobcoach und
   * Freiwilligenarbeit — dieselben vier Sitze" — printed above a workspace
   * that now renders only the seats the viewer works. A heading naming items
   * the page does not contain is the same failure as the portal group called
   * "Zusammen entscheiden" that held nothing to decide: the list changed, the
   * name stayed, and every check remained green. Deriving it from the rendered
   * domains means it cannot go stale.
   */
  workspaceSubtitle: (domains: readonly CareRoleId[]): string =>
    `${domains.map((domain) => CARE_ROLE_LABELS[domain]).join(' · ')} — Termine und was für die Arbeit nützt.`,
  portalTitle: 'Dein Team',
  portalSubtitle: 'Die Menschen, die für dich zuständig sind.',
  empty: 'Noch niemand zugewiesen.',
  portalEmpty: 'Noch niemand zugewiesen. Die Betreuung trägt das Team ein.',
  assign: 'Zuweisen',
  unassigned: 'Nicht zugewiesen',
  save: 'Speichern',
  saving: 'Wird gespeichert...',
  attributes: 'Für die Arbeit',
  appointments: 'Termine',
  appointmentsEmpty: 'Keine Termine.',
  domainEmpty: 'Noch leer',
  appointmentAdd: 'Termin setzen',
  appointmentTitle: 'Titel',
  appointmentWhen: 'Beginn',
  appointmentWhere: 'Ort',
  appointmentNotes: 'Notiz',
  appointmentNotesHint: 'Keine Diagnosen, keine Verfahrensdetails.',
  markDone: 'Stattgefunden',
  markCancel: 'Absagen',

  // Closing an appointment is the one moment staff have actually spoken with
  // the person, so it is the only honest place to record how they are doing.
  // The scale used to sit on the client page permanently, with no interaction
  // attached to it.
  checkInLegend: 'Wie geht es der Person zurzeit?',
  checkInHint:
    'Optional — nur erfassen, wenn ihr im Termin darüber gesprochen habt. Keine Einschätzung ins Blaue.',
  checkInConcerns: 'Was beschäftigt sie?',
  checkInNotAsked: 'Nicht besprochen',
  completeSubmit: 'Termin abschliessen',

  // Requests — the resident's half, answered on the staff side.
  requestTitle: 'Gesprächswunsch',
  requestPastTime: 'Bitte einen Zeitpunkt in der Zukunft wählen.',
  requestDuplicate: 'Für diesen Bereich ist bereits eine Anfrage offen.',
  declineNeedsReason: 'Bitte kurz begründen — die Person liest diese Antwort.',
  rescheduleClosed: 'Ein vergangener oder abgesagter Termin kann nicht verschoben werden.',
  requestsHeading: 'Gesprächswünsche',
  requestUnclaimed: 'Noch niemand zuständig',
  accept: 'Annehmen',
  decline: 'Ablehnen',
  reschedule: 'Verschieben',
  staffNoteLabel: 'Antwort an die Person',
  newTimeLabel: 'Neuer Zeitpunkt',
} as const
