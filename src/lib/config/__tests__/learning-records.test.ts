/**
 * Learning records: what may be saved, who may change it, and whose name it
 * carries. Three findings from the live audit of 2026-10-02, each pinned.
 */

import {
  learningAttribution,
  learningRecordProblem,
  mayChangeLearningRecord,
  type LearningRecordDraft,
} from '../learning'
import { ROLE_LABELS } from '@/lib/constants/labels'

const draft = (over: Partial<LearningRecordDraft> = {}): LearningRecordDraft => ({
  kind: 'LANGUAGE_TEST',
  title: 'fide-Test',
  languageCode: 'DE',
  cefrLevel: 'B1',
  startedAt: null,
  completedAt: null,
  ...over,
})

describe('a language test needs a level somebody chose', () => {
  // The level select opened on A1 with no blank option, so every test saved
  // through it read «DE A1» — a fact about a person's German written by a
  // default, and the number the German-level KPI reads.
  it('refuses a language test without a level', () => {
    expect(learningRecordProblem(draft({ cefrLevel: null }))).toBe('LEVEL_REQUIRED')
  })

  it('refuses a language test without a language', () => {
    expect(learningRecordProblem(draft({ languageCode: null }))).toBe('LANGUAGE_REQUIRED')
  })

  it('refuses a level that is not a CEFR level', () => {
    expect(learningRecordProblem(draft({ cefrLevel: 'A9' }))).toBe('LEVEL_REQUIRED')
  })

  it('accepts a test with both chosen', () => {
    expect(learningRecordProblem(draft())).toBeNull()
  })

  it('asks no level of a course', () => {
    expect(
      learningRecordProblem(draft({ kind: 'COURSE', languageCode: null, cefrLevel: null })),
    ).toBeNull()
  })

  it('still refuses a missing title and backwards dates', () => {
    expect(learningRecordProblem(draft({ title: ' ' }))).toBe('TITLE_OR_KIND')
    expect(
      learningRecordProblem(
        draft({ startedAt: new Date('2026-05-02'), completedAt: new Date('2026-05-01') }),
      ),
    ).toBe('DATES')
  })
})

describe('who may edit or delete a record', () => {
  const own = { residentId: 'r1', recordedBy: 'RESIDENT' as const }
  const team = { residentId: 'r1', recordedBy: 'STAFF' as const }
  const other = { residentId: 'r2', recordedBy: 'RESIDENT' as const }

  it('lets staff who write learning change any record — evidence included', () => {
    const staff = { kind: 'staff' as const, mayWriteLearning: true }
    expect([own, team, other].map((r) => mayChangeLearningRecord(staff, r))).toEqual([
      true,
      true,
      true,
    ])
  })

  it('gives staff without the permission nothing', () => {
    const staff = { kind: 'staff' as const, mayWriteLearning: false }
    expect(mayChangeLearningRecord(staff, own)).toBe(false)
  })

  it('lets a client change only what they entered themselves', () => {
    const client = { kind: 'resident' as const, residentId: 'r1' }
    expect(mayChangeLearningRecord(client, own)).toBe(true)
    // The team's statement is not theirs to rewrite, nor a neighbour's entry.
    expect(mayChangeLearningRecord(client, team)).toBe(false)
    expect(mayChangeLearningRecord(client, other)).toBe(false)
  })
})

describe('a staff record names the role of whoever entered it', () => {
  // «Von der Betreuung eingetragen» was printed under a job the Jobcoach filed.
  it.each([
    ['JOBCOACH', 'Jobcoach'],
    ['FREIWILLIGENARBEIT', 'Freiwilligenarbeit'],
    ['SOZIALARBEIT', 'Sozialarbeit'],
    ['BETREUUNG', 'Betreuung'],
  ])('%s', (role, label) => {
    const line = learningAttribution({ recordedBy: 'STAFF' }, { role }, ROLE_LABELS)
    expect(line).toContain(label)
    if (role !== 'BETREUUNG') expect(line).not.toContain('Betreuung')
  })

  it('says «Vom Team» rather than guessing when the author is unknown', () => {
    expect(learningAttribution({ recordedBy: 'STAFF' }, null, ROLE_LABELS)).toBe(
      'Vom Team eingetragen',
    )
  })

  it('credits the client for their own entries', () => {
    expect(learningAttribution({ recordedBy: 'RESIDENT' }, { role: 'JOBCOACH' }, ROLE_LABELS)).toBe(
      'Selbst eingetragen',
    )
  })
})
