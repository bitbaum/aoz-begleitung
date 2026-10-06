/**
 * What a client is told about their own thread, and the evidence a thread
 * leaves behind — findings 3, 4 and 5 of the 2026-10-02 audit.
 */

import {
  clientAnswerPending,
  evidenceForStartedApplication,
  openBoardEmptyState,
  OPPORTUNITY_EVIDENCE_CATEGORY,
  proposalState,
  residentContactHint,
  residentNextStep,
  stageAfterClientAnswer,
} from '../pipeline'
import { isAwaitingAnswer } from '@/lib/jobcoach/queue'
import { OPPORTUNITY_KINDS } from '@/lib/config/opportunities'
import { LEARNING_CATEGORIES } from '@/lib/config/learning'
import { residentNextStepKey, residentContactHintKey } from '@/lib/i18n/opportunity-labels'

describe('evidence is filed by kind, not all as «Gemeinschaft»', () => {
  const at = new Date('2026-09-01T08:00:00Z')
  const listing = { title: 'Lager', organisation: 'Beispiel AG' }

  it.each([
    ['EMPLOYMENT', 'vocational'],
    ['INTERNSHIP', 'vocational'],
    ['VOLUNTEERING', 'community'],
    ['COMMUNITY_SERVICE', 'community'],
  ] as const)('%s → %s', (kind, category) => {
    expect(evidenceForStartedApplication({ ...listing, kind }, at).category).toBe(category)
  })

  it('maps every kind onto a real learning category', () => {
    for (const kind of OPPORTUNITY_KINDS) {
      expect(LEARNING_CATEGORIES).toContain(OPPORTUNITY_EVIDENCE_CATEGORY[kind])
    }
  })

  it('records who moved the thread to STARTED, so the record can name their role', () => {
    expect(
      evidenceForStartedApplication({ ...listing, kind: 'EMPLOYMENT' }, at, 'user-1')
        .recordedByUserId,
    ).toBe('user-1')
  })
})

describe('a proposal from the team is not the client’s own interest', () => {
  const staffRow = {
    stage: 'INTERESTED' as const,
    createdBy: 'STAFF' as const,
    residentAnswer: null,
    supportedByUserId: 'coach',
    createdAt: new Date(),
    opportunityId: 'opp-1',
  }
  const clientRow = { ...staffRow, createdBy: 'RESIDENT' as const, supportedByUserId: null }

  it('asks the client for an answer on a staff-raised INTERESTED row', () => {
    expect(clientAnswerPending(staffRow)).toBe(true)
    expect(residentNextStep(staffRow)).toBe('PROPOSED_TO_YOU')
  })

  it('never asks the client to answer their own interest', () => {
    expect(clientAnswerPending(clientRow)).toBe(false)
    expect(residentNextStep(clientRow)).toBe('WAITING_ON_STAFF')
  })

  it('points the opposite way to isAwaitingAnswer — a proposal is not a request to staff', () => {
    expect(isAwaitingAnswer(staffRow)).toBe(false)
    expect(isAwaitingAnswer(clientRow)).toBe(true)
  })

  it('accepting keeps the thread on the normal path; declining ends it as the client’s no', () => {
    expect(stageAfterClientAnswer('ACCEPTED')).toBe('INTERESTED')
    expect(stageAfterClientAnswer('DECLINED')).toBe('DECLINED')

    const accepted = { ...staffRow, residentAnswer: 'ACCEPTED' }
    expect(clientAnswerPending(accepted)).toBe(false)
    expect(residentNextStep(accepted)).toBe('WAITING_ON_STAFF')

    const declined = { ...staffRow, stage: 'DECLINED' as const, residentAnswer: 'DECLINED' }
    expect(residentNextStep(declined)).toBe('YOU_DECLINED')
    // The place saying no is a different sentence from the client saying no.
    expect(residentNextStep({ ...declined, residentAnswer: null })).toBe('NOT_THIS_TIME')
  })

  it('shows staff where each proposal stands', () => {
    expect(proposalState(staffRow)).toBe('PENDING')
    expect(proposalState({ ...staffRow, residentAnswer: 'ACCEPTED' })).toBe('ACCEPTED')
    expect(proposalState({ ...staffRow, stage: 'DECLINED', residentAnswer: 'DECLINED' })).toBe(
      'DECLINED',
    )
    expect(proposalState(clientRow)).toBeNull()
    // Moved along by staff before the client answered: no longer a proposal.
    expect(proposalState({ ...staffRow, stage: 'APPLIED' })).toBeNull()
  })
})

describe('the card says what is true at THIS stage', () => {
  const row = (stage: 'ACCEPTED' | 'STARTED' | 'ENDED') => ({ stage, createdBy: 'STAFF' as const })

  it('never tells someone whose engagement ended to call before the first day', () => {
    expect(residentContactHint('ENDED')).toBe('REFERENCE')
    expect(residentContactHint('STARTED')).toBe('DURING')
    expect(residentContactHint('ACCEPTED')).toBe('BEFORE_START')
    expect(residentContactHintKey('REFERENCE')).not.toBe('opportunities.contactHint')
    expect(residentContactHint('INTERESTED')).toBeNull()
  })

  it('does not promise a start date the listing never stated', () => {
    const step = residentNextStep(row('ACCEPTED'))
    expect(residentNextStepKey(step, true)).toBe('opportunities.nextAttend')
    expect(residentNextStepKey(step, false)).toBe('opportunities.nextAttendUndated')
  })

  it('separates «yours, starting soon» from «under way» and «finished»', () => {
    expect(residentNextStep(row('ACCEPTED'))).toBe('YOURS_TO_ATTEND')
    expect(residentNextStep(row('STARTED'))).toBe('UNDER_WAY')
    expect(residentNextStep(row('ENDED'))).toBe('FINISHED')
  })
})

describe('«Offene Plätze» explains an empty list correctly', () => {
  it('says nothing is advertised only when nothing is', () => {
    expect(openBoardEmptyState(0, 0)).toBe('NONE_PUBLISHED')
  })

  it('points up to the client’s own threads when every listing is one of them', () => {
    expect(openBoardEmptyState(0, 1)).toBe('ALL_YOURS')
  })

  it('is not an empty state when places are open', () => {
    expect(openBoardEmptyState(2, 3)).toBeNull()
  })
})
