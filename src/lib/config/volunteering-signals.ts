import type { VolunteeringSignalId } from '@/lib/volunteering/queue'

/**
 * What each of the Freiwilligenarbeit coordinator's signals is called, and what she should do about it.
 *
 * Copy lives here rather than in the queue module for the same reason
 * `JOB_SIGNAL_COPY` does: the queue is pure logic with no opinion about how it
 * is rendered. `action` is the sentence under the count — a tile that names a
 * problem without naming the next move is a nag.
 *
 * No `principleId` yet, deliberately. The Jobcoach signals each cite a
 * principle in `job-integration-docs.ts` with sources behind it; there is no
 * equivalent evidence catalogue for Freiwilligenarbeit in this product. Adding
 * a plausible-looking id would claim a footing that does not exist — the same
 * mistake as seeding the board with invented employers to move a number.
 */
export const VOLUNTEERING_SIGNAL_COPY: Record<
  VolunteeringSignalId,
  { title: string; action: string }
> = {
  INTEREST_UNANSWERED: {
    title: 'Interesse wartet auf Antwort',
    action: 'Zurückmelden — die Person hat den Einsatz selbst gewählt.',
  },
  NO_ENGAGEMENT: {
    title: 'Noch kein Engagement',
    action: 'Einen Einsatz oder Anlass vorschlagen.',
  },
  STALLED_ENGAGEMENT: {
    title: 'Engagement seit Wochen unverändert',
    action: 'Stand nachführen oder abschliessen.',
  },
}
