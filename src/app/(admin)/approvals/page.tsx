import type { Metadata } from 'next'

import { PageHeader } from '@/components/ui/Page'
import { ReviewFactForm } from '@/components/admin/ReviewFactForm'
import { ownSeat } from '@/lib/client-facts/access'
import { mayReadFact } from '@/lib/client-facts/policy'
import { pendingFactQueue } from '@/lib/client-facts/queue'
import { expiringFacts } from '@/lib/client-facts/renewals'
import { requirePermission } from '@/lib/auth'
import { CLIENT_FACT_LABELS as L } from '@/lib/constants/labels'
import { formatDate } from '@/lib/utils'
import { residentName } from '@/lib/utils/resident-name'

export const metadata: Metadata = { title: L.queueTitle }
export const dynamic = 'force-dynamic'

/**
 * Freigaben — client-entered facts nobody has looked at yet.
 *
 * `clientFacts:read` says only that this person has a queue. WHICH facts they
 * see, and for which clients, is decided per kind against the care seats they
 * hold: the Jobcoach opens this page and finds permits for the clients he coaches,
 * never their insurance, never a client he does not hold. The narrowing
 * happens in the QUERY — a kind he may not read is a query never issued, not
 * rows fetched and filtered in the markup.
 */
export default async function ApprovalsPage() {
  const viewer = await requirePermission('clientFacts:read')

  const seat = ownSeat(viewer.role)

  const [items, expiring] = await Promise.all([
    pendingFactQueue({ userId: viewer.id, scope: viewer.scope, ownDomain: seat }),
    // Same visibility rule as the queue, applied to the two dated kinds: a
    // Jobcoach sees permits running out and no insurances.
    expiringFacts(new Date()).then((facts) =>
      facts.filter((fact) =>
        mayReadFact(fact.kind, { scope: viewer.scope, seatsForClient: seat ? [seat] : [] }),
      ),
    ),
  ])

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={L.queueTitle} description={L.queueSubtitle} />

      {/*
        Renewals first: an insurance that lapses costs the person their cover,
        which outranks reading an entry somebody typed last week. This is the
        surface that carries it, because STAFF_EMAIL_RECIPIENTS is unset on the
        live box and staff hold no accounts — a mailed reminder reaches nobody.
      */}
      {expiring.length > 0 && (
        <section className="card border-status-warning/30">
          <h2 className="font-semibold text-ui-text">{L.renewalsTitle}</h2>
          <p className="mt-1 text-xs text-ui-muted">{L.renewalsHint}</p>
          <ul className="mt-3 space-y-2">
            {expiring.map((fact) => (
              <li
                key={`${fact.kind}-${fact.id}`}
                className="flex flex-wrap items-baseline justify-between gap-2 border-t border-ui-border pt-2"
              >
                <div>
                  <span className="font-medium text-ui-text">{residentName(fact.resident)}</span>{' '}
                  <span className="text-xs text-ui-muted">
                    {L.kinds[fact.kind]}
                    {fact.kind === 'PERMIT'
                      ? ` · ${L.permitTypes[fact.label]}`
                      : ` · ${fact.label}`}
                  </span>
                </div>
                <span
                  className={`numeric text-xs ${
                    fact.daysLeft < 0 ? 'text-status-error-text' : 'text-status-warning-text'
                  }`}
                >
                  {fact.daysLeft < 0
                    ? L.renewal.expired(Math.abs(fact.daysLeft))
                    : L.renewal.due(fact.daysLeft)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-ui-muted">{L.confirmMeaning}</p>

      {items.length === 0 ? (
        <div className="card">
          <p className="text-ui-text">{L.queueEmpty}</p>
          <p className="mt-1 text-sm text-ui-muted">{L.queueEmptyHint}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="eyebrow">{L.kinds[item.kind]}</p>
                  <p className="font-medium text-ui-text">{residentName(item.resident)}</p>
                </div>
                <p className="numeric text-xs text-ui-muted">{formatDate(item.createdAt)}</p>
              </div>

              <p className="mt-2 text-sm text-ui-text">
                {item.kind === 'PERMIT' ? L.permitTypes[item.summary] : item.summary}
              </p>
              {item.validUntil && (
                <p className="numeric mt-1 text-xs text-ui-muted">
                  {L.fields.validUntil}: {formatDate(item.validUntil)}
                </p>
              )}

              <ReviewFactForm id={item.id} kind={item.kind} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
