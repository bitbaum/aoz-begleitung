'use client'

import { DateInput } from '@/components/ui/DateInput'
import { useState } from 'react'

import {
  APPOINTMENT_STATUS_LABELS,
  CARE_ATTRIBUTE_CATALOG,
  CARE_LABELS,
  CARE_ROLE_LABELS,
  CARE_ROLES,
  type CareRoleId,
} from '@/lib/config/care'
import type { InterpreterNeed } from '@/lib/db'
import { INTERPRETER_LABELS, interpreterPrompt, needsInterpreter } from '@/lib/config/interpreting'
import type { CareAppointment, CareAttributeValue } from '@/lib/actions/care'
import {
  createAppointment,
  respondToAppointmentRequest,
  rescheduleAppointment,
  saveCareAttributes,
  setAppointmentStatus,
} from '@/lib/actions/care'
import { ChevronDown } from 'lucide-react'
import { formatZurichDateTime } from '@/lib/utils/local-time'
import { SATISFACTION_EMOJIS, SATISFACTION_LABELS } from '@/lib/constants'

interface CareWorkspaceProps {
  residentId: string
  /**
   * Whether conversations with this person need an interpreter.
   *
   * Shown HERE, beside the field where a time is chosen, rather than only on
   * the profile. Medios needs roughly a day's notice, so the moment that
   * decides whether an interpreter can be there is the moment somebody picks
   * a date — a note further up the page is read after the decision, if at all.
   */
  interpreterNeed: InterpreterNeed
  attributes: CareAttributeValue[]
  appointments: CareAppointment[]
  /**
   * The seats this viewer works — and therefore the only ones rendered.
   *
   * The workspace used to map over CARE_ROLES and pass the writable set down
   * as an edit flag, so every staff member READ all four domains and merely
   * could not type in three of them. A job coach opening any client saw
   * Housing's "Schlüssel: fehlt" and Sozialarbeit's "Nächster Schritt" — notes
   * another discipline wrote about a person, on a page he opened to do a
   * different job. Leitung still receives all four here.
   */
  writableDomains: CareRoleId[]
}

export function CareWorkspace({
  residentId,
  interpreterNeed,
  attributes,
  appointments,
  writableDomains,
}: CareWorkspaceProps) {
  // Ordered by CARE_ROLES rather than by the caller's array, so the panels sit
  // in the same order for everyone who sees more than one.
  const domains = CARE_ROLES.filter((domain) => writableDomains.includes(domain))

  if (domains.length === 0) return null

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-ui-text">{CARE_LABELS.workspaceTitle}</h2>
      <p className="text-sm text-ui-muted mt-1 mb-6">{CARE_LABELS.workspaceSubtitle(domains)}</p>

      <div className="space-y-6">
        {domains.map((domain) => (
          <DomainPanel
            key={domain}
            residentId={residentId}
            interpreterNeed={interpreterNeed}
            domain={domain}
            attributes={attributes.filter((item) => item.domain === domain)}
            appointments={appointments.filter((item) => item.domain === domain)}
          />
        ))}
      </div>
    </div>
  )
}

function DomainPanel({
  residentId,
  interpreterNeed,
  domain,
  attributes,
  appointments,
}: {
  residentId: string
  interpreterNeed: InterpreterNeed
  domain: CareRoleId
  attributes: CareAttributeValue[]
  appointments: CareAppointment[]
}) {
  const byKey = new Map(attributes.map((item) => [item.key, item.value]))
  // Requests first: they are the only ones waiting on this staff member, and
  // an ask buried under next week's calendar is an ask nobody answers.
  const requests = appointments.filter((item) => item.status === 'REQUESTED')
  const upcoming = appointments.filter((item) => item.status === 'SCHEDULED')
  const past = appointments.filter(
    (item) => item.status !== 'SCHEDULED' && item.status !== 'REQUESTED',
  )
  const hasContent = attributes.some((item) => item.value?.trim()) || appointments.length > 0

  return (
    // Four of these stack on the page. When every panel is a wall of empty
    // inputs, the page is ~2500px of form for a person with no care notes yet
    // — so an empty domain collapses to its heading and opens on demand,
    // while a domain with real content stays open.
    <details open={hasContent || undefined} className="group border border-ui-border rounded-lg">
      <summary className="flex min-h-[44px] cursor-pointer select-none list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <h3 className="font-semibold text-ui-text">{CARE_ROLE_LABELS[domain]}</h3>
        <span className="flex items-center gap-2 text-xs text-ui-muted">
          {!hasContent && CARE_LABELS.domainEmpty}
          <ChevronDown
            className="w-4 h-4 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="px-4 pb-4">
        <AttributeForm residentId={residentId} domain={domain} values={byKey} />

        <div className="mt-6">
          <h4 className="text-sm font-medium text-ui-text mb-3">{CARE_LABELS.appointments}</h4>
          {requests.length > 0 && (
            <div className="mb-4">
              <p className="eyebrow mb-2">{CARE_LABELS.requestsHeading}</p>
              <ul className="space-y-3">
                {requests.map((item) => (
                  <AppointmentRow key={item.id} item={item} canWrite />
                ))}
              </ul>
            </div>
          )}

          {upcoming.length === 0 && past.length === 0 && requests.length === 0 ? (
            <p className="text-sm text-ui-muted">{CARE_LABELS.appointmentsEmpty}</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((item) => (
                <AppointmentRow key={item.id} item={item} canWrite />
              ))}
              {/* A past appointment is a record, not a plan: nobody re-decides
                  whether a meeting that already happened is going to happen. */}
              {past.map((item) => (
                <AppointmentRow key={item.id} item={item} canWrite={false} />
              ))}
            </ul>
          )}
          {needsInterpreter(interpreterNeed) && (
            <p className="alert-info mt-3 text-sm" role="note">
              {INTERPRETER_LABELS.leadTimeOk} {INTERPRETER_LABELS.bookingHint}
            </p>
          )}
          <AppointmentForm
            residentId={residentId}
            domain={domain}
            interpreterNeed={interpreterNeed}
          />
        </div>
      </div>
    </details>
  )
}

function AttributeForm({
  residentId,
  domain,
  values,
}: {
  residentId: string
  domain: CareRoleId
  values: Map<string, string>
}) {
  async function submit(formData: FormData): Promise<void> {
    await saveCareAttributes(formData)
  }

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="residentId" value={residentId} />
      <input type="hidden" name="domain" value={domain} />
      {CARE_ATTRIBUTE_CATALOG[domain].map((def) => {
        const fieldId = `attr-${domain}-${def.key}`
        const current = values.get(def.key) || ''
        return (
          <div key={def.key}>
            <label htmlFor={fieldId} className="label">
              {def.label}
            </label>
            {def.kind === 'textarea' ? (
              <textarea
                id={fieldId}
                name={`attr.${def.key}`}
                rows={2}
                className="input"
                defaultValue={current}
              />
            ) : def.kind === 'select' ? (
              <select
                id={fieldId}
                name={`attr.${def.key}`}
                className="input"
                defaultValue={current}
              >
                <option value="">{CARE_LABELS.unassigned}</option>
                {(def.options || []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={fieldId}
                name={`attr.${def.key}`}
                className="input"
                defaultValue={current}
              />
            )}
            {def.hint && <p className="text-xs text-ui-muted mt-1">{def.hint}</p>}
          </div>
        )
      })}
      <button type="submit" className="btn-primary min-h-[44px]">
        {CARE_LABELS.save}
      </button>
    </form>
  )
}

function AppointmentForm({
  residentId,
  domain,
  interpreterNeed,
}: {
  residentId: string
  domain: CareRoleId
  interpreterNeed: InterpreterNeed
}) {
  /**
   * The chosen time, so the interpreter warning can be about THIS appointment.
   *
   * The banner above this form is a standing fact — "this person needs
   * interpreting" — and it said the same reassuring sentence whether the
   * meeting was next month or tomorrow morning. `interpreterPrompt` existed to
   * answer the actual question and was called by nothing; its own docstring
   * says it is "a single function so the staff form, the care workspace and
   * any future surface cannot disagree", and neither surface used it.
   *
   * The failure it prevents is concrete: booking a consequential meeting
   * inside the lead time and finding out at the door that nobody can speak to
   * the person.
   */
  const [startsAtInput, setStartsAtInput] = useState('')

  async function submit(formData: FormData): Promise<void> {
    await createAppointment(formData)
    setStartsAtInput('')
  }

  const chosen = startsAtInput ? new Date(startsAtInput) : null
  const prompt = interpreterPrompt(
    interpreterNeed,
    chosen && !Number.isNaN(chosen.getTime()) ? chosen : null,
    new Date(),
  )

  return (
    <details className="mt-4">
      <summary className="min-h-[44px] cursor-pointer text-sm font-medium text-brand-primary list-none [&::-webkit-details-marker]:hidden">
        {CARE_LABELS.appointmentAdd}
      </summary>
      <form action={submit} className="mt-3 space-y-3">
        <input type="hidden" name="residentId" value={residentId} />
        <input type="hidden" name="domain" value={domain} />
        <div>
          <label htmlFor={`appt-title-${domain}`} className="label">
            {CARE_LABELS.appointmentTitle}
          </label>
          <input
            id={`appt-title-${domain}`}
            name="title"
            required
            minLength={2}
            className="input"
          />
        </div>
        <div>
          <label htmlFor={`appt-when-${domain}`} className="label">
            {CARE_LABELS.appointmentWhen}
          </label>
          <DateInput
            id={`appt-when-${domain}`}
            name="startsAt"
            type="datetime-local"
            required
            className="input"
            value={startsAtInput}
            onChange={(event) => setStartsAtInput(event.target.value)}
          />
          {/* Said where the time is picked, not buried in a profile. */}
          {prompt === 'too-late' && (
            <p className="alert-warning mt-2 text-sm" role="alert">
              {INTERPRETER_LABELS.leadTimeWarning} {INTERPRETER_LABELS.bookingHint}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`appt-where-${domain}`} className="label">
            {CARE_LABELS.appointmentWhere}
          </label>
          <input id={`appt-where-${domain}`} name="location" className="input" />
        </div>
        <div>
          <label htmlFor={`appt-notes-${domain}`} className="label">
            {CARE_LABELS.appointmentNotes}
          </label>
          <textarea id={`appt-notes-${domain}`} name="notes" rows={2} className="input" />
          <p className="text-xs text-ui-muted mt-1">{CARE_LABELS.appointmentNotesHint}</p>
        </div>
        <button type="submit" className="btn-primary min-h-[44px]">
          {CARE_LABELS.save}
        </button>
      </form>
    </details>
  )
}

function AppointmentRow({ item, canWrite }: { item: CareAppointment; canWrite: boolean }) {
  async function setStatus(formData: FormData): Promise<void> {
    await setAppointmentStatus(formData)
  }

  async function respond(formData: FormData): Promise<void> {
    await respondToAppointmentRequest(formData)
  }

  async function move(formData: FormData): Promise<void> {
    await rescheduleAppointment(formData)
  }

  const isRequest = item.status === 'REQUESTED'

  return (
    <li className="border border-ui-border rounded-md p-3">
      <p className="font-medium text-ui-text">{item.title}</p>
      <p className="text-sm text-ui-muted">
        {formatZurichDateTime(item.startsAt)}
        {item.location ? ` · ${item.location}` : ''}
        {/* Null on a request nobody has taken. Saying so beats a stray
            separator with nothing after it. */}
        {` · ${item.staffName ?? CARE_LABELS.requestUnclaimed}`}
        {` · ${APPOINTMENT_STATUS_LABELS[item.status]}`}
      </p>
      {item.notes && <p className="text-sm text-ui-muted mt-1 whitespace-pre-wrap">{item.notes}</p>}

      {/* What the resident asked for, in their words. Without it a coach is
          answering a time slot rather than a person. */}
      {item.residentNote && (
        <p className="text-sm text-ui-text mt-2 whitespace-pre-wrap border-l-2 border-brand-secondary pl-3">
          {item.residentNote}
        </p>
      )}

      {canWrite && isRequest && (
        <div className="mt-3 flex flex-wrap gap-2">
          <details>
            <summary className="btn-primary inline-flex min-h-[44px] cursor-pointer items-center text-sm list-none [&::-webkit-details-marker]:hidden">
              {CARE_LABELS.accept}
            </summary>
            <form action={respond} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="decision" value="ACCEPT" />
              <div>
                <label htmlFor={`accept-when-${item.id}`} className="label">
                  {CARE_LABELS.newTimeLabel}
                </label>
                {/* Blank keeps the time the resident proposed. Prefilling it
                    would make "confirm what they asked for" look like a change. */}
                <DateInput
                  id={`accept-when-${item.id}`}
                  name="startsAt"
                  type="datetime-local"
                  className="input"
                />
              </div>
              <div>
                <label htmlFor={`accept-note-${item.id}`} className="label">
                  {CARE_LABELS.staffNoteLabel}
                </label>
                <input id={`accept-note-${item.id}`} name="staffNote" className="input" />
              </div>
              <button type="submit" className="btn-primary min-h-[44px] text-sm">
                {CARE_LABELS.accept}
              </button>
            </form>
          </details>

          <details>
            <summary className="btn-secondary inline-flex min-h-[44px] cursor-pointer items-center text-sm list-none [&::-webkit-details-marker]:hidden">
              {CARE_LABELS.decline}
            </summary>
            <form action={respond} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="decision" value="DECLINE" />
              <div>
                <label htmlFor={`decline-note-${item.id}`} className="label">
                  {CARE_LABELS.staffNoteLabel}
                </label>
                {/* Required: the resident reads this sentence, and a refusal
                    with no reason is the thing this product keeps promising
                    not to do. */}
                <input
                  id={`decline-note-${item.id}`}
                  name="staffNote"
                  required
                  minLength={3}
                  className="input"
                />
              </div>
              <button type="submit" className="btn-danger min-h-[44px] text-sm">
                {CARE_LABELS.decline}
              </button>
            </form>
          </details>
        </div>
      )}
      {canWrite && item.status === 'SCHEDULED' && (
        <div className="mt-3 space-y-2">
          {/* Closing the appointment is where a check-in belongs: it is the one
              moment staff have actually spoken with the person. The scale used
              to sit on the client page permanently, so a score could be
              recorded for someone nobody had talked to. */}
          <details>
            <summary className="btn-secondary inline-flex min-h-[44px] cursor-pointer items-center text-sm list-none [&::-webkit-details-marker]:hidden">
              {CARE_LABELS.markDone}
            </summary>
            <form action={setStatus} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="status" value="COMPLETED" />

              <fieldset>
                <legend className="label">{CARE_LABELS.checkInLegend}</legend>
                <p className="text-xs text-ui-muted mb-2">{CARE_LABELS.checkInHint}</p>
                <div className="flex flex-wrap gap-2">
                  {SATISFACTION_EMOJIS.map((emoji, index) => {
                    const value = index + 1
                    const inputId = `checkin-${item.id}-${value}`
                    return (
                      <label key={value} htmlFor={inputId} className="cursor-pointer">
                        <input
                          type="radio"
                          id={inputId}
                          name="overallSatisfaction"
                          value={value}
                          className="sr-only peer"
                        />
                        <span
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-ui-border text-2xl peer-checked:border-brand-primary peer-checked:bg-brand-primary/8 peer-focus-visible:outline peer-focus-visible:outline-2"
                          title={SATISFACTION_LABELS[index]}
                        >
                          <span aria-hidden="true">{emoji}</span>
                          <span className="sr-only">{SATISFACTION_LABELS[index]}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <div>
                <label htmlFor={`checkin-concerns-${item.id}`} className="label">
                  {CARE_LABELS.checkInConcerns}
                </label>
                <textarea
                  id={`checkin-concerns-${item.id}`}
                  name="concerns"
                  rows={2}
                  className="input"
                />
                <p className="text-xs text-ui-muted mt-1">{CARE_LABELS.appointmentNotesHint}</p>
              </div>

              <button type="submit" className="btn-primary min-h-[44px] text-sm">
                {CARE_LABELS.completeSubmit}
              </button>
            </form>
          </details>

          <details>
            <summary className="btn-secondary inline-flex min-h-[44px] cursor-pointer items-center text-sm list-none [&::-webkit-details-marker]:hidden">
              {CARE_LABELS.reschedule}
            </summary>
            {/* Moving a meeting used to mean cancelling it and creating another
                one. The resident's card did not say "moved to Tuesday" — it
                said the meeting was called off, then a different one appeared. */}
            <form action={move} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={item.id} />
              <div>
                <label htmlFor={`move-when-${item.id}`} className="label">
                  {CARE_LABELS.newTimeLabel}
                </label>
                <DateInput
                  id={`move-when-${item.id}`}
                  name="startsAt"
                  type="datetime-local"
                  required
                  className="input"
                />
              </div>
              <div>
                <label htmlFor={`move-note-${item.id}`} className="label">
                  {CARE_LABELS.staffNoteLabel}
                </label>
                <input id={`move-note-${item.id}`} name="staffNote" className="input" />
              </div>
              <button type="submit" className="btn-primary min-h-[44px] text-sm">
                {CARE_LABELS.reschedule}
              </button>
            </form>
          </details>

          <form action={setStatus}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="status" value="CANCELLED" />
            <button type="submit" className="btn-secondary min-h-[44px] text-sm">
              {CARE_LABELS.markCancel}
            </button>
          </form>
        </div>
      )}
    </li>
  )
}
