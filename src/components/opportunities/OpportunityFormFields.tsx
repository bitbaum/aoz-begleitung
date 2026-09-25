'use client'

/**
 * The opportunity form.
 *
 * The "Voraussetzungen" block is the ethical core of the feature and is
 * grouped and captioned as such on purpose: everything in it describes the
 * PLACE. There is deliberately no field anywhere on this form that records
 * anything about a person’s status — see the note in src/lib/db/schema.ts.
 *
 * Every `name=` here is checked against the zod schema by
 * `opportunity-form-fields.test.ts`. A field the schema does not know is
 * stripped on save and vanishes with no error at all.
 *
 * ## Why this is a client component now
 *
 * Because the board was empty, and a listing is fourteen fields. A coach
 * holding a job ad — an e-mail, a PDF, a note from a phone call — had to
 * retype all of it, and the cost of entering a place is the thing standing
 * between residents and anything to apply for at all.
 *
 * The values live in one `useAiForm` store that both the coach and the
 * assistant write to, exactly as the resident intake form does. The inputs
 * keep their `name` attributes, so the enclosing `<form action={…}>` still
 * submits plain FormData and nothing about saving changed.
 *
 * TWO fields are withheld from the model, and both matter more than the
 * convenience does — see OPPORTUNITY_AI_EXCLUDED in lib/config/ai-forms.ts.
 * They are rendered here from the store like everything else, but the model is
 * never shown them and can never write them.
 */

import Link from 'next/link'
import { useActionState } from 'react'
import { useAiForm } from '@fleet/ai-forms/react'
import { AiFormBar } from '@/components/forms/AiFormBar'
import type { OpportunityFormState } from '@/lib/actions/opportunities'
import {
  OPPORTUNITY_KIND_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  PERMIT_REQUIREMENT_HINTS,
  PERMIT_REQUIREMENT_LABELS,
  type OpportunityRecord,
} from '@/lib/config/opportunities'
import { CEFR_LEVELS } from '@/lib/config/learning'
import { OPPORTUNITY_FORM } from '@/lib/config/ai-forms'
import { OPPORTUNITIES_ADMIN_LABELS as L } from '@/lib/constants'

type Props = {
  opportunity?: OpportunityRecord
  /** The save action. Returns a state rather than throwing. @see lib/actions/opportunities */
  action: (state: OpportunityFormState, formData: FormData) => Promise<OpportunityFormState>
  /** Where «Abbrechen» goes back to. */
  cancelHref: string
}

function dateInputValue(value?: Date | null) {
  return value ? value.toISOString().slice(0, 10) : ''
}

function numberInputValue(value?: number | null) {
  return value === null || value === undefined ? '' : String(value)
}

/**
 * The store's starting values.
 *
 * `null` everywhere for a new listing, and that is load-bearing rather than
 * tidy: the hook infers fill-vs-refine from whether ANY value has content, so
 * seeding `kind: 'VOLUNTEERING'` and `status: 'DRAFT'` — the defaults the
 * selects display — would make the very first instruction a refine, and a
 * refine cannot fill an empty form. The selects show those defaults by falling
 * back at render time instead, so what a coach sees is unchanged.
 */
function initialValues(opportunity?: OpportunityRecord): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of OPPORTUNITY_FORM.fields) {
    if (!opportunity) {
      values[field.name] = null
      continue
    }
    const saved = (opportunity as unknown as Record<string, unknown>)[field.name]
    values[field.name] =
      saved instanceof Date ? dateInputValue(saved) : saved === undefined ? null : saved
  }
  return values
}

export function OpportunityFormFields({ opportunity, action, cancelHref }: Props) {
  const form = useAiForm({
    target: OPPORTUNITY_FORM.key,
    fields: OPPORTUNITY_FORM.fields,
    initialValues: initialValues(opportunity),
  })

  // The `<form>` lives here rather than in the page so that a rejected save
  // returns into THIS component and leaves the store above untouched. Hoisted
  // to the page, a rejection unmounted the whole route and every value went
  // with it. @see OpportunityFormState
  const [state, submit, pending] = useActionState<OpportunityFormState, FormData>(action, {})

  const text = (name: string) => (form.values[name] == null ? '' : String(form.values[name]))
  const set = (name: string) => (event: { target: { value: string } }) =>
    form.setValue(name, event.target.value)

  /** A field the assistant wrote is worth a glance before it is saved. */
  const touched = (name: string) => (form.isAiTouched(name) ? ' ring-1 ring-brand-primary/40' : '')

  return (
    <form action={submit} className="card space-y-6">
      {opportunity ? <input type="hidden" name="id" value={opportunity.id} /> : null}

      {/* The reason the save did not go through, in the words the schema
          chose. This used to be swallowed by the error boundary. */}
      {state.error ? (
        <p className="alert-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <AiFormBar
        form={form}
        fillTitle={L.aiFillTitle}
        refineTitle={L.aiRefineTitle}
        fillHint={L.aiFillHint}
        refineHint={L.aiRefineHint}
        fillPlaceholder={L.aiFillPlaceholder}
        refinePlaceholder={L.aiRefinePlaceholder}
      />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-label text-ui-muted">
          {L.sectionDetails}
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-ui-text">{L.titleField}</span>
            <input
              name="title"
              value={text('title')}
              onChange={set('title')}
              placeholder={L.titlePlaceholder}
              required
              maxLength={160}
              className={`input${touched('title')}`}
            />
          </label>

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-ui-text">{L.descriptionField}</span>
            <textarea
              name="description"
              value={text('description')}
              onChange={set('description')}
              required
              maxLength={2000}
              rows={5}
              className={`input min-h-32${touched('description')}`}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-ui-text">{L.organisation}</span>
            <input
              name="organisation"
              value={text('organisation')}
              onChange={set('organisation')}
              required
              maxLength={200}
              className={`input${touched('organisation')}`}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-ui-text">{L.kindField}</span>
            <select
              name="kind"
              value={text('kind') || 'VOLUNTEERING'}
              onChange={set('kind')}
              className={`input${touched('kind')}`}
            >
              {Object.entries(OPPORTUNITY_KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-ui-text">{L.location}</span>
            <input
              name="location"
              value={text('location')}
              onChange={set('location')}
              maxLength={300}
              className={`input${touched('location')}`}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-ui-text">{L.schedule}</span>
            <input
              name="schedule"
              value={text('schedule')}
              onChange={set('schedule')}
              placeholder="z.B. Di + Do, 11–14 Uhr"
              maxLength={300}
              className={`input${touched('schedule')}`}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-ui-text">{L.hoursPerWeek}</span>
            <input
              name="hoursPerWeek"
              type="number"
              min={1}
              value={numberInputValue(form.values.hoursPerWeek as number | null)}
              onChange={set('hoursPerWeek')}
              className={`input${touched('hoursPerWeek')}`}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-ui-text">{L.seats}</span>
            <input
              name="seats"
              type="number"
              min={1}
              value={numberInputValue(form.values.seats as number | null)}
              onChange={set('seats')}
              className={`input${touched('seats')}`}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-ui-text">{L.startsAt}</span>
            <input
              name="startsAt"
              type="date"
              value={text('startsAt')}
              onChange={set('startsAt')}
              className={`input${touched('startsAt')}`}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-ui-text">{L.endsAt}</span>
            <input
              name="endsAt"
              type="date"
              value={text('endsAt')}
              onChange={set('endsAt')}
              className={`input${touched('endsAt')}`}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-ui-border bg-ui-subtle p-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-label text-ui-muted">
            {L.sectionRequirements}
          </h2>
          <p className="mt-1 text-sm text-ui-muted">{L.requirementsHint}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-ui-text">{L.germanLevel}</span>
            <select
              name="germanLevel"
              value={text('germanLevel')}
              onChange={set('germanLevel')}
              className={`input${touched('germanLevel')}`}
            >
              <option value="">{L.germanLevelAny}</option>
              {CEFR_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-ui-text">{L.permitRequirement}</span>
            {/* Never written by the assistant. @see OPPORTUNITY_AI_EXCLUDED */}
            <select
              name="permitRequirement"
              value={text('permitRequirement') || 'NONE'}
              onChange={set('permitRequirement')}
              className="input"
            >
              {Object.entries(PERMIT_REQUIREMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {/* The rule is enforced on the server for both publish paths. It is
                stated here too so a coach meets it while filling the form
                rather than as a rejection after pressing Veröffentlichen. */}
            <span className="block text-xs text-ui-muted">{L.permitRequirementWorkHint}</span>
          </label>

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-ui-text">{L.requirementNote}</span>
            <input
              name="requirementNote"
              value={text('requirementNote')}
              onChange={set('requirementNote')}
              maxLength={500}
              className={`input${touched('requirementNote')}`}
            />
          </label>
        </div>

        <ul className="space-y-1 text-xs text-ui-muted">
          {Object.entries(PERMIT_REQUIREMENT_HINTS).map(([value, hint]) => (
            <li key={value}>
              <span className="font-medium text-ui-text">
                {PERMIT_REQUIREMENT_LABELS[value as keyof typeof PERMIT_REQUIREMENT_LABELS]}
              </span>{' '}
              — {hint}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-label text-ui-muted">
          {L.sectionContact}
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-ui-text">{L.contactName}</span>
            <input
              name="contactName"
              value={text('contactName')}
              onChange={set('contactName')}
              maxLength={200}
              className={`input${touched('contactName')}`}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-ui-text">{L.contactEmail}</span>
            <input
              name="contactEmail"
              type="email"
              value={text('contactEmail')}
              onChange={set('contactEmail')}
              maxLength={200}
              className={`input${touched('contactEmail')}`}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-ui-text">{L.contactPhone}</span>
            <input
              name="contactPhone"
              value={text('contactPhone')}
              onChange={set('contactPhone')}
              maxLength={80}
              className={`input${touched('contactPhone')}`}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-ui-text">{L.website}</span>
            <input
              name="website"
              type="url"
              value={text('website')}
              onChange={set('website')}
              maxLength={500}
              className={`input${touched('website')}`}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-ui-text">{L.statusField}</span>
            {/* Never written by the assistant. @see OPPORTUNITY_AI_EXCLUDED */}
            <select
              name="status"
              value={text('status') || 'DRAFT'}
              onChange={set('status')}
              className="input"
            >
              {Object.entries(OPPORTUNITY_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? L.saving : L.save}
        </button>
        <Link href={cancelHref} className="btn-outline">
          {L.cancel}
        </Link>
      </div>
    </form>
  )
}
