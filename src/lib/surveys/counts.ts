/**
 * How many clients a survey invited and how many have answered — counted
 * from the invitations, never joined to a response.
 *
 * Its own module so the code that READS responses (`staff-data.ts`) never
 * touches the invitation table: `anonymity-boundary.test.ts` holds that line.
 */

import { count, inArray } from 'drizzle-orm'
import { db, surveyInvitation } from '@/lib/db'

/** Invited and answered counts per survey, from the invitations alone. */
export async function invitationCounts(
  surveyIds: readonly string[],
): Promise<Map<string, { invited: number; answered: number }>> {
  const result = new Map<string, { invited: number; answered: number }>()
  if (surveyIds.length === 0) return result
  const rows = await db
    .select({
      surveyId: surveyInvitation.surveyId,
      answered: surveyInvitation.answered,
      n: count(),
    })
    .from(surveyInvitation)
    .where(inArray(surveyInvitation.surveyId, [...surveyIds]))
    .groupBy(surveyInvitation.surveyId, surveyInvitation.answered)
  for (const row of rows) {
    const entry = result.get(row.surveyId) ?? { invited: 0, answered: 0 }
    entry.invited += row.n
    if (row.answered) entry.answered += row.n
    result.set(row.surveyId, entry)
  }
  return result
}
