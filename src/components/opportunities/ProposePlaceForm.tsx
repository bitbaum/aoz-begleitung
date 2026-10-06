'use client'

/**
 * «Platz vorschlagen» — put THIS person forward for a published place, from
 * their dossier.
 *
 * The dossier's «Einsätze & Bewerbungen» said «Noch nichts» with no way
 * forward: the only way to attach someone was to open a listing and find the
 * person there. This is the same action from the other end — `addApplicant`,
 * the same staff-attached INTERESTED thread, the same refusals RETURNED and
 * shown here. The picker starts empty for the same reason «Person zuordnen»
 * does: a pre-selected first option is a choice nobody made.
 */

import { useActionState } from 'react'
import { addApplicant, type ApplicationActionState } from '@/lib/actions/opportunities'
import { OPPORTUNITIES_ADMIN_LABELS as L } from '@/lib/constants/labels/opportunities'

interface Props {
  residentId: string
  places: readonly { id: string; title: string; organisation: string }[]
}

const INITIAL: ApplicationActionState = {}

export function ProposePlaceForm({ residentId, places }: Props) {
  const [state, formAction, pending] = useActionState(addApplicant, INITIAL)

  return (
    <div className="mt-4 border-t border-ui-border pt-4">
      <h3 className="text-sm font-semibold text-ui-text">{L.proposePlace}</h3>
      {places.length === 0 ? (
        <p className="mt-1 text-sm text-ui-muted">{L.proposePlaceNone}</p>
      ) : (
        <form action={formAction} className="mt-2 space-y-2">
          <p className="text-sm text-ui-muted">{L.proposePlaceHint}</p>
          <div className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="residentId" value={residentId} />
            <label className="block w-full space-y-1.5 sm:w-auto sm:min-w-[16rem] sm:flex-1">
              <span className="block text-xs font-medium text-ui-text">{L.proposePlace}</span>
              <select name="opportunityId" required defaultValue="" className="input">
                <option value="" disabled>
                  {L.proposePlaceOption}
                </option>
                {places.map((place) => (
                  <option key={place.id} value={place.id}>
                    {`${place.title} · ${place.organisation}`}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={pending}
              className="btn-primary min-h-[44px] disabled:opacity-60"
            >
              {pending ? L.saving : L.proposePlace}
            </button>
          </div>
          {state.error ? (
            <p role="alert" className="alert-error text-sm">
              {state.error}
            </p>
          ) : null}
        </form>
      )}
    </div>
  )
}
