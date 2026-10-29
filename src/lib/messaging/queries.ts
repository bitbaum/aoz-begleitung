import { residentScopeFilter, type SiteCapabilities } from '@/lib/auth/site-access'
import { db, message as messageTable, messageThread, resident as residentTable } from '@/lib/db'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { RESIDENT_NAME_SELECT } from '@/lib/utils/resident-name'
import {
  messageAuthor,
  messagesToMarkRead,
  unreadCountFor,
  type MessageParty,
  type MessageRow,
} from './thread'

/**
 * The I/O half of resident ↔ staff messaging. Everything that decides anything
 * lives in `thread.ts`; this file only reads and writes.
 */

const MESSAGE_SELECT = {
  id: true,
  authorResidentId: true,
  authorUserId: true,
  body: true,
  createdAt: true,
  readAt: true,
} as const

/** The message columns as insert-returning shape — mirrors MESSAGE_SELECT. */
const MESSAGE_RETURNING = {
  id: messageTable.id,
  authorResidentId: messageTable.authorResidentId,
  authorUserId: messageTable.authorUserId,
  body: messageTable.body,
  createdAt: messageTable.createdAt,
  readAt: messageTable.readAt,
} as const

/**
 * The resident's thread, created on first use.
 *
 * Insert-or-skip rather than "find, then create if missing": two requests
 * arriving together — a resident sending while staff open the thread — would
 * otherwise both find nothing and both insert, and the unique index would turn
 * the loser into a 500 on an ordinary action.
 */
export async function getOrCreateThread(residentId: string) {
  const [created] = await db
    .insert(messageThread)
    .values({ residentId })
    .onConflictDoNothing({ target: messageThread.residentId })
    .returning({ id: messageThread.id, residentId: messageThread.residentId })
  if (created) return created

  const existing = await db.query.messageThread.findFirst({
    where: eq(messageThread.residentId, residentId),
    columns: { id: true, residentId: true },
  })
  if (!existing) {
    // Unreachable unless the thread was deleted between the two statements.
    throw new Error(`Message thread for resident ${residentId} vanished during creation`)
  }
  return existing
}

export async function loadThreadMessages(threadId: string): Promise<MessageRow[]> {
  return db.query.message.findMany({
    where: eq(messageTable.threadId, threadId),
    orderBy: [asc(messageTable.createdAt)],
    columns: MESSAGE_SELECT,
  })
}

/**
 * Append a message and bump the thread, in one transaction.
 *
 * The bump is what a staff inbox sorts on. If the write succeeded and the bump
 * did not, the message would exist and the thread would look untouched — the
 * conversation would be invisible in the only list that surfaces it.
 */
export async function appendMessage({
  threadId,
  party,
  body,
}: {
  threadId: string
  party: MessageParty
  body: string
}) {
  return db.transaction(async (tx) => {
    const [message] = await tx
      .insert(messageTable)
      .values({ threadId, body: body.trim(), ...messageAuthor(party) })
      .returning(MESSAGE_RETURNING)

    await tx
      .update(messageThread)
      .set({ updatedAt: new Date() })
      .where(eq(messageThread.id, threadId))

    return message!
  })
}

/** Mark the other side's messages read. Returns how many changed. */
export async function markThreadRead(threadId: string, party: MessageParty): Promise<number> {
  const messages = await loadThreadMessages(threadId)
  const ids = messagesToMarkRead(messages, party)
  if (ids.length === 0) return 0

  const updated = await db
    .update(messageTable)
    .set({ readAt: new Date() })
    .where(inArray(messageTable.id, ids))
    .returning({ id: messageTable.id })
  return updated.length
}

/** How many messages are waiting for this resident. Drives the portal badge. */
export async function residentUnreadCount(residentId: string): Promise<number> {
  const thread = await db.query.messageThread.findFirst({
    where: eq(messageThread.residentId, residentId),
    columns: { id: true },
  })
  if (!thread) return 0

  const messages = await loadThreadMessages(thread.id)
  return unreadCountFor(messages, { kind: 'resident', residentId })
}

/**
 * Every thread with something waiting for staff, oldest wait first.
 *
 * Ordered by the OLDEST unanswered message rather than the newest activity: a
 * question from four days ago matters more than one from an hour ago, and
 * sorting by recency buries exactly the person who has been waiting longest.
 */
/** Resident existence and unit scope are checked before opening any thread. */
export async function findMessageResident(residentId: string, viewer: SiteCapabilities) {
  return db.query.resident.findFirst({
    where: and(eq(residentTable.id, residentId), residentScopeFilter(viewer) ?? undefined),
    columns: RESIDENT_NAME_SELECT,
  })
}

export async function staffInbox(viewer: SiteCapabilities) {
  const siteFilter = residentScopeFilter(viewer)
  const threads = await db.query.messageThread.findMany({
    where: siteFilter
      ? inArray(
          messageThread.residentId,
          db.select({ id: residentTable.id }).from(residentTable).where(siteFilter),
        )
      : undefined,
    orderBy: [desc(messageThread.updatedAt)],
    columns: { id: true, updatedAt: true },
    with: {
      resident: { columns: RESIDENT_NAME_SELECT },
      messages: { orderBy: [asc(messageTable.createdAt)], columns: MESSAGE_SELECT },
    },
  })

  return threads
    .map((thread) => {
      const waiting = thread.messages.filter(
        (message) => message.authorResidentId !== null && message.readAt === null,
      )
      const lastMessage = thread.messages[thread.messages.length - 1]

      return {
        id: thread.id,
        resident: thread.resident,
        unreadCount: waiting.length,
        // The moment the person started waiting, not the moment anything last
        // happened in the thread.
        waitingSince: waiting[0]?.createdAt ?? null,
        lastMessageAt: lastMessage?.createdAt ?? thread.updatedAt,
        lastMessagePreview: lastMessage?.body ?? '',
      }
    })
    .sort((a, b) => {
      if (a.waitingSince && b.waitingSince) {
        return a.waitingSince.getTime() - b.waitingSince.getTime()
      }
      // Threads with somebody waiting always come before threads without.
      if (a.waitingSince) return -1
      if (b.waitingSince) return 1
      return b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
    })
}
