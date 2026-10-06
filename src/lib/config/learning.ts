/**
 * Learning records — SSOT for kinds, CEFR, categories, labels.
 *
 * A language test is a communication fact (same reason we store spoken
 * languages). A course or informal note is for Sozialarbeit and Jobcoach,
 * never a grade of the person. No diagnoses, no case details.
 */

import { BRAND } from './brand'
import type { IntegrationBoardId } from './integration-boards'

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = (typeof CEFR_LEVELS)[number]

export const LEARNING_KINDS = [
  'LANGUAGE_TEST',
  'COURSE',
  'INFORMAL',
  'QUALIFICATION',
  'VOLUNTEERING',
  'COMMUNITY_SERVICE',
  // Work. Present here because a started OpportunityApplication becomes a
  // LearningRecord of the SAME kind with no translation table, so every
  // OpportunityKind must be a LearningKind. Pinned by opportunity-kinds.test.ts.
  'EMPLOYMENT',
  'INTERNSHIP',
] as const
export type LearningKindId = (typeof LEARNING_KINDS)[number]

/** Completed records staff can award — certificates, courses, service hours. */
export const ACHIEVEMENT_KINDS = [
  'LANGUAGE_TEST',
  'COURSE',
  'QUALIFICATION',
  'VOLUNTEERING',
  'COMMUNITY_SERVICE',
  // A job held or a Praktikum completed is evidence of the same sort as a
  // certificate: something the person did, which the next placement can read.
  'EMPLOYMENT',
  'INTERNSHIP',
] as const

export function isAchievementRecord(record: { status: string; kind: string }): boolean {
  return (
    record.status === 'COMPLETED' && (ACHIEVEMENT_KINDS as readonly string[]).includes(record.kind)
  )
}

export function kindTracksHours(kind: string): boolean {
  return kind === 'VOLUNTEERING' || kind === 'COMMUNITY_SERVICE' || kind === 'COURSE'
}

export const LEARNING_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED'] as const
export type LearningStatusId = (typeof LEARNING_STATUSES)[number]

export const LEARNING_CATEGORIES = [
  'language',
  'integration',
  'vocational',
  'digital',
  'community',
  'other',
] as const
export type LearningCategoryId = (typeof LEARNING_CATEGORIES)[number]

/**
 * Window for the dashboard's "Abschlüsse in N Tagen" pulse.
 *
 * Lives here rather than in the dashboard config because it is a statement
 * about learning ("recent" means a month), not about dashboard composition —
 * and the demo seed needs it too, to place completions inside the window
 * instead of reporting zero on a world full of finished courses.
 */
export const LEARNING_PULSE_WINDOW_DAYS = 30

/**
 * What counts as "this person has a German level on file".
 *
 * ONE definition, because two things ask it and they must never disagree: the
 * learning board's "Kein Deutsch-Test erfasst" panel (as SQL, in
 * `actions/learning.ts`) and the Jobcoach KPI that measures the same coverage
 * (as a predicate, in `analytics/role-kpis.ts`). A board that nudges about a
 * gap the KPI does not count would have staff chasing a number that never moves.
 *
 * Why it matters at all: the Integrationsagenda Schweiz sets communication in a
 * national language as an explicit Wirkungsziel, and the OECD finding is that
 * language and work run in PARALLEL. A missing level is not an administrative
 * gap — it is the one fact that decides whether a placement conversation can
 * even start.
 */
export const GERMAN_TEST_KIND = 'LANGUAGE_TEST' as const
export const GERMAN_LANGUAGE_CODE = 'DE' as const

export function isGermanLanguageTest(record: {
  kind: string
  languageCode?: string | null
}): boolean {
  return record.kind === GERMAN_TEST_KIND && record.languageCode === GERMAN_LANGUAGE_CODE
}

/**
 * The boards are NOT learning's own. `/opportunities` splits the integration
 * domain the same way and by the same role rule, so the identity and the
 * default live in `integration-boards.ts` and this file only says which
 * learning kinds land on each. Two copies of "the job coach works the job half"
 * is exactly one copy too many.
 */
export function boardKinds(board: IntegrationBoardId): readonly LearningKindId[] {
  switch (board) {
    case 'job':
      // The job coach's board now holds the two kinds their work is actually
      // about. It previously showed only language tests, courses and
      // qualifications — the preparation, never the placement.
      return ['LANGUAGE_TEST', 'COURSE', 'QUALIFICATION', 'EMPLOYMENT', 'INTERNSHIP']
    case 'volunteering':
      return ['VOLUNTEERING', 'COMMUNITY_SERVICE']
    case 'overview':
    default:
      return LEARNING_KINDS
  }
}

export const LEARNING_KIND_LABELS: Record<LearningKindId, string> = {
  LANGUAGE_TEST: 'Sprachtest',
  COURSE: 'Kurs',
  INFORMAL: 'Informelles Lernen',
  QUALIFICATION: 'Abschluss / Nachweis',
  VOLUNTEERING: 'Freiwilligenarbeit',
  COMMUNITY_SERVICE: 'Gemeinnützige Arbeit',
  EMPLOYMENT: 'Arbeitsstelle',
  INTERNSHIP: 'Praktikum',
}

export const LEARNING_STATUS_LABELS: Record<LearningStatusId, string> = {
  PLANNED: 'Geplant',
  IN_PROGRESS: 'Laufend',
  COMPLETED: 'Abgeschlossen',
  EXPIRED: 'Abgelaufen',
}

export const LEARNING_CATEGORY_LABELS: Record<LearningCategoryId, string> = {
  language: 'Sprache',
  integration: 'Integration',
  vocational: 'Beruf',
  digital: 'Digitales',
  community: 'Gemeinschaft',
  other: 'Anderes',
}

export const LEARNING_LANGUAGE_OPTIONS = [
  { code: 'DE', label: 'Deutsch' },
  { code: 'EN', label: 'Englisch' },
  { code: 'FR', label: 'Französisch' },
  { code: 'IT', label: 'Italienisch' },
  { code: 'AR', label: 'Arabisch' },
  { code: 'FA', label: 'Farsi / Dari' },
  { code: 'TR', label: 'Türkisch' },
  { code: 'TI', label: 'Tigrinya' },
  { code: 'UK', label: 'Ukrainisch' },
  { code: 'RU', label: 'Russisch' },
] as const

/**
 * The ONE name for this area of the product.
 *
 * It had four. The nav said "Lernen & Beruf", the page title and its heading
 * said "Integrationsnachweise", the dashboard tile said "Lernen & Kurse", and
 * the permission descriptions said "Integrationsnachweise" again — so a
 * Jobcoach told to "open Lernen & Beruf" arrived at a page whose heading,
 * browser tab and dashboard tile all named something else, with no way to
 * know they were the same place. Every surface reads this constant now, and
 * `learning-area-name.test.ts` fails if a literal reappears.
 */
export const LEARNING_AREA_NAME = 'Lernen & Beruf'

export const LEARNING_LABELS = {
  title: LEARNING_AREA_NAME,
  subtitle: 'Kurse, Sprachtests und was jemand selbst gelernt hat — für Betreuung und Jobcoach.',
  boardTitle: LEARNING_AREA_NAME,
  boardSubtitle:
    'Was jemand macht, lernt und nachweisen kann — damit Jobcoach, Sozialarbeit und Freiwilligenarbeit schnell sehen, was zählt.',
  boardSwitcherLabel: 'Bereich',
  boardOverview: 'Alle Nachweise',
  boardJob: 'Beruf & Qualifikation',
  boardVolunteering: 'Freiwilligenarbeit',
  filterMine: 'Meine Klient*innen',
  filterAll: 'Alle',
  filterStatus: 'Stand',
  filterSource: 'Quelle',
  filterCategory: 'Bereich',
  filterSearch: 'Suche',
  filterSearchPlaceholder: 'Name, Code, Titel oder Anbieter…',
  sourceResident: 'Selbst eingetragen',
  sourceStaff: 'Von Fachperson erfasst',
  sourceAll: 'Alle Quellen',
  openResident: 'Zum Dossier',
  unitUnknown: 'Ohne aktuelle Unterkunft',
  noResults: 'Keine passenden Nachweise.',
  noMine: 'Für diese Filter sind noch keine eigenen Klient*innen zugeordnet.',
  filterReset: 'Filter zurücksetzen',
  evidenceTitle: 'Nachweis erfassen',
  evidenceSubtitle:
    'Dokumentieren Sie, was Sie machen: Kurse, Sprachtests, Freiwilligenarbeit oder andere Schritte, die Ihre Integration zeigen.',
  evidenceQuickCourse: 'Kurs',
  evidenceQuickLanguage: 'Sprachtest',
  evidenceQuickVolunteering: 'Freiwilligenarbeit',
  evidenceQuickQualification: 'Abschluss',
  assignedToYou: 'Vom Team für Sie erfasst',
  selfLogged: 'Von Ihnen eingetragen',
  evidenceHelp:
    'Tragen Sie nur Dinge ein, die wirklich stattgefunden haben oder geplant sind. Das hilft Ihnen und Ihrem Team beim nächsten Schritt.',
  saveError: 'Speichern fehlgeschlagen. Bitte Eingaben prüfen und erneut versuchen.',
  portalTitle: 'Ihr Lernen',
  portalSubtitle: 'Sprachtests, Kurse, Weiterbildung. Sie können selbst eintragen, was Sie machen.',
  add: 'Eintrag hinzufügen',
  empty: 'Noch keine Einträge.',
  kind: 'Art',
  titleField: 'Bezeichnung',
  titlePlaceholder: 'z.B. Deutschkurs A2, fide-Test, Velomechanik',
  status: 'Stand',
  language: 'Sprache',
  cefr: 'Niveau (GER)',
  provider: 'Anbieter',
  providerPlaceholder: `z.B. ${BRAND.orgName}, EB Zürich, fide`,
  category: 'Bereich',
  hours: 'Stunden',
  startedAt: 'Beginn',
  completedAt: 'Abschluss',
  notes: 'Notizen',
  notesHint: 'Keine Diagnosen, keine Verfahrensdetails — nur was für Wohnen oder Arbeit nützt.',
  save: 'Speichern',
  saving: 'Wird gespeichert...',
  recordedByResident: 'Selbst eingetragen',
  // Never a domain name here: a job the Jobcoach recorded was credited to «die
  // Betreuung». The role comes from the person who entered it — see
  // `learningAttribution`.
  recordedByTeam: 'Vom Team eingetragen',
  chooseLanguage: 'Sprache wählen',
  chooseLevel: 'Niveau wählen',
  edit: 'Bearbeiten',
  delete: 'Löschen',
  deleteConfirmTitle: 'Eintrag löschen?',
  deleteConfirm:
    'Der Eintrag verschwindet aus dem Dossier und aus «Lernen & Beruf». Das lässt sich nicht rückgängig machen.',
  cancelEdit: 'Abbrechen',
  updated: 'Eintrag gespeichert.',
  deleted: 'Eintrag gelöscht.',
  generatedFromOpportunity: 'Aus einem Einsatzplatz erstellt',
  germanMissing: 'Kein Deutsch-Test erfasst',
  planned: 'Geplant',
  inProgress: 'Laufend',
  noGermanHint: 'Jobcoach: hier fehlt oft der nächste Deutschkurs.',
} as const

// =============================================================================
// Validation — one rule set for staff and client, so the two forms cannot
// accept different things.
// =============================================================================

/** Why a learning record was refused. Mapped to words per audience. */
export type LearningRecordProblem =
  | 'TITLE_OR_KIND'
  | 'LANGUAGE_REQUIRED'
  | 'LEVEL_REQUIRED'
  | 'DATES'

export interface LearningRecordDraft {
  kind: string | null
  title: string
  languageCode: string | null
  cefrLevel: string | null
  startedAt: Date | null
  completedAt: Date | null
}

/**
 * A language test needs an explicitly chosen language AND level.
 *
 * The level select used to open on «A1» with no blank option, so every
 * language test saved through it said «DE A1» — whether or not anyone chose
 * A1. That is a fact about a person's German, written by a default, and it is
 * the number the Jobcoach board and the German-level KPI read. The form now
 * opens blank and the server refuses a test without a level: «nicht
 * angegeben» is not a level, and a test whose result nobody knows is not yet
 * worth recording as one.
 */
export function learningRecordProblem(draft: LearningRecordDraft): LearningRecordProblem | null {
  if (!draft.kind || !(LEARNING_KINDS as readonly string[]).includes(draft.kind)) {
    return 'TITLE_OR_KIND'
  }
  if (draft.title.trim().length < 2) return 'TITLE_OR_KIND'
  if (draft.kind === 'LANGUAGE_TEST') {
    if (!draft.languageCode) return 'LANGUAGE_REQUIRED'
    if (!draft.cefrLevel || !(CEFR_LEVELS as readonly string[]).includes(draft.cefrLevel)) {
      return 'LEVEL_REQUIRED'
    }
  }
  if (draft.startedAt && draft.completedAt && draft.completedAt < draft.startedAt) return 'DATES'
  return null
}

export const LEARNING_RECORD_PROBLEM_LABELS: Record<LearningRecordProblem, string> = {
  TITLE_OR_KIND: 'Art und Bezeichnung sind erforderlich.',
  LANGUAGE_REQUIRED: 'Bitte wählen Sie die Sprache des Tests.',
  LEVEL_REQUIRED: 'Bitte wählen Sie das Niveau des Tests.',
  DATES: 'Der Abschluss liegt vor dem Beginn.',
}

// =============================================================================
// Who may change a record
// =============================================================================

export type LearningRecordActor =
  | { kind: 'staff'; mayWriteLearning: boolean }
  | { kind: 'resident'; residentId: string }

export interface LearningRecordOwnership {
  residentId: string
  recordedBy: 'RESIDENT' | 'STAFF'
}

/**
 * Edit and delete follow one rule, for both.
 *
 * - Staff who may write learning may change ANY record — their own, a
 *   colleague's, the client's, and the evidence the pipeline generated when a
 *   thread reached STARTED (a coach who moved the wrong person must be able to
 *   take the certificate back).
 * - A client may change only what they entered THEMSELVES. A record the team
 *   filed is the team's statement; the client can ask about it, not rewrite it.
 */
export function mayChangeLearningRecord(
  actor: LearningRecordActor,
  record: LearningRecordOwnership,
): boolean {
  if (actor.kind === 'staff') return actor.mayWriteLearning
  return record.residentId === actor.residentId && record.recordedBy === 'RESIDENT'
}

// =============================================================================
// Attribution — who on the team entered it
// =============================================================================

/**
 * The staff-side line under a record: «Selbst eingetragen», or the ROLE of the
 * member of staff who entered it. Rows older than `recordedByUserId` (and rows
 * whose author left) have no role to name, and say «Vom Team» rather than
 * guess one.
 */
export function learningAttribution(
  record: { recordedBy: 'RESIDENT' | 'STAFF' },
  author: { role: string } | null | undefined,
  roleLabels: Record<string, string>,
): string {
  if (record.recordedBy === 'RESIDENT') return LEARNING_LABELS.recordedByResident
  const role = author ? roleLabels[author.role] : undefined
  return role ? `${LEARNING_LABELS.recordedByTeam} · ${role}` : LEARNING_LABELS.recordedByTeam
}

// =============================================================================
// Form copy — the form is shared by staff (German) and the portal (translated)
// =============================================================================

/**
 * Every word the learning form renders. The form takes this as a prop and
 * imports no labels itself, so the portal can hand it the reader's language:
 * it used to render this whole form — options included — in German inside an
 * Arabic page.
 */
export interface LearningFormCopy {
  kind: string
  status: string
  titleField: string
  titlePlaceholder: string
  language: string
  chooseLanguage: string
  cefr: string
  chooseLevel: string
  provider: string
  providerPlaceholder: string
  category: string
  hours: string
  startedAt: string
  completedAt: string
  notes: string
  notesHint: string
  save: string
  saving: string
  saveError: string
  evidenceHelp: string
  cancel: string
  kindLabels: Record<LearningKindId, string>
  statusLabels: Record<LearningStatusId, string>
  categoryLabels: Record<LearningCategoryId, string>
  languageLabels: Record<string, string>
  problems: Record<LearningRecordProblem, string>
}

export const STAFF_LEARNING_FORM_COPY: LearningFormCopy = {
  kind: LEARNING_LABELS.kind,
  status: LEARNING_LABELS.status,
  titleField: LEARNING_LABELS.titleField,
  titlePlaceholder: LEARNING_LABELS.titlePlaceholder,
  language: LEARNING_LABELS.language,
  chooseLanguage: LEARNING_LABELS.chooseLanguage,
  cefr: LEARNING_LABELS.cefr,
  chooseLevel: LEARNING_LABELS.chooseLevel,
  provider: LEARNING_LABELS.provider,
  providerPlaceholder: LEARNING_LABELS.providerPlaceholder,
  category: LEARNING_LABELS.category,
  hours: LEARNING_LABELS.hours,
  startedAt: LEARNING_LABELS.startedAt,
  completedAt: LEARNING_LABELS.completedAt,
  notes: LEARNING_LABELS.notes,
  notesHint: LEARNING_LABELS.notesHint,
  save: LEARNING_LABELS.save,
  saving: LEARNING_LABELS.saving,
  saveError: LEARNING_LABELS.saveError,
  evidenceHelp: LEARNING_LABELS.evidenceHelp,
  cancel: LEARNING_LABELS.cancelEdit,
  kindLabels: LEARNING_KIND_LABELS,
  statusLabels: LEARNING_STATUS_LABELS,
  categoryLabels: LEARNING_CATEGORY_LABELS,
  languageLabels: Object.fromEntries(LEARNING_LANGUAGE_OPTIONS.map((l) => [l.code, l.label])),
  problems: LEARNING_RECORD_PROBLEM_LABELS,
}

/** The words around the form: edit, delete and its confirmation. */
export interface LearningRecordActionCopy {
  edit: string
  delete: string
  deleteConfirmTitle: string
  deleteConfirm: string
  cancel: string
  updated: string
  deleted: string
  saving: string
  deleteFailed: string
}

export const STAFF_LEARNING_ACTION_COPY: LearningRecordActionCopy = {
  edit: LEARNING_LABELS.edit,
  delete: LEARNING_LABELS.delete,
  deleteConfirmTitle: LEARNING_LABELS.deleteConfirmTitle,
  deleteConfirm: LEARNING_LABELS.deleteConfirm,
  cancel: LEARNING_LABELS.cancelEdit,
  updated: LEARNING_LABELS.updated,
  deleted: LEARNING_LABELS.deleted,
  saving: LEARNING_LABELS.saving,
  deleteFailed: LEARNING_LABELS.saveError,
}
