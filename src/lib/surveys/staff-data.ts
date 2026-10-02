/**
 * What staff may read about surveys: the surveys, how many were invited, how
 * many answered, and the aggregated results.
 *
 * This file reads SurveyResponse and therefore never names a client — no
 * client table, no client id. `anonymity-boundary.test.ts` fails if it starts
 * to. Results are loaded as `answers` only (no id, no date) and summarised
 * before they leave this module.
 */

import { desc, eq } from 'drizzle-orm'
import { db, survey, surveyResponse } from '@/lib/db'
import { invitationCounts } from './counts'
import { surveyQuestionsSchema, type SurveyQuestion } from './questions'
import { summarizeSurvey, type SurveyResults } from './results'

export type SurveyStatusId = 'DRAFT' | 'OPEN' | 'CLOSED'

export interface SurveyListRow {
  id: string
  title: string
  status: SurveyStatusId
  createdAt: Date
  openedAt: Date | null
  closedAt: Date | null
  invited: number
  answered: number
}

export async function listSurveys(): Promise<SurveyListRow[]> {
  const rows = await db
    .select({
      id: survey.id,
      title: survey.title,
      status: survey.status,
      createdAt: survey.createdAt,
      openedAt: survey.openedAt,
      closedAt: survey.closedAt,
    })
    .from(survey)
    .orderBy(desc(survey.createdAt))
  const counts = await invitationCounts(rows.map((row) => row.id))
  return rows.map((row) => ({ ...row, ...(counts.get(row.id) ?? { invited: 0, answered: 0 }) }))
}

export interface SurveyDetail {
  id: string
  templateId: string
  title: string
  intro: string | null
  status: SurveyStatusId
  minResponses: number
  createdAt: Date
  openedAt: Date | null
  closedAt: Date | null
  questions: SurveyQuestion[]
  invited: number
  answered: number
}

export async function getSurveyDetail(id: string): Promise<SurveyDetail | null> {
  const row = await db.query.survey.findFirst({ where: eq(survey.id, id) })
  if (!row) return null
  const questions = surveyQuestionsSchema.safeParse(row.questions)
  const counts = (await invitationCounts([row.id])).get(row.id) ?? { invited: 0, answered: 0 }
  return {
    id: row.id,
    templateId: row.templateId,
    title: row.title,
    intro: row.intro,
    status: row.status,
    minResponses: row.minResponses,
    createdAt: row.createdAt,
    openedAt: row.openedAt,
    closedAt: row.closedAt,
    questions: questions.success ? questions.data : [],
    ...counts,
  }
}

/**
 * The results of one survey, under the k rule. Loads `answers` and nothing
 * else from each response.
 */
export async function getSurveyResults(detail: SurveyDetail): Promise<SurveyResults> {
  const rows = await db
    .select({ answers: surveyResponse.answers })
    .from(surveyResponse)
    .where(eq(surveyResponse.surveyId, detail.id))
  return summarizeSurvey(
    detail.questions,
    rows.map((row) => row.answers),
    detail.minResponses,
    detail.status,
  )
}

/** Open surveys with their counts — for a small dashboard or list summary. */
export async function listOpenSurveys(): Promise<SurveyListRow[]> {
  return (await listSurveys()).filter((row) => row.status === 'OPEN')
}
