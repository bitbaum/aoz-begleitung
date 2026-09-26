import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { QuickStat } from '../QuickStatsRow'

vi.mock('next/link', async () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

const BASE = {
  label: 'Freie Plätze',
  value: 5,
  href: '/housing',
  urgency: 'ok' as const,
  icon: '🛏️',
}

describe('QuickStat', () => {
  it('renders the label', () => {
    render(<QuickStat {...BASE} />)
    expect(screen.getByText('Freie Plätze')).toBeInTheDocument()
  })

  it('renders the value', () => {
    render(<QuickStat {...BASE} value={8} />)
    expect(screen.getByText(/8/)).toBeInTheDocument()
  })

  it('appends suffix to value when provided', () => {
    render(<QuickStat {...BASE} value={3} suffix=" überfällig" />)
    // Number and word are styled apart but must still read as "3 überfällig".
    expect(screen.getByRole('link').textContent).toMatch(/3 überfällig/)
  })

  it('renders the icon', () => {
    render(<QuickStat {...BASE} icon="⏰" />)
    expect(screen.getByText('⏰')).toBeInTheDocument()
  })

  it('links to the href', () => {
    render(<QuickStat {...BASE} href="/placements?overdue=1" />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/placements?overdue=1')
  })

  it('shows subtext when provided', () => {
    render(<QuickStat {...BASE} subtext="10/20 belegt" />)
    expect(screen.getByText('10/20 belegt')).toBeInTheDocument()
  })

  it('hides subtext when not provided', () => {
    render(<QuickStat {...BASE} />)
    expect(screen.queryByText(/belegt/)).not.toBeInTheDocument()
  })

  it('renders progress bar when total is provided', () => {
    const { container } = render(<QuickStat {...BASE} value={5} total={20} />)
    const bar = container.querySelector('[style*="width"]')
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveStyle({ width: '25%' })
  })

  it('hides progress bar when total is not provided', () => {
    const { container } = render(<QuickStat {...BASE} />)
    expect(container.querySelector('[style*="width"]')).not.toBeInTheDocument()
  })

  // Colour now follows MEANING, not a palette name the caller picked. These
  // assert the mapping, so a caller cannot reintroduce "blue because it looks
  // nice" without the type system stopping them first.
  it('leaves a neutral figure uncoloured', () => {
    const { container } = render(<QuickStat {...BASE} urgency="neutral" />)
    expect(container.querySelector('.text-status-error-text')).not.toBeInTheDocument()
    expect(container.querySelector('.text-status-warning-text')).not.toBeInTheDocument()
  })

  it('colours a critical figure', () => {
    const { container } = render(<QuickStat {...BASE} urgency="critical" />)
    expect(container.querySelector('.text-status-error-text')).toBeInTheDocument()
  })

  it('colours a figure needing attention', () => {
    const { container } = render(<QuickStat {...BASE} urgency="attention" />)
    expect(container.querySelector('.text-status-warning-text')).toBeInTheDocument()
  })

  it('never tints the whole card', () => {
    // The old version filled the surface and drew a 2px coloured border, so
    // four stat cards read as four alerts and hid the one that mattered.
    const { container } = render(<QuickStat {...BASE} urgency="critical" />)
    const card = container.querySelector('a')

    expect(card?.className).toContain('card-hover')
    expect(card?.className).not.toMatch(/bg-status-|border-2/)
  })
})
