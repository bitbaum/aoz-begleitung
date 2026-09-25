import { describe, expect, it } from 'vitest'

import {
  NO_ENGAGEMENT_GRACE_DAYS,
  STALLED_ENGAGEMENT_DAYS,
  VOLUNTEERING_SIGNAL_IDS,
  buildVolunteeringQueue,
  signalsFor,
} from '@/lib/volunteering/queue'
import { STAFF_ROLE_CARE_DOMAIN } from '@/lib/config/care'
import type { CareClientInput } from '@/lib/care/queue'

const NOW = new Date('2026-09-05T09:00:00Z')

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000)
}

function client(overrides: Partial<CareClientInput> = {}): CareClientInput {
  return {
    residentId: 'r1',
    name: 'Amina',
    createdAt: daysAgo(200),
    learningRecords: [],
    applications: [],
    ...overrides,
  }
}

describe("The Freiwilligenarbeit coordinator's queue", () => {
  it('names a resident whose own interest nobody answered', () => {
    const signals = signalsFor(
      client({
        applications: [
          {
            opportunityId: 'opp-1',
            stage: 'INTERESTED',
            createdBy: 'RESIDENT',
            supportedByUserId: null,
          },
        ],
      }),
      NOW,
    )
    expect(signals).toEqual(['INTEREST_UNANSWERED'])
  })

  it('stops naming it the moment a person picks it up', () => {
    // The whole inversion in one assertion: staff engagement is what changes
    // the state, not the resident clicking again.
    const signals = signalsFor(
      client({
        applications: [
          {
            opportunityId: 'opp-1',
            stage: 'INTERESTED',
            createdBy: 'RESIDENT',
            supportedByUserId: 'staff-1',
          },
        ],
      }),
      NOW,
    )
    expect(signals).toEqual([])
  })

  it('does not count an unanswered click as an engagement', () => {
    // Were this wrong, a resident putting their hand up would REMOVE themselves
    // from the Freiwilligenarbeit coordinator's queue — the exact failure fixed on the job side.
    const waiting = client({
      createdAt: daysAgo(NO_ENGAGEMENT_GRACE_DAYS + 5),
      applications: [
        {
          opportunityId: 'opp-1',
          stage: 'INTERESTED',
          createdBy: 'RESIDENT',
          supportedByUserId: null,
        },
      ],
    })
    expect(signalsFor(waiting, NOW)).toContain('INTEREST_UNANSWERED')
    expect(signalsFor(waiting, NOW)).not.toContain('NO_ENGAGEMENT')
  })

  it('waits out the grace period before asking why nothing is arranged', () => {
    expect(signalsFor(client({ createdAt: daysAgo(NO_ENGAGEMENT_GRACE_DAYS - 1) }), NOW)).toEqual(
      [],
    )
    expect(signalsFor(client({ createdAt: daysAgo(NO_ENGAGEMENT_GRACE_DAYS) }), NOW)).toEqual([
      'NO_ENGAGEMENT',
    ])
  })

  it('treats a live engagement as arranged', () => {
    const placed = client({
      createdAt: daysAgo(200),
      applications: [
        {
          opportunityId: 'opp-1',
          stage: 'STARTED',
          createdBy: 'STAFF',
          supportedByUserId: 'staff-1',
        },
      ],
    })
    expect(signalsFor(placed, NOW)).toEqual([])
  })

  it('flags an engagement that has stopped moving', () => {
    const stalled = client({
      applications: [
        {
          opportunityId: 'opp-1',
          stage: 'STARTED',
          createdBy: 'STAFF',
          supportedByUserId: 'staff-1',
        },
      ],
      learningRecords: [
        {
          kind: 'VOLUNTEERING',
          status: 'IN_PROGRESS',
          updatedAt: daysAgo(STALLED_ENGAGEMENT_DAYS + 1),
        },
      ],
    })
    expect(signalsFor(stalled, NOW)).toEqual(['STALLED_ENGAGEMENT'])
  })

  it('ignores a stalled record that belongs to the job coach', () => {
    // A language course going nowhere is the Jobcoach's signal, not the Freiwilligenarbeit coordinator's. Her
    // queue naming it would hand her work she cannot act on.
    const jobRecord = client({
      applications: [
        {
          opportunityId: 'opp-1',
          stage: 'STARTED',
          createdBy: 'STAFF',
          supportedByUserId: 'staff-1',
        },
      ],
      learningRecords: [
        { kind: 'COURSE', status: 'IN_PROGRESS', updatedAt: daysAgo(STALLED_ENGAGEMENT_DAYS + 1) },
      ],
    })
    expect(signalsFor(jobRecord, NOW)).toEqual([])
  })

  it('orders rows by signal, because the dashboard hero shows only the first', () => {
    const queue = buildVolunteeringQueue(
      [
        client({
          residentId: 'stalled',
          name: 'Stalled',
          learningRecords: [
            {
              kind: 'VOLUNTEERING',
              status: 'IN_PROGRESS',
              updatedAt: daysAgo(STALLED_ENGAGEMENT_DAYS + 1),
            },
          ],
          applications: [
            {
              opportunityId: 'opp-1',
              stage: 'STARTED',
              createdBy: 'STAFF',
              supportedByUserId: 's',
            },
          ],
        }),
        client({
          residentId: 'waiting',
          name: 'Waiting',
          applications: [
            {
              opportunityId: 'opp-1',
              stage: 'INTERESTED',
              createdBy: 'RESIDENT',
              supportedByUserId: null,
            },
          ],
        }),
      ],
      NOW,
    )

    expect(queue[0]).toMatchObject({ residentId: 'waiting', signal: 'INTEREST_UNANSWERED' })
  })
})

describe('a row points at the thing it is about', () => {
  /**
   * The three navigations this ends: the tile linked to `/residents/{id}`, from
   * which the coach scrolled to the threads card, opened the listing, and
   * looked for the person among its applicants — once per waiting client, for
   * the signal that is FIRST in the priority list and therefore the one the
   * dashboard hero renders.
   *
   * The id was in the source row the whole time and the queue dropped it.
   */
  it('carries the opportunity a resident is waiting on', () => {
    const [row] = buildVolunteeringQueue(
      [
        client({
          applications: [
            {
              opportunityId: 'opp-kinderhort',
              stage: 'INTERESTED',
              createdBy: 'RESIDENT',
              supportedByUserId: null,
            },
          ],
        }),
      ],
      NOW,
    )
    expect(row).toMatchObject({ signal: 'INTEREST_UNANSWERED', opportunityId: 'opp-kinderhort' })
  })

  it('carries null for a signal about the person, not a placement', () => {
    // "Nobody has arranged anything yet" has no thread to open, and inventing
    // a destination for it would be worse than the extra click.
    const [row] = buildVolunteeringQueue(
      [client({ createdAt: daysAgo(NO_ENGAGEMENT_GRACE_DAYS + 1) })],
      NOW,
    )
    expect(row).toMatchObject({ signal: 'NO_ENGAGEMENT', opportunityId: null })
  })
})

describe('the seat the dashboard fetches', () => {
  /**
   * The root cause, pinned. The caseload query read the literal `'JOB'`, so
   * the Freiwilligenarbeit coordinator's seats — `VOLUNTEERING` — were never queried and every term of her
   * `totalIssues` was structurally zero. She was congratulated every morning.
   */
  it('maps each coach to their own seat, derived and not written out', () => {
    expect(STAFF_ROLE_CARE_DOMAIN.JOBCOACH).toBe('JOB')
    expect(STAFF_ROLE_CARE_DOMAIN.FREIWILLIGENARBEIT).toBe('VOLUNTEERING')
    expect(STAFF_ROLE_CARE_DOMAIN.JOBCOACH).not.toBe(STAFF_ROLE_CARE_DOMAIN.FREIWILLIGENARBEIT)
  })

  it('gives the volunteering domain as many signals as the job domain has', () => {
    // Not a symmetry fetish: a domain with zero signals is a domain whose
    // specialist can never be told anything, which is where the Freiwilligenarbeit coordinator started.
    expect(VOLUNTEERING_SIGNAL_IDS.length).toBeGreaterThan(0)
    expect(VOLUNTEERING_SIGNAL_IDS[0]).toBe('INTEREST_UNANSWERED')
  })
})
