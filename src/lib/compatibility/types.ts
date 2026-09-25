/**
 * Types for the compatibility scoring system
 */

import type {
  AgeRange,
  Gender,
  FamilyStatus,
  SleepSchedule,
  SocialStyle,
  SmokingStatus,
  MobilityNeed,
  RoomSharingStatus,
  SupportLevel,
  RecyclingKnowledge,
  ConflictStyle,
} from '@/lib/db'
import type { CleanlinessProfile } from './cleanliness'

export type {
  AgeRange,
  Gender,
  FamilyStatus,
  SleepSchedule,
  SocialStyle,
  SmokingStatus,
  MobilityNeed,
  RoomSharingStatus,
  SupportLevel,
  RecyclingKnowledge,
  ConflictStyle,
}

export interface ResidentProfile {
  id: string
  code: string

  // Demographics
  ageRange: AgeRange
  gender: Gender
  familyStatus: FamilyStatus

  // Lifestyle
  sleepSchedule: SleepSchedule
  noiseTolerance: number // 1-5
  guestTolerance: number // 1-5
  // Three separate cleanliness dimensions — see lib/compatibility/cleanliness.ts
  cleanlinessPractice: number // 1-5: what this person keeps themselves
  cleanlinessExpectation: number // 1-5: what they expect from others
  chaosTolerance: number // 1-5: how much mess they can live with

  // Social
  socialStyle: SocialStyle
  languages: string[]
  conflictStyle: ConflictStyle

  // Practical
  smokingStatus: SmokingStatus
  dietaryNeeds: string[]
  mobilityNeeds: MobilityNeed
  medicalEquipment: boolean

  // Preferences
  petTolerance: boolean
  sharedBathroom: boolean
  sharedKitchen: boolean
  privacyNeed: number // 1-5

  // Household
  choresContribution: number // 1-5
  recyclingKnowledge: RecyclingKnowledge

  // Health/Support needs (functional, not diagnostic)
  roomSharingStatus: RoomSharingStatus
  hasNightDisturbances: boolean
  needsQuietEnvironment: boolean
  hasSleepEquipment: boolean
  supportLevel: SupportLevel
}

// Types imported from @/lib/db above (SSOT: src/lib/db/schema.ts)

export interface CompatibilityScore {
  overall: number // 0-100
  lifestyle: number
  social: number
  practical: number
  risk: number // Lower is better

  strengths: string[]
  concerns: string[]
  recommendations: string[]
  predictions?: string[] // Predicted conflict types and timeframes
}

export interface CompatibilityWeights {
  lifestyle: number // Default 35
  social: number // Default 25
  practical: number // Default 20
  risk: number // Default 20
}

export interface DimensionResult {
  score: number
  factors: FactorResult[]
}

export interface FactorResult {
  name: string
  score: number
  weight: number
  note?: string
}

/**
 * Aggregate profile of an apartment based on current residents
 */
export interface ApartmentProfile {
  unitId: string
  currentResidentCount: number
  isEmpty: boolean

  // Numeric attributes (averages)
  avgNoiseTolerance: number | null
  avgCleanlinessLevel: number | null
  /**
   * Individual cleanliness profiles of current residents. Cleanliness fit is
   * directional and pairwise (see lib/compatibility/cleanliness.ts), so an
   * average is not enough: averaging hides the single incompatible pairing
   * that generates the incidents.
   */
  cleanlinessProfiles: CleanlinessProfile[]
  avgPrivacyNeed: number | null
  avgChoresContribution: number | null

  // Enum attributes (dominant/distribution)
  dominantSleepSchedule: SleepSchedule | null
  sleepScheduleDistribution: Record<SleepSchedule, number>
  dominantSocialStyle: SocialStyle | null
  dominantSmokingStatus: SmokingStatus | null

  // Multi-value attributes
  commonLanguages: string[]

  // Boolean attributes (percentages)
  percentNeedsQuiet: number
  percentHasNightDisturbances: number
}

/**
 * Compatibility of new resident with apartment aggregate profile
 */
export interface ApartmentCompatibility {
  apartmentProfile: ApartmentProfile
  fitScore: number // 0-100
  conflicts: ApartmentConflict[]
  strengths: string[]
  warnings: string[]
}

export interface ApartmentConflict {
  attribute: string
  severity: 'BLOCKING' | 'HIGH' | 'MEDIUM' | 'LOW'
  message: string
  residentValue: number | string
  apartmentAverage: number | string
}
