import type { ResidentProfile } from '../types'

const DEFAULT_RESIDENT: ResidentProfile = {
  id: 'test-1',
  code: 'RES-001',
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
}

/**
 * Create a ResidentProfile with sensible defaults, overridable per field.
 */
export function makeResident(overrides: Partial<ResidentProfile> = {}): ResidentProfile {
  return { ...DEFAULT_RESIDENT, ...overrides }
}

// Pre-built personas

export const earlyBird = makeResident({
  id: 'early-bird',
  code: 'RES-EB',
  sleepSchedule: 'EARLY_BIRD',
  cleanlinessPractice: 5,
  cleanlinessExpectation: 5,
  chaosTolerance: 6 - 5,
  noiseTolerance: 2,
  guestTolerance: 2,
  socialStyle: 'INTROVERTED',
  conflictStyle: 'AVOIDANT',
  smokingStatus: 'NON_SMOKER',
  needsQuietEnvironment: true,
})

export const nightOwl = makeResident({
  id: 'night-owl',
  code: 'RES-NO',
  sleepSchedule: 'NIGHT_OWL',
  cleanlinessPractice: 2,
  cleanlinessExpectation: 2,
  chaosTolerance: 6 - 2,
  noiseTolerance: 5,
  guestTolerance: 5,
  socialStyle: 'EXTROVERTED',
  conflictStyle: 'DIRECT',
  smokingStatus: 'INDOOR_SMOKER',
})

export const idealMatchA = makeResident({
  id: 'ideal-a',
  code: 'RES-IA',
  sleepSchedule: 'STANDARD',
  noiseTolerance: 3,
  cleanlinessPractice: 4,
  cleanlinessExpectation: 4,
  chaosTolerance: 6 - 4,
  socialStyle: 'MODERATE',
  languages: ['German', 'English'],
  smokingStatus: 'NON_SMOKER',
  privacyNeed: 3,
  choresContribution: 4,
  recyclingKnowledge: 'GOOD',
  petTolerance: true,
  sharedBathroom: true,
  sharedKitchen: true,
})

export const idealMatchB = makeResident({
  id: 'ideal-b',
  code: 'RES-IB',
  sleepSchedule: 'STANDARD',
  noiseTolerance: 3,
  cleanlinessPractice: 4,
  cleanlinessExpectation: 4,
  chaosTolerance: 6 - 4,
  socialStyle: 'MODERATE',
  languages: ['German', 'English'],
  smokingStatus: 'NON_SMOKER',
  privacyNeed: 3,
  choresContribution: 4,
  recyclingKnowledge: 'GOOD',
  petTolerance: true,
  sharedBathroom: true,
  sharedKitchen: true,
})

export const worstMatchA = makeResident({
  id: 'worst-a',
  code: 'RES-WA',
  sleepSchedule: 'EARLY_BIRD',
  noiseTolerance: 1,
  cleanlinessPractice: 5,
  cleanlinessExpectation: 5,
  chaosTolerance: 6 - 5,
  guestTolerance: 1,
  socialStyle: 'INTROVERTED',
  languages: ['Arabic'],
  conflictStyle: 'AVOIDANT',
  smokingStatus: 'NON_SMOKER',
  privacyNeed: 5,
  choresContribution: 5,
  recyclingKnowledge: 'GOOD',
  petTolerance: false,
  sharedBathroom: false,
  sharedKitchen: false,
  needsQuietEnvironment: true,
  roomSharingStatus: 'NEEDS_PRIVATE',
  ageRange: 'SENIOR',
})

export const worstMatchB = makeResident({
  id: 'worst-b',
  code: 'RES-WB',
  sleepSchedule: 'NIGHT_OWL',
  noiseTolerance: 5,
  cleanlinessPractice: 1,
  cleanlinessExpectation: 1,
  chaosTolerance: 6 - 1,
  guestTolerance: 5,
  socialStyle: 'EXTROVERTED',
  languages: ['Turkish'],
  conflictStyle: 'DIRECT',
  smokingStatus: 'INDOOR_SMOKER',
  privacyNeed: 1,
  choresContribution: 1,
  recyclingKnowledge: 'NONE',
  petTolerance: true,
  sharedBathroom: true,
  sharedKitchen: true,
  hasNightDisturbances: true,
  roomSharingStatus: 'CAN_SHARE',
  ageRange: 'YOUNG_ADULT',
})
