'use client'

import { MESSAGES_LABELS } from '@/lib/constants/labels'
import type { MessageRow } from '@/lib/messaging/thread'
import { ComposeForm, MessageBubble, useOptimisticThread, useScrollToEnd } from './thread-ui'

/**
 * The staff side of one conversation.
 *
 * Its own component rather than one shared with the portal, because the two
 * sides differ in who "mine" is, in which labels they use, and in whether the
 * copy is translated — this file says exactly those three things. The
 * mechanics they share (optimistic send, the bubble, the compose box) live in
 * thread-ui.tsx.
 */
export function StaffReplyThread({
  residentId,
  initialMessages,
}: {
  residentId: string
  initialMessages: MessageRow[]
}) {
  const thread = useOptimisticThread({
    initialMessages,
    endpoint: `/api/messages/${residentId}`,
    pendingAuthor: { authorResidentId: null, authorUserId: 'self' },
  })
  const endRef = useScrollToEnd(thread.messages.length)

  return (
    <div className="flex flex-col gap-4 min-h-[60vh]">
      {thread.messages.length === 0 ? (
        <p className="text-sm text-ui-muted py-6">{MESSAGES_LABELS.empty}</p>
      ) : (
        <ol className="flex-1 overflow-y-auto space-y-3 pe-1">
          {thread.messages.map((message) => {
            const fromStaff = message.authorUserId !== null
            return (
              <MessageBubble
                key={message.id}
                message={message}
                mine={fromStaff}
                author={fromStaff ? MESSAGES_LABELS.fromStaff : MESSAGES_LABELS.fromResident}
              />
            )
          })}
          <li ref={endRef} />
        </ol>
      )}

      <ComposeForm
        thread={thread}
        labels={{
          placeholder: MESSAGES_LABELS.replyPlaceholder,
          sendFailed: MESSAGES_LABELS.sendFailed,
          sending: MESSAGES_LABELS.sending,
          send: MESSAGES_LABELS.send,
        }}
      />
    </div>
  )
}
