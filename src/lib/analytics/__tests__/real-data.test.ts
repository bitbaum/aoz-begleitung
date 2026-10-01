import {
  EMPTY_PLACEHOLDER_SCOPE,
  excludesPlaceholders,
  isRealRow,
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
