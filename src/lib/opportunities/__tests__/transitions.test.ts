/**
 * Where an application may go, and on which listings.
 *
 * Observed live on 2026-10-01: a client was attached to a DRAFT job and set
 * straight to «Beendet · Nachweis erstellt» through a free stage <select>.
 * These pin the table that replaced it, over EVERY pair of stages rather than
 * a few examples — a jump nobody thought to test is exactly the jump that
 * shipped.
 *
 * The expected table is restated here on purpose: comparing the config to
 * itself could not fail.
 */

import {
  APPLICATION_STAGES,
  OPPORTUNITY_STATUSES,
  type ApplicationStageId,
} from '@/lib/config/opportunities'
import {
  APPLICATION_TRANSITIONS,
  availableTransitions,
  canTransition,
  isTerminalStage,
  mayAttachPeople,
  stageChangeRefusal,
} from '../pipeline'

const ALLOWED: Record<ApplicationStageId, readonly ApplicationStageId[]> = {
  INTERESTED: ['APPLIED', 'DECLINED'],
  APPLIED: ['INTERVIEW', 'ACCEPTED', 'DECLINED'],
  INTERVIEW: ['ACCEPTED', 'DECLINED'],
  ACCEPTED: ['STARTED', 'DECLINED'],
  STARTED: ['ENDED'],
  ENDED: [],
  DECLINED: [],
}

const PAIRS = APPLICATION_STAGES.flatMap((from) =>
  APPLICATION_STAGES.map((to) => [from, to, ALLOWED[from].includes(to)] as const),
)

describe('the transition table', () => {
  it.each(PAIRS)('%s → %s allowed: %s', (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed)
    // On a published listing the table is the only rule.
    expect(stageChangeRefusal('PUBLISHED', from, to)).toBe(allowed ? null : 'ILLEGAL_TRANSITION')
  })

  it('declares every stage, so none is silently a dead end', () => {
    expect(Object.keys(APPLICATION_TRANSITIONS).sort()).toEqual([...APPLICATION_STAGES].sort())
  })

  it('never moves anything INTO the starting stage', () => {
    for (const from of APPLICATION_STAGES) {
      expect(canTransition(from, 'INTERESTED')).toBe(false)
    }
  })

  it('offers no step out of a terminal stage', () => {
    for (const stage of APPLICATION_STAGES.filter(isTerminalStage)) {
      expect(availableTransitions('PUBLISHED', stage)).toEqual([])
    }
  })

  it('cannot reach ENDED without passing STARTED — the evidence step', () => {
    for (const from of APPLICATION_STAGES) {
      if (from === 'STARTED') continue
      expect(canTransition(from, 'ENDED')).toBe(false)
    }
  })

  it('cannot decline someone who already started — the engagement ENDS instead', () => {
    expect(canTransition('STARTED', 'DECLINED')).toBe(false)
  })
})

describe('a listing that is not on offer', () => {
  it.each(['DRAFT', 'ARCHIVED'] as const)('%s refuses every forward move', (status) => {
    for (const [from, to, allowed] of PAIRS) {
      if (!allowed) continue
      const windDown = to === 'ENDED' || to === 'DECLINED'
      expect({ from, to, refusal: stageChangeRefusal(status, from, to) }).toEqual({
        from,
        to,
        refusal: windDown ? null : 'LISTING_NOT_PUBLISHED',
      })
    }
  })

  it('still lets a started engagement on an archived listing end', () => {
    // Otherwise archiving a place would strand everyone working there, with
    // no way to record their hours.
    expect(availableTransitions('ARCHIVED', 'STARTED')).toEqual(['ENDED'])
  })

  it('lets a person attached to a draft by mistake be let go — and nothing else', () => {
    expect(availableTransitions('DRAFT', 'INTERESTED')).toEqual(['DECLINED'])
    expect(availableTransitions('DRAFT', 'ACCEPTED')).toEqual(['DECLINED'])
  })

  it('takes nobody new unless published', () => {
    expect(OPPORTUNITY_STATUSES.filter(mayAttachPeople)).toEqual(['PUBLISHED'])
  })
})
