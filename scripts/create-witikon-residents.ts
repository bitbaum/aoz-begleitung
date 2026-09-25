/**
 * Create 8 diverse residents for Witikon-440
 * Following CLAUDE.md best practices:
 * - SSOT: Using the Drizzle schema
 * - Quality: Type-safe, validated data
 * - SOC: Data creation separated from business logic
 */

import { eq } from 'drizzle-orm'
import {
  db,
  resident as residentTable,
  type AgeRange,
  type Gender,
  type FamilyStatus,
  type SleepSchedule,
  type SocialStyle,
  type SmokingStatus,
  type MobilityNeed,
  type RecyclingKnowledge,
  type RoomSharingStatus,
  type SupportLevel,
  type ResidentStatus,
} from '../src/lib/db'

async function main() {
  console.log('🏢 Creating residents for Witikon-440...\n')

  const residents = [
    {
      code: 'WIT-001',
      ageRange: 'YOUNG_ADULT' as AgeRange,
      gender: 'MALE' as Gender,
      familyStatus: 'SINGLE' as FamilyStatus,
      sleepSchedule: 'EARLY_BIRD' as SleepSchedule,
      noiseTolerance: 1, // Very low tolerance
      cleanlinessPractice: 5,
      cleanlinessExpectation: 5,
      chaosTolerance: 6 - 5, // Very clean
      socialStyle: 'INTROVERTED' as SocialStyle,
      privacyNeed: 5, // High need
      languages: ['AR', 'EN'],
      smokingStatus: 'NON_SMOKER' as SmokingStatus,
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      name: 'Ahmed Hassan - quiet early bird, very clean',
    },
    {
      code: 'WIT-002',
      ageRange: 'ADULT' as AgeRange,
      gender: 'FEMALE' as Gender,
      familyStatus: 'SINGLE' as FamilyStatus,
      sleepSchedule: 'NIGHT_OWL' as SleepSchedule,
      noiseTolerance: 5, // High tolerance
      cleanlinessPractice: 3,
      cleanlinessExpectation: 3,
      chaosTolerance: 6 - 3, // Average
      socialStyle: 'EXTROVERTED' as SocialStyle,
      privacyNeed: 1, // Low need
      languages: ['ES', 'EN'],
      smokingStatus: 'NON_SMOKER' as SmokingStatus,
      dietaryNeeds: ['VEGETARIAN'],
      name: 'Maria Rodriguez - social night owl, musician',
    },
    {
      code: 'WIT-003',
      ageRange: 'ADULT' as AgeRange,
      gender: 'MALE' as Gender,
      familyStatus: 'SINGLE' as FamilyStatus,
      sleepSchedule: 'IRREGULAR' as SleepSchedule,
      noiseTolerance: 3, // Medium
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4, // Clean
      socialStyle: 'MODERATE' as SocialStyle,
      privacyNeed: 3, // Medium
      languages: ['RU'],
      smokingStatus: 'NON_SMOKER' as SmokingStatus,
      dietaryNeeds: [],
      name: 'Dmitri Volkov - flexible shift worker',
    },
    {
      code: 'WIT-004',
      ageRange: 'YOUNG_ADULT' as AgeRange,
      gender: 'FEMALE' as Gender,
      familyStatus: 'SINGLE' as FamilyStatus,
      sleepSchedule: 'EARLY_BIRD' as SleepSchedule,
      noiseTolerance: 1, // Very low
      cleanlinessPractice: 5,
      cleanlinessExpectation: 5,
      chaosTolerance: 6 - 5, // Very clean
      socialStyle: 'INTROVERTED' as SocialStyle,
      privacyNeed: 5, // High
      languages: ['SO'],
      smokingStatus: 'NON_SMOKER' as SmokingStatus,
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      hasMedicalDocumentation: true,
      name: 'Amina Osman - quiet, religious, needs privacy',
    },
    {
      code: 'WIT-005',
      ageRange: 'ADULT' as AgeRange,
      gender: 'MALE' as Gender,
      familyStatus: 'SINGLE' as FamilyStatus,
      sleepSchedule: 'NIGHT_OWL' as SleepSchedule,
      noiseTolerance: 5, // High
      cleanlinessPractice: 2,
      cleanlinessExpectation: 2,
      chaosTolerance: 6 - 2, // Messy
      socialStyle: 'EXTROVERTED' as SocialStyle,
      privacyNeed: 1, // Low
      languages: ['PT'],
      smokingStatus: 'NON_SMOKER' as SmokingStatus,
      dietaryNeeds: [],
      name: 'Carlos Silva - party person, messy',
    },
    {
      code: 'WIT-006',
      ageRange: 'YOUNG_ADULT' as AgeRange,
      gender: 'FEMALE' as Gender,
      familyStatus: 'SINGLE' as FamilyStatus,
      sleepSchedule: 'IRREGULAR' as SleepSchedule,
      noiseTolerance: 3, // Medium
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4, // Clean
      socialStyle: 'MODERATE' as SocialStyle,
      privacyNeed: 3, // Medium
      languages: ['AR'],
      smokingStatus: 'NON_SMOKER' as SmokingStatus,
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      name: 'Fatima Al-Rashid - nurse, shift work',
    },
    {
      code: 'WIT-007',
      ageRange: 'ADULT' as AgeRange,
      gender: 'MALE' as Gender,
      familyStatus: 'SINGLE' as FamilyStatus,
      sleepSchedule: 'EARLY_BIRD' as SleepSchedule,
      noiseTolerance: 2, // Low
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4, // Clean
      socialStyle: 'MODERATE' as SocialStyle,
      privacyNeed: 3, // Medium
      languages: ['EN'],
      smokingStatus: 'NON_SMOKER' as SmokingStatus,
      dietaryNeeds: [],
      name: "John O'Brien - teacher, structured",
    },
    {
      code: 'WIT-008',
      ageRange: 'YOUNG_ADULT' as AgeRange,
      gender: 'FEMALE' as Gender,
      familyStatus: 'SINGLE' as FamilyStatus,
      sleepSchedule: 'EARLY_BIRD' as SleepSchedule,
      noiseTolerance: 1, // Very low
      cleanlinessPractice: 5,
      cleanlinessExpectation: 5,
      chaosTolerance: 6 - 5, // Very clean
      socialStyle: 'INTROVERTED' as SocialStyle,
      privacyNeed: 5, // High
      languages: ['JA'],
      smokingStatus: 'NON_SMOKER' as SmokingStatus,
      dietaryNeeds: [],
      name: 'Yuki Tanaka - PhD student, needs quiet',
    },
  ]

  for (const data of residents) {
    const { name, ...residentData } = data

    // Check if already exists
    const exists = await db.query.resident.findFirst({
      where: eq(residentTable.code, data.code),
    })

    if (exists) {
      console.log(`  ⏭️  ${data.code} already exists - skipping`)
      continue
    }

    const [resident] = await db
      .insert(residentTable)
      .values({
        ...residentData,
        status: 'ACTIVE' as ResidentStatus,
        // Default values for required fields
        choresContribution: 3,
        recyclingKnowledge: 'BASIC' as RecyclingKnowledge,
        roomSharingStatus: 'CAN_SHARE' as RoomSharingStatus,
        supportLevel: 'STANDARD' as SupportLevel,
        sharedBathroom: true,
        sharedKitchen: true,
        mobilityNeeds: 'NONE' as MobilityNeed,
        medicalEquipment: false,
        petTolerance: true,
        hasNightDisturbances: false,
        needsQuietEnvironment: data.noiseTolerance <= 2,
        hasSleepEquipment: false,
      })
      .returning()

    console.log(`  ✓ Created ${resident.code} - ${name}`)
  }

  console.log('\n✅ All residents created!')
  console.log('\n📊 Resident Diversity:')
  console.log('  • Sleep: Early birds (4) vs Night owls (2) vs Flexible (2)')
  console.log('  • Social: Quiet (3) vs Moderate (3) vs Social (2)')
  console.log('  • Clean: Very clean (3) vs Clean (3) vs Average/Messy (2)')
  console.log('  • Noise tolerance: 1-5 spread')
  console.log('  • Languages: AR, ES, RU, SO, PT, EN, JA, FR')
  console.log('  • Kitchen: own cookware (3), vegetarian (1), none (4)')
  console.log('\n💡 Next: Visit http://localhost:3000/matching to see compatibility scores!')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })
