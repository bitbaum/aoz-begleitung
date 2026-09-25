import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { ActionDashboard } from '../ActionDashboard'

// --- Mocks ---

vi.mock('../PrimaryActionHero', async () => ({
  HeroAction: ({ action }: { action: { type: string } }) => (
    <div data-testid="hero-action" data-type={action?.type ?? 'none'} />
  ),
  CriticalAlertBanner: ({ incidents }: { incidents: Array<{ id: string }> }) => (
    <div data-testid="critical-banner" data-count={incidents.length} />
  ),
  determinePrimaryAction: vi.fn(() => ({
    type: 'ALL_GOOD',
    label: 'OK',
    href: '/',
    color: 'green',
  })),
}))

vi.mock('../QuickStatsRow', async () => ({
  QuickStat: ({ label, value }: { label: string; value: number }) => (
    <div data-testid="quick-stat">
      {label}: {value}
    </div>
  ),
}))

vi.mock('../ActionTilesGrid', async () => ({
  ActionTile: ({ title, count }: { title: string; count: number }) => (
    <div data-testid="action-tile">
      {title} ({count})
    </div>
  ),
}))

vi.mock('../AllClearState', async () => ({
  AllClearState: () => <div data-testid="all-clear-state" />,
  QuickActionsBar: ({ unplacedCount, freeBeds }: { unplacedCount: number; freeBeds: number }) => (
    <div data-testid="quick-actions-bar" data-unplaced={unplacedCount} data-free={freeBeds} />
  ),
}))

// The claim is a server action; the component only needs something to call.
const claimApplication = vi.fn()
vi.mock('@/lib/actions/opportunities', async () => ({
  claimApplication: (formData: FormData) => claimApplication(formData),
}))

vi.mock('@/lib/config/thresholds', async () => ({
  ...(await vi.importActual<object>('@/lib/config/thresholds')),
  DISPLAY_LIMITS: { dashboardItems: 3 },
}))

// NOT mocked: the German labels are the SSOT and this test reads them.
// They used to be re-typed here as a 50-key literal, which is a second copy
// of a table that already exists — and it silently dropped every key added
// after it was written, so a component rendering a brand-new label rendered
// `undefined` while the suite stayed green.

// --- Helpers ---

const BASE_PROPS = {
  viewer: { role: 'ADMIN' as const, scope: 'ALL_DOMAINS' as const, isSystemAdmin: true },
  // A populated workspace with nothing urgent — the "quiet" case. Emptiness
  // is a THIRD state and is exercised separately below.
  residentCount: 15,
  // Oversight over every domain: no single seat, so "nobody is assigned to
  // you" is not a question that applies. Specialists are exercised below.
  assignedResidentCount: null,
  waitingApplications: [],
  pendingApprovals: [],
  jobQueue: [],
  volunteeringQueue: [],
  waitingThreads: [],
  overdueFollowUps: [],
  expiringFacts: [],
  housingUnitCount: 4,
  occupiedBeds: 10,
  totalBeds: 20,
  totalPlacements: 15,
  overdueCheckIns: [],
  dueSoonCheckIns: [],
  unplacedResidents: [],
  criticalIncidents: [],
  problemUnits: [],
  pendingTransfers: [],
  proposalsAwaitingStaff: [],
  conflictFreeDays: 14,
  openMaintenanceCount: 0,
  learningInProgressCount: 0,
  learningRecentCompletions: 0,
  upcomingEventsCount: 0,
  activeStaffCount: 4,
  neverSignedInStaffCount: 0,
  // Fixed strings, because they are now computed on the server and passed in.
  // The component no longer reads a clock, which is what makes its output the
  // same in the container and in the browser.
  greeting: 'Guten Tag',
  todayLabel: 'Sonntag, 16. August',
}

function makeCheckIn(id: string) {
  return {
    id,
    residentCode: `RES-${id}`,
    residentDisplayName: null,
    residentId: `rid-${id}`,
    unitCode: 'A01',
    daysSinceLastCheckIn: 8,
    supportLevel: 'STANDARD',
  }
}

function makeResident(id: string) {
  return { id, code: `RES-${id}`, displayName: null, createdAt: new Date('2024-01-01') }
}

function makeIncident(id: string) {
  return { id, type: 'NOISE', unitCode: 'B02', unitId: 'unit-1', daysSinceCreated: 2 }
}

function makeProblemUnit(id: string) {
  return {
    id,
    code: `U0${id}`,
    incidentCount: 3,
    problemScore: 8,
    unresolvedCount: 1,
    primaryIssue: 'NOISE',
  }
}

function makeDueSoon(id: string, daysUntilDue = 2) {
  return {
    id,
    residentCode: `RES-${id}`,
    residentDisplayName: null,
    residentId: `rid-${id}`,
    unitCode: 'C03',
    daysUntilDue,
    supportLevel: 'STANDARD',
  }
}

function makeTransfer(id: string) {
  return {
    id,
    residentCode: `RES-${id}`,
    residentDisplayName: null,
    unitCode: 'A01',
    daysSinceCreated: 4,
  }
}

function makeProposal(id: string) {
  return { id, title: 'Ruhezeiten ab 21 Uhr', unitCode: 'A01', daysWaiting: 3 }
}

// --- Tests ---

describe('ActionDashboard', () => {
  // ── Summary message ───────────────────────────────────────────────────────

  it('shows "Alles unter Kontrolle" when no issues', () => {
    render(<ActionDashboard {...BASE_PROPS} />)
    expect(screen.getByText('Alles unter Kontrolle heute.')).toBeInTheDocument()
  })

  it('shows singular task message when exactly 1 issue', () => {
    render(<ActionDashboard {...BASE_PROPS} overdueCheckIns={[makeCheckIn('c1')]} />)
    expect(screen.getByText('1 Aufgabe wartet auf Sie.')).toBeInTheDocument()
  })

  it('shows plural tasks message when more than 1 issue', () => {
    render(
      <ActionDashboard
        {...BASE_PROPS}
        overdueCheckIns={[makeCheckIn('c1')]}
        unplacedResidents={[makeResident('r1')]}
      />,
    )
    expect(screen.getByText(/2 Aufgaben warten auf Sie/)).toBeInTheDocument()
  })

  // ── CTA hierarchy ─────────────────────────────────────────────────────────

  it('does not render the legacy quick-action bar above the primary action', () => {
    render(<ActionDashboard {...BASE_PROPS} occupiedBeds={10} totalBeds={20} />)
    expect(screen.queryByTestId('quick-actions-bar')).not.toBeInTheDocument()
  })

  it('routes unplaced residents into the open task list instead of another CTA bar', () => {
    render(
      <ActionDashboard
        {...BASE_PROPS}
        unplacedResidents={[makeResident('r1'), makeResident('r2')]}
      />,
    )
    expect(screen.queryByTestId('quick-actions-bar')).not.toBeInTheDocument()
    expect(screen.getByText('Klient*innen platzieren (2)')).toBeInTheDocument()
  })

  // ── Critical alert banner ─────────────────────────────────────────────────

  it('shows CriticalAlertBanner when criticalIncidents > 0', () => {
    render(<ActionDashboard {...BASE_PROPS} criticalIncidents={[makeIncident('i1')]} />)
    expect(screen.getByTestId('critical-banner')).toBeInTheDocument()
  })

  it('hides CriticalAlertBanner when no criticalIncidents', () => {
    render(<ActionDashboard {...BASE_PROPS} />)
    expect(screen.queryByTestId('critical-banner')).not.toBeInTheDocument()
  })

  // ── HeroAction ────────────────────────────────────────────────────────────

  it('renders HeroAction when there is an action to name', () => {
    render(<ActionDashboard {...BASE_PROPS} overdueCheckIns={[makeCheckIn('c1')]} />)
    expect(screen.getByTestId('hero-action')).toBeInTheDocument()
  })

  it('does not render HeroAction on a quiet day — the all-clear block says it once', () => {
    // The hero, the all-clear block and the greeting line all used to render
    // together, three sentences and two identical buttons for one fact.
    render(<ActionDashboard {...BASE_PROPS} />)
    expect(screen.queryByTestId('hero-action')).not.toBeInTheDocument()
    expect(screen.getByTestId('all-clear-state')).toBeInTheDocument()
  })

  // ── QuickStats row ────────────────────────────────────────────────────────

  it('renders all 7 QuickStat tiles for ADMIN', () => {
    // 7 since the Leitung-only team tile landed. Betreuung gets 6 — that
    // difference is the point, and it is asserted in config/dashboard.test.ts.
    render(<ActionDashboard {...BASE_PROPS} />)
    expect(screen.getAllByTestId('quick-stat')).toHaveLength(7)
  })

  it('gives BETREUUNG one tile fewer — no team health', () => {
    render(
      <ActionDashboard
        {...BASE_PROPS}
        viewer={{ role: 'BETREUUNG', scope: 'OWN_DOMAIN', isSystemAdmin: false }}
      />,
    )
    const stats = screen.getAllByTestId('quick-stat')

    expect(stats).toHaveLength(6)
    expect(stats.some((s) => s.textContent?.includes('Team'))).toBe(false)
  })

  // The team tile's SUBTEXT ("n Konten waren noch nie angemeldet") is not
  // assertable here: this suite mocks QuickStat down to `label: value`, so no
  // subtext reaches the DOM whatever the props say. The wording itself is a
  // pure label function and is pinned in the labels test instead — asserting
  // it through a mock that cannot render it would test the mock.

  it('renders only the learning stat for JOBCOACH', () => {
    render(
      <ActionDashboard
        {...BASE_PROPS}
        viewer={{ role: 'JOBCOACH', scope: 'OWN_DOMAIN', isSystemAdmin: false }}
        learningInProgressCount={4}
      />,
    )
    const stats = screen.getAllByTestId('quick-stat')
    expect(stats).toHaveLength(1)
    expect(stats[0]).toHaveTextContent('Lernen & Beruf: 4')
  })

  it('renders learning and events stats for FREIWILLIGENARBEIT, no housing stats', () => {
    render(
      <ActionDashboard
        {...BASE_PROPS}
        viewer={{ role: 'FREIWILLIGENARBEIT', scope: 'OWN_DOMAIN', isSystemAdmin: false }}
        upcomingEventsCount={2}
      />,
    )
    const stats = screen.getAllByTestId('quick-stat')
    expect(stats).toHaveLength(2)
    expect(screen.queryByText(/Freie Plätze/)).not.toBeInTheDocument()
    expect(screen.getByText(/Veranstaltungen: 2/)).toBeInTheDocument()
  })

  /**
   * The bug this pins: the Freiwilligenarbeit coordinator's dashboard could not show her an open task.
   * Every term of `totalIssues` needed a permission she does not hold, and the
   * sixth — the coach queue — was fetched with a hardcoded `'JOB'` while her
   * seats are `VOLUNTEERING`. The count was structurally zero, so the page
   * resolved to `quiet` and congratulated her, every morning.
   */
  it('shows FREIWILLIGENARBEIT her own queue instead of congratulating her', () => {
    render(
      <ActionDashboard
        {...BASE_PROPS}
        viewer={{ role: 'FREIWILLIGENARBEIT', scope: 'OWN_DOMAIN', isSystemAdmin: false }}
        volunteeringQueue={[
          {
            residentId: 'r1',
            name: 'Amina',
            signal: 'INTEREST_UNANSWERED',
            opportunityId: 'opp-1',
          },
          { residentId: 'r2', name: 'Yusuf', signal: 'NO_ENGAGEMENT', opportunityId: null },
        ]}
      />,
    )

    const tiles = screen.getAllByTestId('action-tile').map((el) => el.textContent ?? '')
    expect(tiles.some((t) => t.includes('Interesse wartet auf Antwort'))).toBe(true)
    expect(tiles.some((t) => t.includes('Noch kein Engagement'))).toBe(true)
    // Counts, not names: ActionTilesGrid is mocked in this suite, so the item
    // list is stubbed. That the rows carry named people is covered by
    // lib/volunteering/__tests__/queue.test.ts.
    expect(tiles.some((t) => t.includes('(1)'))).toBe(true)
    // And crucially: NOT the all-clear screen.
    expect(screen.queryByText(/Alles unter Kontrolle/)).not.toBeInTheDocument()
  })

  it('still congratulates her when there is genuinely nothing', () => {
    // The other half. "Nothing to do" must stay sayable, or the fix just
    // replaces a false calm with a false alarm.
    render(
      <ActionDashboard
        {...BASE_PROPS}
        viewer={{ role: 'FREIWILLIGENARBEIT', scope: 'OWN_DOMAIN', isSystemAdmin: false }}
        volunteeringQueue={[]}
      />,
    )
    const tiles = screen.queryAllByTestId('action-tile').map((el) => el.textContent ?? '')
    expect(tiles.some((t) => t.includes('Interesse wartet auf Antwort'))).toBe(false)
  })

  /**
   * `staffInbox()` computed `waitingSince` per thread and sorted oldest-first
   * on every load, and only /messages read it — so Betreuung had to open the
   * inbox speculatively to learn somebody had been waiting four days.
   */
  it('names who is waiting for an answer, longest wait first', () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000)
    render(
      <ActionDashboard
        {...BASE_PROPS}
        viewer={{ role: 'BETREUUNG', scope: 'ALL_DOMAINS', isSystemAdmin: false }}
        waitingThreads={[
          { residentId: 'r1', name: 'Hana', waitingSince: fourDaysAgo },
          { residentId: 'r2', name: 'Noor', waitingSince: new Date() },
        ]}
      />,
    )

    const tiles = screen.getAllByTestId('action-tile').map((el) => el.textContent ?? '')
    expect(tiles.some((t) => t.includes('Nachrichten ohne Antwort'))).toBe(true)
    expect(tiles.some((t) => t.includes('(2)'))).toBe(true)
  })

  it('shows nobody waiting when nobody is', () => {
    render(<ActionDashboard {...BASE_PROPS} waitingThreads={[]} />)
    const tiles = screen.queryAllByTestId('action-tile').map((el) => el.textContent ?? '')
    expect(tiles.some((t) => t.includes('Nachrichten ohne Antwort'))).toBe(false)
  })

  /**
   * `getIncidentsNeedingFollowUp()` did this triage from the day it was
   * written — overdue, due soon, urgent, each with unit and subject — and was
   * called by nothing but its own test. Only the nightly email read
   * `nextFollowUpDate`, so a review date the caseworker set could pass without
   * anything in the product saying so.
   */
  it('names follow-ups whose review date has passed', () => {
    render(
      <ActionDashboard
        {...BASE_PROPS}
        viewer={{ role: 'BETREUUNG', scope: 'ALL_DOMAINS', isSystemAdmin: false }}
        overdueFollowUps={[
          { id: 'inc-1', subject: 'Hana', unitCode: 'WIT-458', daysOverdue: 6 },
          { id: 'inc-2', subject: null, unitCode: 'WIT-458', daysOverdue: 1 },
        ]}
      />,
    )

    const tiles = screen.getAllByTestId('action-tile').map((el) => el.textContent ?? '')
    expect(tiles.some((t) => t.includes('Nachfassen überfällig'))).toBe(true)
    expect(tiles.some((t) => t.includes('(2)'))).toBe(true)
  })

  it('says nothing when every review date is still ahead', () => {
    render(<ActionDashboard {...BASE_PROPS} overdueFollowUps={[]} />)
    const tiles = screen.queryAllByTestId('action-tile').map((el) => el.textContent ?? '')
    expect(tiles.some((t) => t.includes('Nachfassen überfällig'))).toBe(false)
  })

  it('hides check-in and maintenance stats for SOZIALARBEIT but keeps occupancy', () => {
    render(
      <ActionDashboard
        {...BASE_PROPS}
        viewer={{ role: 'SOZIALARBEIT', scope: 'OWN_DOMAIN', isSystemAdmin: false }}
      />,
    )
    expect(screen.queryByText(/Check-ins:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Wartung:/)).not.toBeInTheDocument()
    expect(screen.getByText(/Freie Plätze: 10/)).toBeInTheDocument()
  })

  it('shows correct freeBeds in the free-beds stat', () => {
    render(<ActionDashboard {...BASE_PROPS} occupiedBeds={8} totalBeds={20} />)
    expect(screen.getByText(/Freie Plätze: 12/)).toBeInTheDocument()
  })

  it('shows overdue check-in count in stat', () => {
    render(
      <ActionDashboard {...BASE_PROPS} overdueCheckIns={[makeCheckIn('c1'), makeCheckIn('c2')]} />,
    )
    expect(screen.getByText(/Check-ins: 2/)).toBeInTheDocument()
  })

  it('shows conflict-free days in harmony stat', () => {
    render(<ActionDashboard {...BASE_PROPS} conflictFreeDays={7} />)
    expect(screen.getByText(/Harmonie: 7/)).toBeInTheDocument()
  })

  it('shows open maintenance count in stat', () => {
    render(<ActionDashboard {...BASE_PROPS} openMaintenanceCount={5} />)
    expect(screen.getByText(/Wartung: 5/)).toBeInTheDocument()
  })

  // ── Action tiles section ──────────────────────────────────────────────────

  it('hides open-tasks section when no issues and no problem units', () => {
    render(<ActionDashboard {...BASE_PROPS} />)
    expect(screen.queryByText('Offene Aufgaben')).not.toBeInTheDocument()
  })

  it('shows open-tasks section when overdueCheckIns present', () => {
    render(<ActionDashboard {...BASE_PROPS} overdueCheckIns={[makeCheckIn('c1')]} />)
    expect(screen.getByText('Offene Aufgaben')).toBeInTheDocument()
  })

  it('renders check-in ActionTile when overdueCheckIns present', () => {
    render(<ActionDashboard {...BASE_PROPS} overdueCheckIns={[makeCheckIn('c1')]} />)
    expect(screen.getByTestId('action-tile')).toHaveTextContent('Check-ins durchführen (1)')
  })

  it('renders unplaced-residents ActionTile when unplacedResidents present', () => {
    render(<ActionDashboard {...BASE_PROPS} unplacedResidents={[makeResident('r1')]} />)
    expect(screen.getByTestId('action-tile')).toHaveTextContent('Klient*innen platzieren (1)')
  })

  it('renders problem-units ActionTile when problemUnits present', () => {
    render(<ActionDashboard {...BASE_PROPS} problemUnits={[makeProblemUnit('1')]} />)
    expect(screen.getByTestId('action-tile')).toHaveTextContent('Einheiten mit Konflikten (1)')
  })

  it('shows open-tasks section when only problemUnits present', () => {
    render(<ActionDashboard {...BASE_PROPS} problemUnits={[makeProblemUnit('1')]} />)
    expect(screen.getByText('Offene Aufgaben')).toBeInTheDocument()
  })

  it('renders transfer-requests ActionTile and counts it as a waiting task', () => {
    render(<ActionDashboard {...BASE_PROPS} pendingTransfers={[makeTransfer('t1')]} />)
    expect(screen.getByTestId('action-tile')).toHaveTextContent('Verlegungsanfragen prüfen (1)')
    expect(screen.getByText('1 Aufgabe wartet auf Sie.')).toBeInTheDocument()
  })

  it('renders proposals ActionTile and counts it as a waiting task', () => {
    render(<ActionDashboard {...BASE_PROPS} proposalsAwaitingStaff={[makeProposal('p1')]} />)
    expect(screen.getByTestId('action-tile')).toHaveTextContent('Beschlüsse bestätigen (1)')
    expect(screen.getByText('1 Aufgabe wartet auf Sie.')).toBeInTheDocument()
  })

  // ── Due-soon section ──────────────────────────────────────────────────────

  it('hides due-soon section when no dueSoonCheckIns', () => {
    render(<ActionDashboard {...BASE_PROPS} />)
    expect(screen.queryByText('Bald fällig')).not.toBeInTheDocument()
  })

  it('shows due-soon section when dueSoonCheckIns present', () => {
    render(<ActionDashboard {...BASE_PROPS} dueSoonCheckIns={[makeDueSoon('d1')]} />)
    expect(screen.getByText('Bald fällig')).toBeInTheDocument()
  })

  it('renders check-ins-this-week ActionTile in due-soon section', () => {
    render(<ActionDashboard {...BASE_PROPS} dueSoonCheckIns={[makeDueSoon('d1')]} />)
    expect(screen.getByTestId('action-tile')).toHaveTextContent('Check-ins diese Woche (1)')
  })

  // ── All-clear state ───────────────────────────────────────────────────────

  it('shows AllClearState when no issues, no incidents, no problem units', () => {
    render(<ActionDashboard {...BASE_PROPS} />)
    expect(screen.getByTestId('all-clear-state')).toBeInTheDocument()
  })

  it('hides AllClearState when there are overdue check-ins', () => {
    render(<ActionDashboard {...BASE_PROPS} overdueCheckIns={[makeCheckIn('c1')]} />)
    expect(screen.queryByTestId('all-clear-state')).not.toBeInTheDocument()
  })

  it('hides AllClearState when there are critical incidents', () => {
    render(<ActionDashboard {...BASE_PROPS} criticalIncidents={[makeIncident('i1')]} />)
    expect(screen.queryByTestId('all-clear-state')).not.toBeInTheDocument()
  })

  it('hides AllClearState when problem units exist', () => {
    render(<ActionDashboard {...BASE_PROPS} problemUnits={[makeProblemUnit('1')]} />)
    expect(screen.queryByTestId('all-clear-state')).not.toBeInTheDocument()
  })

  // ── Empty workspace ───────────────────────────────────────────────────────
  //
  // A database nobody has filled in used to be indistinguishable from a day's
  // work completed: every queue is empty either way, so the page congratulated
  // a team that had not started. These pin the two apart.

  const EMPTY_WORKSPACE = {
    ...BASE_PROPS,
    residentCount: 0,
    housingUnitCount: 0,
    totalPlacements: 0,
    occupiedBeds: 0,
    totalBeds: 0,
  }

  it('never reports an empty workspace as finished work', () => {
    render(<ActionDashboard {...EMPTY_WORKSPACE} />)
    expect(screen.queryByTestId('all-clear-state')).not.toBeInTheDocument()
    expect(screen.queryByText('Alles unter Kontrolle heute.')).not.toBeInTheDocument()
    expect(screen.getByText('Noch keine Daten erfasst')).toBeInTheDocument()
  })

  it('offers the first setup step a Leitung can actually take', () => {
    render(<ActionDashboard {...EMPTY_WORKSPACE} />)
    // No units yet, and ADMIN may create them.
    expect(screen.getByRole('link', { name: 'Erste Unterkunft erfassen' })).toHaveAttribute(
      'href',
      '/housing/new',
    )
  })

  it('moves to resident intake once housing exists', () => {
    render(<ActionDashboard {...EMPTY_WORKSPACE} housingUnitCount={3} />)
    expect(screen.getByRole('link', { name: 'Erste*n Klient*in erfassen' })).toHaveAttribute(
      'href',
      '/residents/new',
    )
  })

  it('offers a Jobcoach no setup button, because every one would be a 403', () => {
    render(
      <ActionDashboard
        {...EMPTY_WORKSPACE}
        viewer={{ role: 'JOBCOACH', scope: 'OWN_DOMAIN', isSystemAdmin: false }}
      />,
    )
    expect(screen.getByText('Noch keine Daten erfasst')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /erfassen/i })).not.toBeInTheDocument()
  })

  it('leaves the empty state as soon as one person exists', () => {
    // Emptiness is measured in PEOPLE, not units: the product exists to
    // support residents, so the first intake is what starts the workspace.
    render(<ActionDashboard {...EMPTY_WORKSPACE} residentCount={2} />)
    expect(screen.queryByText('Noch keine Daten erfasst')).not.toBeInTheDocument()
    expect(screen.getByTestId('all-clear-state')).toBeInTheDocument()
  })

  // ── Specialist with an empty seat ─────────────────────────────────────────
  //
  // The same confusion as above, one level in. `residentCount` is global on
  // purpose — a Jobcoach must not be told the workspace is empty while 19
  // people sit in it — but that makes a specialist nobody has been assigned to
  // indistinguishable from a specialist who has finished. On 2026-08-31, the
  // day the real AOZ team was created, the Jobcoach and the Freiwilligenarbeit coordinator each opened
  // their first ever session and were shown "🎉 Alles unter Kontrolle! Keine
  // dringenden Aufgaben" over an account connected to no one.

  const SPECIALIST = {
    ...BASE_PROPS,
    viewer: { role: 'JOBCOACH' as const, scope: 'OWN_DOMAIN' as const, isSystemAdmin: false },
  }

  it('does not congratulate a specialist nobody has been assigned to', () => {
    render(<ActionDashboard {...SPECIALIST} assignedResidentCount={0} />)

    expect(screen.queryByTestId('all-clear-state')).not.toBeInTheDocument()
    expect(screen.queryByText('Alles unter Kontrolle heute.')).not.toBeInTheDocument()
    expect(screen.getByText('Noch keine Klient*innen zugewiesen')).toBeInTheDocument()
  })

  it('points at where the care seat is actually filled', () => {
    // The seat is assigned in the Betreuungsteam panel on a client's page,
    // which is not somewhere you would guess from a dashboard.
    render(<ActionDashboard {...SPECIALIST} assignedResidentCount={0} />)
    expect(screen.getByRole('link', { name: 'Klient*innen öffnen' })).toHaveAttribute(
      'href',
      '/residents',
    )
  })

  it('goes quiet once someone is assigned', () => {
    render(<ActionDashboard {...SPECIALIST} assignedResidentCount={3} />)
    expect(screen.queryByText('Noch keine Klient*innen zugewiesen')).not.toBeInTheDocument()
    expect(screen.getByTestId('all-clear-state')).toBeInTheDocument()
  })

  it('never asks a viewer with oversight to go and get assigned', () => {
    // null, not 0: someone who covers every domain has no single seat, so the
    // question does not apply to them and must not be answered with a notice.
    render(<ActionDashboard {...BASE_PROPS} assignedResidentCount={null} />)
    expect(screen.queryByText('Noch keine Klient*innen zugewiesen')).not.toBeInTheDocument()
    expect(screen.getByTestId('all-clear-state')).toBeInTheDocument()
  })

  it('shows real work rather than the onboarding notice', () => {
    // A specialist can be handed a task before anyone formalises the
    // assignment. Telling them to go and get assigned while a critical
    // incident sits unread would be the notice actively hiding the work.
    render(
      <ActionDashboard
        {...SPECIALIST}
        assignedResidentCount={0}
        criticalIncidents={[
          { id: 'i1', type: 'VIOLENCE', unitCode: 'WIT-458', unitId: 'u1', daysSinceCreated: 1 },
        ]}
      />,
    )
    expect(screen.queryByText('Noch keine Klient*innen zugewiesen')).not.toBeInTheDocument()
  })

  describe('Eingang: people waiting on an answer', () => {
    const request = (residentId: string, opportunityId: string) => ({
      applicationId: `app-${residentId}-${opportunityId}`,
      opportunityId,
      opportunityTitle: 'Velowerkstatt',
      residentId,
      name: `Person ${residentId}`,
      since: new Date(),
    })

    it('lists each request with its own Übernehmen button and counts it', () => {
      render(
        <ActionDashboard
          {...BASE_PROPS}
          waitingApplications={[request('r1', 'o1'), request('r2', 'o1')]}
        />,
      )
      expect(screen.getByText('Anfragen zu Einsatzplätzen')).toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: 'Übernehmen' })).toHaveLength(2)
      expect(screen.getByText('Person r1').closest('a')).toHaveAttribute('href', '/residents/r1')
      expect(screen.getByText('2 Aufgaben warten auf Sie.')).toBeInTheDocument()
      expect(screen.queryByTestId('all-clear-state')).not.toBeInTheDocument()
    })

    it('does not list a request twice when the caseload tile holds it too', () => {
      render(
        <ActionDashboard
          {...BASE_PROPS}
          viewer={{ role: 'FREIWILLIGENARBEIT', scope: 'OWN_DOMAIN', isSystemAdmin: false }}
          waitingApplications={[request('r1', 'opp-1')]}
          volunteeringQueue={[
            {
              residentId: 'r1',
              name: 'Amina',
              signal: 'INTEREST_UNANSWERED',
              opportunityId: 'opp-1',
            },
          ]}
        />,
      )
      const tiles = screen.queryAllByTestId('action-tile').map((el) => el.textContent ?? '')
      expect(tiles.some((t) => t.includes('Interesse wartet auf Antwort'))).toBe(false)
      expect(screen.getByText('1 Aufgabe wartet auf Sie.')).toBeInTheDocument()
    })

    it('keeps a caseload request the section does not show', () => {
      // Her client asked about a JOB — outside her half, so not in her section.
      // Dropping it from the caseload tile too would leave it on no screen.
      render(
        <ActionDashboard
          {...BASE_PROPS}
          viewer={{ role: 'FREIWILLIGENARBEIT', scope: 'OWN_DOMAIN', isSystemAdmin: false }}
          waitingApplications={[request('r9', 'vol-1')]}
          volunteeringQueue={[
            {
              residentId: 'r1',
              name: 'Amina',
              signal: 'INTEREST_UNANSWERED',
              opportunityId: 'job-7',
            },
          ]}
        />,
      )
      const tiles = screen.getAllByTestId('action-tile').map((el) => el.textContent ?? '')
      expect(tiles.some((t) => t.includes('Interesse wartet auf Antwort'))).toBe(true)
    })

    it('shows pending Freigaben as work', () => {
      render(
        <ActionDashboard
          {...BASE_PROPS}
          pendingApprovals={[{ id: 'f1', name: 'Amina', summary: 'Ausweis B' }]}
        />,
      )
      const tiles = screen.getAllByTestId('action-tile').map((el) => el.textContent ?? '')
      expect(tiles).toContain('Freigaben (1)')
    })
  })
})
