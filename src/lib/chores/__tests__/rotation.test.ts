import { currentTurnResidentId, isResidentsTurn } from '../rotation'

describe('currentTurnResidentId', () => {
  const rota = ['hana', 'noor', 'amara']

  it('starts at the first person in the rotation', () => {
    expect(currentTurnResidentId(rota, 0)).toBe('hana')
  })

  it('advances one place per completion and wraps around', () => {
    expect(currentTurnResidentId(rota, 1)).toBe('noor')
    expect(currentTurnResidentId(rota, 2)).toBe('amara')
    expect(currentTurnResidentId(rota, 3)).toBe('hana')
    expect(currentTurnResidentId(rota, 7)).toBe('noor')
  })

  it('advances even when someone else covered the turn', () => {
    // Amara doing Hana's turn still moves the rota on: covering for a housemate
    // must not cost you your own place in the queue.
    expect(currentTurnResidentId(rota, 0)).toBe('hana')
    expect(currentTurnResidentId(rota, 1)).toBe('noor')
  })

  it('returns null when the house keeps no rotation for this task', () => {
    expect(currentTurnResidentId([], 4)).toBeNull()
  })

  it('handles a one-person rotation without dividing by zero', () => {
    expect(currentTurnResidentId(['hana'], 99)).toBe('hana')
  })

  it('does not produce a nonsense index for an impossible count', () => {
    expect(currentTurnResidentId(rota, -3)).toBe('hana')
  })
})

describe('isResidentsTurn', () => {
  const rota = ['hana', 'noor']

  it('is true only for the person currently up', () => {
    expect(isResidentsTurn(rota, 0, 'hana')).toBe(true)
    expect(isResidentsTurn(rota, 0, 'noor')).toBe(false)
  })

  it('is false for everyone when there is no rotation', () => {
    expect(isResidentsTurn([], 0, 'hana')).toBe(false)
  })
})
