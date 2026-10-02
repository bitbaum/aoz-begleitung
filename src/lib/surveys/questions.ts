/**
 * Survey questions and answers — the shapes, validated, and nothing else.
 *
 * Pure: no database, no session. A survey's questions are a snapshot of a
 * config template (`config/survey-templates.ts`) stored as JSON on the Survey
 * row, so a template edited later never rewrites a survey that is already out.
 *
 * Every question is OPTIONAL to answer. The questionnaire this models (AOZ
 * Wohnen+, "Leben in der AOZ Wohnung") asks about money, loneliness and
 * health; somebody who does not want to answer one of those must still be able
 * to answer the rest. A submission needs at least one answer.
 *
 * Texts carry every language the portal OFFERS. `survey-templates.test.ts`
 * fails when `availableLocales()` grows a language the templates do not speak,
 * so a resident is never shown a translated portal around a German survey.
 */

import { z } from 'zod'
import { BRAND } from '@/lib/config/brand'

/** The languages a survey text must exist in — the portal's offered set. */
export const SURVEY_LOCALES = ['de', 'en', 'fr', 'uk', 'ru', 'ar'] as const
export type SurveyLocale = (typeof SURVEY_LOCALES)[number]

export type LocalizedText = Record<SurveyLocale, string>

const nonEmpty = z.string().trim().min(1)

export const localizedTextSchema = z
  .object({ de: nonEmpty, en: nonEmpty, fr: nonEmpty, uk: nonEmpty, ru: nonEmpty, ar: nonEmpty })
  .strict()

/** Ids are machine keys inside JSON; keep them boring. */
const keySchema = z.string().regex(/^[a-z][a-zA-Z0-9_]{0,39}$/)

const optionSchema = z.object({ id: keySchema, label: localizedTextSchema }).strict()

const base = { id: keySchema, prompt: localizedTextSchema }

export const questionSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('single'), options: z.array(optionSchema).min(2) }).strict(),
  z
    .object({
      ...base,
      type: z.literal('multi'),
      options: z.array(optionSchema).min(2),
      /** "Sonstiges": a free-text field beside the boxes. */
      other: z.object({ label: localizedTextSchema }).strict().optional(),
    })
    .strict(),
  // Labelled steps, in order from one end of the scale to the other.
  z.object({ ...base, type: z.literal('scale'), steps: z.array(optionSchema).min(3) }).strict(),
  z.object({ ...base, type: z.literal('text') }).strict(),
])

export type SurveyQuestion = z.infer<typeof questionSchema>
export type SurveyQuestionType = SurveyQuestion['type']

export const MAX_SURVEY_QUESTIONS = 40
/** Free text, per field. Long enough for a paragraph, short enough to read. */
export const SURVEY_TEXT_MAX = 2000

/** The choices of a single, multi or scale question; empty for text. */
export function choicesOf(
  question: SurveyQuestion,
): readonly { id: string; label: LocalizedText }[] {
  if (question.type === 'scale') return question.steps
  if (question.type === 'text') return []
  return question.options
}

export const surveyQuestionsSchema = z
  .array(questionSchema)
  .min(1)
  .max(MAX_SURVEY_QUESTIONS)
  .superRefine((questions, ctx) => {
    const seen = new Set<string>()
    questions.forEach((question, index) => {
      if (seen.has(question.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate question id ${question.id}`,
          path: [index],
        })
      }
      seen.add(question.id)
      const ids = choicesOf(question).map((choice) => choice.id)
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate option id in ${question.id}`,
          path: [index],
        })
      }
    })
  })

/** The text in `locale`, German when it is not one of the survey languages. */
export function localize(text: LocalizedText, locale: string): string {
  const raw = (SURVEY_LOCALES as readonly string[]).includes(locale)
    ? text[locale as SurveyLocale]
    : text.de
  return raw.replaceAll(ORG_TOKEN, BRAND.orgName)
}

/**
 * Template texts name the organisation as `{org}`, filled from
 * `BRAND.orgName` at render — the same rule as all governance copy, so a
 * re-badged deployment asks about ITS help, not AOZ's.
 */
export const ORG_TOKEN = '{org}'

// =============================================================================
// Answers
// =============================================================================

export type SurveyAnswer = string | { selected: string[]; other?: string }

/** questionId → answer. Only answered questions appear. */
export type SurveyAnswers = Record<string, SurveyAnswer>

export type ParsedAnswers =
  { ok: true; answers: SurveyAnswers } | { ok: false; reason: 'invalid' | 'empty' }

function cleanText(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (trimmed.length > SURVEY_TEXT_MAX) return undefined
  return trimmed
}

/**
 * Validate raw answers against the questions they claim to answer.
 *
 * Strict in every direction that matters for anonymity: an unknown question id
 * is REFUSED, not ignored, so nothing can ride along inside `answers` — no
 * extra key can carry a resident id, a timestamp or anything else into the one
 * table promised to hold nothing that identifies anybody.
 */
export function parseAnswers(questions: readonly SurveyQuestion[], raw: unknown): ParsedAnswers {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: 'invalid' }
  }
  const byId = new Map(questions.map((question) => [question.id, question]))
  const input = raw as Record<string, unknown>
  for (const key of Object.keys(input)) {
    if (!byId.has(key)) return { ok: false, reason: 'invalid' }
  }

  const answers: SurveyAnswers = {}
  for (const question of questions) {
    const value = input[question.id]
    if (value === undefined || value === null || value === '') continue

    if (question.type === 'text') {
      const text = cleanText(value)
      if (text === undefined) return { ok: false, reason: 'invalid' }
      if (text !== null) answers[question.id] = text
      continue
    }

    const allowed = new Set(choicesOf(question).map((choice) => choice.id))

    if (question.type === 'single' || question.type === 'scale') {
      if (typeof value !== 'string' || !allowed.has(value)) return { ok: false, reason: 'invalid' }
      answers[question.id] = value
      continue
    }

    // multi
    if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, reason: 'invalid' }
    const { selected, other, ...rest } = value as { selected?: unknown; other?: unknown }
    if (Object.keys(rest).length > 0) return { ok: false, reason: 'invalid' }
    const picked = selected ?? []
    if (!Array.isArray(picked) || picked.some((id) => typeof id !== 'string' || !allowed.has(id))) {
      return { ok: false, reason: 'invalid' }
    }
    const otherText = question.other ? cleanText(other) : other === undefined ? null : undefined
    if (otherText === undefined) return { ok: false, reason: 'invalid' }
    const unique = Array.from(new Set(picked as string[]))
    if (unique.length === 0 && otherText === null) continue
    answers[question.id] =
      otherText === null ? { selected: unique } : { selected: unique, other: otherText }
  }

  if (Object.keys(answers).length === 0) return { ok: false, reason: 'empty' }
  return { ok: true, answers }
}

/** The form-field name for a question; multi "Sonstiges" adds `:other`. */
export function fieldName(questionId: string): string {
  return `q:${questionId}`
}

/**
 * Read the portal form into the raw shape `parseAnswers` takes. Multi questions
 * are checkboxes sharing one name; everything else is a single value.
 */
export function answersFromFormData(
  questions: readonly SurveyQuestion[],
  formData: FormData,
): Record<string, unknown> {
  const raw: Record<string, unknown> = {}
  for (const question of questions) {
    const name = fieldName(question.id)
    if (question.type === 'multi') {
      const selected = formData.getAll(name).filter((v): v is string => typeof v === 'string')
      const other = formData.get(`${name}:other`)
      raw[question.id] = {
        selected,
        ...(question.other && typeof other === 'string' ? { other } : {}),
      }
    } else {
      const value = formData.get(name)
      if (typeof value === 'string') raw[question.id] = value
    }
  }
  return raw
}
