import { monthlyStatements, monthKeyOf } from '../statement'
import { splitEqually } from '../split'

const MEMBERS = ['amara', 'georgy', 'hana', 'noor']

function expense(
  paidById: string,
  amountRappen: number,
  date: string,
  participants: string[] = MEMBERS,
) {
  return {
    paidById,
    amountRappen,
    date: new Date(date),
    shares: splitEqually(amountRappen, participants),
  }
}

describe('monthKeyOf', () => {
  it('buckets by the Zurich calendar month, not UTC', () => {
    // 23:30 UTC on July 31 is already August 1 in Zurich (UTC+2 in summer).
    expect(monthKeyOf(new Date('2026-07-31T23:30:00Z'))).toBe('2026-08')
    expect(monthKeyOf(new Date('2026-07-31T12:00:00Z'))).toBe('2026-07')
  })
})

describe('monthlyStatements', () => {
  it('returns an empty list for no expenses', () => {
    expect(monthlyStatements([], MEMBERS)).toEqual([])
  })

  it('groups by month, newest first, and totals correctly', () => {
    const statements = monthlyStatements(
      [
        expense('amara', 2000, '2026-08-13T10:00:00Z'),
        expense('georgy', 600, '2026-08-13T11:00:00Z'),
        expense('hana', 1000, '2026-07-05T10:00:00Z'),
      ],
      MEMBERS,
    )
    expect(statements.map((s) => s.monthKey)).toEqual(['2026-08', '2026-07'])
    expect(statements[0].totalRappen).toBe(2600)
    expect(statements[0].expenseCount).toBe(2)
    expect(statements[0].monthLabel).toBe('August 2026')
  })

  it('computes paid, share and net per person; nets sum to zero', () => {
    const statements = monthlyStatements([expense('amara', 2000, '2026-08-13T10:00:00Z')], MEMBERS)
    const rows = statements[0].rows
    const amara = rows.find((r) => r.residentId === 'amara')!
    expect(amara).toEqual({
      residentId: 'amara',
      paidRappen: 2000,
      shareRappen: 500,
      netRappen: 1500,
    })
    const georgy = rows.find((r) => r.residentId === 'georgy')!
    expect(georgy.netRappen).toBe(-500)
    expect(rows.reduce((a, r) => a + r.netRappen, 0)).toBe(0)
  })

  it('handles partial splits: the uninvolved member shows a zero row', () => {
    const statements = monthlyStatements(
      [expense('georgy', 600, '2026-08-13T10:00:00Z', ['georgy', 'hana', 'noor'])],
      MEMBERS,
    )
    const amara = statements[0].rows.find((r) => r.residentId === 'amara')!
    expect(amara).toEqual({ residentId: 'amara', paidRappen: 0, shareRappen: 0, netRappen: 0 })
  })

  it('includes past residents present in the data but not in memberIds', () => {
    const statements = monthlyStatements(
      [expense('former', 1200, '2026-08-01T10:00:00Z', ['former', 'georgy'])],
      MEMBERS,
    )
    expect(statements[0].rows.some((r) => r.residentId === 'former')).toBe(true)
  })

  it('sorts rows by paid desc, then id', () => {
    const statements = monthlyStatements(
      [
        expense('noor', 1000, '2026-08-02T10:00:00Z'),
        expense('amara', 1000, '2026-08-03T10:00:00Z'),
      ],
      MEMBERS,
    )
    expect(statements[0].rows.map((r) => r.residentId)).toEqual(['amara', 'noor', 'georgy', 'hana'])
  })
})
