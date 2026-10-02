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
  recordedByStaff: 'Von der Betreuung eingetragen',
  germanMissing: 'Kein Deutsch-Test erfasst',
  planned: 'Geplant',
  inProgress: 'Laufend',
  noGermanHint: 'Jobcoach: hier fehlt oft der nächste Deutschkurs.',
} as const
