/**
 * The review page's order: whoever is waiting for an answer first, then the
 * pipeline, closed threads last.
 */

import { AWAITING_GROUP_ID, daysSince, groupApplicationsForReview } from '../review'
import type { ApplicationStageId } from '@/lib/config/opportunities'

function row(
  id: string,
  stage: ApplicationStageId,
  overrides: Partial<{
    createdBy: 'RESIDENT' | 'STAFF'
    supportedByUserId: string | null
    createdAt: Date
  }> = {},
) {
  return {
    id,
    opportunityId: 'opp-1',
    stage,
    createdBy: 'STAFF' as 'RESIDENT' | 'STAFF',
    supportedByUserId: 'staff-1' as string | null,
    createdAt: new Date('2026-09-01'),
    ...overrides,
  }
}

const unanswered = (id: string, createdAt: string) =>
  row(id, 'INTERESTED', {
    createdBy: 'RESIDENT',
    supportedByUserId: null,
    createdAt: new Date(createdAt),
  })

describe('groupApplicationsForReview', () => {
  it('puts unanswered requests first, oldest first, then pipeline order', () => {
    const groups = groupApplicationsForReview([
      row('ended', 'ENDED'),
      row('applied', 'APPLIED'),
      unanswered('new', '2026-09-20'),
      row('staff-interested', 'INTERESTED'),
      row('declined', 'DECLINED'),
      unanswered('old', '2026-09-02'),
      row('started', 'STARTED'),
    ])

    expect(groups.map((g) => g.id)).toEqual([
      AWAITING_GROUP_ID,
      'INTERESTED',
      'APPLIED',
      'STARTED',
      'ENDED',
      'DECLINED',
    ])
    expect(groups[0].rows.map((r) => r.id)).toEqual(['old', 'new'])
    expect(groups[0].label).toBe('Wartet auf Antwort')
  })

  it('a claimed request is no longer waiting', () => {
    const claimed = row('claimed', 'INTERESTED', { createdBy: 'RESIDENT' })
    const [group] = groupApplicationsForReview([claimed])
    expect(group.id).toBe('INTERESTED')
  })

  it('closes only the finished groups', () => {
    const groups = groupApplicationsForReview([
      unanswered('a', '2026-09-01'),
      row('b', 'ACCEPTED'),
      row('c', 'ENDED'),
      row('d', 'DECLINED'),
    ])
    expect(Object.fromEntries(groups.map((g) => [g.id, g.closed]))).toEqual({
      [AWAITING_GROUP_ID]: false,
      ACCEPTED: false,
      ENDED: true,
      DECLINED: true,
    })
  })

  it('renders nothing for no applications', () => {
    expect(groupApplicationsForReview([])).toEqual([])
  })
})

describe('daysSince', () => {
  it('counts whole days and never goes negative', () => {
    const now = new Date('2026-10-01T12:00:00Z')
    expect(daysSince(new Date('2026-09-28T12:00:00Z'), now)).toBe(3)
    expect(daysSince(new Date('2026-10-02T12:00:00Z'), now)).toBe(0)
  })
})
