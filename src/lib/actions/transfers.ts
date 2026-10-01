'use server'

import { db, transferRequest } from '@/lib/db'
import { and, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { requireStaffAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/role-policy'
import type { ReviewTransferRequestInput } from '@/lib/validation/transfer'
import { RESIDENT_NAME_SELECT } from '@/lib/utils/resident-name'

export async function getTransferRequests(status?: string) {
  await requireStaffAuth()
  const where = status
    ? eq(
        transferRequest.status,
        status as 'PENDING' | 'APPROVED' | 'DENIED' | 'COMPLETED' | 'CANCELLED',
      )
    : undefined

  return db.query.transferRequest.findMany({
    where,
    with: {
      resident: { columns: { ...RESIDENT_NAME_SELECT, supportLevel: true } },
      currentPlacement: {
        columns: { id: true },
        with: {
          housingUnit: { columns: { id: true, code: true, address: true } },
        },
      },
      targetUnit: { columns: { id: true, code: true, address: true } },
    },
    orderBy: [desc(transferRequest.createdAt)],
  })
}

async function reviewTransferRequest(
  input: ReviewTransferRequestInput,
  decision: 'APPROVED' | 'DENIED',
): Promise<{ success: boolean; error?: string }> {
  const user = await requireStaffAuth()
  // Deciding where someone lives is placements:write — the same verb the
  // dashboard queue and the nav item are gated on. It took a session alone.
  if (!hasPermission(user, 'placements:write')) {
    return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
  }

  try {
    // Atomic guard: only PENDING rows are eligible. Prevents two staff members
    // concurrently approving + denying (or both approving) the same request.
    const updated = await db
      .update(transferRequest)
      .set({
        status: decision,
        staffNotes: input.staffNotes,
        reviewedBy: user.id,
        reviewedAt: new Date(),
      })
      .where(and(eq(transferRequest.id, input.requestId), eq(transferRequest.status, 'PENDING')))
      .returning({ id: transferRequest.id })

    if (updated.length === 0) {
      const exists = await db.query.transferRequest.findFirst({
        where: eq(transferRequest.id, input.requestId),
        columns: { id: true },
      })
      return {
        success: false,
        error: exists
          ? 'Anfrage wurde bereits bearbeitet'
          : ERROR_MESSAGES.TRANSFER_REQUEST_NOT_FOUND,
      }
    }

    await logAudit({
      action: 'UPDATE',
      entity: 'TRANSFER_REQUEST',
      entityId: input.requestId,
      userId: user.id,
      changes: { status: decision, staffNotes: input.staffNotes },
    })

    revalidatePath('/transfer-requests')
    return { success: true }
  } catch (error) {
    logger.errorWithCause(`Failed to ${decision.toLowerCase()} transfer request`, error, {
      requestId: input.requestId,
    })
    return { success: false, error: ERROR_MESSAGES.TRANSFER_REQUEST_REVIEW_ERROR }
  }
}

export async function approveTransferRequest(input: ReviewTransferRequestInput) {
  return reviewTransferRequest(input, 'APPROVED')
}

export async function denyTransferRequest(input: ReviewTransferRequestInput) {
  return reviewTransferRequest(input, 'DENIED')
}
