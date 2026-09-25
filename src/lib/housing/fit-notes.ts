/**
 * Fit notes for a HOUSEHOLD — never a verdict on a person.
 *
 * ## What this replaced, and why
 *
 * The unit page used to rank people: it counted how often
 * each resident was the subject of an incident and listed the names of anyone
 * at two or more, and a second card flagged individual residents as having
 * adaptation problems and offered to relocate them. Both answered the
 * question "who is the problem here?" — which is a judgement about a person,
 * built from counts, in a product whose first principle is that people are
 * not data points. The card also compared cleanliness as a symmetric
 * difference, the exact model the directional cleanliness work replaced.
 *
 * ## What this answers instead
 *
 * "What in this household could cause friction, and what conversation would
 * help?" Every note describes a DIFFERENCE between people or a PATTERN of
 * events in the flat. None names anyone or counts anything per person, and
 * none recommends a move: a placement change stays a staff decision, taken
 * with the people concerned, not a button offered by a count.
 */

import { frictionBetween, type CleanlinessProfile } from '@/lib/compatibility/cleanliness'

export interface FitNoteResident extends CleanlinessProfile {
  sleepSchedule: string
  smokingStatus: string
  noiseTolerance: number
  privacyNeed: number
}

export interface FitNoteIncident {
  category: string
  type: string
  date: Date | string
}

export type FitNote =
  | { id: 'SLEEP_RHYTHMS' }
  | { id: 'SMOKING' }
  | { id: 'CLEANLINESS_EXPECTATIONS' }
  | { id: 'NOISE' }
  | { id: 'PRIVACY' }
  | { id: 'REPEATED_INCIDENTS'; incidentType: string; count: number }

/** How far apart two people on a 1–5 scale must be before it is worth a note. */
export const SCALE_SPREAD_WORTH_A_NOTE = 3

/**
 * A directional cleanliness score below this means someone's expectation of
 * the others clearly goes unmet — the same 0–100 scale the matcher uses.
 */
export const CLEANLINESS_FRICTION_WORTH_A_NOTE = 50

/** A pattern, not an incident: this many of one kind in the window. */
export const REPEATED_INCIDENTS_THRESHOLD = 2
export const INCIDENT_WINDOW_DAYS = 30

const CONFLICT_CATEGORIES = new Set(['INTERPERSONAL', 'SAFETY'])

function spread(values: number[]): number {
  return values.length === 0 ? 0 : Math.max(...values) - Math.min(...values)
}

export function householdFitNotes(
  residents: readonly FitNoteResident[],
  incidents: readonly FitNoteIncident[],
  now: Date = new Date(),
): FitNote[] {
  const notes: FitNote[] = []

  if (residents.length >= 2) {
    const schedules = new Set(residents.map((r) => r.sleepSchedule))
    if (schedules.has('EARLY_BIRD') && schedules.has('NIGHT_OWL')) {
      notes.push({ id: 'SLEEP_RHYTHMS' })
    }

    const smokes = residents.some((r) => r.smokingStatus !== 'NON_SMOKER')
    const doesNot = residents.some((r) => r.smokingStatus === 'NON_SMOKER')
    if (smokes && doesNot) notes.push({ id: 'SMOKING' })

    // Directional, as everywhere else: friction is one person's expectation
    // going unmet by another, not the distance between two numbers.
    const cleanlinessFriction = residents.some((observer, i) =>
      residents.some(
        (other, j) =>
          i !== j && frictionBetween(observer, other).score < CLEANLINESS_FRICTION_WORTH_A_NOTE,
      ),
    )
    if (cleanlinessFriction) notes.push({ id: 'CLEANLINESS_EXPECTATIONS' })

    if (spread(residents.map((r) => r.noiseTolerance)) >= SCALE_SPREAD_WORTH_A_NOTE) {
      notes.push({ id: 'NOISE' })
    }
    if (spread(residents.map((r) => r.privacyNeed)) >= SCALE_SPREAD_WORTH_A_NOTE) {
      notes.push({ id: 'PRIVACY' })
    }
  }

  // Patterns in the flat, by kind of event — never by who was involved.
  const since = now.getTime() - INCIDENT_WINDOW_DAYS * 86_400_000
  const byType = new Map<string, number>()
  for (const incident of incidents) {
    if (!CONFLICT_CATEGORIES.has(incident.category)) continue
    if (new Date(incident.date).getTime() < since) continue
    byType.set(incident.type, (byType.get(incident.type) ?? 0) + 1)
  }
  for (const [incidentType, count] of [...byType].sort((a, b) => b[1] - a[1])) {
    if (count >= REPEATED_INCIDENTS_THRESHOLD) {
      notes.push({ id: 'REPEATED_INCIDENTS', incidentType, count })
    }
  }

  return notes
}
