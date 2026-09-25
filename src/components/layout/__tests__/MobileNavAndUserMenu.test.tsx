import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// --- Navigation mock ---

vi.mock('next/navigation', async () => ({
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
}))

let mockPathname = '/'
const mockRouter = { push: vi.fn(), refresh: vi.fn() }

// --- next/link mock ---

vi.mock('next/link', async () => ({
  __esModule: true,
  // Spread the rest: this mock used to forward only the four props it named,
  // so any attribute the component set — aria-current among them — vanished
  // before a test could see it. A mock that silently drops attributes makes
  // accessibility regressions untestable.
  default: ({
    href,
    children,
    className,
    onClick,
    ...rest
  }: {
    href: string
    children: React.ReactNode
    className?: string
    onClick?: () => void
  } & Record<string, unknown>) => (
    <a href={href} className={className} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}))

// --- Config/constants mocks ---

vi.mock('@/lib/config/navigation', async () => ({
  // The drawer consumes the SAME grouped nav as the desktop megamenu — one
  // top-level link, one group (whose /new shortcut must be filtered out).
  MEGAMENU_GROUPS: [
    { href: '/', icon: 'home', label: 'Dashboard' },
    {
      label: 'Personen',
      items: [
        { href: '/residents', icon: 'users', label: 'Bewohner', desc: 'Liste' },
        { href: '/residents/new', icon: 'users', label: 'Neuer Bewohner', desc: 'Erfassen' },
        { href: '/housing', icon: 'building', label: 'Unterkünfte', desc: 'Einheiten' },
      ],
    },
  ],
  SYSTEM_LINKS: [{ href: '/settings', icon: 'settings', label: 'Einstellungen' }],
  NAV_ICONS: {
    home: () => <svg data-testid="icon-home" />,
    users: () => <svg data-testid="icon-users" />,
    building: () => <svg data-testid="icon-building" />,
    settings: () => <svg data-testid="icon-settings" />,
  },
}))

vi.mock('@/lib/constants/labels', async () => ({
  APP_LABELS: { tagline: 'Kompatibles Wohnen' },
  UI_LABELS: {
    menuOpen: 'Menü öffnen',
    menuClose: 'Menü schliessen',
    navigation: 'Navigation',
    userMenu: 'Benutzermenü',
    switchToPortal: 'Zum Portal wechseln',
    logout: 'Abmelden',
    loggingOut: 'Abmelden...',
  },
  ROLE_LABELS: { ADMIN: 'Administrator' },
}))

vi.mock('@/components/ui/Logo', async () => ({
  Logo: ({ size }: { size?: string }) => <div data-testid={`logo-${size}`} />,
}))

// --- Component imports (after mocks) ---
import { MobileNav } from '../MobileNav'
import { UserMenu } from '../UserMenu'

// =============================================================================
// MobileNav
// =============================================================================

describe('MobileNav', () => {
  beforeEach(() => {
    mockPathname = '/'
  })

  it('renders the hamburger button', () => {
    render(<MobileNav />)
    expect(screen.getByRole('button', { name: 'Menü öffnen' })).toBeInTheDocument()
  })

  it('hamburger has aria-expanded=false initially', () => {
    render(<MobileNav />)
    expect(screen.getByRole('button', { name: 'Menü öffnen' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('drawer is hidden initially (translate-x-full)', () => {
    const { container } = render(<MobileNav />)
    const drawer = container.querySelector('#mobile-nav-drawer')
    expect(drawer?.className).toContain('-translate-x-full')
  })

  it('opens drawer when hamburger clicked', () => {
    const { container } = render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    const drawer = container.querySelector('#mobile-nav-drawer')
    expect(drawer?.className).toContain('translate-x-0')
  })

  it('hamburger has aria-expanded=true when open', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    expect(screen.getByRole('button', { name: 'Menü öffnen' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('shows close button when drawer is open', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    expect(screen.getByRole('button', { name: 'Menü schliessen' })).toBeInTheDocument()
  })

  it('close button hides drawer', () => {
    const { container } = render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Menü schliessen' }))
    const drawer = container.querySelector('#mobile-nav-drawer')
    expect(drawer?.className).toContain('-translate-x-full')
  })

  it('shows backdrop when open', () => {
    const { container } = render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    expect(container.querySelector('.scrim')).toBeInTheDocument()
  })

  it('hides backdrop when closed', () => {
    const { container } = render(<MobileNav />)
    expect(container.querySelector('.scrim')).not.toBeInTheDocument()
  })

  it('clicking backdrop closes drawer', () => {
    const { container } = render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    fireEvent.click(container.querySelector('.scrim')!)
    const drawer = container.querySelector('#mobile-nav-drawer')
    expect(drawer?.className).toContain('-translate-x-full')
  })

  it('Escape key closes drawer', () => {
    const { container } = render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    const drawer = container.querySelector('#mobile-nav-drawer')
    expect(drawer?.className).toContain('-translate-x-full')
  })

  it('renders top-level, grouped and system nav labels', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Personen')).toBeInTheDocument() // group eyebrow
    expect(screen.getByText('Bewohner')).toBeInTheDocument()
    expect(screen.getByText('Unterkünfte')).toBeInTheDocument()
    expect(screen.getByText('Einstellungen')).toBeInTheDocument() // system section
  })

  it('hides creation shortcuts (…/new) from the drawer', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    expect(screen.queryByText('Neuer Bewohner')).not.toBeInTheDocument()
  })

  it('renders nav links with correct hrefs', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    expect(screen.getByRole('link', { name: /Bewohner/ })).toHaveAttribute('href', '/residents')
  })

  it('announces the current page on the active drawer link', () => {
    // MobileNavLink computed `active`, styled with it, and never announced it —
    // so the highlight existed only for people who can see it. Every other nav
    // surface in this app (AdminSidebar, PortalNav, PortalTabBar, PortalSidebar)
    // already sets aria-current; this was the one straggler.
    mockPathname = '/residents'
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    expect(screen.getByRole('link', { name: /Bewohner/ })).toHaveAttribute('aria-current', 'page')
    mockPathname = '/'
  })

  it('does not mark inactive drawer links as the current page', () => {
    mockPathname = '/residents'
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    expect(screen.getByRole('link', { name: /Unterkünfte/ })).not.toHaveAttribute('aria-current')
    mockPathname = '/'
  })

  it('clicking nav link closes drawer', () => {
    const { container } = render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    fireEvent.click(screen.getByRole('link', { name: /Dashboard/ }))
    const drawer = container.querySelector('#mobile-nav-drawer')
    expect(drawer?.className).toContain('-translate-x-full')
  })

  it('drawer has role=dialog with aria-modal', () => {
    const { container } = render(<MobileNav />)
    const drawer = container.querySelector('#mobile-nav-drawer')
    expect(drawer).toHaveAttribute('role', 'dialog')
    expect(drawer).toHaveAttribute('aria-modal', 'true')
  })

  it('marks active link for current pathname', () => {
    mockPathname = '/residents'
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    // The active link should use the semantic active surface token.
    const residentsLink = screen.getByRole('link', { name: /Bewohner/ })
    expect(residentsLink.className).toContain('nav-item-active')
  })

  it('sets body overflow hidden when open', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('restores body overflow when closed', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: 'Menü öffnen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Menü schliessen' }))
    expect(document.body.style.overflow).toBe('')
  })
})

// =============================================================================
// UserMenu
// =============================================================================

const BASE_USER = { name: 'Anna Meier', email: 'anna@example.com', role: 'ADMIN' }

describe('UserMenu', () => {
  beforeEach(() => {
    mockRouter.push.mockClear()
    mockRouter.refresh.mockClear()
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
  })

  it('renders toggle button with aria-label', () => {
    render(<UserMenu user={BASE_USER} />)
    expect(screen.getByRole('button', { name: 'Benutzermenü' })).toBeInTheDocument()
  })

  it('shows user initials in avatar', () => {
    render(<UserMenu user={BASE_USER} />)
    expect(screen.getByText('AM')).toBeInTheDocument()
  })

  it('dropdown is hidden initially', () => {
    render(<UserMenu user={BASE_USER} />)
    expect(screen.queryByText('anna@example.com')).not.toBeInTheDocument()
  })

  it('opens dropdown when button clicked', () => {
    render(<UserMenu user={BASE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Benutzermenü' }))
    expect(screen.getByText('anna@example.com')).toBeInTheDocument()
  })

  it('shows user name in dropdown', () => {
    render(<UserMenu user={BASE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Benutzermenü' }))
    // Name appears in header + dropdown
    expect(screen.getAllByText('Anna Meier').length).toBeGreaterThanOrEqual(1)
  })

  it('shows role label in dropdown', () => {
    render(<UserMenu user={BASE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Benutzermenü' }))
    expect(screen.getByText('Administrator')).toBeInTheDocument()
  })

  it('toggle button has aria-expanded=true when open', () => {
    render(<UserMenu user={BASE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Benutzermenü' }))
    expect(screen.getByRole('button', { name: 'Benutzermenü' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('closes dropdown on outside mousedown', () => {
    render(<UserMenu user={BASE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Benutzermenü' }))
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('anna@example.com')).not.toBeInTheDocument()
  })

  it('hides portal link when hasPortalAccess is false', () => {
    render(<UserMenu user={BASE_USER} hasPortalAccess={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Benutzermenü' }))
    expect(screen.queryByText('Zum Portal wechseln')).not.toBeInTheDocument()
  })

  it('shows portal link when hasPortalAccess is true', () => {
    render(<UserMenu user={BASE_USER} hasPortalAccess />)
    fireEvent.click(screen.getByRole('button', { name: 'Benutzermenü' }))
    expect(screen.getByText('Zum Portal wechseln')).toBeInTheDocument()
  })

  it('portal link points to /portal', () => {
    render(<UserMenu user={BASE_USER} hasPortalAccess />)
    fireEvent.click(screen.getByRole('button', { name: 'Benutzermenü' }))
    expect(screen.getByRole('link', { name: 'Zum Portal wechseln' })).toHaveAttribute(
      'href',
      '/portal',
    )
  })

  it('shows logout button', () => {
    render(<UserMenu user={BASE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Benutzermenü' }))
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBeInTheDocument()
  })

  it('calls logout API and redirects on logout click', async () => {
    render(<UserMenu user={BASE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Benutzermenü' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }))
    })
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' })
    expect(mockRouter.push).toHaveBeenCalledWith('/login')
  })

  it('shows initials from multi-word name', () => {
    render(<UserMenu user={{ ...BASE_USER, name: 'Max Müller' }} />)
    expect(screen.getByText('MM')).toBeInTheDocument()
  })

  it('caps initials at 2 characters', () => {
    render(<UserMenu user={{ ...BASE_USER, name: 'Anna Berta Clara' }} />)
    expect(screen.getByText('AB')).toBeInTheDocument()
  })
})

// =============================================================================
// FairnessSummary
// =============================================================================

vi.mock('@/lib/config/household-tasks', async () => ({
  CHORE_LABELS: {
    balance: {
      title: 'Aufgaben-Saldo',
      subtitle: 'Diesen Monat, in Minuten',
      explainer: 'Fast alle überschätzen den eigenen Anteil.',
      done: 'Geleistet',
      share: 'Anteil',
      net: 'Saldo',
      netHint: 'Saldo = geleistet minus Anteil.',
      settleHint: 'Ein Saldo wird mit der nächsten Aufgabe ausgeglichen.',
      minutes: 'Min.',
      empty: 'Diesen Monat wurde noch nichts erledigt.',
    },
  },
}))

import { ChoreBalanceSummary } from '../../portal/ChoreBalanceSummary'

const row = (
  code: string,
  doneMinutes: number,
  shareMinutes: number,
  extra: { residentId?: string; displayName?: string | null } = {},
) => ({
  residentId: extra.residentId ?? code,
  code,
  displayName: extra.displayName ?? null,
  doneMinutes,
  shareMinutes,
  balanceMinutes: doneMinutes - shareMinutes,
})

describe('ChoreBalanceSummary', () => {
  it('renders section title', () => {
    render(<ChoreBalanceSummary balances={[]} />)
    expect(screen.getByText('Aufgaben-Saldo')).toBeInTheDocument()
  })

  it('says nothing happened yet rather than drawing empty bars', () => {
    render(<ChoreBalanceSummary balances={[row('RES-001', 0, 0)]} />)
    expect(screen.getByText('Diesen Monat wurde noch nichts erledigt.')).toBeInTheDocument()
  })

  it('shows a signed balance in minutes, not a completion count', () => {
    render(<ChoreBalanceSummary balances={[row('RES-001', 60, 30), row('RES-002', 0, 30)]} />)
    expect(screen.getByText('+30 Min.')).toBeInTheDocument()
    expect(screen.getByText('-30 Min.')).toBeInTheDocument()
  })

  it('shows each person their own minutes done and their share', () => {
    render(<ChoreBalanceSummary balances={[row('RES-001', 60, 30), row('RES-002', 0, 30)]} />)
    expect(screen.getByText(/Geleistet 60 · Anteil 30 Min\./)).toBeInTheDocument()
  })

  it('prefers a self-chosen display name over the login code', () => {
    render(
      <ChoreBalanceSummary
        balances={[row('RES-001', 60, 30, { displayName: 'Fatima' }), row('RES-002', 0, 30)]}
      />,
    )
    expect(screen.getByText('Fatima')).toBeInTheDocument()
    expect(screen.queryByText('RES-001')).not.toBeInTheDocument()
  })

  it('marks the reader so they can find themselves', () => {
    render(
      <ChoreBalanceSummary
        balances={[row('RES-001', 60, 30, { residentId: 'me' }), row('RES-002', 0, 30)]}
        currentResidentId="me"
      />,
    )
    expect(screen.getByText('Du')).toBeInTheDocument()
  })

  it('scales bars to the largest IMBALANCE, so an even month reads as even', () => {
    // Hana is 5 minutes ahead of a 100-minute share. Scaling to contribution
    // would paint that bar full and imply a winner; scaling to imbalance keeps
    // the whole panel visibly near-even.
    const { container } = render(
      <ChoreBalanceSummary balances={[row('RES-001', 105, 100), row('RES-002', 95, 100)]} />,
    )
    const widths = Array.from(container.querySelectorAll('[style*="width"]')).map(
      (b) => (b as HTMLElement).style.width,
    )
    // Half-width max: each side of centre can only ever fill 50% of the track.
    expect(widths).toEqual(['50%', '50%'])
  })

  it('draws no rank, medal or position number', () => {
    const { container } = render(
      <ChoreBalanceSummary balances={[row('RES-001', 90, 30), row('RES-002', 0, 30)]} />,
    )
    expect(container.textContent).not.toMatch(/[🥇🏆]|\b1\.\s|\bPlatz\b/)
  })
})
