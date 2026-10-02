/**
 * Recording one anonymous answer — the ONLY place that touches both an
 * invitation (which names a resident) and a response (which must not).
 *
 * One transaction:
 *   1. find this resident's invitation to this survey — none: refused;
 *   2. flip it to answered, guarded by `answered = false` so two submits racing
 *      cannot both pass;
 *   3. insert the response with `surveyId`, `answers` and the DAY — nothing
 *      else. Not the resident, not the invitation, not a time.
 *
 * What is deliberately absent: no audit entry, no log line naming the
 * resident, no return value carrying the response id. "Resident X answered
 * survey Y" is not written anywhere except the invitation's own boolean, and
 * that boolean is what refuses a second answer.
 * `surveys/__tests__/submit.test.ts` pins the inserted values to exactly
 * those three keys.
 */

import { and, eq } from 'drizzle-orm'
import { db, surveyInvitation, surveyResponse } from '@/lib/db'
import type { SurveyAnswers } from './questions'

export type SubmitOutcome = 'ok' | 'not-invited' | 'already-answered'

/** Today in Zurich as YYYY-MM-DD — a date, never a time. */
export function surveyDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export async function recordSurveyResponse(input: {
  surveyId: string
  residentId: string
  answers: SurveyAnswers
  now?: Date
}): Promise<SubmitOutcome> {
  return db.transaction(async (tx) => {
    const [invitation] = await tx
      .select({ id: surveyInvitation.id, answered: surveyInvitation.answered })
      .from(surveyInvitation)
      .where(
        and(
          eq(surveyInvitation.surveyId, input.surveyId),
          eq(surveyInvitation.residentId, input.residentId),
        ),
      )
      .limit(1)
    if (!invitation) return 'not-invited'
    if (invitation.answered) return 'already-answered'

    const flipped = await tx
      .update(surveyInvitation)
      .set({ answered: true })
      .where(and(eq(surveyInvitation.id, invitation.id), eq(surveyInvitation.answered, false)))
      .returning({ id: surveyInvitation.id })
    if (flipped.length === 0) return 'already-answered'

    await tx.insert(surveyResponse).values({
      surveyId: input.surveyId,
      answers: input.answers,
      submittedOn: surveyDay(input.now),
    })
    return 'ok'
  })
}
