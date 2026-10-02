/**
 * The anonymity of a survey answer is a property of the SCHEMA.
 *
 * SurveyResponse may hold what was answered, for which survey, on which day —
 * and nothing that points at a person or a moment. Adding a residentId, an
 * invitation link, a user, an IP or a timestamp to it would make every answer
 * attributable, silently, with every other check still green. So the column
 * set is pinned exactly, and the invitation is pinned to hold no answer time.
 */

import { getTableColumns } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { surveyInvitation, surveyResponse } from '@/lib/db/schema'

/** Column names that would make an answer attributable to a person or a moment. */
const IDENTIFYING =
  /resident|invitation|user|account|code|ip|session|device|created|updated|time|at$/i

describe('SurveyResponse holds no identity', () => {
  const columns = Object.keys(getTableColumns(surveyResponse))

  it('has exactly id, surveyId, answers and submittedOn', () => {
    expect(columns.sort()).toEqual(['answers', 'id', 'submittedOn', 'surveyId'])
  })

  it('has no column that names a person, a session or a time', () => {
    expect(columns.filter((name) => name !== 'surveyId' && IDENTIFYING.test(name))).toEqual([])
  })

  it('stores the day as a DATE, not a timestamp', () => {
    expect(getTableColumns(surveyResponse).submittedOn.getSQLType()).toBe('date')
  })

  it('references only the survey', () => {
    const targets = getTableConfig(surveyResponse).foreignKeys.map(
      (fk) => getTableConfig(fk.reference().foreignTable).name,
    )
    expect(targets).toEqual(['Survey'])
  })
})

describe('SurveyInvitation holds no answer time', () => {
  it('has exactly id, surveyId, residentId, invitedAt and answered', () => {
    expect(Object.keys(getTableColumns(surveyInvitation)).sort()).toEqual([
      'answered',
      'id',
      'invitedAt',
      'residentId',
      'surveyId',
    ])
  })

  it('records whether, never when, someone answered', () => {
    expect(getTableColumns(surveyInvitation).answered.getSQLType()).toBe('boolean')
  })
})
