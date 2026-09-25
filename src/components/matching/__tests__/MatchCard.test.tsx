import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MatchCard } from '../MatchCard'
import type { MatchResult } from '@/lib/matching/types'
import type { Resident } from '@/lib/db'
import { PLACEMENT_CONCERN_LABELS } from '@/lib/constants'

// =============================================================================
// MOCKS
// =============================================================================

vi.mock('next/link', async () => {
  function MockLink({
    children,
    href,
    className,
  }: {
    children: React.ReactNode
    href: string
    className?: string
  }) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  }
  return { default: MockLink }
})

vi.mock('@/lib/actions/matching', async () => ({
  placeResident: vi.fn(),
}))

// Spreads the real module first. A hand-listed replacement made the card's
// import graph part of this file's setup: pulling in a helper that reads any
// other label — as reaching for the blocking-concern SSOT did — failed the
// whole suite at collection, with an error about a mock rather than about the
// change. The overrides below still pin the strings the assertions match on.
vi.mock('@/lib/constants', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/constants')>()),
  SLEEP_SCHEDULE_LABELS: {
    EARLY_BIRD: 'Fruehaufsteher',
    STANDARD: 'Normal',
    NIGHT_OWL: 'Nachteule',
  },
  SMOKING_STATUS_LABELS: {
    NON_SMOKER: 'Nichtraucher',
    OUTDOOR_SMOKER: 'Raucht nur draussen',
  },
  SOCIAL_STYLE_LABELS: {
    INTROVERTED: 'Ruhig',
    MODERATE: 'Ausgeglichen',
    EXTROVERTED: 'Gesellig',
  },
  MATCHING_LABELS: {
    topRecommendation: 'Top Empfehlung',
    topRank: (rank: number) => `Top ${rank}`,
    empty: 'Leer',
    history: 'Verlauf:',
    conflictFree: 'konfliktfrei)',
    perMonthAvg: '/Monat Ø',
    conflictsLast30Days: 'Konflikte letzte 30 Tage',
    apartmentProfile: 'Wohnungs-Profil',
    residents: 'Bewohner',
    matching: 'Passend',
    scoreDerivation: 'Score-Berechnung anzeigen',
    basePenalty: 'Basis: 100 Punkte',
    conflictDeductions: 'Abzüge (Konflikte):',
    strengthBonus: 'Bonus (Stärken):',
    smallGroupBonus: 'Bonus (kleine Gruppe):',
    totalFit: 'Gesamtpassung',
    historicalData: 'Historische Daten',
    placements: 'Platzierungen',
    successRate: 'Erfolgsrate',
    successRateDesc: () => 'waren erfolgreich',
    placementsWithSimilar: 'Platzierungen mit ähnlicher Kompatibilität',
    noHistoricalData: 'Keine historischen Daten für ähnliche Kompatibilitätswerte',
    plusMinusTen: '±10',
    available: 'verfügbar',
    noRoommatesNoConflicts: 'Keine Mitbewohner - keine Konflikte',
    sharedLanguageWith: 'Gemeinsame Sprache mit',
    residentsCount: 'Bewohner(n)',
    currentResidents: 'Aktuelle Bewohner:',
    concerns: 'Bedenken',
    moreConcerns: (count: number) => `+${count} weitere Bedenken`,
    blocked: 'Blockiert',
    place: 'Platzieren',
    placeLowCompat: 'Platzieren (niedrige Kompatibilität)',
  },
  getLabel: (labels: Record<string, string>, key: string) => labels[key] || key,
}))

vi.mock('@/lib/utils', async () => ({
  getScoreColorClass: (score: number) => {
    if (score >= 80) return 'text-score-excellent-text'
    if (score >= 60) return 'text-score-good-text'
    if (score >= 40) return 'text-score-medium-text'
    if (score >= 20) return 'text-score-low-text'
    return 'text-score-critical-text'
  },
}))

vi.mock('../HeadToHeadComparison', async () => ({
  HeadToHeadComparison: () => <div data-testid="head-to-head">HeadToHead Mock</div>,
}))

vi.mock('../SpotSelection', async () => ({
  SpotSelection: () => <div data-testid="spot-selection">SpotSelection Mock</div>,
}))

// =============================================================================
// TEST FIXTURES
// =============================================================================

const mockResident = {
  id: 'res-1',
  code: 'RES-001',
  ageRange: 'ADULT',
  gender: 'MALE',
  familyStatus: 'SINGLE',
  sleepSchedule: 'STANDARD',
  noiseTolerance: 3,
  cleanlinessPractice: 3,
  guestTolerance: 3,
  socialStyle: 'MODERATE',
  languages: ['DE', 'EN'],
  conflictStyle: 'COOPERATIVE',
  smokingStatus: 'NON_SMOKER',
  dietaryNeeds: [],
  mobilityNeeds: 'NONE',
  medicalEquipment: false,
  petTolerance: true,
  sharedBathroom: true,
  sharedKitchen: true,
  privacyNeed: 3,
  choresContribution: 3,
  recyclingKnowledge: 'BASIC',
  roomSharingStatus: 'CAN_SHARE',
  hasNightDisturbances: false,
  needsQuietEnvironment: false,
  hasSleepEquipment: false,
  supportLevel: 'STANDARD',
  notes: null,
  status: 'ACTIVE',
  roommatePreferences: null,
  preferencesCompletedAt: null,
  hasMedicalDocumentation: false,
  medicalDocType: null,
  medicalDocDate: null,
  medicalDocNotes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Resident

function makeMatch(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    unit: {
      id: 'unit-1',
      code: 'WG-101',
      address: 'Teststrasse 1, 8000 Zuerich',
      totalBeds: 4,
      placements: [],
      spots: [],
      name: null,
      status: 'AVAILABLE',
      floor: null,
      wheelchairAccess: false,
      smokingAllowed: false,
      petsAllowed: false,
      quietHours: null,
      sharedKitchen: true,
      sharedBathroom: true,
      totalRooms: 2,
      sharedRooms: 2,
      privateRooms: 0,
      sharedBathrooms: 1,
      privateBathrooms: 0,
      privateKitchen: false,
      groundFloor: false,
      elevator: false,
      nearPublicTransport: true,
      nearHealthServices: false,
      nearSchools: false,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as MatchResult['unit'],
    apartmentProfile: {
      unitId: 'unit-1',
      currentResidentCount: 0,
      isEmpty: true,
      avgNoiseTolerance: null,
      avgCleanlinessLevel: null,
      cleanlinessProfiles: [],
      avgPrivacyNeed: null,
      avgChoresContribution: null,
      dominantSleepSchedule: null,
      sleepScheduleDistribution: {} as Record<string, number>,
      dominantSocialStyle: null,
      dominantSmokingStatus: null,
      commonLanguages: [],
      percentNeedsQuiet: 0,
      percentHasNightDisturbances: 0,
    },
    apartmentFit: {
      apartmentProfile: {} as MatchResult['apartmentProfile'],
      fitScore: 85,
      conflicts: [],
      strengths: [],
      warnings: [],
    },
    unitMetrics: null,
    realSuccessData: null,
    compatibilityDetails: [],
    unitConcerns: [],
    hasBlockingIssue: false,
    sharedLanguageCount: 0,
    totalRoommateConcerns: 0,
    safeguardWarnings: [],
    rankingFactors: [],
    sortScore: 85,
    bestRoomFit: null,
    ...overrides,
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('MatchCard', () => {
  describe('basic rendering', () => {
    it('renders unit code and address', () => {
      render(<MatchCard match={makeMatch()} resident={mockResident} />)

      expect(screen.getByText('WG-101')).toBeInTheDocument()
      expect(screen.getByText('Teststrasse 1, 8000 Zuerich')).toBeInTheDocument()
    })

    it('shows occupancy count', () => {
      render(<MatchCard match={makeMatch()} resident={mockResident} />)

      expect(screen.getByText('0/4 belegt')).toBeInTheDocument()
    })

    it('shows "Leer" label for empty units', () => {
      render(<MatchCard match={makeMatch()} resident={mockResident} />)

      expect(screen.getByText('Leer')).toBeInTheDocument()
    })

    it('links unit code to housing detail page', () => {
      render(<MatchCard match={makeMatch()} resident={mockResident} />)

      const link = screen.getByText('WG-101')
      expect(link.closest('a')).toHaveAttribute('href', '/housing/unit-1')
    })
  })

  describe('rank badges', () => {
    it('shows "Top Empfehlung" for rank 1', () => {
      render(<MatchCard match={makeMatch()} resident={mockResident} rank={1} />)

      expect(screen.getByText('Top Empfehlung')).toBeInTheDocument()
    })

    it('shows "Top 2" for rank 2', () => {
      render(<MatchCard match={makeMatch()} resident={mockResident} rank={2} />)

      expect(screen.getByText('Top 2')).toBeInTheDocument()
    })

    it('shows "Top 3" for rank 3', () => {
      render(<MatchCard match={makeMatch()} resident={mockResident} rank={3} />)

      expect(screen.getByText('Top 3')).toBeInTheDocument()
    })

    it('does not show rank badge for rank > 3', () => {
      render(<MatchCard match={makeMatch()} resident={mockResident} rank={4} />)

      expect(screen.queryByText(/Top/)).not.toBeInTheDocument()
    })

    it('does not show rank badge when no rank provided', () => {
      render(<MatchCard match={makeMatch()} resident={mockResident} />)

      expect(screen.queryByText(/Top/)).not.toBeInTheDocument()
    })
  })

  describe('empty unit positive factors', () => {
    it('shows no-conflicts message for empty units', () => {
      render(<MatchCard match={makeMatch()} resident={mockResident} />)

      expect(screen.getByText(/Keine Mitbewohner - keine Konflikte/)).toBeInTheDocument()
    })
  })

  describe('unit with roommates', () => {
    const matchWithRoommate = makeMatch({
      unit: {
        ...makeMatch().unit,
        placements: [
          {
            id: 'p-1',
            status: 'ACTIVE',
            resident: {
              id: 'res-2',
              code: 'RES-002',
              languages: ['DE'],
            } as Resident,
          } as MatchResult['unit']['placements'][0],
        ],
      },
      apartmentProfile: {
        ...makeMatch().apartmentProfile,
        isEmpty: false,
        currentResidentCount: 1,
      },
      compatibilityDetails: [
        {
          resident: {
            id: 'res-2',
            code: 'RES-002',
            languages: ['DE'],
          } as Resident,
          score: {
            overall: 75,
            lifestyle: 80,
            social: 70,
            practical: 75,
            risk: 10,
            strengths: ['Aehnlicher Schlafrhythmus'],
            concerns: [],
            recommendations: [],
          },
        },
      ],
    })

    it('shows current residents section', () => {
      render(<MatchCard match={matchWithRoommate} resident={mockResident} />)

      expect(screen.getByText('Aktuelle Bewohner:')).toBeInTheDocument()
      expect(screen.getByText('RES-002')).toBeInTheDocument()
    })

    it('shows shared language indicator', () => {
      render(<MatchCard match={matchWithRoommate} resident={mockResident} />)

      // RES-002 has 'DE', resident has ['DE', 'EN'] — shared language
      expect(screen.getByText(/Gemeinsame Sprache/)).toBeInTheDocument()
    })

    it('shows strengths from compatibility details', () => {
      render(<MatchCard match={matchWithRoommate} resident={mockResident} />)

      expect(screen.getByText(/Aehnlicher Schlafrhythmus/)).toBeInTheDocument()
    })

    it('shows occupancy count correctly', () => {
      render(<MatchCard match={matchWithRoommate} resident={mockResident} />)

      expect(screen.getByText('1/4 belegt')).toBeInTheDocument()
    })
  })

  describe('concerns', () => {
    it('shows unit concerns', () => {
      const match = makeMatch({
        unitConcerns: ['Kein Erdgeschoss verfuegbar'],
      })

      render(<MatchCard match={match} resident={mockResident} />)

      expect(screen.getByText(/Kein Erdgeschoss verfuegbar/)).toBeInTheDocument()
    })

    it('shows roommate concerns', () => {
      const match = makeMatch({
        compatibilityDetails: [
          {
            resident: { id: 'res-2', code: 'RES-002' } as Resident,
            score: {
              overall: 50,
              lifestyle: 40,
              social: 50,
              practical: 60,
              risk: 30,
              strengths: [],
              concerns: ['Unterschiedlicher Schlafrhythmus'],
              recommendations: [],
            },
          },
        ],
        unit: {
          ...makeMatch().unit,
          placements: [
            {
              id: 'p-1',
              status: 'ACTIVE',
              resident: { id: 'res-2', code: 'RES-002' } as Resident,
            } as MatchResult['unit']['placements'][0],
          ],
        },
      })

      render(<MatchCard match={match} resident={mockResident} />)

      expect(screen.getByText(/Unterschiedlicher Schlafrhythmus/)).toBeInTheDocument()
    })

    it('limits displayed concerns to 3 and shows overflow count', () => {
      const match = makeMatch({
        compatibilityDetails: [
          {
            resident: { id: 'res-2', code: 'RES-002' } as Resident,
            score: {
              overall: 30,
              lifestyle: 20,
              social: 30,
              practical: 40,
              risk: 50,
              strengths: [],
              concerns: ['Concern 1', 'Concern 2', 'Concern 3', 'Concern 4', 'Concern 5'],
              recommendations: [],
            },
          },
        ],
        unit: {
          ...makeMatch().unit,
          placements: [
            {
              id: 'p-1',
              status: 'ACTIVE',
              resident: { id: 'res-2', code: 'RES-002' } as Resident,
            } as MatchResult['unit']['placements'][0],
          ],
        },
      })

      render(<MatchCard match={match} resident={mockResident} />)

      expect(screen.getByText(/\+2 weitere Bedenken/)).toBeInTheDocument()
    })
  })

  describe('blocking issues', () => {
    // The concern is the REAL label, not one invented here. This test used to
    // pass an ad-hoc string that no code path produces; it went green only
    // because the card was substring-matching prose, so it agreed with the bug
    // rather than with the product.
    it('applies red styling for a blocking concern', () => {
      const match = makeMatch({
        unitConcerns: [PLACEMENT_CONCERN_LABELS.wheelchairRequired],
        hasBlockingIssue: true,
      })

      const { container } = render(<MatchCard match={match} resident={mockResident} />)

      const concern = screen.getByText(new RegExp(PLACEMENT_CONCERN_LABELS.wheelchairRequired))
      expect(concern.className).toContain('text-status-error-text')
      expect((container.firstChild as HTMLElement).className).toContain('border-status-error')
    })

    it('leaves a non-blocking concern in warning colours', () => {
      // Smoking is a concern, not a blocker — and the card must not paint the
      // whole unit as excluded for it.
      const match = makeMatch({
        unitConcerns: [PLACEMENT_CONCERN_LABELS.smokerInNonSmokingUnit],
        hasBlockingIssue: false,
      })

      const { container } = render(<MatchCard match={match} resident={mockResident} />)

      const concern = screen.getByText(new RegExp(PLACEMENT_CONCERN_LABELS.smokerInNonSmokingUnit))
      expect(concern.className).toContain('text-status-warning-text')
      expect((container.firstChild as HTMLElement).className).not.toContain('border-status-error')
    })
  })

  describe('unit metrics', () => {
    it('shows unit performance when metrics provided', () => {
      const match = makeMatch({
        unitMetrics: {
          unitId: 'unit-1',
          unitCode: 'WG-101',
          conflictRate: 0.5,
          recentConflicts: 1,
          totalConflicts: 3,
          avgPlacementDuration: 90,
          turnoverRate: 10,
          successRate: 85,
          currentOccupancy: 2,
          occupancyRate: 50,
          avgSatisfaction: 4,
          incidentFreeMonths: 2,
          riskLevel: 'LOW',
          label: 'Stabil',
        },
      })

      render(<MatchCard match={match} resident={mockResident} />)

      expect(screen.getByText(/Verlauf: Stabil/)).toBeInTheDocument()
      expect(screen.getByText(/2M konfliktfrei/)).toBeInTheDocument()
    })

    it('shows warning for high risk units', () => {
      const match = makeMatch({
        unitMetrics: {
          unitId: 'unit-1',
          unitCode: 'WG-101',
          conflictRate: 2.5,
          recentConflicts: 4,
          totalConflicts: 15,
          avgPlacementDuration: 30,
          turnoverRate: 40,
          successRate: 40,
          currentOccupancy: 3,
          occupancyRate: 75,
          avgSatisfaction: 2.5,
          incidentFreeMonths: 0,
          riskLevel: 'HIGH',
          label: 'Riskant',
        },
      })

      render(<MatchCard match={match} resident={mockResident} />)

      expect(screen.getByText(/4 Konflikte letzte 30 Tage/)).toBeInTheDocument()
    })
  })

  describe('apartment profile', () => {
    it('shows apartment fit score for non-empty apartments', () => {
      const match = makeMatch({
        apartmentProfile: {
          ...makeMatch().apartmentProfile,
          isEmpty: false,
          currentResidentCount: 2,
        },
        apartmentFit: {
          ...makeMatch().apartmentFit,
          fitScore: 72,
        },
      })

      render(<MatchCard match={match} resident={mockResident} />)

      expect(screen.getByText(/72% Passend/)).toBeInTheDocument()
    })

    it('renders HeadToHeadComparison for non-empty apartments', () => {
      const match = makeMatch({
        apartmentProfile: {
          ...makeMatch().apartmentProfile,
          isEmpty: false,
          currentResidentCount: 1,
        },
      })

      render(<MatchCard match={match} resident={mockResident} />)

      expect(screen.getByTestId('head-to-head')).toBeInTheDocument()
    })

    it('does not render apartment profile section for empty apartments', () => {
      render(<MatchCard match={makeMatch()} resident={mockResident} />)

      expect(screen.queryByTestId('head-to-head')).not.toBeInTheDocument()
    })
  })

  describe('spot selection', () => {
    it('renders SpotSelection when spots are available', () => {
      const match = makeMatch({
        unit: {
          ...makeMatch().unit,
          spots: [
            {
              id: 'spot-1',
              code: 'S-001',
              type: 'BED',
              status: 'AVAILABLE',
              placements: [],
            } as unknown as MatchResult['unit']['spots'][0],
          ],
        },
      })

      render(<MatchCard match={match} resident={mockResident} />)

      expect(screen.getByTestId('spot-selection')).toBeInTheDocument()
    })

    it('renders fallback placement form when no spots', () => {
      render(<MatchCard match={makeMatch()} resident={mockResident} />)

      expect(screen.getByText('Platzieren')).toBeInTheDocument()
    })
  })

  describe('historical success data', () => {
    it('shows success rate when data available', () => {
      const match = makeMatch({
        apartmentProfile: {
          ...makeMatch().apartmentProfile,
          isEmpty: false,
          currentResidentCount: 1,
        },
        realSuccessData: {
          successRate: 78,
          totalPlacements: 10,
          successfulPlacements: 8,
        },
      })

      render(<MatchCard match={match} resident={mockResident} />)

      expect(screen.getByText(/78% Erfolgsrate/)).toBeInTheDocument()
      expect(screen.getByText(/Historische Daten/)).toBeInTheDocument()
    })

    it('shows no-data message when no historical placements', () => {
      const match = makeMatch({
        apartmentProfile: {
          ...makeMatch().apartmentProfile,
          isEmpty: false,
          currentResidentCount: 1,
        },
        realSuccessData: {
          successRate: 0,
          totalPlacements: 0,
          successfulPlacements: 0,
        },
      })

      render(<MatchCard match={match} resident={mockResident} />)

      expect(screen.getByText(/Keine historischen Daten/)).toBeInTheDocument()
    })
  })
})
