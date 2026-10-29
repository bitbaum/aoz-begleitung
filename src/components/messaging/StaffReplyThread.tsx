'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { MESSAGES_LABELS } from '@/lib/constants/labels'
import { formatDateTime } from '@/lib/utils/formatting'
import {
  MESSAGE_BODY_MAX_LENGTH,
  isSendableBody,
  mergeMessageRows,
  type MessageRow,
} from '@/lib/messaging/thread'

/**
 * The staff side of one conversation.
 *
 * Deliberately its own component rather than a shared one with the portal:
 * the two sides differ in who "mine" is, in which labels they use, and in
 * whether the copy is translated. A single component parameterised over all
 * three would be harder to read than two that each say one thing.
 */
export function StaffReplyThread({
  residentId,
  threadId,
  initialMessages,
}: {
  residentId: string
  threadId: string
  initialMessages: MessageRow[]
}) {
  const [messages, setMessages] = useState(() => mergeMessageRows(threadId, [], initialMessages))
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  const endRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  async function send(event: React.FormEvent) {
    event.preventDefault()
    if (!isSendableBody(body) || sending) return

    const text = body.trim()
    setSending(true)
    setFailed(false)
    setBody('')

    const pendingId = `pending-${crypto.randomUUID()}`
    const pending: MessageRow = {
      id: pendingId,
      clientId: pendingId,
      authorResidentId: null,
      authorUserId: 'self',
      body: text,
      createdAt: new Date(),
      readAt: null,
    }
    setMessages((current) => mergeMessageRows(threadId, current, [pending]))

    try {
      const response = await fetch(`/api/messages/${residentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)

      setMessages((current) =>
        mergeMessageRows(threadId, current, [{ ...result.data.message, clientId: pendingId }]),
      )
    } catch {
      // The text stays in the box. Clearing it optimistically would leave a
      // caseworker believing they had answered somebody they had not.
      setMessages((current) => current.filter((message) => message.id !== pending.id))
      setBody(text)
      setFailed(true)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 min-h-[60vh]">
      {messages.length === 0 ? (
        <p className="text-sm text-ui-muted py-6">{MESSAGES_LABELS.empty}</p>
      ) : (
        <ol className="flex-1 overflow-y-auto space-y-3 pe-1">
          {messages.map((message) => {
            const fromStaff = message.authorUserId !== null
            return (
              <li
                key={message.id}
                className={fromStaff ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={`max-w-[85%] rounded-2xl border px-4 py-3 ${
                    fromStaff
                      ? 'bg-brand-primary text-ui-on-accent border-brand-primary/40'
                      : 'bg-ui-surface border-ui-border-strong'
                  }`}
                >
                  <p className={`eyebrow ${fromStaff ? 'text-ui-on-accent/80' : ''}`}>
                    {fromStaff ? MESSAGES_LABELS.fromStaff : MESSAGES_LABELS.fromResident}
                  </p>
                  <p
                    className={`text-sm mt-1 whitespace-pre-line ${fromStaff ? 'text-ui-on-accent' : 'text-ui-text'}`}
                  >
                    {message.body}
                  </p>
                  <p
                    className={`text-2xs mt-2 numeric ${fromStaff ? 'text-ui-on-accent/75' : 'text-ui-muted'}`}
                  >
                    {formatDateTime(message.createdAt)}
                  </p>
                </div>
              </li>
            )
          })}
          <li ref={endRef} />
        </ol>
      )}

      <form
        onSubmit={send}
        className="sticky bottom-0 border-t border-ui-border bg-ui-canvas pt-3 flex flex-col gap-2"
      >
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={MESSAGES_LABELS.replyPlaceholder}
          maxLength={MESSAGE_BODY_MAX_LENGTH}
          rows={3}
          className="input"
        />
        {failed && (
          <p role="alert" className="alert-error">
            {MESSAGES_LABELS.sendFailed}
          </p>
        )}
        <button
          type="submit"
          disabled={sending || !isSendableBody(body)}
          className="btn-secondary self-end"
        >
          {sending ? MESSAGES_LABELS.sending : MESSAGES_LABELS.send}
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  )
}
