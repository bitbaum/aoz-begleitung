/**
 * Survey results — aggregates only, and only above k.
 *
 * Pure. Takes the questions and the ANSWERS of each response (never a row, so
 * there is no id, date or anything else to carry through) and returns counts
 * per choice and the free-text answers.
 *
 * THE k RULE. Below `minResponses` nothing is returned at all — not the
 * counts, not the free text, not a per-question answered count. With three
 * people invited and two answers in, "1 × sehr einsam" is a statement about a
 * person the staff member can name. The page says "x von k" and nothing more.
 *
 * FREE TEXT has no order that could mean anything: sorted alphabetically, so
 * neither the order of submission nor the date can be read off the list.
 */

import { choicesOf, localize, type SurveyAnswer, type SurveyQuestion } from './questions'
import { SURVEY_MIN_RESPONSES } from '@/lib/config/survey-templates'

export interface ChoiceCount {
  id: string
  /** German — results are a staff surface. */
  label: string
  count: number
}

export type QuestionResult =
  | {
      type: 'single' | 'scale'
      id: string
      prompt: string
      answered: number
      choices: ChoiceCount[]
    }
  | {
      type: 'multi'
      id: string
      prompt: string
      answered: number
      choices: ChoiceCount[]
      /** "Sonstiges" free text, alphabetical. */
      other: string[]
    }
  | { type: 'text'; id: string; prompt: string; answered: number; texts: string[] }

export type SurveyResults =
  | { kind: 'still-open'; responses: number }
  | { kind: 'too-few'; responses: number; minResponses: number }
  | { kind: 'ready'; responses: number; minResponses: number; questions: QuestionResult[] }

/** k as stored, never below the floor — a stored 1 must not switch the rule off. */
export function effectiveMinResponses(stored: number): number {
  return Math.max(SURVEY_MIN_RESPONSES.min, Math.floor(stored))
}

/** Alphabetical, locale-aware — an order that says nothing about who or when. */
export function orderFreeText(texts: readonly string[]): string[] {
  return [...texts].sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }))
}

function asRecord(answers: unknown): Record<string, SurveyAnswer> {
  return typeof answers === 'object' && answers !== null && !Array.isArray(answers)
    ? (answers as Record<string, SurveyAnswer>)
    : {}
}

export function summarizeSurvey(
  questions: readonly SurveyQuestion[],
  answerSets: readonly unknown[],
  minResponses: number,
  status: 'DRAFT' | 'OPEN' | 'CLOSED',
): SurveyResults {
  const k = effectiveMinResponses(minResponses)
  const responses = answerSets.length
  // Results only once the survey is CLOSED. While it is open, comparing the
  // results before and after one more answer would reveal that answer — the
  // k rule protects a snapshot, not a sequence of them. Staff see the count.
  if (status !== 'CLOSED') return { kind: 'still-open', responses }
  if (responses < k) return { kind: 'too-few', responses, minResponses: k }

  const records = answerSets.map(asRecord)

  const results = questions.map((question): QuestionResult => {
    const values = records.map((record) => record[question.id]).filter((v) => v !== undefined)
    const prompt = localize(question.prompt, 'de')

    if (question.type === 'text') {
      const texts = values.filter((v): v is string => typeof v === 'string')
      return {
        type: 'text',
        id: question.id,
        prompt,
        answered: texts.length,
        texts: orderFreeText(texts),
      }
    }

    const counts = new Map(choicesOf(question).map((choice) => [choice.id, 0]))
    let answered = 0
    const other: string[] = []
    for (const value of values) {
      if (question.type === 'multi') {
        if (typeof value !== 'object' || value === null) continue
        answered += 1
        for (const id of value.selected ?? []) {
          if (counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1)
        }
        if (typeof value.other === 'string' && value.other.length > 0) other.push(value.other)
      } else if (typeof value === 'string' && counts.has(value)) {
        answered += 1
        counts.set(value, (counts.get(value) ?? 0) + 1)
      }
    }
    const choices = choicesOf(question).map((choice) => ({
      id: choice.id,
      label: localize(choice.label, 'de'),
      count: counts.get(choice.id) ?? 0,
    }))

    if (question.type === 'multi') {
      return {
        type: 'multi',
        id: question.id,
        prompt,
        answered,
        choices,
        other: orderFreeText(other),
      }
    }
    return { type: question.type, id: question.id, prompt, answered, choices }
  })

  return { kind: 'ready', responses, minResponses: k, questions: results }
}
