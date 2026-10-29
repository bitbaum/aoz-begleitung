'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { useT } from '@/lib/i18n/LocaleProvider'
import {
  MESSAGE_BODY_MAX_LENGTH,
  isSendableBody,
  mergeMessageRows,
  type MessageRow,
} from '@/lib/messaging/thread'
import { formatDateTime } from '@/lib/utils/formatting'

/**
 * The resident's side of the conversation.
 *
 * Optimistic: the message appears the moment it is sent, before the server
 * confirms. On a phone in a building with poor reception, a compose box that
 * empties and shows nothing for two seconds reads as "it did not send", and
 * people send again.
 */
export function MessageThreadView({
  threadId,
  initialMessages,
}: {
  threadId: string
  initialMessages: MessageRow[]
}) {
  const t = useT()
  const [messages, setMessages] = useState(() => mergeMessageRows(threadId, [], initialMessages))
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  const endRef = useRef<HTMLLIElement>(null)

  // Newest message in view on open — a conversation you have to scroll to read
  // the end of is one people stop reading.
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
      authorResidentId: 'self',
      authorUserId: null,
      body: text,
      createdAt: new Date(),
      readAt: null,
    }
    setMessages((current) => mergeMessageRows(threadId, current, [pending]))

    try {
      const response = await fetch('/api/portal/messages', {
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
      // Put the text back in the box rather than leaving a message on screen
      // that never reached anybody. A message you believe you sent is worse
      // than one you can see failed.
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
        <p className="text-sm text-ui-muted py-8 text-center">{t('messages.empty')}</p>
      ) : (
        <ol className="flex-1 overflow-y-auto space-y-3 pe-1">
          {messages.map((message) => {
            const mine = message.authorResidentId !== null
            return (
              <li key={message.id} className={mine ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`max-w-[85%] rounded-2xl border px-4 py-3 ${
                    mine
                      ? 'bg-brand-primary text-ui-on-accent border-brand-primary/40'
                      : 'bg-ui-surface border-ui-border-strong'
                  }`}
                >
                  <p className={`eyebrow ${mine ? 'text-ui-on-accent/80' : ''}`}>
                    {mine ? t('messages.you') : t('messages.staff')}
                  </p>
                  <p
                    className={`text-sm mt-1 whitespace-pre-line ${mine ? 'text-ui-on-accent' : 'text-ui-text'}`}
                  >
                    {message.body}
                  </p>
                  <p
                    className={`text-2xs mt-2 numeric ${mine ? 'text-ui-on-accent/75' : 'text-ui-muted'}`}
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
          placeholder={t('messages.placeholder')}
          maxLength={MESSAGE_BODY_MAX_LENGTH}
          rows={3}
          className="input"
        />
        {failed && (
          <p role="alert" className="alert-error">
            {t('messages.sendFailed')}
          </p>
        )}
        <button
          type="submit"
          disabled={sending || !isSendableBody(body)}
          className="btn-secondary self-end"
        >
          {sending ? t('messages.sending') : t('messages.send')}
          <Send className="w-4 h-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  )
}
