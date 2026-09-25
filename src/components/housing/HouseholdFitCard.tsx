import { HOUSEHOLD_FIT_LABELS as L, INCIDENT_TYPE_LABELS } from '@/lib/constants/labels'
import type { FitNote } from '@/lib/housing/fit-notes'

/**
 * What in this household could cause friction, and what conversation helps.
 *
 * Replaces a card that singled out individual residents as the ones who did
 * not fit and offered to relocate them. Every line here is about
 * the household; none names a person or suggests a move.
 */
export function HouseholdFitCard({ notes }: { notes: FitNote[] }) {
  return (
    <section className="card" aria-labelledby="household-fit-title">
      <h2 id="household-fit-title" className="text-lg font-semibold text-ui-text">
        {L.title}
      </h2>
      <p className="mt-1 text-sm text-ui-muted">{L.intro}</p>
      {notes.length === 0 ? (
        <p className="mt-3 text-sm text-ui-text">{L.none}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {notes.map((note) => (
            <li
              key={note.id === 'REPEATED_INCIDENTS' ? `${note.id}:${note.incidentType}` : note.id}
              className="rounded-lg border border-ui-border bg-ui-subtle p-3 text-sm text-ui-text"
            >
              {note.id === 'REPEATED_INCIDENTS'
                ? L.repeatedIncidents(
                    INCIDENT_TYPE_LABELS[note.incidentType] ?? note.incidentType,
                    note.count,
                  )
                : L.notes[note.id]}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
