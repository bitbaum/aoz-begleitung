'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { Handshake } from 'lucide-react'
import { claimApplication } from '@/lib/actions/opportunities'
import { DASHBOARD_LABELS as L } from '@/lib/constants/labels'
import { DISPLAY_LIMITS } from '@/lib/config/thresholds'
import { daysSinceCeil } from '@/lib/utils'
import type { WaitingApplication } from '@/lib/inbox/waiting'

/**
 * Residents who asked about a place and are still waiting — with the answer
 * one press away.
 *
 * Rendered as rows with their own action rather than as one more ActionTile,
 * because a tile only links onward: the coach would open the listing, find the
 * person among its applicants and press there. Taking a request up is the
 * whole job of this row, so it happens on the row.
 */
export function WaitingApplications({ applications }: { applications: WaitingApplication[] }) {
  const [pending, startTransition] = useTransition()
  if (applications.length === 0) return null

  const shown = applications.slice(0, DISPLAY_LIMITS.dashboardItems * 2)
  const hidden = applications.length - shown.length

  return (
    <section className="card" aria-labelledby="waiting-applications-title">
      <div className="flex items-center gap-2">
        <Handshake className="w-5 h-5 text-brand-primary" aria-hidden="true" />
        <h3 id="waiting-applications-title" className="text-base font-semibold text-ui-text">
          {L.applicationsTitle}
        </h3>
        <span className="chip-warning ms-auto">{applications.length}</span>
      </div>
      <p className="mt-1 text-sm text-ui-muted">{L.applicationsHint}</p>

      <ul className="mt-3 divide-y divide-ui-border">
        {shown.map((row) => (
          <li
            key={row.applicationId}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/residents/${row.residentId}`}
                className="font-medium text-ui-text hover:underline"
              >
                {row.name}
              </Link>
              <p className="text-sm text-ui-muted truncate">
                {L.applicationInterest(row.opportunityTitle)} ·{' '}
                {L.applicationSince(daysSinceCeil(row.since))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <form action={(formData) => startTransition(() => claimApplication(formData))}>
                <input type="hidden" name="applicationId" value={row.applicationId} />
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-secondary min-h-[44px] px-4 text-sm disabled:opacity-60"
                >
                  {L.applicationClaim}
                </button>
              </form>
              <Link
                href={`/opportunities/${row.opportunityId}`}
                className="btn-ghost min-h-[44px] px-3 text-sm"
              >
                {L.applicationOpen}
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="mt-3 text-sm">
          <Link href="/opportunities" className="text-brand-primary hover:underline">
            {L.applicationsMore(hidden)}
          </Link>
        </p>
      )}
    </section>
  )
}
