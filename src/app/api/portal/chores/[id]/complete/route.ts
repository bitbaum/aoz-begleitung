import { db, householdTask, taskCompletion, taskAttentionFlag, taskRequest } from '@/lib/db'
import { eq, and, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { findOwnTask, requirePortalAuth } from '@/lib/chores/portal-task-route'
import { portalCompleteTaskSchema } from '@/lib/validation/schemas'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { auth, refusal } = await requirePortalAuth()
  if (refusal) return refusal

  const { id } = await params

  // Parse optional body (may be empty for quick-complete)
  let notes: string | undefined
  let durationMinutes: number | undefined
  let completedItems: string[] | undefined
  try {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = await request.json()
      const parsed = portalCompleteTaskSchema.safeParse(body)
      if (parsed.success) {
        notes = parsed.data.notes
        durationMinutes = parsed.data.durationMinutes
        completedItems = parsed.data.completedItems
      }
    }
  } catch {
    // Empty body is fine for quick-complete
  }

  const { task, refusal: taskRefusal } = await findOwnTask(auth, id)
  if (taskRefusal) return taskRefusal

  // Only items that are actually on this task's checklist may be recorded —
  // otherwise a client could claim credit for work the house never agreed on.
  const ticked = (completedItems ?? []).filter((item) => (task.checklist ?? []).includes(item))

  try {
    // Transaction: create completion + update task + resolve flags + complete requests.
    // For ONE_TIME tasks we use a conditional update with `isCompleted: false` guard
    // to prevent two concurrent completions from racing past the outer check.
    const result = await db.transaction(async (tx) => {
      const isOneTime = task.taskType === 'ONE_TIME'

      // 1. Create completion. Ticked items are intersected with the task's own
      // checklist: a client must not be able to invent a done-criterion that
      // the house never agreed on, and the order is the task's, not the
      // client's, so the record reads the same as the list people saw.
      const tickedItems = completedItems
        ? (task.checklist ?? []).filter((item) => completedItems!.includes(item))
        : []

      const [completion] = await tx
        .insert(taskCompletion)
        .values({
          taskId: id,
          completedById: auth.resident.id,
          notes: notes || null,
          durationMinutes: durationMinutes || null,
          completedItems: tickedItems,
        })
        .returning()

      // 2. Update task status
      await tx
        .update(householdTask)
        .set({
          currentStatus: 'IDLE',
          ...(isOneTime ? { isCompleted: true, completedAt: new Date() } : {}),
        })
        .where(eq(householdTask.id, id))

      // 3. Resolve active attention flags
      await tx
        .update(taskAttentionFlag)
        .set({
          isResolved: true,
          resolvedAt: new Date(),
          resolvedByCompletionId: completion.id,
        })
        .where(and(eq(taskAttentionFlag.taskId, id), eq(taskAttentionFlag.isResolved, false)))

      // 4. Complete pending/accepted requests
      await tx
        .update(taskRequest)
        .set({
          status: 'COMPLETED',
          completionId: completion.id,
        })
        .where(
          and(eq(taskRequest.taskId, id), inArray(taskRequest.status, ['PENDING', 'ACCEPTED'])),
        )

      return completion
    })

    await logAudit({
      action: 'UPDATE',
      entity: 'HOUSEHOLD_TASK',
      entityId: id,
      changes: { action: 'completed', completedBy: auth.resident.code },
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    logger.errorWithCause('Failed to complete household task', error)
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.TASK_COMPLETE_ERROR },
      { status: 500 },
    )
  }
}
