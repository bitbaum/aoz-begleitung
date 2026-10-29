import { DateInput } from '@/components/ui/DateInput'
import { CARE_ROLES, type CareRoleId } from '@/lib/config/care'
import type { CareAppointment } from '@/lib/actions/care'
import { requestAppointment } from '@/lib/actions/care'
import { formatZurichDateTime } from '@/lib/utils/local-time'
import { getRequestTranslator } from '@/lib/i18n/request'
import { appointmentStatusLabel, careDomainLabel } from '@/lib/i18n/care-labels'

interface PortalAppointmentsCardProps {
  title: string
  empty: string
  appointments: CareAppointment[]
  /**
   * Whether to offer the request form. False on surfaces that only report —
   * the profile page shows the same list without turning into a second place
   * to ask, which would leave a resident wondering if they had asked twice.
   */
  canRequest?: boolean
}

/**
 * A resident's appointments, and the way they ask for one.
 *
 * This was read-only: a list of what staff had scheduled, with no way to
 * respond to it. Every other portal surface accepts the resident's input —
 * expenses, chores, reports, transfers, votes — and the one that structures
 * their relationship with the people responsible for them did not.
 *
 * The status and the staff reply are shown for the same reason the transfer
 * page shows its decision: an answer stored and never rendered is the same as
 * no answer.
 */
export async function PortalAppointmentsCard({
  title,
  empty,
  appointments,
  canRequest = false,
}: PortalAppointmentsCardProps) {
  const { t, locale } = await getRequestTranslator()

  async function submitRequest(formData: FormData): Promise<void> {
    'use server'
    await requestAppointment(formData)
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-ui-text">{title}</h2>

      {appointments.length === 0 ? (
        <p className="text-sm text-ui-muted mt-3">{empty}</p>
      ) : (
        <ul className="space-y-3 mt-3">
          {appointments.map((item) => (
            <li key={item.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ui-text">{item.title}</span>
                <span className="chip chip-neutral">{appointmentStatusLabel(t, item.status)}</span>
              </div>
              <span className="text-sm text-ui-muted">
                {formatZurichDateTime(item.startsAt)}
                {` · ${careDomainLabel(t, item.domain)}`}
                {/* Null while nobody has picked the request up. Saying so is
                    better than an empty gap the resident has to interpret. */}
                {` · ${item.staffName ?? t('care.requestUnclaimed')}`}
                {item.location ? ` · ${item.location}` : ''}
              </span>

              {item.staffNote && (
                <p className="text-sm text-ui-text bg-ui-subtle border border-ui-border rounded-md p-2 mt-1">
                  <span className="eyebrow block mb-0.5">{t('care.requestAnswer')}</span>
                  {item.staffNote}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {canRequest && (
        <details className="mt-4">
          <summary className="btn-secondary inline-flex min-h-[44px] cursor-pointer items-center text-sm list-none [&::-webkit-details-marker]:hidden">
            {t('care.requestAsk')}
          </summary>
          <form action={submitRequest} className="mt-3 space-y-3">
            <div>
              <label htmlFor="request-domain" className="label">
                {t('care.title')}
              </label>
              <select id="request-domain" name="domain" className="input" defaultValue="SOCIAL">
                {CARE_ROLES.map((domain: CareRoleId) => (
                  <option key={domain} value={domain}>
                    {careDomainLabel(t, domain)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="request-when" className="label">
                {t('care.requestWhen')}
              </label>
              <DateInput
                locale={locale}
                id="request-when"
                name="startsAt"
                type="datetime-local"
                required
                className="input"
              />
            </div>

            <div>
              <label htmlFor="request-what" className="label">
                {t('care.requestWhat')}
              </label>
              <textarea id="request-what" name="residentNote" rows={2} className="input" />
            </div>

            <button type="submit" className="btn-primary min-h-[44px] text-sm">
              {t('care.requestSubmit')}
            </button>
          </form>
        </details>
      )}
    </div>
  )
}
