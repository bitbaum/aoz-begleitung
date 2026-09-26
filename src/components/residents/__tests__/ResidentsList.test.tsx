import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { ResidentsList, type ResidentListItem } from '../ResidentsList'

// --- Mocks ---

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

vi.mock('@/components/residents/ResidentCardActions', async () => ({
  ResidentCardActions: ({ residentId }: { residentId: string }) => (
    <div data-testid={`actions-${residentId}`} />
  ),
}))

/**
 * The label mock SPREADS the real map rather than retyping it.
 *
 * It used to be a hand-written copy of `RESIDENT_LIST_LABELS`, and a copy goes
 * stale the moment a key is added: `placeholder` landed in the real file, this
 * object did not have it, and the component rendered `undefined` — an empty
 * span, no marker, no error. The test failed for a reason that had nothing to
 * do with the code under test.
 *
 * Only the few labels whose exact wording these tests assert are overridden,
 * so shortening them here cannot drift from the product either.
 */
vi.mock('@/lib/constants', async () => {
  const actual = await vi.importActual<typeof import('@/lib/constants')>('@/lib/constants')
  return {
    ...actual,
    AGE_RANGE_LABELS: { ADULT: '26-40', YOUNG_ADULT: '18-25' },
    GENDER_LABELS_SHORT: { MALE: 'M', FEMALE: 'W', PREFER_NOT_SAY: '-' },
    RESIDENT_STATUS_LABELS: { ACTIVE: 'Aktiv', PLACED: 'Platziert', EXITED: 'Archiviert' },
    RESIDENT_LIST_LABELS: {
      ...actual.RESIDENT_LIST_LABELS,
      emptyDefault: 'Noch keine Bewohner vorhanden',
      emptyFiltered: 'Keine Bewohner für diese Filter',
      notPlaced: 'Nicht platziert',
      recentIncidentsSuffix: 'Vorfälle',
    },
    LANGUAGE_LABELS: { de: 'Deutsch', en: 'Englisch' },
    getLabel: (labels: Record<string, string>, key: string) => labels[key] ?? key,
  }
})

vi.mock('@/lib/utils', async () => ({
  getStatusBadgeClass: (status: string) => `badge-${status.toLowerCase()}`,
  formatDate: (d: Date | string) => '01.01.2024',
}))

// --- Helpers ---

function makeResident(overrides: Partial<ResidentListItem> & { id: string }): ResidentListItem {
  return {
    id: overrides.id,
    code: overrides.code ?? `RES-${overrides.id}`,
    displayName: overrides.displayName ?? null,
    isPlaceholder: overrides.isPlaceholder ?? false,
    ageRange: overrides.ageRange ?? 'ADULT',
    gender: overrides.gender ?? 'PREFER_NOT_SAY',
    status: overrides.status ?? 'ACTIVE',
    languages: overrides.languages ?? ['de'],
    createdAt: overrides.createdAt ?? new Date('2024-01-01'),
    placements: overrides.placements ?? [],
    incidentCount: overrides.incidentCount ?? 0,
  }
}

// --- Tests ---

describe('ResidentsList', () => {
  // ── Empty states ──────────────────────────────────────────────────────────

  it('shows empty-default message when no residents at all', () => {
    render(<ResidentsList residents={[]} />)
    expect(screen.getByText('Noch keine Bewohner vorhanden')).toBeInTheDocument()
  })

  // ── Card rendering ────────────────────────────────────────────────────────

  it('renders resident code', () => {
    render(<ResidentsList residents={[makeResident({ id: 'r1', code: 'RES-001' })]} />)
    expect(screen.getByText('RES-001')).toBeInTheDocument()
  })

  it('renders link to resident profile', () => {
    render(<ResidentsList residents={[makeResident({ id: 'res-abc', code: 'RES-ABC' })]} />)
    expect(screen.getByRole('link', { name: /RES-ABC/ })).toHaveAttribute(
      'href',
      '/residents/res-abc',
    )
  })

  it('shows age and gender', () => {
    render(
      <ResidentsList residents={[makeResident({ id: 'r1', ageRange: 'ADULT', gender: 'MALE' })]} />,
    )
    expect(screen.getByText(/26-40/)).toBeInTheDocument()
    expect(screen.getByText(/M/)).toBeInTheDocument()
  })

  it('shows status badge', () => {
    render(<ResidentsList residents={[makeResident({ id: 'r1', status: 'PLACED' })]} />)
    expect(screen.getByText('Platziert')).toBeInTheDocument()
  })

  it('shows housing unit code when placed', () => {
    const resident = makeResident({
      id: 'r1',
      placements: [{ housingUnit: { code: 'HU-01' } }],
    })
    render(<ResidentsList residents={[resident]} />)
    expect(screen.getByText('HU-01')).toBeInTheDocument()
  })

  it('shows "Nicht platziert" warning when no placement', () => {
    render(<ResidentsList residents={[makeResident({ id: 'r1', placements: [] })]} />)
    expect(screen.getByText('Nicht platziert')).toBeInTheDocument()
  })

  it('shows language', () => {
    render(<ResidentsList residents={[makeResident({ id: 'r1', languages: ['de'] })]} />)
    expect(screen.getByText('Deutsch')).toBeInTheDocument()
  })

  it('shows incident count when > 0', () => {
    render(<ResidentsList residents={[makeResident({ id: 'r1', incidentCount: 3 })]} />)
    expect(screen.getByText(/3/)).toBeInTheDocument()
    expect(screen.getByText(/Vorfälle/)).toBeInTheDocument()
  })

  it('hides incident count when 0', () => {
    render(<ResidentsList residents={[makeResident({ id: 'r1', incidentCount: 0 })]} />)
    expect(screen.queryByText(/Vorfälle/)).not.toBeInTheDocument()
  })

  it('renders ResidentCardActions with resident id', () => {
    render(<ResidentsList residents={[makeResident({ id: 'r42' })]} />)
    expect(screen.getByTestId('actions-r42')).toBeInTheDocument()
  })

  it('renders multiple resident cards', () => {
    render(
      <ResidentsList
        residents={[
          makeResident({ id: 'r1', code: 'RES-001' }),
          makeResident({ id: 'r2', code: 'RES-002' }),
        ]}
      />,
    )
    expect(screen.getByText('RES-001')).toBeInTheDocument()
    expect(screen.getByText('RES-002')).toBeInTheDocument()
  })
})

/**
 * A seeded profile must never read as a person who needs support.
 *
 * Placeholder rows carry a plausible first name and sit in a real flat, so on
 * this list "Amir" looks exactly like a real client. Without a marker a Betreuerin could
 * open a case, record a check-in or chase somebody who does not exist yet —
 * and the row would keep looking healthy, because a name is a name.
 *
 * The marker disappears the moment the code is claimed at /register, because
 * from then on there IS somebody behind it.
 */
describe('placeholder profiles are marked', () => {
  it('marks a seeded profile', () => {
    render(
      <ResidentsList
        residents={[makeResident({ id: 'p1', displayName: 'Amir', isPlaceholder: true })]}
      />,
    )
    expect(screen.getByText('Platzhalter')).toBeInTheDocument()
  })

  it('leaves a real client unmarked', () => {
    render(
      <ResidentsList
        residents={[makeResident({ id: 'r1', displayName: 'Hana', isPlaceholder: false })]}
      />,
    )
    expect(screen.queryByText('Platzhalter')).not.toBeInTheDocument()
  })

  it('marks only the seeded one when both are listed together', () => {
    // The realistic screen: one real flat and one seeded flat, side by side.
    render(
      <ResidentsList
        residents={[
          makeResident({ id: 'r1', displayName: 'Hana', isPlaceholder: false }),
          makeResident({ id: 'p1', displayName: 'Amir', isPlaceholder: true }),
        ]}
      />,
    )
    expect(screen.getAllByText('Platzhalter')).toHaveLength(1)
    expect(screen.getByText('Hana')).toBeInTheDocument()
    expect(screen.getByText('Amir')).toBeInTheDocument()
  })
})
