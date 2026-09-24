/**
 * The staff navigation as a vertical panel.
 *
 * What matters here is not that it renders — it is that EVERY destination a
 * role may reach is present without an interaction. The megamenu this replaced
 * put four of five groups behind a hover, and the fifth behind a horizontal
 * scroll on a 1280px laptop; a nav whose contents depend on pointer behaviour
 * cannot be asserted, and was not.
 */

import { render, screen } from '@testing-library/react'
import { AdminSidebar } from '@/components/layout/AdminSidebar'
import { visibleMegaMenuGroups, withInboxBadge } from '@/lib/config/navigation'
import { hasPermission } from '@/lib/auth/role-policy'

vi.mock('next/navigation', async () => ({
  usePathname: () => mockPathname,
}))

let mockPathname = '/'

beforeEach(() => {
  mockPathname = '/'
})

describe('AdminSidebar', () => {
  it('renders every destination an ADMIN can reach, with no interaction', () => {
    const groups = visibleMegaMenuGroups({
      role: 'ADMIN',
      scope: 'ALL_DOMAINS',
      isSystemAdmin: true,
    })
    render(<AdminSidebar groups={groups} />)

    const expected = groups.flatMap((group) =>
      'items' in group ? group.items.map((i) => i.label) : [group.label],
    )

    const missing = expected.filter((label) => screen.queryAllByText(label).length === 0)
    expect({ total: expected.length, missing }).toEqual({ total: expected.length, missing: [] })
  })

  it('shows a narrower role only what its permissions allow', () => {
    // JOBCOACH may not read housing. A nav that offered it would end at
    // /kein-zugriff — a dead end dressed as a destination.
    //
    // Vorfälle IS offered, and that is not a regression of the same rule: the
    // role now holds `incidents:read` on purpose, so the entry leads
    // somewhere. Distributed housing removed the corridor where a coach used
    // to overhear that a client's household was in trouble; this is the
    // replacement. What they still cannot do is WORK the ladder —
    // `incidents:write` stays with Betreuung and Sozialarbeit, and the
    // conflict-operations dashboard section is keyed on that verb.
    const viewer = { role: 'JOBCOACH', scope: 'OWN_DOMAIN', isSystemAdmin: false } as const
    render(<AdminSidebar groups={visibleMegaMenuGroups(viewer)} />)

    expect(screen.queryByText('Unterkünfte')).toBeNull()
    expect(screen.getAllByText('Vorfälle').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Eingang').length).toBeGreaterThan(0)

    // The nav entry is only honest if the route behind it admits them.
    expect(hasPermission(viewer, 'incidents:read')).toBe(true)
    expect(hasPermission(viewer, 'incidents:write')).toBe(false)
  })

  it('marks the current page, and only the current page', () => {
    mockPathname = '/incidents'
    render(
      <AdminSidebar
        groups={visibleMegaMenuGroups({ role: 'ADMIN', scope: 'ALL_DOMAINS', isSystemAdmin: true })}
      />,
    )

    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page')

    expect(current).toHaveLength(1)
    expect(current[0]).toHaveAttribute('href', '/incidents')
  })

  it('opens the group holding the current page', () => {
    mockPathname = '/incidents'
    const { container } = render(
      <AdminSidebar
        groups={visibleMegaMenuGroups({ role: 'ADMIN', scope: 'ALL_DOMAINS', isSystemAdmin: true })}
      />,
    )

    const open = Array.from(container.querySelectorAll('details[open]'))
    // Exactly one — arriving on a page must not expand the whole tree.
    expect(open).toHaveLength(1)
    expect(open[0]?.textContent).toContain('Vorfälle')
  })

  it('does not wrap a single destination in a one-item accordion', () => {
    // Dashboard and Nachrichten are links, not groups. An accordion holding
    // one item is a link wearing a hat.
    const { container } = render(
      <AdminSidebar
        groups={visibleMegaMenuGroups({ role: 'ADMIN', scope: 'ALL_DOMAINS', isSystemAdmin: true })}
      />,
    )

    const oneItemGroups = Array.from(container.querySelectorAll('details')).filter(
      (d) => d.querySelectorAll('li').length === 1,
    )
    expect(oneItemGroups).toEqual([])
  })

  describe('the Eingang badge', () => {
    const admin = { role: 'ADMIN', scope: 'ALL_DOMAINS', isSystemAdmin: true } as const

    it('shows how many people are waiting, on Eingang and nowhere else', () => {
      render(<AdminSidebar groups={withInboxBadge(visibleMegaMenuGroups(admin), 4)} />)
      const badge = screen.getByLabelText('4 Personen warten auf eine Antwort')
      expect(badge).toHaveTextContent('4')
      expect(badge.closest('a')).toHaveAttribute('href', '/')
      expect(screen.getAllByText('4')).toHaveLength(1)
    })

    it('renders nothing at zero or when the count failed', () => {
      // A permanent "0" is a mark people learn to stop reading.
      for (const count of [0, null]) {
        const { unmount } = render(
          <AdminSidebar groups={withInboxBadge(visibleMegaMenuGroups(admin), count)} />,
        )
        expect(
          screen.queryByLabelText(/warten auf eine Antwort|wartet auf eine Antwort/),
        ).toBeNull()
        unmount()
      }
    })

    it('caps a large count so the nav keeps its width', () => {
      render(<AdminSidebar groups={withInboxBadge(visibleMegaMenuGroups(admin), 140)} />)
      expect(screen.getByLabelText('140 Personen warten auf eine Antwort')).toHaveTextContent('99+')
    })
  })
})
