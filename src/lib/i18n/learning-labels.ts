/**
 * Translated words for the learning area of the portal.
 *
 * `/portal/learning` rendered the kinds («Sprachtest», «Arbeitsstelle»), the
 * attribution lines and the whole «Nachweis erfassen» form — every option
 * included — in German inside an English or Arabic page. The staff side keeps
 * reading `lib/config/learning.ts`; the portal reads this, keyed by the same id
 * unions, so a new kind, status or category fails to compile here until it has
 * a word.
 *
 * Language names come from `Intl.DisplayNames` in the reader's locale rather
 * than ten dictionary entries per language: the runtime already knows what
 * «Tigrinya» is called in Arabic.
 */

import type { MessageKey } from './dictionaries/de'
import { LOCALES, type LocaleId } from './locales'
import type { Translator } from './index'
import {
  LEARNING_LANGUAGE_OPTIONS,
  type LearningCategoryId,
  type LearningFormCopy,
  type LearningKindId,
  type LearningRecordActionCopy,
  type LearningRecordProblem,
  type LearningStatusId,
} from '@/lib/config/learning'
import { STAFF_ROLE_CARE_DOMAIN } from '@/lib/config/care'
import type { StaffRole } from '@/lib/auth/role-policy'
import { careDomainLabel } from './care-labels'

const KIND_KEYS: Record<LearningKindId, MessageKey> = {
  LANGUAGE_TEST: 'learning.kindLanguageTest',
  COURSE: 'learning.kindCourse',
  INFORMAL: 'learning.kindInformal',
  QUALIFICATION: 'learning.kindQualification',
  VOLUNTEERING: 'learning.kindVolunteering',
  COMMUNITY_SERVICE: 'learning.kindCommunityService',
  EMPLOYMENT: 'learning.kindEmployment',
  INTERNSHIP: 'learning.kindInternship',
}

const STATUS_KEYS: Record<LearningStatusId, MessageKey> = {
  PLANNED: 'learning.statusPlanned',
  IN_PROGRESS: 'learning.statusInProgress',
  COMPLETED: 'learning.statusCompleted',
  EXPIRED: 'learning.statusExpired',
}

const CATEGORY_KEYS: Record<LearningCategoryId, MessageKey> = {
  language: 'learning.categoryLanguage',
  integration: 'learning.categoryIntegration',
  vocational: 'learning.categoryVocational',
  digital: 'learning.categoryDigital',
  community: 'learning.categoryCommunity',
  other: 'learning.categoryOther',
}

const PROBLEM_KEYS: Record<LearningRecordProblem, MessageKey> = {
  TITLE_OR_KIND: 'learning.problemTitle',
  LANGUAGE_REQUIRED: 'learning.problemLanguage',
  LEVEL_REQUIRED: 'learning.problemLevel',
  DATES: 'learning.problemDates',
}

function mapKeys<K extends string>(t: Translator, keys: Record<K, MessageKey>): Record<K, string> {
  const entries = Object.entries(keys).map(([id, key]) => [id, t(key as MessageKey)])
  return Object.fromEntries(entries) as Record<K, string>
}

export function learningKindLabel(t: Translator, kind: string): string {
  const key = KIND_KEYS[kind as LearningKindId]
  return key ? t(key) : kind
}

export function learningStatusLabel(t: Translator, status: string): string {
  const key = STATUS_KEYS[status as LearningStatusId]
  return key ? t(key) : status
}

/** A language's name in the reader's language — «Deutsch», «German», «الألمانية». */
export function languageNames(locale: LocaleId): Record<string, string> {
  let display: Intl.DisplayNames | null = null
  try {
    display = new Intl.DisplayNames([LOCALES[locale].intlTag], { type: 'language' })
  } catch {
    display = null
  }
  return Object.fromEntries(
    LEARNING_LANGUAGE_OPTIONS.map((option) => [
      option.code,
      display?.of(option.code.toLowerCase()) ?? option.code,
    ]),
  )
}

/**
 * Who on the team entered a record, as the client reads it.
 *
 * The ROLE, never the colleague's name, and translated through the care
 * domains the portal already names («Jobcoach», «Freiwilligenarbeit»). A role
 * with no care domain (Liegenschaften), or a row from before the author was
 * stored, says «Von Ihrem Team» rather than guessing.
 */
export function learningAttributionForClient(
  t: Translator,
  record: { recordedBy: 'RESIDENT' | 'STAFF' },
  author: { role: string } | null | undefined,
): string {
  if (record.recordedBy === 'RESIDENT') return t('learning.fromYou')
  const domain = author ? STAFF_ROLE_CARE_DOMAIN[author.role as StaffRole] : undefined
  return domain
    ? `${t('learning.enteredByRole')} ${careDomainLabel(t, domain)}`
    : t('learning.enteredByTeam')
}

export function learningFormCopy(t: Translator, locale: LocaleId): LearningFormCopy {
  return {
    kind: t('learning.formKind'),
    status: t('learning.formStatus'),
    titleField: t('learning.formTitle'),
    titlePlaceholder: t('learning.formTitlePlaceholder'),
    language: t('learning.formLanguage'),
    chooseLanguage: t('learning.formChooseLanguage'),
    cefr: t('learning.formLevel'),
    chooseLevel: t('learning.formChooseLevel'),
    provider: t('learning.formProvider'),
    providerPlaceholder: t('learning.formProviderPlaceholder'),
    category: t('learning.formCategory'),
    hours: t('learning.hours'),
    startedAt: t('learning.formStartedAt'),
    completedAt: t('learning.formCompletedAt'),
    notes: t('learning.formNotes'),
    notesHint: t('learning.formNotesHint'),
    save: t('learning.formSave'),
    saving: t('learning.formSaving'),
    saveError: t('learning.evidenceSaveError'),
    evidenceHelp: t('learning.evidenceHelp'),
    cancel: t('learning.formCancel'),
    kindLabels: mapKeys(t, KIND_KEYS),
    statusLabels: mapKeys(t, STATUS_KEYS),
    categoryLabels: mapKeys(t, CATEGORY_KEYS),
    languageLabels: languageNames(locale),
    problems: mapKeys(t, PROBLEM_KEYS),
  }
}

export function learningActionCopy(t: Translator): LearningRecordActionCopy {
  return {
    edit: t('learning.edit'),
    delete: t('learning.delete'),
    deleteConfirmTitle: t('learning.deleteConfirmTitle'),
    deleteConfirm: t('learning.deleteConfirm'),
    cancel: t('learning.formCancel'),
    updated: t('learning.updated'),
    deleted: t('learning.deleted'),
    saving: t('learning.formSaving'),
    deleteFailed: t('learning.evidenceSaveError'),
  }
}
