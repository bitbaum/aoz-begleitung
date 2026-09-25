import { toResidentProfile } from '../convert'
import type { Resident } from '@/lib/db'

function makePrismaResident(overrides: Partial<Resident> = {}): Resident {
  return {
    id: 'clx1234567890abcdefghijk',
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
    status: 'ACTIVE',
    // A fixture is a person, not a seeded placeholder.
    isPlaceholder: false,
    notes: null,
    hasMedicalDocumentation: false,
    medicalDocType: null,
    medicalDocDate: null,
    medicalDocNotes: null,
    roommatePreferences: null,
    preferencesCompletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('toResidentProfile', () => {
  it('maps all required fields from Prisma Resident', () => {
    const resident = makePrismaResident()
    const profile = toResidentProfile(resident)

    expect(profile.id).toBe(resident.id)
    expect(profile.code).toBe(resident.code)
    expect(profile.ageRange).toBe('ADULT')
    expect(profile.gender).toBe('MALE')
    expect(profile.familyStatus).toBe('SINGLE')
    expect(profile.sleepSchedule).toBe('STANDARD')
    expect(profile.noiseTolerance).toBe(3)
    expect(profile.cleanlinessPractice).toBe(3)
    expect(profile.guestTolerance).toBe(3)
    expect(profile.socialStyle).toBe('MODERATE')
    expect(profile.conflictStyle).toBe('COOPERATIVE')
    expect(profile.languages).toEqual(['German'])
    expect(profile.smokingStatus).toBe('NON_SMOKER')
    expect(profile.dietaryNeeds).toEqual([])
    expect(profile.mobilityNeeds).toBe('NONE')
    expect(profile.medicalEquipment).toBe(false)
    expect(profile.petTolerance).toBe(true)
    expect(profile.sharedBathroom).toBe(true)
    expect(profile.sharedKitchen).toBe(true)
    expect(profile.privacyNeed).toBe(3)
    expect(profile.choresContribution).toBe(3)
    expect(profile.recyclingKnowledge).toBe('BASIC')
    expect(profile.roomSharingStatus).toBe('CAN_SHARE')
    expect(profile.hasNightDisturbances).toBe(false)
    expect(profile.needsQuietEnvironment).toBe(false)
    expect(profile.hasSleepEquipment).toBe(false)
    expect(profile.supportLevel).toBe('STANDARD')
  })

  it('preserves array fields (languages, dietaryNeeds)', () => {
    const resident = makePrismaResident({
      languages: ['German', 'Arabic', 'English'],
      dietaryNeeds: ['SEPARATE_COOKWARE', 'vegan'],
    })
    const profile = toResidentProfile(resident)
    expect(profile.languages).toEqual(['German', 'Arabic', 'English'])
    expect(profile.dietaryNeeds).toEqual(['SEPARATE_COOKWARE', 'vegan'])
  })

  it('does not include Prisma-only fields (status, createdAt, etc.)', () => {
    const resident = makePrismaResident()
    const profile = toResidentProfile(resident)
    expect(profile).not.toHaveProperty('status')
    expect(profile).not.toHaveProperty('createdAt')
    expect(profile).not.toHaveProperty('updatedAt')
    expect(profile).not.toHaveProperty('notes')
  })

  it('output is compatible with calculateCompatibility', () => {
    // Verify the shape has all fields needed by the scoring algorithm
    const resident = makePrismaResident()
    const profile = toResidentProfile(resident)

    const requiredFields = [
      'id',
      'code',
      'ageRange',
      'gender',
      'familyStatus',
      'sleepSchedule',
      'noiseTolerance',
      'cleanlinessPractice',
      'guestTolerance',
      'socialStyle',
      'languages',
      'conflictStyle',
      'smokingStatus',
      'dietaryNeeds',
      'mobilityNeeds',
      'medicalEquipment',
      'petTolerance',
      'sharedBathroom',
      'sharedKitchen',
      'privacyNeed',
      'choresContribution',
      'recyclingKnowledge',
      'roomSharingStatus',
      'hasNightDisturbances',
      'needsQuietEnvironment',
      'hasSleepEquipment',
      'supportLevel',
    ]

    for (const field of requiredFields) {
      expect(profile).toHaveProperty(field)
    }
  })
})
