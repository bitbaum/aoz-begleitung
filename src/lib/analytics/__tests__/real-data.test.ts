import { readFileSync } from 'fs'
import {
  EMPTY_PLACEHOLDER_SCOPE,
  excludesPlaceholders,
  isRealRow,
  servedRows,
  type PlaceholderScope,
} from '../real-data'

const scope: PlaceholderScope = { residentIds: new Set(['placeholder-1']) }

describe('which rows belong to the pilot', () => {
  it('drops a row whose resident is an unclaimed placeholder', () => {
    expect(isRealRow({ residentId: 'placeholder-1' }, scope)).toBe(false)
  })

  it('keeps a real row', () => {
    expect(isRealRow({ residentId: 'georgy' }, scope)).toBe(true)
  })

  it('keeps everything when there are no placeholders', () => {
    // A real deployment must not have its numbers quietly filtered.
    const rows = [{ residentId: 'a' }, { residentId: 'b' }]
    expect(excludesPlaceholders(rows, EMPTY_PLACEHOLDER_SCOPE)).toEqual(rows)
  })

  it('keeps a row linked to nobody', () => {
    expect(isRealRow({}, scope)).toBe(true)
    expect(isRealRow({ residentId: null }, scope)).toBe(true)
  })
})

describe('work queues are about people somebody is serving', () => {
  /**
   * Live 2026-10-02: «Check-ins diese Woche» named Amir, Yusuf and Tesfay, and
   * «Kein Deutsch-Test erfasst» Nour, Tesfay, Leyla and Dawit — all
   * placeholders, nobody behind any of them.
   */
  const placements = [
    { id: 'p1', resident: { id: 'placeholder-1' } },
    { id: 'p2', resident: { id: 'georgy' } },
  ]

  it('drops a placeholder carried one level down', () => {
    expect(servedRows(placements, (p) => p.resident.id, scope).map((p) => p.id)).toEqual(['p2'])
  })

  it.each([
    ['src/app/(admin)/page.tsx', ['servedRows(placements', 'servedRows(jobCaseload']],
    ['src/app/(admin)/learning/page.tsx', ['servedRows(learningBoard.missingGerman']],
  ])('%s builds its queues from served rows only', (file, calls) => {
    // The queries live in pages and a shared action; a pure predicate cannot
    // see whether a page USES it, so the wiring is pinned here.
    const source = readFileSync(file, 'utf8').replace(/\s+/g, '')
    for (const call of calls) expect(source).toContain(call.replace(/\s+/g, ''))
  })
})
