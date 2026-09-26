import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'

import { PortalHousingCard } from '../PortalHousingCard'
import { createTranslator } from '@/lib/i18n'

/**
 * The apartment name is editable where it is shown.
 *
 * WHAT SHIPPED: `ApartmentNameEditor` was complete — guarded, validated,
 * translated into every offered language — and rendered by NOTHING. It had
 * been built for `/portal/apartment`, and when that page was retired to a
 * redirect its editor stayed behind: half a pair, deleted halfway.
 *
 * `PATCH /api/portal/apartment` kept working the entire time — auth-checked,
 * audited, and reachable by no control a resident could press. So the portal
 * displayed "Singapur" at the top of the housing card, offered no way to
 * change it, and CLAUDE.md went on stating that any current resident may set
 * it. Nothing failed: an unrendered component type-checks, lints, and even
 * passes its own tests.
 *
 * Found by grepping for components that nothing imports, after deleting four
 * dead dashboard components — the same sweep, one file further down.
 */

vi.mock('@/lib/i18n/LocaleProvider', () => ({
  useT: () => createTranslator('de'),
}))

vi.mock('@/lib/i18n/request', () => ({
  getRequestTranslator: async () => ({ t: createTranslator('de'), locale: 'de' }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const PLACEMENT = { startDate: new Date('2026-08-13'), compatibilityScore: null }

function unit(nickname: string | null) {
  return {
    address: 'Musterstrasse 1, 8000 Zürich',
    nickname,
    totalRooms: 3,
    quietHours: null,
    smokingAllowed: false,
    petsAllowed: false,
  }
}

async function renderCard(nickname: string | null) {
  render(
    await PortalHousingCard({
      placement: PLACEMENT,
      housingUnit: unit(nickname),
      roommatesCount: 2,
    }),
  )
}

describe('a named flat', () => {
  it('shows the name the residents chose', async () => {
    await renderCard('Singapur')
    expect(screen.getByRole('heading', { name: 'Singapur' })).toBeInTheDocument()
  })

  it('offers a control to change it', async () => {
    // The whole defect in one assertion. Before this, the name was read-only
    // on every surface a resident can reach.
    await renderCard('Singapur')
    expect(screen.getByRole('button', { name: 'Namen ändern' })).toBeInTheDocument()
  })
})

describe('an unnamed flat', () => {
  it('says so, rather than showing a generic label', async () => {
    // "Unterkunft" reads like the flat's name; "Noch ohne Namen" invites the
    // action that is now actually available.
    await renderCard(null)
    expect(screen.getByText('Noch ohne Namen')).toBeInTheDocument()
  })

  it('still offers the control', async () => {
    await renderCard(null)
    expect(screen.getByRole('button', { name: 'Namen ändern' })).toBeInTheDocument()
  })
})

describe('the heading level', () => {
  it('is h2, under the portal page title', async () => {
    // The editor used to be a page heading at text-2xl. Dropping it into a
    // card unchanged would have skipped a level and oversized the card.
    await renderCard('Singapur')
    expect(screen.getByRole('heading', { level: 2, name: 'Singapur' })).toBeInTheDocument()
  })
})
