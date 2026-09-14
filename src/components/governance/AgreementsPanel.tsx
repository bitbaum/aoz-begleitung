'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatDateNumeric } from '@/lib/utils/formatting'
import type { AgreementStatus } from '@/lib/db'
import { createAgreement, reviewAgreement } from '@/lib/actions/governance'
import {
  AGREEMENT_QUALITY_HINTS,
  AGREEMENT_STATUS_COLORS,
  AGREEMENT_STATUS_LABELS,
} from '@/lib/config/conflict-resolution'

export interface AgreementView {
  id: string
  terms: string
  status: AgreementStatus
  reviewDate: string
  outcomeNotes: string | null
  mediatorName: string | null
  parties: { residentId: string; residentName: string; acceptedAt: string | null }[]
}

interface AgreementsPanelProps {
  incidentId: string
  agreements: AgreementView[]
  /** Residents who can be party to an agreement on this incident. */
  candidates: { id: string; name: string }[]
  defaultReviewDate: string
}

/**
 * The concrete output of a resolution step.
 *
 * An agreement is only useful if it can be checked, so it carries a review date
 * and an explicit "did it hold?" — a free-text resolution note cannot be
 * followed up on, and "resolved" then means nothing more than "someone typed
 * something".
 */
export function AgreementsPanel({
  incidentId,
  agreements,
  candidates,
  defaultReviewDate,
}: AgreementsPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [terms, setTerms] = useState('')
  const [reviewDate, setReviewDate] = useState(defaultReviewDate)
  const [selected, setSelected] = useState<string[]>(candidates.map((c) => c.id).slice(0, 2))
  const [error, setError] = useState<string | null>(null)

  function toggleParty(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await createAgreement({
        incidentId,
        terms,
        residentIds: selected,
        reviewDate: new Date(reviewDate),
      })
      if (result.success) {
        setTerms('')
        setIsOpen(false)
        router.refresh()
      } else {
        setError(result.error)
      }
    })
  }

  function review(agreementId: string, status: 'HELD' | 'BROKEN') {
    startTransition(async () => {
      const result = await reviewAgreement({ agreementId, status })
      if (result.success) router.refresh()
      else setError(result.error)
    })
  }

  return (
    <section className="card" aria-labelledby="agreements-heading">
      <h2 id="agreements-heading" className="mb-1 text-lg font-semibold text-ui-text">
        Abmachungen
      </h2>
      <p className="mb-4 text-sm text-ui-muted">
        Was wurde konkret vereinbart — und hat es gehalten?
      </p>

      {agreements.length === 0 ? (
        <p className="text-sm text-ui-muted">Noch keine Abmachung festgehalten.</p>
      ) : (
        <ul className="space-y-3">
          {agreements.map((agreement) => (
            <li key={agreement.id} className="rounded-md border border-ui-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="whitespace-pre-line text-sm leading-6 text-ui-text">
                  {agreement.terms}
                </p>
                <span className={`badge shrink-0 ${AGREEMENT_STATUS_COLORS[agreement.status]}`}>
                  {AGREEMENT_STATUS_LABELS[agreement.status]}
                </span>
              </div>

              <p className="mt-2 text-xs text-ui-muted">
                Beteiligt: {agreement.parties.map((p) => p.residentName).join(', ')} · Überprüfung:{' '}
                {formatDateNumeric(agreement.reviewDate)}
                {agreement.mediatorName ? ` · Vermittlung: ${agreement.mediatorName}` : ''}
              </p>

              {agreement.outcomeNotes && (
                <p className="mt-2 text-sm text-ui-muted">{agreement.outcomeNotes}</p>
              )}

              {(agreement.status === 'PROPOSED' ||
                agreement.status === 'ACCEPTED' ||
                agreement.status === 'EXPIRED') && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => review(agreement.id, 'HELD')}
                    disabled={isPending}
                    className="btn-secondary min-h-[44px]"
                  >
                    Hat gehalten
                  </button>
                  <button
                    type="button"
                    onClick={() => review(agreement.id, 'BROKEN')}
                    disabled={isPending}
                    className="btn-secondary min-h-[44px]"
                  >
                    Nicht eingehalten
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-3 text-sm text-status-error-text" role="alert">
          {error}
        </p>
      )}

      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="btn-primary mt-4 min-h-[44px]"
        >
          Abmachung festhalten
        </button>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4 border-t border-ui-border pt-4">
          <div>
            <label htmlFor="agreement-terms" className="label">
              Was wurde vereinbart?
            </label>
            <textarea
              id="agreement-terms"
              value={terms}
              onChange={(event) => setTerms(event.target.value)}
              required
              minLength={15}
              rows={4}
              className="input w-full"
              placeholder="In den Worten der Beteiligten"
            />
            {/* Vague agreements are the main reason the same conflict comes back. */}
            <ul className="mt-2 space-y-1 text-xs text-ui-muted">
              {AGREEMENT_QUALITY_HINTS.map((hint) => (
                <li key={hint}>· {hint}</li>
              ))}
            </ul>
          </div>

          <fieldset>
            <legend className="label">Beteiligte</legend>
            <div className="flex flex-wrap gap-2">
              {candidates.map((candidate) => (
                <label
                  key={candidate.id}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md border border-ui-border px-3"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(candidate.id)}
                    onChange={() => toggleParty(candidate.id)}
                  />
                  <span className="text-sm text-ui-text">{candidate.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="agreement-review" className="label">
              Überprüfung am
            </label>
            <input
              id="agreement-review"
              type="date"
              value={reviewDate}
              onChange={(event) => setReviewDate(event.target.value)}
              required
              className="input"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={isPending} className="btn-primary min-h-[44px]">
              {isPending ? 'Wird gespeichert…' : 'Speichern'}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn-secondary min-h-[44px]"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
