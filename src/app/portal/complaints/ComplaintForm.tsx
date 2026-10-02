'use client'

import { useState } from 'react'
import { COMPLAINT_SUBJECT_IDS } from '@/lib/constants/labels'

type Subject = (typeof COMPLAINT_SUBJECT_IDS)[number]

/**
 * Filing a complaint about the organisation.
 *
 * Copy arrives as a prop, already translated by the server. A client component
 * cannot call the request translator, and hardcoding German here is the leak
 * the portal gates exist to prevent — `COMPLAINT_SUBJECT_IDS` is imported for
 * the enum VALUES only, which are language-independent.
 *
 * The anonymity choice sits next to the submit button with its cost written
 * beside it: anonymous means nobody can answer. Burying that would let someone
 * choose anonymity and then wait for a reply that can never arrive.
 */
export interface ComplaintFormLabels {
  subjectLabel: string
  subjects: Record<Subject, string>
  bodyLabel: string
  bodyPlaceholder: string
  anonymousLabel: string
  anonymousHint: string
  submit: string
  tooShort: string
  sent: string
  sentAnonymous: string
}

export function ComplaintForm({ labels }: { labels: ComplaintFormLabels }) {
  const [subject, setSubject] = useState<Subject>('STAFF')
  const [body, setBody] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setState('sending')

    const res = await fetch('/api/portal/complaints', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject, body, anonymous }),
    }).catch(() => null)

    const data = await res?.json().catch(() => null)

    if (!res?.ok || !data?.success) {
      setState('error')
      setMessage(labels.tooShort)
      return
    }

    // The confirmation differs by branch: an anonymous complaint must not
    // promise an answer under "Ihre Meldungen", because it will never appear
    // there and nobody can write back to it.
    setState('sent')
    setMessage(anonymous ? labels.sentAnonymous : labels.sent)
  }

  if (state === 'sent') {
    return (
      <div className="alert-success" role="status">
        {message}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="label" htmlFor="complaint-subject">
          {labels.subjectLabel}
        </label>
        <select
          id="complaint-subject"
          className="input"
          value={subject}
          onChange={(e) => setSubject(e.target.value as Subject)}
        >
          {COMPLAINT_SUBJECT_IDS.map((id) => (
            <option key={id} value={id}>
              {labels.subjects[id]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="complaint-body">
          {labels.bodyLabel}
        </label>
        <textarea
          id="complaint-body"
          className="input min-h-[140px]"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={labels.bodyPlaceholder}
          required
          minLength={10}
          maxLength={4000}
        />
      </div>

      <div className="card bg-ui-subtle">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
          />
          <span>
            <span className="font-medium text-ui-text text-sm">{labels.anonymousLabel}</span>
            <span className="block text-xs text-ui-muted mt-1">{labels.anonymousHint}</span>
          </span>
        </label>
      </div>

      {state === 'error' && (
        <p className="alert-error" role="alert">
          {message}
        </p>
      )}

      <button
        type="submit"
        className="btn-primary min-h-[44px] w-full sm:w-auto"
        disabled={state === 'sending'}
      >
        {labels.submit}
      </button>
    </form>
  )
}
