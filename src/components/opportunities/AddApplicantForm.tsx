'use client'

/**
 * Put a person forward for a listing.
 *
 * Client-side only so the action's refusal — "Erst veröffentlichen, dann
 * Personen zuordnen" — is RETURNED and shown here rather than thrown into the
 * error boundary. The page already hides this form on a listing that is not
 * published; the action refuses again, because a stale tab is still a tab.
 */

import { useActionState } from 'react'
import { addApplicant, type ApplicationActionState } from '@/lib/actions/opportunities'
import { OPPORTUNITIES_ADMIN_LABELS as L } from '@/lib/constants/labels/opportunities'

interface Props {
  opportunityId: string
  /** Already resolved through `residentOptionLabel()` on the server. */
  people: readonly { id: string; name: string }[]
}

const INITIAL: ApplicationActionState = {}

export function AddApplicantForm({ opportunityId, people }: Props) {
  const [state, formAction, pending] = useActionState(addApplicant, INITIAL)

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <label className="block w-full space-y-1.5 sm:w-auto">
          <span className="block text-xs font-medium text-ui-text">{L.addApplicant}</span>
          {/* Starts EMPTY: with no empty option the browser pre-selects the
              first name, and one press of «Speichern» attached Alex by
              accident (live 2026-10-02). The action refuses a blank too. */}
          <select name="residentId" required defaultValue="" className="input">
            <option value="" disabled>
              {L.choosePersonOption}
            </option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block w-full space-y-1.5 sm:w-auto sm:min-w-[12rem] sm:flex-1">
          <span className="block text-xs font-medium text-ui-text">{L.applicantNote}</span>
          <input
            name="note"
            maxLength={500}
            placeholder={L.applicantNotePlaceholder}
            className="input"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="btn-primary min-h-[44px] disabled:opacity-60"
        >
          {pending ? L.saving : L.save}
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="alert-error text-sm">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
