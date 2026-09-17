import {
  db,
  householdTask,
  taskCompletion,
  taskAttentionFlag,
  taskRequest,
  placement,
} from '@/lib/db'
import { eq, and, ne, desc } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/chores/portal-task-route'
import { logger } from '@/lib/logger'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { QUERY_LIMITS } from '@/lib/config/thresholds'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { auth, refusal } = await requirePortalAuth()
  if (refusal) return refusal

  const { id } = await params

  try {
    const task = await db.query.householdTask.findFirst({
      where: and(
        eq(householdTask.id, id),
        eq(householdTask.housingUnitId, auth.placement.housingUnitId),
      ),
      with: {
        createdByResident: { columns: { id: true, code: true } },
        completions: {
          orderBy: [desc(taskCompletion.completedAt)],
          limit: QUERY_LIMITS.choreHistory,
          with: { completedBy: { columns: { id: true, code: true } } },
        },
        attentionFlags: {
          orderBy: [desc(taskAttentionFlag.createdAt)],
          with: { flaggedBy: { columns: { id: true, code: true } } },
        },
        requests: {
          orderBy: [desc(taskRequest.createdAt)],
          with: {
            requestedBy: { columns: { id: true, code: true } },
            requestedResident: { columns: { id: true, code: true } },
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.TASK_NOT_FOUND },
        { status: 404 },
      )
    }

    // Get roommates for request form
    const roommates = await db.query.placement.findMany({
      where: and(
        eq(placement.housingUnitId, auth.placement.housingUnitId),
        eq(placement.status, 'ACTIVE'),
        ne(placement.residentId, auth.resident.id),
      ),
      columns: {},
      with: {
        resident: { columns: { id: true, code: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        task,
        roommates: roommates.map((p) => p.resident),
        currentResidentId: auth.resident.id,
      },
    })
  } catch (error) {
    logger.errorWithCause('Failed to get household task detail', error)
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.TASK_LOAD_ERROR },
      { status: 500 },
    )
  }
}
