/**
 * The opening moves of every per-task portal route
 * (`/api/portal/chores/[id]/{complete,request,attention,complaint}`).
 *
 * Each of them signs the resident in, then looks the task up BY ID AND BY
 * HOUSING UNIT — a resident may only act on the chores of the flat they live
 * in — and, unless the route also makes sense for a finished task, refuses
 * one that is already done. Four routes had spelled that out four times, and
 * a security check written four times is one that drifts.
 *
 * Two functions rather than one because the routes parse their body BETWEEN
 * the two steps: an invalid body on an unknown task answers 400, not 404, and
 * that order is pinned by the route tests.
 */

import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, householdTask } from '@/lib/db'
import { getPortalAuth, type PortalAuthResult } from '@/lib/portal-auth'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'

export type PortalTask = NonNullable<Awaited<ReturnType<typeof db.query.householdTask.findFirst>>>

/** `{ success: false, error }` with the given status — the portal's refusal shape. */
export function portalRefusal(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status })
}

/** The signed-in resident, or the 401 to return. */
export async function requirePortalAuth(): Promise<
  { auth: PortalAuthResult; refusal?: undefined } | { auth?: undefined; refusal: NextResponse }
> {
  const auth = await getPortalAuth()
  if (!auth) return { refusal: portalRefusal(ERROR_MESSAGES.NOT_AUTHENTICATED, 401) }
  return { auth }
}

/**
 * The task `id` in the resident's own housing unit, or the refusal to return:
 * 404 when it is not theirs (or does not exist — the two are deliberately
 * indistinguishable), 400 when it is already completed and the route does
 * not accept that.
 */
export async function findOwnTask(
  auth: PortalAuthResult,
  id: string,
  { allowCompleted = false }: { allowCompleted?: boolean } = {},
): Promise<
  { task: PortalTask; refusal?: undefined } | { task?: undefined; refusal: NextResponse }
> {
  const task = await db.query.householdTask.findFirst({
    where: and(
      eq(householdTask.id, id),
      eq(householdTask.housingUnitId, auth.placement.housingUnitId),
    ),
  })

  if (!task) return { refusal: portalRefusal(ERROR_MESSAGES.TASK_NOT_FOUND, 404) }
  if (task.isCompleted && !allowCompleted) {
    return { refusal: portalRefusal(ERROR_MESSAGES.TASK_ALREADY_COMPLETED, 400) }
  }
  return { task }
}
