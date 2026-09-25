/**
 * The pipeline is what turns a noticeboard into a tool, so these pin the two
 * things that would quietly corrupt it: where a thread can go next, and what
 * an application turns into once it actually starts.
 */

import {
  APPLICATION_PIPELINE,
  evidenceForStartedApplication,
  isActiveStage,
  isFull,
  isTerminalStage,
  nextPipelineStage,
  occupiesSeat,
  openSeats,
  pipelinePosition,
} from '../pipeline'
import { APPLICATION_STAGES, type ApplicationStageId } from '@/lib/config/opportunities'

describe('pipeline shape', () => {
  it('leaves no stage without a label or a position', () => {
    // Every stage is either on the forward path or is DECLINED. A stage that
    // is neither would render with no badge and be unreachable by any control.
    for (const stage of APPLICATION_STAGES) {
      const onPath = (APPLICATION_PIPELINE as readonly string[]).includes(stage)
      expect(onPath || stage === 'DECLINED').toBe(true)
    }
  })

  it('keeps DECLINED off the forward path', () => {
    // If a refusal were a later phase of the same journey, "advance to the
    // next stage" would eventually mean "reject this person".
    expect(APPLICATION_PIPELINE).not.toContain('DECLINED')
    expect(pipelinePosition('DECLINED')).toBe(-1)
    expect(nextPipelineStage('DECLINED')).toBeNull()
  })

  it('offers no next step from a stage that is over', () => {
    expect(nextPipelineStage('ENDED')).toBeNull()
    expect(isTerminalStage('ENDED')).toBe(true)
    expect(isTerminalStage('DECLINED')).toBe(true)
    expect(isActiveStage('ENDED')).toBe(false)
  })

  it('walks the whole path in order and then stops', () => {
    const walked: ApplicationStageId[] = ['INTERESTED']
    let current = nextPipelineStage('INTERESTED')
    while (current) {
      walked.push(current)
      current = nextPipelineStage(current)
    }

    expect(walked).toEqual([...APPLICATION_PIPELINE])
  })

  it('treats every non-terminal stage as active', () => {
    for (const stage of APPLICATION_STAGES) {
      expect(isActiveStage(stage)).toBe(!isTerminalStage(stage))
    }
  })
})

describe('seats', () => {
  it('counts only the people actually holding a place', () => {
    // Someone merely interested has not taken a seat; someone who started has.
    expect(occupiesSeat('INTERESTED')).toBe(false)
    expect(occupiesSeat('APPLIED')).toBe(false)
    expect(occupiesSeat('INTERVIEW')).toBe(false)
    expect(occupiesSeat('ACCEPTED')).toBe(true)
    expect(occupiesSeat('STARTED')).toBe(true)
    expect(occupiesSeat('ENDED')).toBe(false)
    expect(occupiesSeat('DECLINED')).toBe(false)
  })

  it('frees the seat again when an engagement ends', () => {
    expect(openSeats({ seats: 2 }, ['STARTED', 'ENDED'])).toBe(1)
  })

  it('reports unknown capacity as unknown, never as full', () => {
    // The bug this guards: `seats ?? 0` renders "0 frei" on every listing that
    // never stated a number, hiding the place from everyone who could take it.
    expect(openSeats({ seats: null }, ['ACCEPTED', 'STARTED'])).toBeNull()
    expect(isFull({ seats: null }, ['ACCEPTED', 'STARTED'])).toBe(false)
  })

  it('never reports negative seats when a listing is oversubscribed', () => {
    expect(openSeats({ seats: 1 }, ['ACCEPTED', 'STARTED'])).toBe(0)
    expect(isFull({ seats: 1 }, ['ACCEPTED', 'STARTED'])).toBe(true)
  })
})

describe('evidenceForStartedApplication', () => {
  const opportunity = {
    kind: 'VOLUNTEERING' as const,
    title: 'Mittagstisch im Quartiertreff',
    organisation: 'Quartierverein Beispiel',
  }
  const startedAt = new Date('2026-08-25T09:00:00Z')

  it('carries the kind straight through to the learning record', () => {
    expect(evidenceForStartedApplication(opportunity, startedAt).kind).toBe('VOLUNTEERING')
    expect(
      evidenceForStartedApplication({ ...opportunity, kind: 'COMMUNITY_SERVICE' }, startedAt).kind,
    ).toBe('COMMUNITY_SERVICE')
  })

  it('records the organisation as the provider, not the product', () => {
    expect(evidenceForStartedApplication(opportunity, startedAt).provider).toBe(
      'Quartierverein Beispiel',
    )
  })

  it('starts the record as running, not as an achievement', () => {
    // COMPLETED here would award a certificate on day one for work that has
    // not happened — `isAchievementRecord()` reads exactly this pair.
    const evidence = evidenceForStartedApplication(opportunity, startedAt)
    expect(evidence.status).toBe('IN_PROGRESS')
    expect(evidence.startedAt).toEqual(startedAt)
  })

  it('marks it staff-recorded, because a stage move is a staff action', () => {
    expect(evidenceForStartedApplication(opportunity, startedAt).recordedBy).toBe('STAFF')
  })

  it('does not invent service hours from a weekly rate', () => {
    // hoursPerWeek is a rate and LearningRecord.hours is a total. Writing one
    // into the other is a wrong number that looks like a right one, and every
    // surface that sums service hours would then be reporting fiction.
    const evidence = evidenceForStartedApplication(opportunity, startedAt) as unknown as Record<
      string,
      unknown
    >
    expect(evidence.hours).toBeUndefined()
  })
})
