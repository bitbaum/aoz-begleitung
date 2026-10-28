import { render, screen, within } from '@testing-library/react'
import { SatisfactionChart } from '../SatisfactionChart'

const props = {
  days: 30,
  totalCheckIns: 20,
  avgSatisfaction: '3.0',
  satisfactionCounts: [1, 8, 4, 5, 2],
  lowSatisfactionCount: 9,
}

describe('shared satisfaction chart', () => {
  test('preserves ordinal levels and proportional scale in its accessible table', () => {
    const { container } = render(<SatisfactionChart {...props} />)
    const table = screen.getByRole('table', { name: 'Check-ins nach Zufriedenheit' })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(6)
    expect(within(rows[1]).getByRole('rowheader')).toHaveTextContent('1/5 Sehr unzufrieden')
    expect(within(rows[2]).getByRole('rowheader')).toHaveTextContent('2/5 Unzufrieden')
    expect(within(rows[5]).getByRole('rowheader')).toHaveTextContent('5/5 Sehr zufrieden')
    expect(within(table).getByRole('columnheader', { name: 'Anzahl' })).toBeInTheDocument()
    expect(container.querySelector('.ck-bar-fill')).toHaveStyle({ width: '5%' })
    expect(container.querySelectorAll('[data-tone="negative"]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-tone="warning"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-tone="positive"]')).toHaveLength(2)
  })

  test('retains the empty state without inventing an average or distribution', () => {
    render(
      <SatisfactionChart
        {...props}
        totalCheckIns={0}
        avgSatisfaction={null}
        satisfactionCounts={[0, 0, 0, 0, 0]}
        lowSatisfactionCount={0}
      />,
    )
    expect(screen.getByText('Keine Check-ins in diesem Zeitraum')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
