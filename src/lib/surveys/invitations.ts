/**
 * The portal side of a survey: which open surveys is this client invited to
 * and has not yet answered.
 *
 * Never reads a response — this file knows WHO was asked, and must not know
 * WHAT anybody said (`anonymity-boundary.test.ts`).
 */

import { and, desc, eq } from 'drizzle-orm'
import { db, survey, surveyInvitation } from '@/lib/db'
import { surveyQuestionsSchema, type SurveyQuestion } from './questions'

export interface PendingSurvey {
  id: string
  templateId: string
  title: string
  intro: string | null
}

/** Open surveys this client was invited to and has not answered. */
export async function listPendingSurveys(residentId: string): Promise<PendingSurvey[]> {
  return db
    .select({
      id: survey.id,
      templateId: survey.templateId,
      title: survey.title,
      intro: survey.intro,
    })
    .from(surveyInvitation)
    .innerJoin(survey, eq(survey.id, surveyInvitation.surveyId))
    .where(
      and(
        eq(surveyInvitation.residentId, residentId),
        eq(surveyInvitation.answered, false),
        eq(survey.status, 'OPEN'),
      ),
    )
    .orderBy(desc(survey.openedAt))
}

export type SurveyForClient =
  | { state: 'open'; survey: PendingSurvey & { questions: SurveyQuestion[] } }
  | { state: 'answered' | 'closed' | 'not-invited' }

/**
 * One survey as this client may see it. A client who was not invited learns
 * nothing about it — not even that it exists.
 */
export async function getSurveyForClient(
  surveyId: string,
  residentId: string,
): Promise<SurveyForClient> {
  const [row] = await db
    .select({
      id: survey.id,
      templateId: survey.templateId,
      title: survey.title,
      intro: survey.intro,
      status: survey.status,
      questions: survey.questions,
      answered: surveyInvitation.answered,
    })
    .from(surveyInvitation)
    .innerJoin(survey, eq(survey.id, surveyInvitation.surveyId))
    .where(
      and(eq(surveyInvitation.surveyId, surveyId), eq(surveyInvitation.residentId, residentId)),
    )
    .limit(1)

  if (!row) return { state: 'not-invited' }
  if (row.answered) return { state: 'answered' }
  if (row.status !== 'OPEN') return { state: 'closed' }
  const questions = surveyQuestionsSchema.safeParse(row.questions)
  if (!questions.success) return { state: 'closed' }
  return {
    state: 'open',
    survey: {
      id: row.id,
      templateId: row.templateId,
      title: row.title,
      intro: row.intro,
      questions: questions.data,
    },
  }
}
