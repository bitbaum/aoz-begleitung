'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface OutstandingRule {
  id: string
  title: string
  body: string
  isAmendment: boolean
}

/**
 * Rules this resident has not yet confirmed reading.
 *
 * Deliberately not a single "I accept everything" checkbox: the record is only
 * worth having if it reflects what someone was actually shown, and it exists to
 * make later conversations easier ("this was agreed on the 3rd, here it is"),
 * not to extract consent. Amended rules are labelled as amendments so nobody
 * has to re-read a whole book to find the one sentence that changed.
 */
export function AcknowledgeRulesPanel({ rules }: { rules: OutstandingRule[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(rules[0]?.id ?? null)

  function acknowledge(ruleIds: string[]) {
    setError(null)
    startTransition(async () => {
      const response = await fetch('/api/portal/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleIds }),
      })
      const result = await response.json()
      if (result.success) router.refresh()
      else setError(result.error ?? 'Bestätigung fehlgeschlagen')
    })
  }

  if (rules.length === 0) return null

  return (
    <section
      className="rounded-lg border border-status-warning/40 bg-status-warning/5 p-4"
      aria-labelledby="ack-heading"
    >
      <h2 id="ack-heading" className="font-semibold text-ui-text">
        {rules.length === 1
          ? 'Eine Regel ist neu für Sie'
          : `${rules.length} Regeln sind neu für Sie`}
      </h2>
      <p className="mt-1 text-sm text-ui-muted">
        Bitte lesen Sie sie durch und bestätigen Sie. So weiss jede und jeder im Haus, was gilt —
        das verhindert die meisten Missverständnisse.
      </p>

      <ul className="mt-4 space-y-2">
        {rules.map((rule) => (
          <li key={rule.id} className="rounded-md border border-ui-border bg-ui-surface">
            <button
              type="button"
              onClick={() => setExpanded(expanded === rule.id ? null : rule.id)}
              aria-expanded={expanded === rule.id}
              className="flex min-h-[44px] w-full items-center justify-between gap-3 p-3 text-left"
            >
              <span className="text-sm font-medium text-ui-text">
                {rule.title}
                {rule.isAmendment && (
                  <span className="ml-2 badge bg-status-info/15 text-status-info-text">
                    Geändert
                  </span>
                )}
              </span>
              <span aria-hidden="true" className="text-ui-muted">
                {expanded === rule.id ? '−' : '+'}
              </span>
            </button>

            {expanded === rule.id && (
              <div className="border-t border-ui-border p-3">
                <p className="text-sm leading-6 text-ui-muted">{rule.body}</p>
                <button
                  type="button"
                  onClick={() => acknowledge([rule.id])}
                  disabled={isPending}
                  className="btn-secondary mt-3 min-h-[44px]"
                >
                  Gelesen und verstanden
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {error && (
        <p className="mt-3 text-sm text-status-error-text" role="alert">
          {error}
        </p>
      )}

      {rules.length > 1 && (
        <button
          type="button"
          onClick={() => acknowledge(rules.map((r) => r.id))}
          disabled={isPending}
          className="btn-primary mt-4 min-h-[44px]"
        >
          {isPending ? 'Wird gespeichert…' : 'Alle gelesen und verstanden'}
        </button>
      )}
    </section>
  )
}
