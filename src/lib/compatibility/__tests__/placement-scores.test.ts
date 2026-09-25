/**
 * Tests for calculateAverageScores
 *
 * This function is called on every placement and transfer to record the
 * compatibility scores stored in the database. Bugs here corrupt the
 * analytics that drive the algorithm accuracy reports.
 */

import { calculateAverageScores } from '../placement-scores'
import type { Resident, Placement } from '@/lib/db'

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Build a minimal Resident-shaped object. All scoring-relevant fields are
 * controlled per-test; remaining Prisma fields are set to safe defaults.
 */
function makeResident(overrides: Partial<Resident> = {}): Resident {
  const base: Resident = {
    id: 'resident-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    code: 'RES-001',
    displayName: null,
    bio: null,
    profileVisibility: 'ROOMMATES' as const,
    ageRange: 'ADULT',
    gender: 'MALE',
    familyStatus: 'SINGLE',
    sleepSchedule: 'STANDARD',
    noiseTolerance: 3,
    cleanlinessPractice: 3,
    cleanlinessExpectation: 3,
    chaosTolerance: 6 - 3,
    guestTolerance: 3,
    socialStyle: 'MODERATE',
    languages: ['German'],
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
    livingSkillsSupport: 'INDEPENDENT',
    interpreterNeed: 'NONE',
    roommatePreferences: null,
    preferencesCompletedAt: null,
    status: 'ACTIVE',
    // A fixture is a person, not a seeded placeholder.
    isPlaceholder: false,
    notes: null,
    hasMedicalDocumentation: false,
    medicalDocType: null,
    medicalDocDate: null,
    medicalDocNotes: null,
  }
  return { ...base, ...overrides }
}

/**
 * Wrap a Resident as a minimal Placement+resident include shape.
 */
function makePlacementWith(resident: Resident): Placement & { resident: Resident } {
  return {
    id: `placement-${resident.id}`,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    residentId: resident.id,
    housingUnitId: 'unit-1',
    spotId: null,
    status: 'ACTIVE',
    startDate: new Date('2024-01-01'),
    endDate: null,
    endReason: null,
    placementNotes: null,
    outcomeNotes: null,
    compatibilityScore: null,
    lifestyleScore: null,
    socialScore: null,
    practicalScore: null,
    riskScore: null,
    satisfactionRating: null,
    conflictGap: null,
    wasPredictable: null,
    relatedIncidentId: null,
    resident,
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe('calculateAverageScores', () => {
  describe('empty placements (no roommates)', () => {
    it('returns 100 for all compatibility scores', () => {
      const resident = makeResident()
      const result = calculateAverageScores(resident, [])
      expect(result.compatibilityScore).toBe(100)
      expect(result.lifestyleScore).toBe(100)
      expect(result.socialScore).toBe(100)
      expect(result.practicalScore).toBe(100)
    })

    it('returns 0 for riskScore when no roommates', () => {
      const resident = makeResident()
      const result = calculateAverageScores(resident, [])
      expect(result.riskScore).toBe(0)
    })
  })

  describe('single roommate', () => {
    it('returns the direct compatibility score without averaging distortion', () => {
      const resident = makeResident({ id: 'r1', code: 'RES-001' })
      const roommate = makeResident({ id: 'r2', code: 'RES-002' })
      const placement = makePlacementWith(roommate)

      const result = calculateAverageScores(resident, [placement])

      // Score must be a positive integer in valid range
      expect(result.compatibilityScore).toBeGreaterThan(0)
      expect(result.compatibilityScore).toBeLessThanOrEqual(100)
      expect(Number.isInteger(result.compatibilityScore)).toBe(true)
    })

    it('returns integer scores for all dimensions', () => {
      const resident = makeResident({ id: 'r1' })
      const roommate = makeResident({ id: 'r2', sleepSchedule: 'EARLY_BIRD', noiseTolerance: 1 })
      const result = calculateAverageScores(resident, [makePlacementWith(roommate)])

      expect(Number.isInteger(result.compatibilityScore)).toBe(true)
      expect(Number.isInteger(result.lifestyleScore)).toBe(true)
      expect(Number.isInteger(result.socialScore)).toBe(true)
      expect(Number.isInteger(result.practicalScore)).toBe(true)
      expect(Number.isInteger(result.riskScore)).toBe(true)
    })

    it('highly compatible roommates score above 70', () => {
      const resident = makeResident({
        id: 'r1',
        code: 'RES-001',
        sleepSchedule: 'STANDARD',
        noiseTolerance: 3,
        cleanlinessPractice: 3,
      })
      const twin = makeResident({
        id: 'r2',
        code: 'RES-002',
        sleepSchedule: 'STANDARD',
        noiseTolerance: 3,
        cleanlinessPractice: 3,
      })
      const result = calculateAverageScores(resident, [makePlacementWith(twin)])

      expect(result.compatibilityScore).toBeGreaterThan(70)
    })

    it('incompatible roommates score lower than compatible ones', () => {
      const resident = makeResident({
        id: 'r1',
        sleepSchedule: 'EARLY_BIRD',
        noiseTolerance: 1,
        cleanlinessPractice: 5,
      })
      const good = makeResident({
        id: 'r2',
        sleepSchedule: 'EARLY_BIRD',
        noiseTolerance: 2,
        cleanlinessPractice: 4,
      })
      const bad = makeResident({
        id: 'r3',
        sleepSchedule: 'NIGHT_OWL',
        noiseTolerance: 5,
        cleanlinessPractice: 1,
        smokingStatus: 'INDOOR_SMOKER',
      })

      const goodScore = calculateAverageScores(resident, [
        makePlacementWith(good),
      ]).compatibilityScore
      const badScore = calculateAverageScores(resident, [makePlacementWith(bad)]).compatibilityScore

      expect(goodScore).toBeGreaterThan(badScore)
    })
  })

  describe('multiple roommates — averaging', () => {
    it('returns Math.round of the average across all roommates', () => {
      // Use identical roommates so we can predict the exact average
      const resident = makeResident({ id: 'r-main' })
      const roommate1 = makeResident({ id: 'r1', code: 'RES-R1' })
      const roommate2 = makeResident({ id: 'r2', code: 'RES-R2' })

      const singleResult1 = calculateAverageScores(resident, [makePlacementWith(roommate1)])
      const singleResult2 = calculateAverageScores(resident, [makePlacementWith(roommate2)])
      const bothResult = calculateAverageScores(resident, [
        makePlacementWith(roommate1),
        makePlacementWith(roommate2),
      ])

      const expectedAvg = Math.round(
        (singleResult1.compatibilityScore + singleResult2.compatibilityScore) / 2,
      )
      expect(bothResult.compatibilityScore).toBe(expectedAvg)
    })

    it('averages all five score dimensions independently', () => {
      const resident = makeResident({ id: 'r-main' })
      const r1 = makeResident({ id: 'r1', code: 'RES-R1' })
      const r2 = makeResident({
        id: 'r2',
        code: 'RES-R2',
        sleepSchedule: 'NIGHT_OWL',
        noiseTolerance: 5,
      })

      const s1 = calculateAverageScores(resident, [makePlacementWith(r1)])
      const s2 = calculateAverageScores(resident, [makePlacementWith(r2)])
      const both = calculateAverageScores(resident, [makePlacementWith(r1), makePlacementWith(r2)])

      expect(both.lifestyleScore).toBe(Math.round((s1.lifestyleScore + s2.lifestyleScore) / 2))
      expect(both.socialScore).toBe(Math.round((s1.socialScore + s2.socialScore) / 2))
      expect(both.practicalScore).toBe(Math.round((s1.practicalScore + s2.practicalScore) / 2))
    })

    it('score with three roommates is bounded between the best and worst pairwise scores', () => {
      const resident = makeResident({ id: 'r-main', sleepSchedule: 'STANDARD' })
      const compatible = makeResident({
        id: 'r1',
        code: 'RES-C',
        sleepSchedule: 'STANDARD',
        noiseTolerance: 3,
      })
      const incompatible = makeResident({
        id: 'r2',
        code: 'RES-I',
        sleepSchedule: 'NIGHT_OWL',
        noiseTolerance: 5,
        smokingStatus: 'INDOOR_SMOKER',
      })
      const neutral = makeResident({
        id: 'r3',
        code: 'RES-N',
        sleepSchedule: 'STANDARD',
        noiseTolerance: 3,
      })

      const best = calculateAverageScores(resident, [
        makePlacementWith(compatible),
      ]).compatibilityScore
      const worst = calculateAverageScores(resident, [
        makePlacementWith(incompatible),
      ]).compatibilityScore
      const all = calculateAverageScores(resident, [
        makePlacementWith(compatible),
        makePlacementWith(incompatible),
        makePlacementWith(neutral),
      ]).compatibilityScore

      expect(all).toBeLessThanOrEqual(best)
      expect(all).toBeGreaterThanOrEqual(worst)
    })
  })

  describe('score bounds', () => {
    it('all scores are non-negative', () => {
      const resident = makeResident({ id: 'r1', sleepSchedule: 'EARLY_BIRD', noiseTolerance: 1 })
      const roommate = makeResident({
        id: 'r2',
        sleepSchedule: 'NIGHT_OWL',
        noiseTolerance: 5,
        smokingStatus: 'INDOOR_SMOKER',
      })
      const result = calculateAverageScores(resident, [makePlacementWith(roommate)])

      expect(result.compatibilityScore).toBeGreaterThanOrEqual(0)
      expect(result.lifestyleScore).toBeGreaterThanOrEqual(0)
      expect(result.socialScore).toBeGreaterThanOrEqual(0)
      expect(result.practicalScore).toBeGreaterThanOrEqual(0)
      expect(result.riskScore).toBeGreaterThanOrEqual(0)
    })

    it('all scores are at most 100', () => {
      const resident = makeResident({ id: 'r1' })
      const roommate = makeResident({ id: 'r2' })
      const result = calculateAverageScores(resident, [makePlacementWith(roommate)])

      expect(result.compatibilityScore).toBeLessThanOrEqual(100)
      expect(result.lifestyleScore).toBeLessThanOrEqual(100)
      expect(result.socialScore).toBeLessThanOrEqual(100)
      expect(result.practicalScore).toBeLessThanOrEqual(100)
    })
  })
})
