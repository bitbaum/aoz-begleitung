'use client'

import { useT } from '@/lib/i18n/LocaleProvider'
import type { MessageRow } from '@/lib/messaging/thread'
import {
  ComposeForm,
  MessageBubble,
  useOptimisticThread,
  useScrollToEnd,
} from '@/components/messaging/thread-ui'

/**
 * The resident's side of the conversation: "mine" is the resident, the copy
 * is translated. The optimistic send and the bubbles are shared with the
 * staff side in components/messaging/thread-ui.tsx.
 */
export function MessageThreadView({ initialMessages }: { initialMessages: MessageRow[] }) {
  const t = useT()
  const thread = useOptimisticThread({
    initialMessages,
    endpoint: '/api/portal/messages',
    pendingAuthor: { authorResidentId: 'self', authorUserId: null },
  })
  const endRef = useScrollToEnd(thread.messages.length)

  return (
    <div className="flex flex-col gap-4 min-h-[60vh]">
      {thread.messages.length === 0 ? (
        <p className="text-sm text-ui-muted py-8 text-center">{t('messages.empty')}</p>
      ) : (
        <ol className="flex-1 overflow-y-auto space-y-3 pe-1">
          {thread.messages.map((message) => {
            const mine = message.authorResidentId !== null
            return (
              <MessageBubble
                key={message.id}
                message={message}
                mine={mine}
                author={mine ? t('messages.you') : t('messages.staff')}
              />
            )
          })}
          <li ref={endRef} />
        </ol>
      )}

      <ComposeForm
        thread={thread}
        labels={{
          placeholder: t('messages.placeholder'),
          sendFailed: t('messages.sendFailed'),
          sending: t('messages.sending'),
          send: t('messages.send'),
        }}
      />
    </div>
  )
}
