import type { Metadata } from 'next'
import { EmptyState, ListShell, PageHeader, PageShell } from '@/components/ui/Page'
import { EVENTS_ADMIN_LABELS } from '@/lib/constants'
import {
  listStaffEvents,
  createEventAsStaff,
  cancelEvent,
  deleteEvent,
  listEventUnitOptions,
} from '@/lib/actions/events'
import { eventUnitOptions, mayDeleteEvent } from '@/lib/config/events'
import { ConfirmEventAction } from '@/components/events/ConfirmEventAction'
import { UI_LABELS } from '@/lib/constants'
import { formatZurichDateTime } from '@/lib/utils/local-time'
import { getCurrentUser, hasPermission, requirePermission } from '@/lib/auth'

export const metadata: Metadata = { title: EVENTS_ADMIN_LABELS.pageTitle }
export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-pending',
  PUBLISHED: 'badge-active',
  CANCELLED: 'badge-ended',
}

async function submitCreateEvent(formData: FormData): Promise<void> {
  'use server'
  await createEventAsStaff(formData)
}

export default async function EventsAdminPage() {
  await requirePermission('events:read')
  const staff = await getCurrentUser()
  const canWriteEvents = !!staff && hasPermission(staff, 'events:write')
  const [events, unitRows] = await Promise.all([listStaffEvents(), listEventUnitOptions()])
  const units = eventUnitOptions(unitRows)

  return (
    <PageShell>
      <PageHeader
        title={EVENTS_ADMIN_LABELS.pageTitle}
        description={EVENTS_ADMIN_LABELS.pageDescription}
      />

      <div className="card">
        {canWriteEvents ? (
          <form action={submitCreateEvent} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="ev-title" className="label">
                {EVENTS_ADMIN_LABELS.formTitle}
              </label>
              <input id="ev-title" name="title" required className="input" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ev-description" className="label">
                {EVENTS_ADMIN_LABELS.formDescription}
              </label>
              <textarea
                id="ev-description"
                name="description"
                required
                rows={2}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="ev-unit" className="label">
                {EVENTS_ADMIN_LABELS.formUnit}
              </label>
              {/* Blank first: a pre-selected first code is a choice nobody made. */}
              <select id="ev-unit" name="housingUnitId" required defaultValue="" className="input">
                <option value="" disabled>
                  {EVENTS_ADMIN_LABELS.unitChoose}
                </option>
                {units.occupied.length > 0 ? (
                  <optgroup label={EVENTS_ADMIN_LABELS.unitGroupOccupied}>
                    {units.occupied.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {units.empty.length > 0 ? (
                  <optgroup label={EVENTS_ADMIN_LABELS.unitGroupEmpty}>
                    {units.empty.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </div>
            <div>
              <label htmlFor="ev-category" className="label">
                {EVENTS_ADMIN_LABELS.formCategory}
              </label>
              <select
                id="ev-category"
                name="category"
                className="input"
                defaultValue="HOUSE_MEETING"
              >
                {Object.entries(EVENTS_ADMIN_LABELS.category).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ev-location" className="label">
                {EVENTS_ADMIN_LABELS.formLocation}
              </label>
              <input id="ev-location" name="location" className="input" />
            </div>
            <div>
              <label htmlFor="ev-startsAt" className="label">
                {EVENTS_ADMIN_LABELS.formStartsAt}
              </label>
              <input
                id="ev-startsAt"
                name="startsAt"
                type="datetime-local"
                required
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary min-h-[44px] px-6">
                {EVENTS_ADMIN_LABELS.submit}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-sm text-ui-muted">Nur Lesen</div>
        )}
      </div>

      {events.length === 0 ? (
        <EmptyState title={EVENTS_ADMIN_LABELS.emptyTitle} />
      ) : (
        <ListShell>
          <div className="divide-y divide-ui-border">
            {events.map((event) => (
              <div key={event.id} className="px-4 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ui-text">{event.title}</span>
                      <span className={`badge ${STATUS_BADGE[event.status]}`}>
                        {EVENTS_ADMIN_LABELS.status[event.status]}
                      </span>
                      <span className="chip chip-neutral">
                        {EVENTS_ADMIN_LABELS.category[event.category]}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-ui-muted">{event.description}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-ui-muted">
                      <span>
                        {EVENTS_ADMIN_LABELS.unit}: {event.housingUnitCode}
                      </span>
                      <span>{formatZurichDateTime(event.startsAt)}</span>
                      {event.location ? <span>{event.location}</span> : null}
                      <span>
                        {EVENTS_ADMIN_LABELS.rsvps}:{' '}
                        {event.rsvps.filter((r) => r.status === 'GOING').length}
                      </span>
                    </div>
                  </div>
                  {canWriteEvents && event.status !== 'CANCELLED' ? (
                    <ConfirmEventAction
                      eventId={event.id}
                      action={cancelEvent}
                      copy={{
                        trigger: EVENTS_ADMIN_LABELS.cancel,
                        title: EVENTS_ADMIN_LABELS.cancelConfirmTitle,
                        message: EVENTS_ADMIN_LABELS.cancelConfirm(
                          event.rsvps.filter((r) => r.status === 'GOING').length,
                        ),
                        confirm: EVENTS_ADMIN_LABELS.cancel,
                        cancel: EVENTS_ADMIN_LABELS.keep,
                        processing: UI_LABELS.processing,
                        failed: EVENTS_ADMIN_LABELS.failed,
                      }}
                    />
                  ) : null}
                  {canWriteEvents && mayDeleteEvent(event) ? (
                    <ConfirmEventAction
                      eventId={event.id}
                      action={deleteEvent}
                      copy={{
                        trigger: EVENTS_ADMIN_LABELS.delete,
                        title: EVENTS_ADMIN_LABELS.deleteConfirmTitle,
                        message: EVENTS_ADMIN_LABELS.deleteConfirm,
                        confirm: EVENTS_ADMIN_LABELS.delete,
                        cancel: UI_LABELS.cancel,
                        processing: UI_LABELS.processing,
                        failed: EVENTS_ADMIN_LABELS.failed,
                      }}
                      buttonClassName="btn-ghost min-h-[44px] px-4 text-status-error"
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </ListShell>
      )}
    </PageShell>
  )
}
