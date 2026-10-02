'use server'

/**
 * A client answering a survey, from the portal.
 *
 * Returns an outcome KEY, never throws and never a German sentence: the form
 * translates it with the labels it was given, in the client's language.
 *
 * What this action never does, on purpose:
 *  - write an audit entry (it would read "resident X answered survey Y");
 *  - log the client together with the survey — a failure is logged by its
 *    error NAME only, because a driver error message can carry the query's
 *    parameters, and those include both ids;
 *  - return or revalidate anything that could tie the answer to the client.
 */

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db, survey } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getPortalResident } from '@/lib/portal-auth'
import { idSchema } from '@/lib/validation/schemas'
import { answersFromFormData, parseAnswers, surveyQuestionsSchema } from '@/lib/surveys/questions'
import { recordSurveyResponse } from '@/lib/surveys/submit'

export type SurveySubmitError =
  'signedOut' | 'notInvited' | 'alreadyAnswered' | 'closed' | 'empty' | 'invalid' | 'failed'

export interface SurveySubmitState {
  ok?: boolean
  error?: SurveySubmitError
}

export async function submitSurveyResponse(
  _previous: SurveySubmitState,
  formData: FormData,
): Promise<SurveySubmitState> {
  const me = await getPortalResident()
  if (!me) return { error: 'signedOut' }

  const surveyId = idSchema.safeParse(formData.get('surveyId'))
  if (!surveyId.success) return { error: 'notInvited' }

  const row = await db.query.survey.findFirst({
    where: eq(survey.id, surveyId.data),
    columns: { status: true, questions: true },
  })
  if (!row) return { error: 'notInvited' }
  if (row.status !== 'OPEN') return { error: 'closed' }
  const questions = surveyQuestionsSchema.safeParse(row.questions)
  if (!questions.success) return { error: 'closed' }

  const answers = parseAnswers(questions.data, answersFromFormData(questions.data, formData))
  if (!answers.ok) return { error: answers.reason === 'empty' ? 'empty' : 'invalid' }

  let outcome: Awaited<ReturnType<typeof recordSurveyResponse>>
  try {
    outcome = await recordSurveyResponse({
      surveyId: surveyId.data,
      residentId: me.id,
      answers: answers.answers,
    })
  } catch (error) {
    logger.error('survey response failed', {
      errorName: error instanceof Error ? error.name : 'unknown',
    })
    return { error: 'failed' }
  }

  if (outcome === 'not-invited') return { error: 'notInvited' }
  if (outcome === 'already-answered') return { error: 'alreadyAnswered' }

  revalidatePath('/portal')
  return { ok: true }
}
