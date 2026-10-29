import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaffAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/role-policy'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import {
  appendMessage,
  findMessageResident,
  getOrCreateThread,
  loadThreadMessages,
  markThreadRead,
} from '@/lib/messaging/queries'
import { isSendableBody, MESSAGE_BODY_MAX_LENGTH } from '@/lib/messaging/thread'

/**
 * The staff side of one resident's conversation.
 *
 * Addressed by RESIDENT id rather than thread id, because that is what staff
 * actually have in hand — they are looking at a person, not a conversation
 * record — and it removes any way to reach a thread whose owner you did not
 * mean to open.
 */

const replySchema = z.object({
  body: z.string().trim().min(1).max(MESSAGE_BODY_MAX_LENGTH),
})

export async function GET(
  _request: NextRequest,
  props: { params: Promise<{ residentId: string }> },
) {
  const params = await props.params
  // `requireStaffAuth` throws when there is no session; the middleware has
  // already turned anonymous requests away, so this is the second gate rather
  // than the first.
  let staff
  try {
    staff = await requireStaffAuth()
  } catch {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED },
      { status: 401 },
    )
  }

  if (!hasPermission(staff, 'messages:read')) {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS },
      { status: 403 },
    )
  }

  try {
    if (!(await findMessageResident(params.residentId, staff))) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.RESIDENT_NOT_FOUND },
        { status: 404 },
      )
    }
    const thread = await getOrCreateThread(params.residentId)
    await markThreadRead(thread.id, { kind: 'staff', userId: staff.id })
    const messages = await loadThreadMessages(thread.id)

    return NextResponse.json({ success: true, data: { messages } })
  } catch (error) {
    logger.errorWithCause('Failed to load staff message thread', error)
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.SESSION_ERROR },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ residentId: string }> },
) {
  const params = await props.params
  let staff
  try {
    staff = await requireStaffAuth()
  } catch {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED },
      { status: 401 },
    )
  }

  if (!hasPermission(staff, 'messages:read')) {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS },
      { status: 403 },
    )
  }

  let body: string
  try {
    const parsed = replySchema.safeParse(await request.json())
    if (!parsed.success || !isSendableBody(parsed.data.body)) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.INVALID_INPUT },
        { status: 400 },
      )
    }
    body = parsed.data.body
  } catch {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.INVALID_INPUT },
      { status: 400 },
    )
  }

  try {
    if (!(await findMessageResident(params.residentId, staff))) {
      return NextResponse.json(
        { success: false, error: ERROR_MESSAGES.RESIDENT_NOT_FOUND },
        { status: 404 },
      )
    }
    const thread = await getOrCreateThread(params.residentId)
    const message = await appendMessage({
      threadId: thread.id,
      party: { kind: 'staff', userId: staff.id },
      body,
    })

    // Audited: a staff message to a resident is an official contact, and
    // "who told them that" has to be answerable later.
    await logAudit({
      action: 'CREATE',
      entity: 'MESSAGE',
      entityId: message.id,
      changes: { residentId: params.residentId, by: staff.name },
    })

    return NextResponse.json({ success: true, data: { message } })
  } catch (error) {
    logger.errorWithCause('Failed to send staff message', error)
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGES.SESSION_ERROR },
      { status: 500 },
    )
  }
}
