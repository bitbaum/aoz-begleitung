import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PortalNav } from '../PortalNav'
import { PORTAL_LABELS } from '@/lib/constants/labels'

let mockPathname = '/portal'

vi.mock('next/navigation', async () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('next/link', async () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
    ...rest
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/constants/labels', async () => await vi.importActual('@/lib/constants/labels'))

function renderNav(hasStaffAccess?: boolean) {
  return render(<PortalNav hasStaffAccess={hasStaffAccess} />)
}

function openAccount() {
  fireEvent.click(screen.getByRole('button', { name: 'Konto' }))
}

describe('PortalNav', () => {
  beforeEach(() => {
    mockPathname = '/portal'
  })

  it('renders the brand link to /portal, named by the brand not by this file', () => {
    // Asserting the literal "Mein Zuhause" is what let the nav and the page
    // metadata drift apart in the first place. The name is the brand's
    // decision, so the test reads the same source the component does.
    renderNav()
    expect(screen.getByRole('link', { name: PORTAL_LABELS.title })).toHaveAttribute(
      'href',
      '/portal',
    )
  })

  it('gives every header link a 44px hit area — the brand link was 24px high', () => {
    renderNav()
    openAccount()
    const short = screen
      .getAllByRole('link')
      .filter((link) => !(link.getAttribute('class') ?? '').includes('min-h-[44px]'))
      .map((link) => link.textContent)
    expect(short).toEqual([])
  })

  it('keeps destinations out of the header — they live in the sidebar and tabs', () => {
    renderNav()
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))

    expect(hrefs).toEqual(['/portal'])
    expect(hrefs).not.toContain('/portal/chores')
    expect(hrefs).not.toContain('/portal/apartment')
    expect(hrefs).not.toContain('/portal/roommates')
  })

  it('offers a compact language switcher, not a grid of every locale', () => {
    renderNav()
    expect(screen.getByRole('combobox', { name: 'Sprache wechseln' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Shqip' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Soomaali' })).not.toBeInTheDocument()
  })

  it('no longer renders a hamburger', () => {
    renderNav()
    expect(screen.queryByRole('button', { name: /Menü öffnen/i })).not.toBeInTheDocument()
  })

  it('hides account destinations until the dropdown is opened', () => {
    renderNav()
    expect(screen.queryByRole('link', { name: 'Profil' })).not.toBeInTheDocument()

    openAccount()
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/portal/profile')
    expect(screen.getByRole('link', { name: 'Hilfe' })).toHaveAttribute('href', '/portal/help')
  })

  it('hides "Zur Verwaltung" when hasStaffAccess is false', () => {
    renderNav(false)
    openAccount()
    expect(screen.queryByRole('link', { name: 'Zur Verwaltung' })).not.toBeInTheDocument()
  })

  it('links to the staff side when hasStaffAccess is true', () => {
    renderNav(true)
    openAccount()
    expect(screen.getByRole('link', { name: 'Zur Verwaltung' })).toHaveAttribute('href', '/')
  })

  it('renders the logout submit button in the account menu', () => {
    renderNav()
    openAccount()
    expect(screen.getByRole('button', { name: 'Abmelden' })).toHaveAttribute('type', 'submit')
  })
})
