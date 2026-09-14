'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/formatting'
import { MESSAGE_BODY_MAX_LENGTH, isSendableBody, type MessageRow } from '@/lib/messaging/thread'

/**
 * The mechanics a conversation has on BOTH sides — kept out of the two
 * components so that each of them says only what differs: who "mine" is,
 * which labels, and where a message is posted.
 *
 * Optimistic: the message appears the moment it is sent, before the server
 * confirms. On a phone in a building with poor reception, a compose box that
 * empties and shows nothing for two seconds reads as "it did not send", and
 * people send again. On failure the text goes back in the box rather than
 * leaving a message on screen that never reached anybody — a message you
 * believe you sent is worse than one you can see failed.
 */
export function useOptimisticThread({
  initialMessages,
  endpoint,
  pendingAuthor,
}: {
  initialMessages: MessageRow[]
  /** Where a new message is POSTed as `{ body }`. */
  endpoint: string
  /** The author columns of a message this side writes. */
  pendingAuthor: Pick<MessageRow, 'authorResidentId' | 'authorUserId'>
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)

  async function send(event: React.FormEvent) {
    event.preventDefault()
    if (!isSendableBody(body) || sending) return

    const text = body.trim()
    setSending(true)
    setFailed(false)
    setBody('')

    const pending: MessageRow = {
      id: `pending-${messages.length}`,
      ...pendingAuthor,
      body: text,
      createdAt: new Date(),
      readAt: null,
    }
    setMessages((current) => [...current, pending])

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)

      setMessages((current) =>
        current.map((message) => (message.id === pending.id ? result.data.message : message)),
      )
    } catch {
      setMessages((current) => current.filter((message) => message.id !== pending.id))
      setBody(text)
      setFailed(true)
    } finally {
      setSending(false)
    }
  }

  return { messages, body, setBody, sending, failed, send }
}

/**
 * A ref for the sentinel `<li>` after the last message; scrolls it into view
 * whenever the count changes. Newest message in view on open — a conversation
 * you have to scroll to read the end of is one people stop reading.
 *
 * Its own hook, returning the ref bare, because a ref inside the thread
 * object would make every read of that object "a ref read during render"
 * to the React compiler's lint.
 */
export function useScrollToEnd(messageCount: number) {
  const endRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messageCount])
  return endRef
}

/** One message: mine on the right in brand colour, theirs on the left. */
export function MessageBubble({
  message,
  mine,
  author,
}: {
  message: MessageRow
  mine: boolean
  /** The eyebrow — who wrote it, in this side's words. */
  author: string
}) {
  return (
    <li className={mine ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={`max-w-[85%] rounded-2xl border px-4 py-3 ${
          mine
            ? 'bg-brand-primary text-ui-on-accent border-brand-primary/40'
            : 'bg-ui-surface border-ui-border-strong'
        }`}
      >
        <p className={`eyebrow ${mine ? 'text-ui-on-accent/80' : ''}`}>{author}</p>
        <p
          className={`text-sm mt-1 whitespace-pre-line ${mine ? 'text-ui-on-accent' : 'text-ui-text'}`}
        >
          {message.body}
        </p>
        <p className={`text-2xs mt-2 numeric ${mine ? 'text-ui-on-accent/75' : 'text-ui-muted'}`}>
          {formatDateTime(message.createdAt)}
        </p>
      </div>
    </li>
  )
}

export interface ComposeLabels {
  placeholder: string
  sendFailed: string
  sending: string
  send: string
}

/** The compose box, pinned to the bottom of the thread. */
export function ComposeForm({
  thread,
  labels,
}: {
  thread: Pick<
    ReturnType<typeof useOptimisticThread>,
    'body' | 'setBody' | 'sending' | 'failed' | 'send'
  >
  labels: ComposeLabels
}) {
  const { body, setBody, sending, failed, send } = thread
  return (
    <form
      onSubmit={send}
      className="sticky bottom-0 border-t border-ui-border bg-ui-canvas pt-3 flex flex-col gap-2"
    >
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={labels.placeholder}
        maxLength={MESSAGE_BODY_MAX_LENGTH}
        rows={3}
        className="input"
      />
      {failed && (
        <p role="alert" className="alert-error">
          {labels.sendFailed}
        </p>
      )}
      <button
        type="submit"
        disabled={sending || !isSendableBody(body)}
        className="btn-secondary self-end"
      >
        {sending ? labels.sending : labels.send}
        <Send className="w-4 h-4" aria-hidden="true" />
      </button>
    </form>
  )
}
