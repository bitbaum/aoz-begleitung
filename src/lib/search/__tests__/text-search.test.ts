import { evaluate, typoCases } from '@bitbaum/searchkit'
import { searchText } from '../text-search'

// Synthetic people and places shaped like the staff lists' rows.
const residents = [
  { id: 'r1', displayName: 'Amina Yusuf', code: 'RES-A1B2C3' },
  { id: 'r2', displayName: 'Jovan Petrović', code: 'RES-D4E5F6' },
  { id: 'r3', displayName: null, code: 'RES-G7H8J9' },
]
const residentFields = [
  { name: 'name', get: (r: (typeof residents)[number]) => r.displayName ?? r.code },
  { name: 'code', get: (r: (typeof residents)[number]) => r.code },
]
const units = [
  { id: 'u1', code: 'DEMO-U05', nickname: 'Casa Harmonie', address: 'Seestrasse 12' },
  { id: 'u2', code: 'DEMO-U06', nickname: null, address: 'Badenerstrasse 280' },
]
const unitFields = [
  { name: 'code', get: (u: (typeof units)[number]) => u.code },
  { name: 'nickname', get: (u: (typeof units)[number]) => u.nickname },
  { name: 'address', get: (u: (typeof units)[number]) => u.address },
]

test('one-slip misspellings of client names find the client', async () => {
  const named = residents.flatMap((r) => (r.displayName ? [{ id: r.id, name: r.displayName }] : []))
  const report = await evaluate(typoCases(named), (q) =>
    searchText(residents, q, residentFields).map((r) => r.id),
  )
  expect(report.cases).toBeGreaterThan(20)
  expect(report.zeroResults).toBe(0)
  expect(report.successAt3).toBe(1)
})

test('one-slip misspellings of a home find it, by nickname or street', async () => {
  const named = [
    { id: 'u1', name: 'Casa Harmonie' },
    { id: 'u2', name: 'Badenerstrasse' },
  ]
  const report = await evaluate(typoCases(named), (q) =>
    searchText(units, q, unitFields).map((u) => u.id),
  )
  expect(report.zeroResults).toBe(0)
  expect(report.successAt3).toBe(1)
})

test('an exact code still finds its one row, and search only narrows', () => {
  expect(searchText(residents, 'RES-D4E5F6', residentFields).map((r) => r.id)).toEqual(['r2'])
  expect(searchText(residents, 'petrovic', residentFields)[0].id).toBe('r2')
  // Only rows the caller passed in can come back.
  expect(searchText(residents.slice(0, 1), 'petrovic', residentFields)).toEqual([])
  expect(searchText(residents, '  ', residentFields)).toBe(residents)
})
