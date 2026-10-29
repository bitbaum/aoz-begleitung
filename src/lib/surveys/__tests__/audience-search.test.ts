import { evaluate, typoCases } from '@bitbaum/searchkit'
import { searchSurveyAudience } from '../audience-search'

const audience = [
  { id: 'synthetic-a', name: 'Müller' },
  { id: 'synthetic-b', name: 'Schneider' },
  { id: 'synthetic-c', name: 'Yilmaz' },
]

test('one-slip misspellings still find the authorized survey audience', async () => {
  const report = await evaluate(typoCases(audience), (query) =>
    searchSurveyAudience(audience, query).map((client) => client.id),
  )
  expect(report.cases).toBeGreaterThan(100)
  expect(report.zeroResults).toBe(0)
  expect(report.successAt3).toBe(1)
})

test('an empty search retains the supplied audience order and spelling variants match', () => {
  expect(searchSurveyAudience(audience, '  ')).toBe(audience)
  expect(searchSurveyAudience(audience, 'mueller')[0].id).toBe('synthetic-a')
  expect(searchSurveyAudience(audience, 'Schneidre')[0].id).toBe('synthetic-b')
  expect(searchSurveyAudience(audience.slice(1), 'mueller')).toEqual([])
})
