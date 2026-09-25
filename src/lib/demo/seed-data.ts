/**
 * Demo seed data — the presentation narrative (SSOT).
 *
 * Creates a compelling story:
 * - Unit 5: Success story (high compatibility, 0 conflicts)
 * - Unit 12: Problem unit (low compatibility, multiple conflicts)
 * - Unit 7: Good unit ready for Ahmed
 * - Unit 3: Empty unit ready for new residents
 * - Ahmed: New resident who would fail in Unit 12 but succeed in Unit 7
 *
 * Called from BOTH the CLI seed (prisma/seed-demo.ts, via ts-node) and the
 * daily reset endpoint (api/cron/reset-demo). It only CREATES rows — wiping
 * is the caller's job (see reset.ts) so this stays runnable on an empty dev
 * DB and on the truncated prod demo alike.
 *
 * Relative-import-safe (no '@/' aliases): ts-node does not resolve tsconfig
 * path aliases.
 */

import { eq, inArray, like, or } from 'drizzle-orm'
import {
  escapeLike,
  expense,
  expenseShare,
  housingUnit,
  incident,
  incidentInvolvement,
  placement,
  placementSpot,
  resident,
  settlement,
  type db,
} from '../db'
import { resolveDemoResidentCode, DEMO_RESIDENT_CODE_PREFIX, DEMO_UNIT_CODE_PREFIX } from './config'
import { seedDemoGovernance } from './seed-governance'
import { seedIntegrationEvidence } from '../seed/integration-evidence'

export interface DemoSeedSummary {
  residents: number
  housingUnits: number
  placements: number
  incidents: number
  demoResidentCode: string
  learningRecords: number
  careAssignments: number
  appointments: number
}

export interface DemoSeedOptions {
  /**
   * Staff account that takes the care seats on every demo resident. Null (the
   * default) seeds evidence without assignments rather than inventing a
   * colleague who would then appear in every real "zuständig" picker.
   */
  careStaffId?: string | null
  /**
   * May the seed create rows that are NOT scoped to a demo unit or a demo
   * resident? Default false.
   *
   * The external activity catalogue has no unit and no code, so the scoped
   * reset — which deletes by demo PREFIX, never by table — has no handle on
   * it. Seeding it under `unit` scope would leave rows accumulating nightly
   * beside a real flat's data, showing real residents invented offers with
   * invented phone numbers. Same rule, same reason as the per-role demo doors:
   * anything the scoped reset cannot clean up belongs to the full reset only.
   */
  siteWideContent?: boolean
}

export async function seedDemoData(
  dbClient: typeof db,
  options: DemoSeedOptions = {},
): Promise<DemoSeedSummary> {
  // The portal demo logs in as Fatima: PLACED, in the zero-conflict success
  // unit, so a visitor sees roommates, rules and chores — not an empty shell.
  const demoResidentCode = resolveDemoResidentCode()

  // ========================================================================
  // RESIDENTS - Creating diverse profiles for the story
  //
  // Every one of them carries a `displayName`, because the narrative already
  // does: the incident texts talk about Alexei and Petro, while the chore
  // board, the queues and the compatibility matrix read the resident rows and
  // showed "RES-DEMO07" for the same person. One human with two identities
  // inside one product tour reads as a bug in the tour.
  //
  // This is demo data, NOT the privacy default: a real resident starts with no
  // name and chooses whether to set one (`residentName()` falls back to the
  // code). Here the names are part of the story being told.
  // ========================================================================

  // SUCCESS UNIT (Unit 5) - 4 highly compatible residents
  const [fatima] = await dbClient
    .insert(resident)
    .values({
      code: demoResidentCode,
      // Self-chosen profile — shows the resident-profile feature in the tour.
      displayName: 'Fatima',
      bio: 'Ich koche gern für alle und mag es ruhig am Abend.',
      ageRange: 'ADULT',
      gender: 'FEMALE',
      familyStatus: 'FAMILY_WITH_CHILDREN',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 3,
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4,
      socialStyle: 'MODERATE',
      languages: ['Arabic', 'German', 'English'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 3,
      choresContribution: 4,
      recyclingKnowledge: 'BASIC',
      roomSharingStatus: 'PREFERS_PRIVATE',
      hasNightDisturbances: false,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'PLACED',
      hasMedicalDocumentation: false,
    })
    .returning()

  const [yasmin] = await dbClient
    .insert(resident)
    .values({
      code: `${DEMO_RESIDENT_CODE_PREFIX}02`,
      displayName: 'Yasmin',
      ageRange: 'ADULT',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 3,
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4,
      socialStyle: 'MODERATE',
      languages: ['Arabic', 'German'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 3,
      choresContribution: 4,
      recyclingKnowledge: 'GOOD',
      roomSharingStatus: 'CAN_SHARE',
      hasNightDisturbances: false,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'PLACED',
      hasMedicalDocumentation: false,
    })
    .returning()

  const [amira] = await dbClient
    .insert(resident)
    .values({
      code: `${DEMO_RESIDENT_CODE_PREFIX}03`,
      displayName: 'Amira',
      ageRange: 'YOUNG_ADULT',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 4,
      cleanlinessPractice: 3,
      cleanlinessExpectation: 3,
      chaosTolerance: 6 - 3,
      socialStyle: 'EXTROVERTED',
      languages: ['Arabic', 'English'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 2,
      choresContribution: 5,
      recyclingKnowledge: 'BASIC',
      roomSharingStatus: 'CAN_SHARE',
      hasNightDisturbances: false,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'PLACED',
      hasMedicalDocumentation: false,
    })
    .returning()

  const [sara] = await dbClient
    .insert(resident)
    .values({
      code: `${DEMO_RESIDENT_CODE_PREFIX}04`,
      displayName: 'Sara',
      ageRange: 'ADULT',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'EARLY_BIRD',
      noiseTolerance: 3,
      cleanlinessPractice: 5,
      cleanlinessExpectation: 5,
      chaosTolerance: 6 - 5,
      socialStyle: 'INTROVERTED',
      languages: ['Arabic', 'French', 'English'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE', 'vegetarian'],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: false,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 4,
      choresContribution: 4,
      recyclingKnowledge: 'GOOD',
      roomSharingStatus: 'PREFERS_PRIVATE',
      hasNightDisturbances: false,
      needsQuietEnvironment: true,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'PLACED',
      hasMedicalDocumentation: false,
    })
    .returning()

  // PROBLEM UNIT (Unit 12) - 4 incompatible residents
  const [marco] = await dbClient
    .insert(resident)
    .values({
      code: `${DEMO_RESIDENT_CODE_PREFIX}05`,
      displayName: 'Marco',
      ageRange: 'YOUNG_ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'NIGHT_OWL',
      noiseTolerance: 5,
      cleanlinessPractice: 1,
      cleanlinessExpectation: 1,
      chaosTolerance: 6 - 1,
      socialStyle: 'EXTROVERTED',
      languages: ['Italian', 'English'],
      smokingStatus: 'OUTDOOR_SMOKER',
      dietaryNeeds: [],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 1,
      choresContribution: 1,
      recyclingKnowledge: 'NONE',
      roomSharingStatus: 'CAN_SHARE',
      hasNightDisturbances: true,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'PLACED',
      hasMedicalDocumentation: false,
    })
    .returning()

  const [dmitri] = await dbClient
    .insert(resident)
    .values({
      code: `${DEMO_RESIDENT_CODE_PREFIX}06`,
      displayName: 'Dmitri',
      ageRange: 'ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'IRREGULAR',
      noiseTolerance: 5,
      cleanlinessPractice: 2,
      cleanlinessExpectation: 2,
      chaosTolerance: 6 - 2,
      socialStyle: 'MODERATE',
      languages: ['Russian', 'English'],
      smokingStatus: 'OUTDOOR_SMOKER',
      dietaryNeeds: [],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 2,
      choresContribution: 2,
      recyclingKnowledge: 'NONE',
      roomSharingStatus: 'CAN_SHARE',
      hasNightDisturbances: false,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'ELEVATED',
      status: 'PLACED',
      hasMedicalDocumentation: false,
    })
    .returning()

  const [petro] = await dbClient
    .insert(resident)
    .values({
      code: `${DEMO_RESIDENT_CODE_PREFIX}07`,
      displayName: 'Petro',
      ageRange: 'YOUNG_ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'NIGHT_OWL',
      noiseTolerance: 4,
      cleanlinessPractice: 2,
      cleanlinessExpectation: 2,
      chaosTolerance: 6 - 2,
      socialStyle: 'EXTROVERTED',
      languages: ['Ukrainian', 'Russian'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: [],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 1,
      choresContribution: 1,
      recyclingKnowledge: 'NONE',
      roomSharingStatus: 'CAN_SHARE',
      hasNightDisturbances: false,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'PLACED',
      hasMedicalDocumentation: false,
    })
    .returning()

  const [alexei] = await dbClient
    .insert(resident)
    .values({
      code: `${DEMO_RESIDENT_CODE_PREFIX}08`,
      displayName: 'Alexei',
      ageRange: 'ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 3,
      cleanlinessPractice: 5,
      cleanlinessExpectation: 5,
      chaosTolerance: 6 - 5,
      socialStyle: 'INTROVERTED',
      languages: ['Russian', 'German'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: [],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: false,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 5,
      choresContribution: 5,
      recyclingKnowledge: 'GOOD',
      roomSharingStatus: 'NEEDS_PRIVATE',
      hasNightDisturbances: false,
      needsQuietEnvironment: true,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'PLACED',
      hasMedicalDocumentation: true,
      medicalDocType: 'PRIVATE_ROOM',
      medicalDocDate: new Date('2024-01-15'),
    })
    .returning()

  // UNIT 7 RESIDENTS - Good mid-tier unit
  const [habib] = await dbClient
    .insert(resident)
    .values({
      code: `${DEMO_RESIDENT_CODE_PREFIX}09`,
      displayName: 'Habib',
      ageRange: 'ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'EARLY_BIRD',
      noiseTolerance: 3,
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4,
      socialStyle: 'MODERATE',
      languages: ['Arabic', 'French', 'German'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 3,
      choresContribution: 4,
      recyclingKnowledge: 'BASIC',
      roomSharingStatus: 'CAN_SHARE',
      hasNightDisturbances: false,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'PLACED',
      hasMedicalDocumentation: false,
    })
    .returning()

  const [omar] = await dbClient
    .insert(resident)
    .values({
      code: `${DEMO_RESIDENT_CODE_PREFIX}10`,
      displayName: 'Omar',
      ageRange: 'YOUNG_ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 4,
      cleanlinessPractice: 3,
      cleanlinessExpectation: 3,
      chaosTolerance: 6 - 3,
      socialStyle: 'MODERATE',
      languages: ['Arabic', 'German'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 2,
      choresContribution: 3,
      recyclingKnowledge: 'BASIC',
      roomSharingStatus: 'CAN_SHARE',
      hasNightDisturbances: false,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'PLACED',
      hasMedicalDocumentation: false,
    })
    .returning()

  const [mustafa] = await dbClient
    .insert(resident)
    .values({
      code: `${DEMO_RESIDENT_CODE_PREFIX}11`,
      displayName: 'Mustafa',
      ageRange: 'ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'EARLY_BIRD',
      noiseTolerance: 3,
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4,
      socialStyle: 'INTROVERTED',
      languages: ['Turkish', 'German', 'English'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 4,
      choresContribution: 5,
      recyclingKnowledge: 'GOOD',
      roomSharingStatus: 'PREFERS_PRIVATE',
      hasNightDisturbances: false,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'PLACED',
      hasMedicalDocumentation: false,
    })
    .returning()

  // UNIT 9 RESIDENTS - Mixed unit
  const [elena] = await dbClient
    .insert(resident)
    .values({
      code: `${DEMO_RESIDENT_CODE_PREFIX}12`,
      displayName: 'Elena',
      ageRange: 'MIDDLE_AGED',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 3,
      cleanlinessPractice: 3,
      cleanlinessExpectation: 3,
      chaosTolerance: 6 - 3,
      socialStyle: 'MODERATE',
      languages: ['Spanish', 'English'],
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
      status: 'PLACED',
      hasMedicalDocumentation: false,
    })
    .returning()

  const [grace] = await dbClient
    .insert(resident)
    .values({
      code: `${DEMO_RESIDENT_CODE_PREFIX}13`,
      displayName: 'Grace',
      ageRange: 'YOUNG_ADULT',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 4,
      cleanlinessPractice: 3,
      cleanlinessExpectation: 3,
      chaosTolerance: 6 - 3,
      socialStyle: 'EXTROVERTED',
      languages: ['English', 'French'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: [],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 2,
      choresContribution: 4,
      recyclingKnowledge: 'BASIC',
      roomSharingStatus: 'CAN_SHARE',
      hasNightDisturbances: false,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'PLACED',
      hasMedicalDocumentation: false,
    })
    .returning()

  // UNPLACED RESIDENTS - The stars of the demo
  const [ahmed] = await dbClient
    .insert(resident)
    .values({
      code: `${DEMO_RESIDENT_CODE_PREFIX}14`,
      displayName: 'Ahmed',
      ageRange: 'ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'EARLY_BIRD',
      noiseTolerance: 3,
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4,
      socialStyle: 'MODERATE',
      languages: ['Arabic', 'German'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 3,
      choresContribution: 4,
      recyclingKnowledge: 'BASIC',
      roomSharingStatus: 'CAN_SHARE',
      hasNightDisturbances: false,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'ACTIVE', // UNPLACED - This is our demo star!
      notes: 'New arrival today - needs placement. Good candidate for Arabic-speaking unit.',
      hasMedicalDocumentation: false,
    })
    .returning()

  const [maria] = await dbClient
    .insert(resident)
    .values({
      code: `${DEMO_RESIDENT_CODE_PREFIX}15`,
      displayName: 'Maria',
      ageRange: 'MIDDLE_AGED',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 2,
      cleanlinessPractice: 5,
      cleanlinessExpectation: 5,
      chaosTolerance: 6 - 5,
      socialStyle: 'INTROVERTED',
      languages: ['Spanish', 'English'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: [],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: false,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 5,
      choresContribution: 5,
      recyclingKnowledge: 'GOOD',
      roomSharingStatus: 'PREFERS_PRIVATE',
      hasNightDisturbances: false,
      needsQuietEnvironment: true,
      hasSleepEquipment: false,
      supportLevel: 'ELEVATED',
      status: 'ACTIVE', // UNPLACED
      notes:
        'Previously transferred 3 times due to cleanliness conflicts. Needs quiet, clean environment.',
      hasMedicalDocumentation: false,
    })
    .returning()

  // ========================================================================
  // HOUSING UNITS
  // ========================================================================

  // UNIT 5 - THE SUCCESS STORY
  const [unit5] = await dbClient
    .insert(housingUnit)
    .values({
      code: `${DEMO_UNIT_CODE_PREFIX}U05`,
      address: 'Beispielstrasse 1, 8000 Zürich',
      // Resident-chosen apartment name — shows the apartment profile feature.
      nickname: 'Casa Harmonie',
      totalBeds: 4,
      totalRooms: 2,
      sharedRooms: 2,
      privateRooms: 0,
      sharedBathrooms: 1,
      privateBathrooms: 0,
      sharedKitchen: true,
      privateKitchen: false,
      groundFloor: false,
      wheelchairAccess: false,
      elevator: true,
      smokingAllowed: false,
      petsAllowed: false,
      quietHours: '22:00-07:00',
      nearPublicTransport: true,
      nearHealthServices: true,
      nearSchools: false,
      status: 'FULL',
      notes: 'Success story - 6 months with zero conflicts. All residents highly compatible.',
    })
    .returning()

  // UNIT 12 - THE PROBLEM UNIT
  const [unit12] = await dbClient
    .insert(housingUnit)
    .values({
      code: `${DEMO_UNIT_CODE_PREFIX}U12`,
      address: 'Beispielstrasse 2, 8000 Zürich',
      totalBeds: 5,
      totalRooms: 3,
      sharedRooms: 2,
      privateRooms: 1,
      sharedBathrooms: 2,
      privateBathrooms: 0,
      sharedKitchen: true,
      privateKitchen: false,
      groundFloor: false,
      wheelchairAccess: false,
      elevator: false,
      smokingAllowed: true,
      petsAllowed: true,
      quietHours: '23:00-06:00',
      nearPublicTransport: true,
      nearHealthServices: false,
      nearSchools: false,
      status: 'AVAILABLE',
      notes: 'Historical issues with noise and cleanliness. Needs careful matching.',
    })
    .returning()

  // UNIT 7 - GOOD UNIT (ready for Ahmed)
  const [unit7] = await dbClient
    .insert(housingUnit)
    .values({
      code: `${DEMO_UNIT_CODE_PREFIX}U07`,
      address: 'Beispielstrasse 3, 8000 Zürich',
      totalBeds: 4,
      totalRooms: 2,
      sharedRooms: 2,
      privateRooms: 0,
      sharedBathrooms: 1,
      privateBathrooms: 0,
      sharedKitchen: true,
      privateKitchen: false,
      groundFloor: false,
      wheelchairAccess: false,
      elevator: true,
      smokingAllowed: false,
      petsAllowed: false,
      quietHours: '22:00-07:00',
      nearPublicTransport: true,
      nearHealthServices: true,
      nearSchools: false,
      status: 'AVAILABLE',
      notes: 'Stable unit with Arabic-speaking residents. Good for cultural integration.',
    })
    .returning()

  // UNIT 3 - EMPTY UNIT
  const [unit3] = await dbClient
    .insert(housingUnit)
    .values({
      code: `${DEMO_UNIT_CODE_PREFIX}U03`,
      address: 'Beispielstrasse 4, 8000 Zürich',
      totalBeds: 3,
      totalRooms: 3,
      sharedRooms: 0,
      privateRooms: 3,
      sharedBathrooms: 1,
      privateBathrooms: 0,
      sharedKitchen: true,
      privateKitchen: false,
      groundFloor: true,
      wheelchairAccess: true,
      elevator: false,
      smokingAllowed: false,
      petsAllowed: false,
      quietHours: '22:00-07:00',
      nearPublicTransport: true,
      nearHealthServices: true,
      nearSchools: true,
      status: 'AVAILABLE',
      notes: 'Newly available unit. All private rooms. Ground floor with wheelchair access.',
    })
    .returning()

  // UNIT 9 - MIXED UNIT
  const [unit9] = await dbClient
    .insert(housingUnit)
    .values({
      code: `${DEMO_UNIT_CODE_PREFIX}U09`,
      address: 'Beispielstrasse 5, 8000 Zürich',
      totalBeds: 3,
      totalRooms: 2,
      sharedRooms: 1,
      privateRooms: 1,
      sharedBathrooms: 1,
      privateBathrooms: 0,
      sharedKitchen: true,
      privateKitchen: false,
      groundFloor: false,
      wheelchairAccess: false,
      elevator: true,
      smokingAllowed: false,
      petsAllowed: true,
      quietHours: '22:00-07:00',
      nearPublicTransport: true,
      nearHealthServices: false,
      nearSchools: false,
      status: 'AVAILABLE',
      notes: 'Mixed demographic unit. Moderate performance.',
    })
    .returning()

  // ========================================================================
  // PLACEMENT SPOTS
  // ========================================================================

  // Unit 5 spots (all occupied)
  const [unit5Bed1] = await dbClient
    .insert(placementSpot)
    .values({
      housingUnitId: unit5.id,
      code: 'R1-B1',
      label: 'Room 1 - Bed 1',
      type: 'BED',
      capacity: 1,
      status: 'OCCUPIED',
    })
    .returning()
  const [unit5Bed2] = await dbClient
    .insert(placementSpot)
    .values({
      housingUnitId: unit5.id,
      code: 'R1-B2',
      label: 'Room 1 - Bed 2',
      type: 'BED',
      capacity: 1,
      status: 'OCCUPIED',
    })
    .returning()
  const [unit5Bed3] = await dbClient
    .insert(placementSpot)
    .values({
      housingUnitId: unit5.id,
      code: 'R2-B1',
      label: 'Room 2 - Bed 1',
      type: 'BED',
      capacity: 1,
      status: 'OCCUPIED',
    })
    .returning()
  const [unit5Bed4] = await dbClient
    .insert(placementSpot)
    .values({
      housingUnitId: unit5.id,
      code: 'R2-B2',
      label: 'Room 2 - Bed 2',
      type: 'BED',
      capacity: 1,
      status: 'OCCUPIED',
    })
    .returning()

  // Unit 12 spots
  const [unit12Bed1] = await dbClient
    .insert(placementSpot)
    .values({
      housingUnitId: unit12.id,
      code: 'R1-B1',
      label: 'Room 1 - Bed 1',
      type: 'BED',
      capacity: 1,
      status: 'OCCUPIED',
    })
    .returning()
  const [unit12Bed2] = await dbClient
    .insert(placementSpot)
    .values({
      housingUnitId: unit12.id,
      code: 'R1-B2',
      label: 'Room 1 - Bed 2',
      type: 'BED',
      capacity: 1,
      status: 'OCCUPIED',
    })
    .returning()
  const [unit12Bed3] = await dbClient
    .insert(placementSpot)
    .values({
      housingUnitId: unit12.id,
      code: 'R2-B1',
      label: 'Room 2 - Bed 1',
      type: 'BED',
      capacity: 1,
      status: 'OCCUPIED',
    })
    .returning()
  const [unit12Room3] = await dbClient
    .insert(placementSpot)
    .values({
      housingUnitId: unit12.id,
      code: 'R3',
      label: 'Private Room 3',
      type: 'PRIVATE_ROOM',
      capacity: 1,
      status: 'OCCUPIED',
      requiresMedicalDocs: true,
    })
    .returning()
  const [unit12Bed5] = await dbClient
    .insert(placementSpot)
    .values({
      housingUnitId: unit12.id,
      code: 'R2-B2',
      label: 'Room 2 - Bed 2',
      type: 'BED',
      capacity: 1,
      status: 'AVAILABLE',
    })
    .returning()

  // Unit 7 spots (one available for Ahmed!)
  const [unit7Bed1] = await dbClient
    .insert(placementSpot)
    .values({
      housingUnitId: unit7.id,
      code: 'R1-B1',
      label: 'Room 1 - Bed 1',
      type: 'BED',
      capacity: 1,
      status: 'OCCUPIED',
    })
    .returning()
  const [unit7Bed2] = await dbClient
    .insert(placementSpot)
    .values({
      housingUnitId: unit7.id,
      code: 'R1-B2',
      label: 'Room 1 - Bed 2',
      type: 'BED',
      capacity: 1,
      status: 'OCCUPIED',
    })
    .returning()
  const [unit7Bed3] = await dbClient
    .insert(placementSpot)
    .values({
      housingUnitId: unit7.id,
      code: 'R2-B1',
      label: 'Room 2 - Bed 1',
      type: 'BED',
      capacity: 1,
      status: 'OCCUPIED',
    })
    .returning()
  const [unit7Bed4] = await dbClient
    .insert(placementSpot)
    .values({
      housingUnitId: unit7.id,
      code: 'R2-B2',
      label: 'Room 2 - Bed 2',
      type: 'BED',
      capacity: 1,
      status: 'AVAILABLE',
    })
    .returning()

  // Unit 3 spots (all empty)
  await dbClient.insert(placementSpot).values({
    housingUnitId: unit3.id,
    code: 'R1',
    label: 'Private Room 1',
    type: 'PRIVATE_ROOM',
    capacity: 1,
    status: 'AVAILABLE',
  })
  await dbClient.insert(placementSpot).values({
    housingUnitId: unit3.id,
    code: 'R2',
    label: 'Private Room 2',
    type: 'PRIVATE_ROOM',
    capacity: 1,
    status: 'AVAILABLE',
  })
  await dbClient.insert(placementSpot).values({
    housingUnitId: unit3.id,
    code: 'R3',
    label: 'Private Room 3',
    type: 'PRIVATE_ROOM',
    capacity: 1,
    status: 'AVAILABLE',
  })

  // Unit 9 spots
  const [unit9Bed1] = await dbClient
    .insert(placementSpot)
    .values({
      housingUnitId: unit9.id,
      code: 'R1-B1',
      label: 'Shared Room - Bed 1',
      type: 'BED',
      capacity: 1,
      status: 'OCCUPIED',
    })
    .returning()
  const [unit9Bed2] = await dbClient
    .insert(placementSpot)
    .values({
      housingUnitId: unit9.id,
      code: 'R1-B2',
      label: 'Shared Room - Bed 2',
      type: 'BED',
      capacity: 1,
      status: 'OCCUPIED',
    })
    .returning()
  await dbClient.insert(placementSpot).values({
    housingUnitId: unit9.id,
    code: 'R2',
    label: 'Private Room',
    type: 'PRIVATE_ROOM',
    capacity: 1,
    status: 'AVAILABLE',
  })

  // ========================================================================
  // PLACEMENTS
  // ========================================================================

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const twoMonthsAgo = new Date()
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

  // Unit 5 placements (SUCCESS - all high compatibility)
  await dbClient.insert(placement).values({
    residentId: fatima.id,
    housingUnitId: unit5.id,
    spotId: unit5Bed1.id,
    startDate: sixMonthsAgo,
    status: 'ACTIVE',
    compatibilityScore: 88,
    lifestyleScore: 85,
    socialScore: 92,
    practicalScore: 87,
    riskScore: 12,
    placementNotes:
      'Apartment Fit: 88%\n\nStrong match - similar cultural background and lifestyle preferences.',
  })

  await dbClient.insert(placement).values({
    residentId: yasmin.id,
    housingUnitId: unit5.id,
    spotId: unit5Bed2.id,
    startDate: sixMonthsAgo,
    status: 'ACTIVE',
    compatibilityScore: 85,
    lifestyleScore: 83,
    socialScore: 90,
    practicalScore: 84,
    riskScore: 15,
    placementNotes:
      'Apartment Fit: 85%\n\nExcellent language match with Fatima (both Arabic speakers).',
  })

  await dbClient.insert(placement).values({
    residentId: amira.id,
    housingUnitId: unit5.id,
    spotId: unit5Bed3.id,
    startDate: sixMonthsAgo,
    status: 'ACTIVE',
    compatibilityScore: 82,
    lifestyleScore: 80,
    socialScore: 88,
    practicalScore: 81,
    riskScore: 18,
    placementNotes:
      'Apartment Fit: 82%\n\nGood fit with existing residents. Slightly more extroverted but compatible.',
  })

  await dbClient.insert(placement).values({
    residentId: sara.id,
    housingUnitId: unit5.id,
    spotId: unit5Bed4.id,
    startDate: sixMonthsAgo,
    status: 'ACTIVE',
    compatibilityScore: 79,
    lifestyleScore: 82,
    socialScore: 85,
    practicalScore: 75,
    riskScore: 21,
    placementNotes:
      'Apartment Fit: 79%\n\nHighly clean, might set good example. Needs quiet which aligns with unit culture.',
  })

  // Unit 12 placements (PROBLEM - low compatibility, conflicts expected)
  await dbClient.insert(placement).values({
    residentId: marco.id,
    housingUnitId: unit12.id,
    spotId: unit12Bed1.id,
    startDate: threeMonthsAgo,
    status: 'ACTIVE',
    compatibilityScore: 45,
    lifestyleScore: 38,
    socialScore: 52,
    practicalScore: 48,
    riskScore: 62,
    placementNotes: 'Apartment Fit: 45%\n\nSuboptimal match - significant lifestyle differences.',
  })

  await dbClient.insert(placement).values({
    residentId: dmitri.id,
    housingUnitId: unit12.id,
    spotId: unit12Bed2.id,
    startDate: threeMonthsAgo,
    status: 'ACTIVE',
    compatibilityScore: 42,
    lifestyleScore: 35,
    socialScore: 48,
    practicalScore: 45,
    riskScore: 58,
    placementNotes:
      'Apartment Fit: 42%\n\nLanguage barrier with Marco. Both low on chores contribution.',
  })

  await dbClient.insert(placement).values({
    residentId: petro.id,
    housingUnitId: unit12.id,
    spotId: unit12Bed3.id,
    startDate: twoMonthsAgo,
    status: 'ACTIVE',
    compatibilityScore: 48,
    lifestyleScore: 40,
    socialScore: 55,
    practicalScore: 50,
    riskScore: 52,
    placementNotes: 'Apartment Fit: 48%\n\nBetter than existing residents but still suboptimal.',
  })

  await dbClient.insert(placement).values({
    residentId: alexei.id,
    housingUnitId: unit12.id,
    spotId: unit12Room3.id,
    startDate: twoMonthsAgo,
    status: 'ACTIVE',
    compatibilityScore: 28,
    lifestyleScore: 22,
    socialScore: 35,
    practicalScore: 30,
    riskScore: 78,
    placementNotes:
      'Apartment Fit: 28%\n\nVery poor match - extremely clean person in messy unit. High conflict risk.',
  })

  // Unit 7 placements (GOOD - ready for Ahmed)
  await dbClient.insert(placement).values({
    residentId: habib.id,
    housingUnitId: unit7.id,
    spotId: unit7Bed1.id,
    startDate: threeMonthsAgo,
    status: 'ACTIVE',
    compatibilityScore: 82,
    lifestyleScore: 80,
    socialScore: 88,
    practicalScore: 80,
    riskScore: 18,
    placementNotes: 'Apartment Fit: 82%\n\nGood foundational resident for unit.',
  })

  await dbClient.insert(placement).values({
    residentId: omar.id,
    housingUnitId: unit7.id,
    spotId: unit7Bed2.id,
    startDate: threeMonthsAgo,
    status: 'ACTIVE',
    compatibilityScore: 80,
    lifestyleScore: 78,
    socialScore: 86,
    practicalScore: 78,
    riskScore: 20,
    placementNotes: 'Apartment Fit: 80%\n\nStrong language match with Habib.',
  })

  await dbClient.insert(placement).values({
    residentId: mustafa.id,
    housingUnitId: unit7.id,
    spotId: unit7Bed3.id,
    startDate: twoMonthsAgo,
    status: 'ACTIVE',
    compatibilityScore: 76,
    lifestyleScore: 75,
    socialScore: 80,
    practicalScore: 74,
    riskScore: 24,
    placementNotes: 'Apartment Fit: 76%\n\nGood addition. Similar early bird schedule with Habib.',
  })

  // Unit 9 placements
  await dbClient.insert(placement).values({
    residentId: elena.id,
    housingUnitId: unit9.id,
    spotId: unit9Bed1.id,
    startDate: threeMonthsAgo,
    status: 'ACTIVE',
    compatibilityScore: 68,
    lifestyleScore: 65,
    socialScore: 72,
    practicalScore: 67,
    riskScore: 33,
    placementNotes: 'Apartment Fit: 68%\n\nModerate match.',
  })

  await dbClient.insert(placement).values({
    residentId: grace.id,
    housingUnitId: unit9.id,
    spotId: unit9Bed2.id,
    startDate: twoMonthsAgo,
    status: 'ACTIVE',
    compatibilityScore: 72,
    lifestyleScore: 70,
    socialScore: 75,
    practicalScore: 71,
    riskScore: 28,
    placementNotes: 'Apartment Fit: 72%\n\nGood addition to unit.',
  })

  // ============================================================================
  // INCIDENTS - Demonstrate patterns (Unit 5=success, Unit 12=problems)
  // ============================================================================

  // Unit 12 - PROBLEM UNIT: Multiple conflicts demonstrating poor compatibility

  // Week 2: First cleanliness complaint (predicted timing)
  const [incident1] = await dbClient
    .insert(incident)
    .values({
      housingUnitId: unit12.id,
      category: 'INTERPERSONAL',
      type: 'CLEANLINESS_DISPUTE',
      date: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000), // 85 days ago
      description:
        'Sauberkeitskonflikt: Marco beschwert sich über unordentliche Gemeinschaftsbereiche. Dmitri und Petro lassen Geschirr ungespült.',
      severity: 'MEDIUM',
      resolvedAt: new Date(Date.now() - 83 * 24 * 60 * 60 * 1000),
      resolution: 'Hausordnung besprochen. Putzplan erstellt.',
      reportedById: marco.id,
    })
    .returning()

  await dbClient.insert(incidentInvolvement).values([
    { incidentId: incident1.id, residentId: marco.id, role: 'INVOLVED' },
    { incidentId: incident1.id, residentId: dmitri.id, role: 'INVOLVED' },
    { incidentId: incident1.id, residentId: petro.id, role: 'INVOLVED' },
  ])

  // Week 3: Noise complaint (night owl vs introverted needs privacy)
  const [incident2] = await dbClient
    .insert(incident)
    .values({
      housingUnitId: unit12.id,
      category: 'INTERPERSONAL',
      type: 'NOISE_COMPLAINT',
      date: new Date(Date.now() - 78 * 24 * 60 * 60 * 1000), // 78 days ago
      description:
        'Lärmbelästigung: Alexei beschwert sich über nächtlichen Lärm von Petro (23:00-02:00 Uhr). Beeinflusst seinen Schlaf.',
      severity: 'HIGH',
      resolvedAt: new Date(Date.now() - 76 * 24 * 60 * 60 * 1000),
      resolution: 'Ruhezeiten nach 22:00 Uhr vereinbart. Petro zugestimmt.',
      reportedById: alexei.id,
    })
    .returning()

  await dbClient.insert(incidentInvolvement).values([
    { incidentId: incident2.id, residentId: alexei.id, role: 'INVOLVED' },
    { incidentId: incident2.id, residentId: petro.id, role: 'INVOLVED' },
  ])

  // Week 4: Cleanliness escalation (difference of 3 levels)
  const [incident3] = await dbClient
    .insert(incident)
    .values({
      housingUnitId: unit12.id,
      category: 'INTERPERSONAL',
      type: 'CLEANLINESS_DISPUTE',
      date: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000), // 70 days ago
      description:
        'Schwerer Sauberkeitskonflikt: Alexei (sehr sauber) kann nicht mit Dmitri und Petro (beide Sauberkeit Level 2) zusammenleben. Küche nicht gereinigt seit 5 Tagen.',
      severity: 'HIGH',
      // No reportedById = staff reported
    })
    .returning()

  await dbClient.insert(incidentInvolvement).values([
    { incidentId: incident3.id, residentId: alexei.id, role: 'INVOLVED' },
    { incidentId: incident3.id, residentId: dmitri.id, role: 'INVOLVED' },
    { incidentId: incident3.id, residentId: petro.id, role: 'INVOLVED' },
  ])

  // Week 6: Chores conflict (low contribution causing tension)
  const [incident4] = await dbClient
    .insert(incident)
    .values({
      housingUnitId: unit12.id,
      category: 'INTERPERSONAL',
      type: 'PERSONAL_CONFLICT',
      date: new Date(Date.now() - 56 * 24 * 60 * 60 * 1000), // 56 days ago
      description:
        'Hausarbeitskonflikt: Petro (Beitrag Level 1) beteiligt sich nicht an Reinigungsarbeiten. Marco übernimmt alle Aufgaben.',
      severity: 'MEDIUM',
      resolvedAt: new Date(Date.now() - 52 * 24 * 60 * 60 * 1000),
      resolution: 'Rotierender Putzplan mit klaren Zuständigkeiten eingeführt.',
      reportedById: marco.id,
    })
    .returning()

  await dbClient.insert(incidentInvolvement).values([
    { incidentId: incident4.id, residentId: marco.id, role: 'INVOLVED' },
    { incidentId: incident4.id, residentId: petro.id, role: 'INVOLVED' },
  ])

  // Week 9: Recycling dispute (knowledge gap causing issues)
  const [incident5] = await dbClient
    .insert(incident)
    .values({
      housingUnitId: unit12.id,
      category: 'INTERPERSONAL',
      type: 'PERSONAL_CONFLICT',
      date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
      description:
        'Recycling-Fehler: Dmitri und Petro (keine Recycling-Kenntnisse) werfen alles in den Restmüll. Alexei frustriert.',
      severity: 'LOW',
      resolvedAt: new Date(Date.now() - 33 * 24 * 60 * 60 * 1000),
      resolution: 'Recycling-Schulung durchgeführt. Infografik in Küche aufgehängt.',
      reportedById: alexei.id,
    })
    .returning()

  await dbClient.insert(incidentInvolvement).values([
    { incidentId: incident5.id, residentId: alexei.id, role: 'INVOLVED' },
    { incidentId: incident5.id, residentId: dmitri.id, role: 'INVOLVED' },
    { incidentId: incident5.id, residentId: petro.id, role: 'INVOLVED' },
  ])

  // Week 11: Recent noise complaint (pattern continues)
  const [incident6] = await dbClient
    .insert(incident)
    .values({
      housingUnitId: unit12.id,
      category: 'INTERPERSONAL',
      type: 'NOISE_COMPLAINT',
      date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      description:
        'Erneute Lärmbelästigung: Petro hält sich nicht an vereinbarte Ruhezeiten. Alexei erwägt Umzug.',
      severity: 'HIGH',
      reportedById: alexei.id,
    })
    .returning()

  await dbClient.insert(incidentInvolvement).values([
    { incidentId: incident6.id, residentId: alexei.id, role: 'INVOLVED' },
    { incidentId: incident6.id, residentId: petro.id, role: 'INVOLVED' },
  ])

  // Unit 5 - SUCCESS STORY: 0 incidents over 6 months (no incidents to create)
  // This demonstrates what good compatibility looks like

  // Unit 9 - One minor incident (manageable with moderate compatibility)
  const [incident7] = await dbClient
    .insert(incident)
    .values({
      housingUnitId: unit9.id,
      category: 'INTERPERSONAL',
      type: 'PERSONAL_CONFLICT',
      date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
      description:
        'Kleine Meinungsverschiedenheit über Küchennutzungszeiten. Schnell gelöst durch Kompromiss.',
      severity: 'LOW',
      resolvedAt: new Date(Date.now() - 44 * 24 * 60 * 60 * 1000),
      resolution: 'Nutzungsplan erstellt. Beide Parteien zufrieden.',
      reportedById: elena.id,
    })
    .returning()

  await dbClient.insert(incidentInvolvement).values([
    { incidentId: incident7.id, residentId: elena.id, role: 'INVOLVED' },
    { incidentId: incident7.id, residentId: grace.id, role: 'INVOLVED' },
  ])

  // ========================================================================
  // SHARED EXPENSES (Unit 5) — the expense-sharing tour
  // ========================================================================
  // An equal 4-way split of CHF 48.00 with one settlement already recorded,
  // so the demo shows balances, a suggested transfer AND a payment history.
  const unit5MemberIds = [fatima.id, yasmin.id, amira.id, sara.id]
  const groceries = await dbClient.transaction(async (tx) => {
    const [created] = await tx
      .insert(expense)
      .values({
        housingUnitId: unit5.id,
        paidById: fatima.id,
        createdById: fatima.id,
        description: 'Wocheneinkauf Migros',
        category: 'GROCERIES',
        amountRappen: 4800,
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      })
      .returning()
    await tx.insert(expenseShare).values(
      unit5MemberIds.map((residentId) => ({
        expenseId: created.id,
        residentId,
        amountRappen: 1200,
      })),
    )
    return created
  })
  await dbClient.transaction(async (tx) => {
    const [created] = await tx
      .insert(expense)
      .values({
        housingUnitId: unit5.id,
        paidById: yasmin.id,
        createdById: yasmin.id,
        description: 'Putzmittel und WC-Papier',
        category: 'HOUSEHOLD',
        amountRappen: 1860,
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      })
      .returning()
    await tx.insert(expenseShare).values(
      unit5MemberIds.map((residentId) => ({
        expenseId: created.id,
        residentId,
        amountRappen: 465,
      })),
    )
  })
  await dbClient.insert(settlement).values({
    housingUnitId: unit5.id,
    fromId: sara.id,
    toId: fatima.id,
    amountRappen: 1200,
    note: `Anteil ${groceries.description}`,
  })

  // ========================================================================
  // LIVING TOGETHER (Unit 5) — chores, decisions and maintenance
  // ========================================================================
  await seedDemoGovernance(dbClient, {
    siteWideContent: options.siteWideContent ?? false,
    unitId: unit5.id,
    demoResidentId: fatima.id,
    roommateIds: [yasmin.id, amira.id, sara.id],
  })

  // ========================================================================
  // INTEGRATION — language, qualification and volunteering evidence
  // ========================================================================
  // Every demo resident, not just unit 5: the learning boards are org-wide,
  // and a board holding four people out of fifteen looks like a filter bug.
  // Ids are queried by prefix rather than threaded through this function, so
  // adding a resident above needs no change here.
  const demoResidents = await dbClient.query.resident.findMany({
    where: or(
      like(resident.code, `${escapeLike(DEMO_RESIDENT_CODE_PREFIX)}%`),
      eq(resident.code, demoResidentCode),
    ),
    columns: { id: true },
  })
  const integration = await seedIntegrationEvidence(dbClient, {
    residentIds: demoResidents.map((resident) => resident.id),
    staffId: options.careStaffId ?? null,
  })

  // Counts are queried, not hardcoded, so the summary can never drift from
  // the data above (ground truth #2: one source of truth). Scoped to the
  // demo prefixes: under UNIT scope this database also holds real data.
  const demoUnitFilter = like(housingUnit.code, `${escapeLike(DEMO_UNIT_CODE_PREFIX)}%`)
  const demoUnitIds = dbClient
    .select({ id: housingUnit.id })
    .from(housingUnit)
    .where(demoUnitFilter)
  const [residents, housingUnits, placements, incidents] = await Promise.all([
    dbClient.$count(
      resident,
      or(
        like(resident.code, `${escapeLike(DEMO_RESIDENT_CODE_PREFIX)}%`),
        eq(resident.code, demoResidentCode),
      ),
    ),
    dbClient.$count(housingUnit, demoUnitFilter),
    dbClient.$count(placement, inArray(placement.housingUnitId, demoUnitIds)),
    dbClient.$count(incident, inArray(incident.housingUnitId, demoUnitIds)),
  ])

  return {
    residents,
    housingUnits,
    placements,
    incidents,
    demoResidentCode,
    learningRecords: integration.records,
    careAssignments: integration.careAssignments,
    appointments: integration.appointments,
  }
}
