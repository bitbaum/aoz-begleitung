import type { Metadata } from 'next'
import { requireResidentCookie, getPortalAuth } from '@/lib/portal-auth'
import { getRequestTranslator } from '@/lib/i18n/request'
import { EmptyState, PageHeader, PageShell, SectionHeader } from '@/components/ui/Page'
import { EventCreateForm } from '@/components/portal/EventCreateForm'
import { ConfirmEventAction } from '@/components/events/ConfirmEventAction'
import { formatZurichDateTime } from '@/lib/utils/local-time'
import {
  HOUSE_EVENT_CATEGORY_LABEL_KEYS,
  EVENT_RSVP_LABEL_KEYS,
  EVENT_RSVP_STATUSES,
} from '@/lib/config/events'
import {
  listUnitEvents,
  createEventAsResident,
  rsvpToEvent,
  cancelEvent,
  type HouseEventSummary,
} from '@/lib/actions/events'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestTranslator()
  return { title: t('nav.events') }
}
export const dynamic = 'force-dynamic'

async function submitCreateEvent(formData: FormData): Promise<void> {
  'use server'
  await createEventAsResident(formData)
}

async function submitRsvp(formData: FormData): Promise<void> {
  'use server'
  await rsvpToEvent(formData)
}

export default async function PortalEventsPage() {
  await requireResidentCookie('/login')
  const { t } = await getRequestTranslator()
  const [auth, events] = await Promise.all([getPortalAuth(), listUnitEvents()])

  const upcoming = events?.upcoming ?? []
  const past = events?.past ?? []

  function renderEvent(event: HouseEventSummary, { isPast }: { isPast: boolean }) {
    const myRsvp = auth
      ? event.rsvps.find((rsvp) => rsvp.residentId === auth.resident.id)
      : undefined
    const isCreator = Boolean(auth && event.createdByResidentId === auth.resident.id)
    const going = event.rsvps.filter((rsvp) => rsvp.status === 'GOING')

    return (
      <article key={event.id} className={`card ${isPast ? 'opacity-70' : ''}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ui-text">{event.title}</span>
          <span className="chip chip-neutral">
            {t(HOUSE_EVENT_CATEGORY_LABEL_KEYS[event.category])}
          </span>
          {event.status === 'CANCELLED' ? (
            <span className="badge badge-ended">{t('events.cancelled')}</span>
          ) : null}
        </div>

        {event.status === 'CANCELLED' ? (
          <p className="alert-warning mt-2 text-sm" role="status">
            {t('events.cancelledNotice')}
          </p>
        ) : null}

        <p className="mt-1 text-sm text-ui-muted">{event.description}</p>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ui-muted">
          <span className="numeric">{formatZurichDateTime(event.startsAt)}</span>
          {event.location ? <span>{event.location}</span> : null}
          {event.createdByName ? (
            <span>
              {t('events.createdBy')}: {event.createdByName}
            </span>
          ) : null}
        </div>

        {/* Names, not a bare count. "3 × Ich komme" tells you how many people
            are coming; it does not tell you whether any of them is someone you
            would want to sit next to, which is the actual question. */}
        <p className="mt-2 text-sm text-ui-text">
          <span className="eyebrow">{t('events.attendees')}</span>{' '}
          {going.length > 0
            ? going.map((rsvp) => rsvp.residentName).join(', ')
            : t('events.noAttendees')}
        </p>

        {!isPast && event.status !== 'CANCELLED' ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {EVENT_RSVP_STATUSES.map((status) => (
              <form key={status} action={submitRsvp}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="status" value={status} />
                <button
                  type="submit"
                  aria-pressed={myRsvp?.status === status}
                  className={
                    myRsvp?.status === status
                      ? 'btn-secondary min-h-[44px] px-4'
                      : 'btn-outline min-h-[44px] px-4'
                  }
                >
                  {t(EVENT_RSVP_LABEL_KEYS[status])}
                </button>
              </form>
            ))}
            {isCreator ? (
              <ConfirmEventAction
                eventId={event.id}
                action={cancelEvent}
                copy={{
                  trigger: t('events.cancel'),
                  title: t('events.cancelConfirmTitle'),
                  message: t('events.cancelConfirm'),
                  confirm: t('events.cancel'),
                  cancel: t('events.keep'),
                  processing: t('learning.formSaving'),
                  failed: t('opportunities.errorFailed'),
                }}
                buttonClassName="btn-ghost min-h-[44px] px-4"
              />
            ) : null}
          </div>
        ) : null}
      </article>
    )
  }

  return (
    <PageShell>
      <PageHeader title={t('events.title')} description={t('events.subtitle')} />

      {/* Same reason as the marketplace: with no placement there is no house
          to hold an event in, and the form would silently swallow the entry. */}
      {!events ? (
        <EmptyState title={t('placement.none')} />
      ) : (
        <EventCreateForm action={submitCreateEvent} />
      )}

      <section className={events ? 'space-y-3' : 'hidden'}>
        <SectionHeader title={t('events.upcoming')} />
        {upcoming.length === 0 ? (
          <EmptyState title={t('events.emptyUpcoming')} />
        ) : (
          upcoming.map((event) => renderEvent(event, { isPast: false }))
        )}
      </section>

      {/* Only when there is one — an empty "Vorbei" heading is a promise of a
          history that does not exist yet. */}
      {past.length > 0 ? (
        <section className="space-y-3">
          <SectionHeader title={t('events.past')} />
          {past.map((event) => renderEvent(event, { isPast: true }))}
        </section>
      ) : null}
    </PageShell>
  )
}
