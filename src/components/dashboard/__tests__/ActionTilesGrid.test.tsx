import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { ActionTile } from '../ActionTilesGrid'

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

vi.mock('@/lib/config/thresholds', async () => ({
  DISPLAY_LIMITS: { dashboardItems: 3 },
}))

vi.mock('@/lib/constants/labels', async () => ({
  DASHBOARD_LABELS: {
    showAllPrefix: 'Alle',
    showAllSuffix: 'anzeigen',
  },
}))

const BASE_ITEMS = [
  { label: 'RES-001', sublabel: '10 Tage · A01', href: '/residents/r1' },
  { label: 'RES-002', sublabel: '5 Tage · B02', href: '/residents/r2' },
]

const BASE = {
  title: 'Check-ins durchführen',
  count: 2,
  description: 'RES-001 wartet am längsten',
  href: '/residents/r1',
  urgency: 'attention' as const,
  items: BASE_ITEMS,
  allHref: '/placements?overdue=1',
}

describe('ActionTile', () => {
  it('renders the title', () => {
    render(<ActionTile {...BASE} />)
    expect(screen.getByRole('heading', { name: 'Check-ins durchführen' })).toBeInTheDocument()
  })

  it('renders the description', () => {
    render(<ActionTile {...BASE} />)
    expect(screen.getByText('RES-001 wartet am längsten')).toBeInTheDocument()
  })

  it('renders the count badge', () => {
    render(<ActionTile {...BASE} count={7} />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('renders each item as a link with label and sublabel', () => {
    render(<ActionTile {...BASE} />)
    expect(screen.getByRole('link', { name: /RES-001/ })).toHaveAttribute('href', '/residents/r1')
    expect(screen.getByText('10 Tage · A01')).toBeInTheDocument()
  })

  it('renders both items when count equals DISPLAY_LIMITS', () => {
    render(<ActionTile {...BASE} />)
    expect(screen.getByText('RES-001')).toBeInTheDocument()
    expect(screen.getByText('RES-002')).toBeInTheDocument()
  })

  it('hides "Alle … anzeigen" link when count <= DISPLAY_LIMITS (3)', () => {
    render(<ActionTile {...BASE} count={3} />)
    expect(screen.queryByText(/Alle 3 anzeigen/)).not.toBeInTheDocument()
  })

  it('shows "Alle … anzeigen" link when count > DISPLAY_LIMITS (3)', () => {
    render(<ActionTile {...BASE} count={5} />)
    expect(screen.getByText(/Alle 5 anzeigen/)).toBeInTheDocument()
  })

  it('"Alle anzeigen" link points to allHref', () => {
    render(<ActionTile {...BASE} count={5} />)
    expect(screen.getByRole('link', { name: /Alle 5 anzeigen/ })).toHaveAttribute(
      'href',
      '/placements?overdue=1',
    )
  })

  // Colour follows MEANING now. A tile is not orange because it is about
  // check-ins; it is amber because something needs attention today.
  it('marks only a critical tile with a coloured edge', () => {
    const { container } = render(<ActionTile {...BASE} urgency="critical" />)
    expect(container.querySelector('.border-status-error\\/40')).toBeInTheDocument()
  })

  it('leaves an ordinary tile with the plain hairline card border', () => {
    const { container } = render(<ActionTile {...BASE} urgency="neutral" />)
    const card = container.firstElementChild

    expect(card?.className).toContain('card')
    expect(card?.className).not.toMatch(/border-status-/)
  })

  it('tints the count badge by urgency, not by topic', () => {
    const { container: critical } = render(<ActionTile {...BASE} urgency="critical" />)
    expect(critical.querySelector('.bg-status-error\\/15')).toBeInTheDocument()

    const { container: neutral } = render(<ActionTile {...BASE} urgency="neutral" />)
    expect(neutral.querySelector('.bg-ui-subtle')).toBeInTheDocument()
  })

  it('renders empty item list without errors', () => {
    render(<ActionTile {...BASE} items={[]} />)
    expect(screen.getByRole('heading', { name: 'Check-ins durchführen' })).toBeInTheDocument()
  })

  it("keeps a row's name and its detail two words (textContent, not a margin)", () => {
    // Live 2026-10-02: "Ihor51 Tage", "AmirIn 4 Tagen", "GeorgyBewerbung…".
    render(<ActionTile {...BASE} />)
    const row = screen.getByRole('link', { name: /RES-001 10 Tage/ })
    expect(row.textContent).toContain('RES-001 10 Tage')
  })
})
