'use client'

import { DateInput } from '@/components/ui/DateInput'
import { useActionState, useState } from 'react'

import {
  deleteClientFact,
  saveHealthContact,
  saveInsurance,
  savePermit,
  type ClientFactFormState,
} from '@/lib/actions/client-facts'
import { PERMIT_TYPES } from '@/lib/validation/client-facts'
import { renewalState } from '@/lib/client-facts/policy'

/**
 * Meine Unterlagen.
 *
 * The `<form>` lives INSIDE this component, which owns every value, so a
 * returned error leaves the store alone and the person fixes one field. Put
 * the form in the page instead and a rejected save unmounts the route and
 * takes an insurance number copied off a card with it — this repo has shipped
 * that once already.
 */

interface FactLabels {
  title: string
  intro: string
  privacy: string
  statusPending: string
  statusConfirmed: string
  statusRejected: string
  confirmMeaning: string
  staffNote: string
  add: string
  edit: string
  remove: string
  save: string
  cancel: string
  saved: string
  insurance: string
  insuranceEmpty: string
  insurerName: string
  policyNumber: string
  validUntil: string
  validUntilHint: string
  healthContacts: string
  healthContactsEmpty: string
  healthContactsHint: string
  contactName: string
  contactProfession: string
  contactProfessionHint: string
  contactPhone: string
  contactAddress: string
  contactNote: string
  permit: string
  permitHint: string
  permitEmpty: string
  permitType: string
  renewalDue: string
  renewalExpired: string
  renewalNone: string
  permitTypes: Record<string, string>
}

interface InsuranceRow {
  id: string
  insurerName: string
  policyNumber: string | null
  validUntil: string | null
  status: string
  staffNote: string | null
}

interface ContactRow {
  id: string
  name: string
  profession: string
  phone: string | null
  address: string | null
  note: string | null
  status: string
  staffNote: string | null
}

interface PermitRow {
  id: string
  type: string
  validUntil: string | null
  status: string
  staffNote: string | null
}

interface Props {
  locale: string
  labels: FactLabels
  insurances: InsuranceRow[]
  contacts: ContactRow[]
  permit: PermitRow | null
}

const EMPTY: ClientFactFormState = {}

function StatusChip({ status, labels }: { status: string; labels: FactLabels }) {
  const text =
    status === 'CONFIRMED'
      ? labels.statusConfirmed
      : status === 'REJECTED'
        ? labels.statusRejected
        : labels.statusPending
  const tone =
    status === 'CONFIRMED'
      ? 'chip-success'
      : status === 'REJECTED'
        ? 'chip-warning'
        : 'chip-neutral'
  return <span className={`chip ${tone}`}>{text}</span>
}

/** The expiry line. Silent when there is no date — an absent date is not a fault. */
function RenewalLine({ validUntil, labels }: { validUntil: string | null; labels: FactLabels }) {
  const state = renewalState(validUntil ? new Date(validUntil) : null, new Date())
  if (state === 'none' || state === 'ok') return null
  return (
    <p
      className={`mt-1 text-xs ${state === 'expired' ? 'text-status-error-text' : 'text-status-warning-text'}`}
    >
      {state === 'expired' ? labels.renewalExpired : labels.renewalDue}
    </p>
  )
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null
  return <p className="mt-1 text-xs text-status-error-text">{messages[0]}</p>
}

function dateValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

export function ClientFactsBoard({ locale, labels, insurances, contacts, permit }: Props) {
  const [insuranceState, insuranceAction, insurancePending] = useActionState(saveInsurance, EMPTY)
  const [contactState, contactAction, contactPending] = useActionState(saveHealthContact, EMPTY)
  const [permitState, permitAction, permitPending] = useActionState(savePermit, EMPTY)

  const [editingInsurance, setEditingInsurance] = useState<string | null>(null)
  const [addingInsurance, setAddingInsurance] = useState(false)
  const [addingContact, setAddingContact] = useState(false)

  const isRtl = locale === 'ar'

  return (
    <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      <header>
        <h1 className="text-xl sm:text-2xl font-bold text-ui-text">{labels.title}</h1>
        <p className="mt-1 text-sm text-ui-muted">{labels.intro}</p>
        <p className="mt-2 text-xs text-ui-muted">{labels.privacy}</p>
      </header>

      {/* Krankenversicherung */}
      <section className="card">
        <h2 className="font-semibold text-ui-text">{labels.insurance}</h2>

        {insurances.length === 0 && !addingInsurance && (
          <p className="mt-2 text-sm text-ui-muted">{labels.insuranceEmpty}</p>
        )}

        <ul className="mt-3 space-y-3">
          {insurances.map((row) => (
            <li key={row.id} className="border-t border-ui-border pt-3">
              {editingInsurance === row.id ? (
                <form action={insuranceAction} className="space-y-2">
                  <input type="hidden" name="id" value={row.id} />
                  <label className="block text-xs text-ui-muted" htmlFor={`insurer-${row.id}`}>
                    {labels.insurerName}
                  </label>
                  <input
                    id={`insurer-${row.id}`}
                    name="insurerName"
                    defaultValue={row.insurerName}
                    className="w-full min-h-[44px] rounded-lg border border-ui-border px-3"
                    required
                  />
                  <FieldError messages={insuranceState.fieldErrors?.insurerName} />
                  <label className="block text-xs text-ui-muted" htmlFor={`policy-${row.id}`}>
                    {labels.policyNumber}
                  </label>
                  <input
                    id={`policy-${row.id}`}
                    name="policyNumber"
                    defaultValue={row.policyNumber ?? ''}
                    className="w-full min-h-[44px] rounded-lg border border-ui-border px-3"
                  />
                  <label className="block text-xs text-ui-muted" htmlFor={`until-${row.id}`}>
                    {labels.validUntil}
                  </label>
                  <DateInput
                    locale={locale}
                    id={`until-${row.id}`}
                    type="date"
                    name="validUntil"
                    defaultValue={dateValue(row.validUntil)}
                    className="w-full min-h-[44px] rounded-lg border border-ui-border px-3"
                  />
                  <p className="text-xs text-ui-muted">{labels.validUntilHint}</p>
                  {insuranceState.error && (
                    <p className="text-xs text-status-error-text">{insuranceState.error}</p>
                  )}
                  <div className="flex gap-2">
                    <button className="btn-primary" disabled={insurancePending}>
                      {labels.save}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setEditingInsurance(null)}
                    >
                      {labels.cancel}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ui-text">{row.insurerName}</p>
                    {row.policyNumber && (
                      <p className="numeric text-xs text-ui-muted">{row.policyNumber}</p>
                    )}
                    <RenewalLine validUntil={row.validUntil} labels={labels} />
                    {row.staffNote && (
                      <p className="mt-1 text-xs text-ui-muted">
                        {labels.staffNote}: {row.staffNote}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusChip status={row.status} labels={labels} />
                    <button
                      type="button"
                      className="btn-ghost min-h-[44px]"
                      onClick={() => setEditingInsurance(row.id)}
                    >
                      {labels.edit}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost min-h-[44px] text-status-error-text"
                      onClick={() => deleteClientFact('INSURANCE', row.id)}
                    >
                      {labels.remove}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        {addingInsurance ? (
          <form action={insuranceAction} className="mt-3 space-y-2 border-t border-ui-border pt-3">
            <label className="block text-xs text-ui-muted" htmlFor="new-insurer">
              {labels.insurerName}
            </label>
            <input
              id="new-insurer"
              name="insurerName"
              className="w-full min-h-[44px] rounded-lg border border-ui-border px-3"
              required
            />
            <FieldError messages={insuranceState.fieldErrors?.insurerName} />
            <label className="block text-xs text-ui-muted" htmlFor="new-policy">
              {labels.policyNumber}
            </label>
            <input
              id="new-policy"
              name="policyNumber"
              className="w-full min-h-[44px] rounded-lg border border-ui-border px-3"
            />
            <label className="block text-xs text-ui-muted" htmlFor="new-until">
              {labels.validUntil}
            </label>
            <DateInput
              locale={locale}
              id="new-until"
              type="date"
              name="validUntil"
              className="w-full min-h-[44px] rounded-lg border border-ui-border px-3"
            />
            <p className="text-xs text-ui-muted">{labels.validUntilHint}</p>
            {insuranceState.error && (
              <p className="text-xs text-status-error-text">{insuranceState.error}</p>
            )}
            <div className="flex gap-2">
              <button className="btn-primary" disabled={insurancePending}>
                {labels.save}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setAddingInsurance(false)}>
                {labels.cancel}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="btn-outline mt-3"
            onClick={() => setAddingInsurance(true)}
          >
            {labels.add}
          </button>
        )}
      </section>

      {/* Gesundheitsfachpersonen */}
      <section className="card">
        <h2 className="font-semibold text-ui-text">{labels.healthContacts}</h2>
        <p className="mt-1 text-xs text-ui-muted">{labels.healthContactsHint}</p>

        {contacts.length === 0 && !addingContact && (
          <p className="mt-2 text-sm text-ui-muted">{labels.healthContactsEmpty}</p>
        )}

        <ul className="mt-3 space-y-3">
          {contacts.map((row) => (
            <li
              key={row.id}
              className="flex items-start justify-between gap-3 border-t border-ui-border pt-3"
            >
              <div>
                <p className="font-medium text-ui-text">{row.name}</p>
                <p className="text-xs text-ui-muted">{row.profession}</p>
                {row.phone && <p className="numeric text-xs text-ui-muted">{row.phone}</p>}
                {row.address && <p className="text-xs text-ui-muted">{row.address}</p>}
                {row.note && <p className="mt-1 text-xs text-ui-muted">{row.note}</p>}
                {row.staffNote && (
                  <p className="mt-1 text-xs text-ui-muted">
                    {labels.staffNote}: {row.staffNote}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusChip status={row.status} labels={labels} />
                <button
                  type="button"
                  className="btn-ghost min-h-[44px] text-status-error-text"
                  onClick={() => deleteClientFact('HEALTH_CONTACT', row.id)}
                >
                  {labels.remove}
                </button>
              </div>
            </li>
          ))}
        </ul>

        {addingContact ? (
          <form action={contactAction} className="mt-3 space-y-2 border-t border-ui-border pt-3">
            <label className="block text-xs text-ui-muted" htmlFor="contact-name">
              {labels.contactName}
            </label>
            <input
              id="contact-name"
              name="name"
              className="w-full min-h-[44px] rounded-lg border border-ui-border px-3"
              required
            />
            <FieldError messages={contactState.fieldErrors?.name} />
            <label className="block text-xs text-ui-muted" htmlFor="contact-profession">
              {labels.contactProfession}
            </label>
            <input
              id="contact-profession"
              name="profession"
              placeholder={labels.contactProfessionHint}
              className="w-full min-h-[44px] rounded-lg border border-ui-border px-3"
              required
            />
            <FieldError messages={contactState.fieldErrors?.profession} />
            <label className="block text-xs text-ui-muted" htmlFor="contact-phone">
              {labels.contactPhone}
            </label>
            <input
              id="contact-phone"
              name="phone"
              inputMode="tel"
              className="w-full min-h-[44px] rounded-lg border border-ui-border px-3"
            />
            <label className="block text-xs text-ui-muted" htmlFor="contact-address">
              {labels.contactAddress}
            </label>
            <input
              id="contact-address"
              name="address"
              className="w-full min-h-[44px] rounded-lg border border-ui-border px-3"
            />
            <label className="block text-xs text-ui-muted" htmlFor="contact-note">
              {labels.contactNote}
            </label>
            <textarea
              id="contact-note"
              name="note"
              rows={2}
              className="w-full rounded-lg border border-ui-border p-3"
            />
            {contactState.error && (
              <p className="text-xs text-status-error-text">{contactState.error}</p>
            )}
            <div className="flex gap-2">
              <button className="btn-primary" disabled={contactPending}>
                {labels.save}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setAddingContact(false)}>
                {labels.cancel}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn-outline mt-3" onClick={() => setAddingContact(true)}>
            {labels.add}
          </button>
        )}
      </section>

      {/* Aufenthaltsstatus */}
      <section className="card">
        <h2 className="font-semibold text-ui-text">{labels.permit}</h2>
        <p className="mt-1 text-xs text-ui-muted">{labels.permitHint}</p>

        <form action={permitAction} className="mt-3 space-y-2">
          <label className="block text-xs text-ui-muted" htmlFor="permit-type">
            {labels.permitType}
          </label>
          <select
            id="permit-type"
            name="type"
            defaultValue={permit?.type ?? 'UNSPECIFIED'}
            className="w-full min-h-[44px] rounded-lg border border-ui-border px-3"
          >
            {PERMIT_TYPES.map((type) => (
              <option key={type} value={type}>
                {labels.permitTypes[type]}
              </option>
            ))}
          </select>
          <label className="block text-xs text-ui-muted" htmlFor="permit-until">
            {labels.validUntil}
          </label>
          <DateInput
            locale={locale}
            id="permit-until"
            type="date"
            name="validUntil"
            defaultValue={dateValue(permit?.validUntil ?? null)}
            className="w-full min-h-[44px] rounded-lg border border-ui-border px-3"
          />
          <p className="text-xs text-ui-muted">{labels.validUntilHint}</p>
          <RenewalLine validUntil={permit?.validUntil ?? null} labels={labels} />
          {permit?.staffNote && (
            <p className="text-xs text-ui-muted">
              {labels.staffNote}: {permit.staffNote}
            </p>
          )}
          {permitState.error && (
            <p className="text-xs text-status-error-text">{permitState.error}</p>
          )}
          <div className="flex items-center gap-3">
            <button className="btn-primary" disabled={permitPending}>
              {labels.save}
            </button>
            {permit && <StatusChip status={permit.status} labels={labels} />}
          </div>
        </form>
      </section>

      <p className="text-xs text-ui-muted">{labels.confirmMeaning}</p>
    </div>
  )
}
