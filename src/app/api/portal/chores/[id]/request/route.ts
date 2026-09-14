import { db, householdTask, taskRequest, placement } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { findOwnTask, requirePortalAuth } from '@/lib/chores/portal-task-route'
import { portalTaskRequestSchema } from '@/lib/validation/schemas'
import { logger } from '@/lib/logger'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { auth, refusal } = await requirePortalAuth()
  if (refusal) return refusal

  const { id } = await params

  let requestedResidentId: string | undefined
  let message: string | undefined
  try {
    const body = await request.json()
    const parsed = portalTaskRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.INVALID_INPUT },
        { status: 400 },
      )
    }
    requestedResidentId = parsed.data.requestedResidentId
    message = parsed.data.message
  } catch {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.INVALID_INPUT },
      { status: 400 },
    )
  }

  try {
    const { task, refusal: taskRefusal } = await findOwnTask(auth, id)
    if (taskRefusal) return taskRefusal

    // Validate requestedResidentId is a roommate (same housing unit) — prevents
    // targeting arbitrary residents elsewhere in the system.
    if (requestedResidentId) {
      const roommate = await db.query.placement.findFirst({
        where: and(
          eq(placement.residentId, requestedResidentId),
          eq(placement.housingUnitId, auth.placement.housingUnitId),
          eq(placement.status, 'ACTIVE'),
        ),
        columns: { residentId: true },
      })
      if (!roommate) {
        return NextResponse.json(
          { success: false, error: ERROR_MESSAGES.INVALID_INPUT },
          { status: 400 },
        )
      }
    }

    const isBroadcast = !requestedResidentId

    const [createdRequest] = await db
      .insert(taskRequest)
      .values({
        taskId: id,
        requestedById: auth.resident.id,
        requestedResidentId: requestedResidentId || null,
        isBroadcast,
        message: message || null,
      })
      .returning()

    // Update task status to REQUESTED
    await db
      .update(householdTask)
      .set({ currentStatus: 'REQUESTED' })
      .where(eq(householdTask.id, id))

    return NextResponse.json({ success: true, data: createdRequest })
  } catch (error) {
    logger.errorWithCause('Failed to create task request', error)
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.TASK_REQUEST_ERROR },
      { status: 500 },
    )
  }
}
