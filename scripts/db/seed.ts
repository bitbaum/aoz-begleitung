/**
 * Seed script for AOZ Housing
 *
 * Run with: pnpm run db:seed
 */

import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { and, asc, eq } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import {
  db,
  algorithmWeight,
  compatibilityAssessment,
  householdTask,
  houseRule,
  housingUnit,
  incident,
  incidentFollowUp,
  incidentInvolvement,
  maintenanceRequest,
  opportunity,
  opportunityApplication,
  placement,
  placementSpot,
  proposal as proposalTable,
  resident,
  satisfactionCheckIn,
  systemConfig,
  taskAttentionFlag,
  taskCompletion,
  taskRequest,
  transferRequest,
  user,
  vote,
} from '@/lib/db'
import { calculateScore } from './scoring-helper'
import { syncOrgRules } from '@/lib/governance/sync-org-rules'
import { seedIntegrationEvidence } from '@/lib/seed/integration-evidence'
import { seedOpportunities } from '@/lib/seed/opportunities'
import { BRAND } from '@/lib/config/brand'

/** Insert one row and return it — the seed's replacement for `prisma.x.create`. */
async function createRow<T extends PgTable>(
  table: T,
  data: InferInsertModel<T>,
): Promise<InferSelectModel<T>> {
  const rows = await db
    .insert(table)
    .values(data as never)
    .returning()
  return rows[0] as InferSelectModel<T>
}

async function main() {
  console.log('🌱 Seeding database...')

  // Clean existing data (order matters: FK constraints)
  // Applications hold a Restrict on Opportunity, so they go first — and both
  // go before residents, whose delete would otherwise be vetoed.
  await db.delete(opportunityApplication)
  await db.delete(opportunity)
  await db.delete(taskRequest)
  await db.delete(taskAttentionFlag)
  await db.delete(taskCompletion)
  await db.delete(householdTask)
  await db.delete(maintenanceRequest)
  await db.delete(incidentFollowUp)
  await db.delete(satisfactionCheckIn)
  await db.delete(incidentInvolvement)
  await db.delete(incident)
  await db.delete(transferRequest)
  await db.delete(compatibilityAssessment)
  await db.delete(placement)
  await db.delete(placementSpot)
  await db.delete(resident)
  await db.delete(housingUnit)
  await db.delete(algorithmWeight)

  // Create algorithm weights
  await createRow(algorithmWeight, {
    lifestyleWeight: 30,
    socialWeight: 25,
    practicalWeight: 25,
    riskWeight: 20,
    factorWeights: {
      sleep: 40,
      noise: 30,
      cleanliness: 30,
      socialStyle: 35,
      language: 40,
      privacy: 25,
      smoking: 40,
      sharedSpaces: 30,
      pets: 15,
      dietary: 15,
    },
    active: true,
    notes: 'Initial weights',
  })

  // Create housing units
  const units = await Promise.all([
    createRow(housingUnit, {
      code: 'ZH-001',
      address: 'Langstrasse 42, 8004 Zürich',
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
      notes: 'Zentrale Lage, gute ÖV-Anbindung',
    }),
    createRow(housingUnit, {
      code: 'ZH-002',
      address: 'Badenerstrasse 120, 8004 Zürich',
      totalBeds: 6,
      totalRooms: 3,
      sharedRooms: 2,
      privateRooms: 1,
      sharedBathrooms: 2,
      privateBathrooms: 0,
      sharedKitchen: true,
      privateKitchen: false,
      groundFloor: true,
      wheelchairAccess: true,
      elevator: false,
      smokingAllowed: false,
      petsAllowed: true,
      quietHours: '22:00-07:00',
      nearPublicTransport: true,
      nearHealthServices: false,
      nearSchools: true,
      status: 'AVAILABLE',
      notes: 'Erdgeschoss, barrierefrei',
    }),
    createRow(housingUnit, {
      code: 'ZH-003',
      address: 'Seestrasse 55, 8002 Zürich',
      totalBeds: 3,
      totalRooms: 3,
      sharedRooms: 0,
      privateRooms: 3,
      sharedBathrooms: 1,
      privateBathrooms: 0,
      sharedKitchen: true,
      privateKitchen: false,
      groundFloor: false,
      wheelchairAccess: false,
      elevator: true,
      smokingAllowed: false,
      petsAllowed: false,
      quietHours: '21:00-08:00',
      nearPublicTransport: true,
      nearHealthServices: true,
      nearSchools: false,
      status: 'AVAILABLE',
      notes: 'Ruhige Lage am See, alle Einzelzimmer',
    }),
    createRow(housingUnit, {
      code: 'ZH-004',
      address: 'Hardstrasse 88, 8005 Zürich',
      totalBeds: 8,
      totalRooms: 4,
      sharedRooms: 4,
      privateRooms: 0,
      sharedBathrooms: 2,
      privateBathrooms: 0,
      sharedKitchen: true,
      privateKitchen: false,
      groundFloor: false,
      wheelchairAccess: false,
      elevator: false,
      smokingAllowed: true,
      petsAllowed: false,
      quietHours: '23:00-06:00',
      nearPublicTransport: true,
      nearHealthServices: false,
      nearSchools: false,
      status: 'AVAILABLE',
      notes: 'Grössere Unterkunft, Rauchen auf Balkon erlaubt',
    }),
    createRow(housingUnit, {
      code: 'ZH-005',
      address: 'Militärstrasse 30, 8004 Zürich',
      totalBeds: 2,
      totalRooms: 1,
      sharedRooms: 1,
      privateRooms: 0,
      sharedBathrooms: 1,
      privateBathrooms: 0,
      sharedKitchen: true,
      privateKitchen: false,
      groundFloor: true,
      wheelchairAccess: false,
      elevator: false,
      smokingAllowed: false,
      petsAllowed: false,
      quietHours: '22:00-07:00',
      nearPublicTransport: true,
      nearHealthServices: false,
      nearSchools: true,
      status: 'MAINTENANCE',
      notes: 'Kleine Einheit, derzeit Renovation',
    }),
    createRow(housingUnit, {
      code: 'ZH-006',
      address: 'Birmensdorferstrasse 65, 8004 Zürich',
      totalBeds: 6,
      totalRooms: 3,
      sharedRooms: 3,
      privateRooms: 0,
      sharedBathrooms: 2,
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
      nearHealthServices: false,
      nearSchools: true,
      status: 'AVAILABLE',
      notes: 'Grosse gemischte Unterkunft, gute Lage',
    }),
    createRow(housingUnit, {
      code: 'ZH-007',
      address: 'Hohlstrasse 192, 8004 Zürich',
      totalBeds: 4,
      totalRooms: 3,
      sharedRooms: 2,
      privateRooms: 0,
      sharedBathrooms: 1,
      privateBathrooms: 1,
      sharedKitchen: true,
      privateKitchen: true,
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
      notes: 'Studio-Option für besondere Bedürfnisse',
    }),
    createRow(housingUnit, {
      code: 'ZH-008',
      address: 'Josefstrasse 28, 8005 Zürich',
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
      quietHours: '21:00-08:00',
      nearPublicTransport: true,
      nearHealthServices: true,
      nearSchools: false,
      status: 'AVAILABLE',
      notes: 'Barrierefrei, Erdgeschoss, alle Einzelzimmer, medizintauglich',
    }),
  ])

  console.log(`✅ Created ${units.length} housing units`)

  // Create placement spots for each unit
  // ZH-001: 2 rooms, 4 beds total (2 beds per room)
  const zh001Room1 = await createRow(placementSpot, {
    housingUnitId: units[0].id,
    code: 'R1',
    label: 'Zimmer 1',
    type: 'ROOM',
    squareMeters: 12,
    floor: 2,
    capacity: 2,
    status: 'AVAILABLE',
  })
  const zh001Room2 = await createRow(placementSpot, {
    housingUnitId: units[0].id,
    code: 'R2',
    label: 'Zimmer 2',
    type: 'ROOM',
    squareMeters: 10,
    floor: 2,
    capacity: 2,
    status: 'AVAILABLE',
  })
  const zh001Beds = await Promise.all([
    createRow(placementSpot, {
      housingUnitId: units[0].id,
      code: 'R1-B1',
      label: 'Bett A',
      type: 'BED',
      parentSpotId: zh001Room1.id,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[0].id,
      code: 'R1-B2',
      label: 'Bett B',
      type: 'BED',
      parentSpotId: zh001Room1.id,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[0].id,
      code: 'R2-B1',
      label: 'Bett A',
      type: 'BED',
      parentSpotId: zh001Room2.id,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[0].id,
      code: 'R2-B2',
      label: 'Bett B',
      type: 'BED',
      parentSpotId: zh001Room2.id,
      status: 'AVAILABLE',
    }),
  ])

  // ZH-002: 3 rooms - 2 shared (2 beds each) + 1 private room (medical)
  const zh002Room1 = await createRow(placementSpot, {
    housingUnitId: units[1].id,
    code: 'R1',
    label: 'Zimmer 1',
    type: 'ROOM',
    squareMeters: 14,
    floor: 0,
    capacity: 2,
    status: 'AVAILABLE',
  })
  const zh002Room2 = await createRow(placementSpot, {
    housingUnitId: units[1].id,
    code: 'R2',
    label: 'Zimmer 2',
    type: 'ROOM',
    squareMeters: 12,
    floor: 0,
    capacity: 2,
    status: 'AVAILABLE',
  })
  const zh002PrivateRoom = await createRow(placementSpot, {
    housingUnitId: units[1].id,
    code: 'R3',
    label: 'Einzelzimmer',
    type: 'PRIVATE_ROOM',
    squareMeters: 10,
    floor: 0,
    capacity: 1,
    requiresMedicalDocs: true,
    status: 'AVAILABLE',
  })
  const zh002Beds = await Promise.all([
    createRow(placementSpot, {
      housingUnitId: units[1].id,
      code: 'R1-B1',
      label: 'Bett A',
      type: 'BED',
      parentSpotId: zh002Room1.id,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[1].id,
      code: 'R1-B2',
      label: 'Bett B',
      type: 'BED',
      parentSpotId: zh002Room1.id,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[1].id,
      code: 'R2-B1',
      label: 'Bett A',
      type: 'BED',
      parentSpotId: zh002Room2.id,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[1].id,
      code: 'R2-B2',
      label: 'Bett B',
      type: 'BED',
      parentSpotId: zh002Room2.id,
      status: 'AVAILABLE',
    }),
  ])

  // ZH-003: 3 private rooms (all medical)
  const zh003Rooms = await Promise.all([
    createRow(placementSpot, {
      housingUnitId: units[2].id,
      code: 'R1',
      label: 'Einzelzimmer 1',
      type: 'PRIVATE_ROOM',
      squareMeters: 12,
      floor: 3,
      capacity: 1,
      requiresMedicalDocs: true,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[2].id,
      code: 'R2',
      label: 'Einzelzimmer 2',
      type: 'PRIVATE_ROOM',
      squareMeters: 10,
      floor: 3,
      capacity: 1,
      requiresMedicalDocs: true,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[2].id,
      code: 'R3',
      label: 'Einzelzimmer 3',
      type: 'PRIVATE_ROOM',
      squareMeters: 11,
      floor: 3,
      capacity: 1,
      requiresMedicalDocs: true,
      status: 'AVAILABLE',
    }),
  ])

  // ZH-004: 4 rooms, 8 beds total (2 beds per room)
  const zh004Rooms = await Promise.all([
    createRow(placementSpot, {
      housingUnitId: units[3].id,
      code: 'R1',
      label: 'Zimmer 1',
      type: 'ROOM',
      squareMeters: 10,
      floor: 1,
      capacity: 2,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[3].id,
      code: 'R2',
      label: 'Zimmer 2',
      type: 'ROOM',
      squareMeters: 10,
      floor: 1,
      capacity: 2,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[3].id,
      code: 'R3',
      label: 'Zimmer 3',
      type: 'ROOM',
      squareMeters: 12,
      floor: 2,
      capacity: 2,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[3].id,
      code: 'R4',
      label: 'Zimmer 4',
      type: 'ROOM',
      squareMeters: 12,
      floor: 2,
      capacity: 2,
      status: 'AVAILABLE',
    }),
  ])
  const zh004Beds = await Promise.all(
    zh004Rooms.flatMap((room, idx) => [
      createRow(placementSpot, {
        housingUnitId: units[3].id,
        code: `R${idx + 1}-B1`,
        label: 'Bett A',
        type: 'BED',
        parentSpotId: room.id,
        status: 'AVAILABLE',
      }),
      createRow(placementSpot, {
        housingUnitId: units[3].id,
        code: `R${idx + 1}-B2`,
        label: 'Bett B',
        type: 'BED',
        parentSpotId: room.id,
        status: 'AVAILABLE',
      }),
    ]),
  )

  // ZH-005: 1 room, 2 beds (in maintenance)
  const zh005Room = await createRow(placementSpot, {
    housingUnitId: units[4].id,
    code: 'R1',
    label: 'Zimmer 1',
    type: 'ROOM',
    squareMeters: 10,
    floor: 0,
    capacity: 2,
    status: 'MAINTENANCE',
  })
  const zh005Beds = await Promise.all([
    createRow(placementSpot, {
      housingUnitId: units[4].id,
      code: 'R1-B1',
      label: 'Bett A',
      type: 'BED',
      parentSpotId: zh005Room.id,
      status: 'MAINTENANCE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[4].id,
      code: 'R1-B2',
      label: 'Bett B',
      type: 'BED',
      parentSpotId: zh005Room.id,
      status: 'MAINTENANCE',
    }),
  ])

  // ZH-006: 3 rooms, 6 beds (2 beds per room)
  const zh006Rooms = await Promise.all([
    createRow(placementSpot, {
      housingUnitId: units[5].id,
      code: 'R1',
      label: 'Zimmer 1',
      type: 'ROOM',
      squareMeters: 12,
      floor: 1,
      capacity: 2,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[5].id,
      code: 'R2',
      label: 'Zimmer 2',
      type: 'ROOM',
      squareMeters: 11,
      floor: 1,
      capacity: 2,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[5].id,
      code: 'R3',
      label: 'Zimmer 3',
      type: 'ROOM',
      squareMeters: 10,
      floor: 2,
      capacity: 2,
      status: 'AVAILABLE',
    }),
  ])
  const zh006Beds = await Promise.all(
    zh006Rooms.flatMap((room, idx) => [
      createRow(placementSpot, {
        housingUnitId: units[5].id,
        code: `R${idx + 1}-B1`,
        label: 'Bett A',
        type: 'BED',
        parentSpotId: room.id,
        status: 'AVAILABLE',
      }),
      createRow(placementSpot, {
        housingUnitId: units[5].id,
        code: `R${idx + 1}-B2`,
        label: 'Bett B',
        type: 'BED',
        parentSpotId: room.id,
        status: 'AVAILABLE',
      }),
    ]),
  )

  // ZH-007: 2 rooms (2 beds, 1 bed) + 1 studio
  const zh007Room1 = await createRow(placementSpot, {
    housingUnitId: units[6].id,
    code: 'R1',
    label: 'Zimmer 1',
    type: 'ROOM',
    squareMeters: 14,
    floor: 1,
    capacity: 2,
    status: 'AVAILABLE',
  })
  const zh007Room2 = await createRow(placementSpot, {
    housingUnitId: units[6].id,
    code: 'R2',
    label: 'Zimmer 2',
    type: 'ROOM',
    squareMeters: 10,
    floor: 1,
    capacity: 1,
    status: 'AVAILABLE',
  })
  const zh007Studio = await createRow(placementSpot, {
    housingUnitId: units[6].id,
    code: 'STUDIO-A',
    label: 'Studio',
    type: 'STUDIO',
    squareMeters: 18,
    floor: 2,
    capacity: 1,
    hasPrivateBathroom: true,
    hasPrivateKitchen: true,
    requiresMedicalDocs: true,
    status: 'AVAILABLE',
  })
  const zh007Beds = await Promise.all([
    createRow(placementSpot, {
      housingUnitId: units[6].id,
      code: 'R1-B1',
      label: 'Bett A',
      type: 'BED',
      parentSpotId: zh007Room1.id,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[6].id,
      code: 'R1-B2',
      label: 'Bett B',
      type: 'BED',
      parentSpotId: zh007Room1.id,
      status: 'AVAILABLE',
    }),
  ])

  // ZH-008: 3 private rooms, ground floor (accessible, medical-eligible)
  const zh008Rooms = await Promise.all([
    createRow(placementSpot, {
      housingUnitId: units[7].id,
      code: 'R1',
      label: 'Einzelzimmer 1',
      type: 'PRIVATE_ROOM',
      squareMeters: 14,
      floor: 0,
      capacity: 1,
      requiresMedicalDocs: true,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[7].id,
      code: 'R2',
      label: 'Einzelzimmer 2',
      type: 'PRIVATE_ROOM',
      squareMeters: 12,
      floor: 0,
      capacity: 1,
      requiresMedicalDocs: true,
      status: 'AVAILABLE',
    }),
    createRow(placementSpot, {
      housingUnitId: units[7].id,
      code: 'R3',
      label: 'Einzelzimmer 3',
      type: 'PRIVATE_ROOM',
      squareMeters: 12,
      floor: 0,
      capacity: 1,
      requiresMedicalDocs: true,
      status: 'AVAILABLE',
    }),
  ])

  // Collect all spots for later use
  const allSpots = {
    zh001: { rooms: [zh001Room1, zh001Room2], beds: zh001Beds },
    zh002: { rooms: [zh002Room1, zh002Room2], privateRoom: zh002PrivateRoom, beds: zh002Beds },
    zh003: { rooms: zh003Rooms },
    zh004: { rooms: zh004Rooms, beds: zh004Beds },
    zh005: { room: zh005Room, beds: zh005Beds },
    zh006: { rooms: zh006Rooms, beds: zh006Beds },
    zh007: { rooms: [zh007Room1, zh007Room2], studio: zh007Studio, beds: zh007Beds },
    zh008: { rooms: zh008Rooms },
  }

  console.log(`✅ Created placement spots for ${units.length} units`)

  // Create residents
  const residents = await Promise.all([
    // Placed residents
    createRow(resident, {
      code: 'RES-001',
      ageRange: 'YOUNG_ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 3,
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4,
      socialStyle: 'MODERATE',
      languages: ['ar', 'en'],
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
      notes: 'Studiert Informatik an der ETH',
    }),
    createRow(resident, {
      code: 'RES-002',
      ageRange: 'ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'NIGHT_OWL',
      noiseTolerance: 4,
      cleanlinessPractice: 3,
      cleanlinessExpectation: 3,
      chaosTolerance: 6 - 3,
      socialStyle: 'EXTROVERTED',
      languages: ['ar', 'fr'],
      smokingStatus: 'OUTDOOR_SMOKER',
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
      notes: 'Arbeitet als Koch, Spätschicht',
    }),
    createRow(resident, {
      code: 'RES-003',
      ageRange: 'ADULT',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'EARLY_BIRD',
      noiseTolerance: 2,
      cleanlinessPractice: 5,
      cleanlinessExpectation: 5,
      chaosTolerance: 6 - 5,
      socialStyle: 'INTROVERTED',
      languages: ['uk', 'ru', 'en'],
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
      notes: 'Ärztin, wartet auf Anerkennung',
      // Medical docs for private room eligibility
      hasMedicalDocumentation: true,
      medicalDocType: 'PRIVATE_ROOM',
      medicalDocDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      medicalDocNotes: 'Benötigt Einzelzimmer aufgrund erhöhtem Privatsphärebedürfnis',
    }),
    createRow(resident, {
      code: 'RES-004',
      ageRange: 'MIDDLE_AGED',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 3,
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4,
      socialStyle: 'MODERATE',
      languages: ['ti', 'en'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: [],
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
      notes: 'Gelernter Elektriker',
    }),
    createRow(resident, {
      code: 'RES-005',
      ageRange: 'YOUNG_ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 4,
      cleanlinessPractice: 3,
      cleanlinessExpectation: 3,
      chaosTolerance: 6 - 3,
      socialStyle: 'EXTROVERTED',
      languages: ['fa', 'en'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 2,
      choresContribution: 3,
      recyclingKnowledge: 'NONE',
      roomSharingStatus: 'PREFERS_PRIVATE',
      hasNightDisturbances: true,
      needsQuietEnvironment: true,
      hasSleepEquipment: false,
      supportLevel: 'ELEVATED',
      status: 'PLACED',
      notes: 'Macht Deutschkurs B1',
      // Medical docs for private room eligibility (in ZH-003)
      hasMedicalDocumentation: true,
      medicalDocType: 'BOTH',
      medicalDocDate: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      medicalDocNotes: 'Psychologische Empfehlung für ruhige Umgebung',
    }),
    createRow(resident, {
      code: 'RES-006',
      ageRange: 'SENIOR',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'EARLY_BIRD',
      noiseTolerance: 1,
      cleanlinessPractice: 5,
      cleanlinessExpectation: 5,
      chaosTolerance: 6 - 5,
      socialStyle: 'INTROVERTED',
      languages: ['tr', 'de'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: [],
      mobilityNeeds: 'GROUND_FLOOR',
      medicalEquipment: true,
      petTolerance: false,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 5,
      choresContribution: 2,
      recyclingKnowledge: 'GOOD',
      roomSharingStatus: 'PREFERS_PRIVATE',
      hasNightDisturbances: false,
      needsQuietEnvironment: true,
      hasSleepEquipment: true,
      supportLevel: 'ELEVATED',
      status: 'PLACED',
      notes: 'Pensioniert, braucht CPAP-Gerät nachts',
    }),
    createRow(resident, {
      code: 'RES-007',
      ageRange: 'ADULT',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 3,
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4,
      socialStyle: 'MODERATE',
      languages: ['so', 'ar', 'en'],
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
      roomSharingStatus: 'NEEDS_PRIVATE',
      hasNightDisturbances: false,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'PLACED',
      notes: 'Arbeitet Teilzeit im Reinigungsbereich',
      // Medical docs for private room eligibility (in ZH-003)
      hasMedicalDocumentation: true,
      medicalDocType: 'PRIVATE_ROOM',
      medicalDocDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      medicalDocNotes: 'Ärztliches Attest für Einzelzimmer',
    }),
    // Unplaced residents (waiting for placement)
    createRow(resident, {
      code: 'RES-008',
      ageRange: 'YOUNG_ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'NIGHT_OWL',
      noiseTolerance: 5,
      cleanlinessPractice: 2,
      cleanlinessExpectation: 2,
      chaosTolerance: 6 - 2,
      socialStyle: 'EXTROVERTED',
      languages: ['ps', 'fa'],
      smokingStatus: 'INDOOR_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 1,
      choresContribution: 2,
      recyclingKnowledge: 'NONE',
      roomSharingStatus: 'CAN_SHARE',
      hasNightDisturbances: false,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'ACTIVE',
      notes: 'Neu angekommen, braucht Raucherunterkunft',
    }),
    createRow(resident, {
      code: 'RES-009',
      ageRange: 'ADULT',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 2,
      cleanlinessPractice: 5,
      cleanlinessExpectation: 5,
      chaosTolerance: 6 - 5,
      socialStyle: 'INTROVERTED',
      languages: ['uk', 'en'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: ['vegetarian'],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 5,
      choresContribution: 5,
      recyclingKnowledge: 'GOOD',
      roomSharingStatus: 'PREFERS_PRIVATE',
      hasNightDisturbances: false,
      needsQuietEnvironment: true,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'ACTIVE',
      notes: 'IT-Fachfrau, sucht ruhige Unterkunft',
    }),
    createRow(resident, {
      code: 'RES-010',
      ageRange: 'MIDDLE_AGED',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'IRREGULAR',
      noiseTolerance: 3,
      cleanlinessPractice: 3,
      cleanlinessExpectation: 3,
      chaosTolerance: 6 - 3,
      socialStyle: 'MODERATE',
      languages: ['ar', 'en', 'de'],
      smokingStatus: 'OUTDOOR_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
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
      status: 'ACTIVE',
      notes: 'Taxifahrer, unregelmässige Arbeitszeiten',
    }),
    // --- New residents (RES-011 to RES-025) ---
    // RES-011: Hard-to-place — night owl, indoor smoker
    createRow(resident, {
      code: 'RES-011',
      ageRange: 'YOUNG_ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'NIGHT_OWL',
      noiseTolerance: 4,
      cleanlinessPractice: 2,
      cleanlinessExpectation: 2,
      chaosTolerance: 6 - 2,
      socialStyle: 'MODERATE',
      languages: ['ps', 'fa'],
      smokingStatus: 'INDOOR_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
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
      supportLevel: 'STANDARD',
      status: 'ACTIVE',
      notes: 'Raucht viel, schwer zu platzieren',
    }),
    // RES-012: Easy-to-place — clean, quiet, cooperative
    createRow(resident, {
      code: 'RES-012',
      ageRange: 'ADULT',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'EARLY_BIRD',
      noiseTolerance: 2,
      cleanlinessPractice: 5,
      cleanlinessExpectation: 5,
      chaosTolerance: 6 - 5,
      socialStyle: 'MODERATE',
      languages: ['ti', 'en'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: [],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 3,
      choresContribution: 5,
      recyclingKnowledge: 'GOOD',
      roomSharingStatus: 'CAN_SHARE',
      hasNightDisturbances: false,
      needsQuietEnvironment: true,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'ACTIVE',
      notes: 'Ordentlich, kooperativ, leicht zu platzieren',
    }),
    // RES-013: Accessibility needs — senior, ground floor, medical equipment
    createRow(resident, {
      code: 'RES-013',
      ageRange: 'SENIOR',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'EARLY_BIRD',
      noiseTolerance: 2,
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4,
      socialStyle: 'INTROVERTED',
      languages: ['ar'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      mobilityNeeds: 'GROUND_FLOOR',
      medicalEquipment: true,
      petTolerance: false,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 4,
      choresContribution: 2,
      recyclingKnowledge: 'NONE',
      roomSharingStatus: 'PREFERS_PRIVATE',
      hasNightDisturbances: false,
      needsQuietEnvironment: true,
      hasSleepEquipment: true,
      supportLevel: 'ELEVATED',
      status: 'ACTIVE',
      notes: 'Benötigt Erdgeschoss und Platz für medizinische Geräte',
      hasMedicalDocumentation: true,
      medicalDocType: 'BOTH',
      medicalDocDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      medicalDocNotes: 'Ärztliche Empfehlung für Erdgeschoss und Einzelzimmer',
    }),
    // RES-014: Good match in ZH-004 — extroverted, standard
    createRow(resident, {
      code: 'RES-014',
      ageRange: 'YOUNG_ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 4,
      cleanlinessPractice: 3,
      cleanlinessExpectation: 3,
      chaosTolerance: 6 - 3,
      socialStyle: 'EXTROVERTED',
      languages: ['es', 'en'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: [],
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
      notes: 'Fussballfan, sucht Anschluss',
    }),
    // RES-015: Good match pair with RES-014 in ZH-004
    createRow(resident, {
      code: 'RES-015',
      ageRange: 'ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 3,
      cleanlinessPractice: 3,
      cleanlinessExpectation: 3,
      chaosTolerance: 6 - 3,
      socialStyle: 'MODERATE',
      languages: ['fr', 'sw', 'en'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: [],
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
      notes: 'Gelernter Mechaniker, spricht drei Sprachen',
    }),
    // RES-016: Tension pair with RES-017 — night owl, introverted
    createRow(resident, {
      code: 'RES-016',
      ageRange: 'ADULT',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'NIGHT_OWL',
      noiseTolerance: 2,
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4,
      socialStyle: 'INTROVERTED',
      languages: ['fa', 'en'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: false,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 5,
      choresContribution: 4,
      recyclingKnowledge: 'BASIC',
      roomSharingStatus: 'PREFERS_PRIVATE',
      hasNightDisturbances: false,
      needsQuietEnvironment: true,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'PLACED',
      notes: 'Studiert abends, braucht Ruhe',
    }),
    // RES-017: Tension pair with RES-016 — early bird, extroverted
    createRow(resident, {
      code: 'RES-017',
      ageRange: 'ADULT',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'EARLY_BIRD',
      noiseTolerance: 4,
      cleanlinessPractice: 3,
      cleanlinessExpectation: 3,
      chaosTolerance: 6 - 3,
      socialStyle: 'EXTROVERTED',
      languages: ['am', 'en'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: [],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 2,
      choresContribution: 3,
      recyclingKnowledge: 'NONE',
      roomSharingStatus: 'CAN_SHARE',
      hasNightDisturbances: false,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'PLACED',
      notes: 'Gesellig, kocht gerne für andere',
    }),
    // RES-018: Stable in ZH-004
    createRow(resident, {
      code: 'RES-018',
      ageRange: 'YOUNG_ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 3,
      cleanlinessPractice: 3,
      cleanlinessExpectation: 3,
      chaosTolerance: 6 - 3,
      socialStyle: 'MODERATE',
      languages: ['so', 'ar'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
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
      notes: 'Besucht Integrationskurs',
    }),
    // RES-019: Stable in ZH-004 — speaks German, helps others
    createRow(resident, {
      code: 'RES-019',
      ageRange: 'MIDDLE_AGED',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 3,
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4,
      socialStyle: 'MODERATE',
      languages: ['tr', 'de'],
      smokingStatus: 'OUTDOOR_SMOKER',
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
      notes: 'Spricht gut Deutsch, hilft anderen Bewohnern',
    }),
    // RES-020: Failed placement → transfer story
    createRow(resident, {
      code: 'RES-020',
      ageRange: 'ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'NIGHT_OWL',
      noiseTolerance: 4,
      cleanlinessPractice: 2,
      cleanlinessExpectation: 2,
      chaosTolerance: 6 - 2,
      socialStyle: 'EXTROVERTED',
      languages: ['ar', 'en'],
      smokingStatus: 'OUTDOOR_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 1,
      choresContribution: 2,
      recyclingKnowledge: 'NONE',
      roomSharingStatus: 'CAN_SHARE',
      hasNightDisturbances: true,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'ELEVATED',
      status: 'TRANSFERRED',
      notes: 'Versetzt nach Konflikten in ZH-004',
    }),
    // RES-021: Recently arrived, waiting
    createRow(resident, {
      code: 'RES-021',
      ageRange: 'YOUNG_ADULT',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 3,
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4,
      socialStyle: 'MODERATE',
      languages: ['es', 'en'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: [],
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
      status: 'ACTIVE',
      notes: 'Vor kurzem angekommen, wartet auf Platzierung',
    }),
    // RES-022: Success story in ZH-001
    createRow(resident, {
      code: 'RES-022',
      ageRange: 'ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'EARLY_BIRD',
      noiseTolerance: 3,
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4,
      socialStyle: 'MODERATE',
      languages: ['ti', 'en', 'ar'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: [],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 3,
      choresContribution: 5,
      recyclingKnowledge: 'GOOD',
      roomSharingStatus: 'CAN_SHARE',
      hasNightDisturbances: false,
      needsQuietEnvironment: false,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      conflictStyle: 'COOPERATIVE',
      status: 'PLACED',
      notes: 'Zuverlässig, hilft bei Haushaltsaufgaben',
    }),
    // RES-023: Complex needs, waiting
    createRow(resident, {
      code: 'RES-023',
      ageRange: 'MIDDLE_AGED',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 2,
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4,
      socialStyle: 'INTROVERTED',
      languages: ['fa', 'ps'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: ['SEPARATE_COOKWARE'],
      mobilityNeeds: 'NONE',
      medicalEquipment: false,
      petTolerance: false,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 4,
      choresContribution: 3,
      recyclingKnowledge: 'NONE',
      roomSharingStatus: 'PREFERS_PRIVATE',
      hasNightDisturbances: true,
      needsQuietEnvironment: true,
      hasSleepEquipment: false,
      supportLevel: 'ELEVATED',
      status: 'ACTIVE',
      notes: 'Erhöhter Betreuungsbedarf, braucht ruhige Umgebung',
    }),
    // RES-024: Transferred into better match (was ZH-001 → now ZH-006)
    createRow(resident, {
      code: 'RES-024',
      ageRange: 'YOUNG_ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      noiseTolerance: 4,
      cleanlinessPractice: 3,
      cleanlinessExpectation: 3,
      chaosTolerance: 6 - 3,
      socialStyle: 'EXTROVERTED',
      languages: ['ar', 'en', 'de'],
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
      notes: 'Spricht drei Sprachen, Deutschkurs A2',
    }),
    // RES-025: Accessibility needs, waiting
    createRow(resident, {
      code: 'RES-025',
      ageRange: 'SENIOR',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'EARLY_BIRD',
      noiseTolerance: 2,
      cleanlinessPractice: 4,
      cleanlinessExpectation: 4,
      chaosTolerance: 6 - 4,
      socialStyle: 'MODERATE',
      languages: ['fr', 'sw'],
      smokingStatus: 'NON_SMOKER',
      dietaryNeeds: [],
      mobilityNeeds: 'GROUND_FLOOR',
      medicalEquipment: false,
      petTolerance: true,
      sharedBathroom: true,
      sharedKitchen: true,
      privacyNeed: 4,
      choresContribution: 3,
      recyclingKnowledge: 'NONE',
      roomSharingStatus: 'PREFERS_PRIVATE',
      hasNightDisturbances: false,
      needsQuietEnvironment: true,
      hasSleepEquipment: false,
      supportLevel: 'STANDARD',
      status: 'ACTIVE',
      notes: 'Benötigt Erdgeschoss, wartet auf passende Unterkunft',
    }),
  ])

  console.log(`✅ Created ${residents.length} residents`)

  // Integration evidence — language, qualification and volunteering records,
  // derived from each resident's own profile. Without it /learning renders
  // five zeroes and an empty list on a database holding 24 people, and the
  // dashboard's learning pulse reports nothing to every coaching role.
  //
  // Care seats go to whichever staff account this database already has (the
  // admin from scripts/db/seed-admin.ts); with none, evidence still seeds and the
  // seats stay empty rather than conjuring a colleague.
  const seedStaff = await db.query.user.findFirst({
    where: eq(user.active, true),
    columns: { id: true },
    orderBy: [asc(user.code)],
  })
  const integration = await seedIntegrationEvidence(db, {
    residentIds: residents.map((r) => r.id),
    staffId: seedStaff?.id ?? null,
  })
  console.log(
    `✅ Created ${integration.records} learning records, ` +
      `${integration.careAssignments} care assignments`,
  )

  const opportunities = await seedOpportunities(db, {
    residentIds: residents.map((r) => r.id),
    staffId: seedStaff?.id ?? null,
  })
  console.log(
    `✅ Created ${opportunities.opportunities} opportunities, ` +
      `${opportunities.applications} applications, ` +
      `${opportunities.evidenceRecords} generated records`,
  )

  // Create placements with CALCULATED compatibility scores
  const now = new Date()
  const DAY = 24 * 60 * 60 * 1000

  // Calculate real compatibility scores between roommates
  // ZH-001: RES-001 (index 0), RES-002 (index 1), RES-022 (index 21)
  const score_0_1 = calculateScore(residents[0], residents[1])
  const score_0_21 = calculateScore(residents[0], residents[21])
  const score_1_21 = calculateScore(residents[1], residents[21])
  console.log(`  📊 RES-001 + RES-002 compatibility: ${score_0_1.compatibilityScore}%`)
  console.log(`  📊 RES-001 + RES-022 compatibility: ${score_0_21.compatibilityScore}%`)

  // ZH-002: RES-003 (index 2) with RES-004 (index 3) and RES-006 (index 5)
  const score_2_3 = calculateScore(residents[2], residents[3])
  const score_2_5 = calculateScore(residents[2], residents[5])
  const score_3_5 = calculateScore(residents[3], residents[5])

  // ZH-003: RES-005 (index 4) and RES-007 (index 6)
  const score_4_6 = calculateScore(residents[4], residents[6])

  // ZH-004: RES-014 (13) + RES-015 (14), RES-018 (17) + RES-019 (18)
  const score_13_14 = calculateScore(residents[13], residents[14])
  const score_17_18 = calculateScore(residents[17], residents[18])
  console.log(`  📊 RES-014 + RES-015 compatibility: ${score_13_14.compatibilityScore}%`)
  console.log(`  📊 RES-018 + RES-019 compatibility: ${score_17_18.compatibilityScore}%`)

  // ZH-006: RES-016 (15) + RES-017 (16) — tension pair
  const score_15_16 = calculateScore(residents[15], residents[16])
  console.log(`  📊 RES-016 + RES-017 compatibility: ${score_15_16.compatibilityScore}%`)

  // Ended placement scores
  const score_19_17 = calculateScore(residents[19], residents[17]) // RES-020 was with RES-018 in ZH-004

  // =========================================================================
  // ACTIVE PLACEMENTS
  // =========================================================================

  const placements = await Promise.all([
    // ZH-001: RES-001 and RES-002 (some tension), RES-022 (success story)
    createRow(placement, {
      residentId: residents[0].id,
      housingUnitId: units[0].id,
      spotId: allSpots.zh001.beds[0].id, // R1-B1
      startDate: new Date(now.getTime() - 60 * DAY),
      compatibilityScore: score_0_1.compatibilityScore,
      lifestyleScore: score_0_1.lifestyleScore,
      socialScore: score_0_1.socialScore,
      practicalScore: score_0_1.practicalScore,
      riskScore: score_0_1.riskScore,
      status: 'ACTIVE',
      placementNotes:
        score_0_1.concerns.length > 0
          ? score_0_1.concerns.join('. ')
          : 'Kompatibilitätsprüfung durchgeführt',
    }),
    createRow(placement, {
      residentId: residents[1].id,
      housingUnitId: units[0].id,
      spotId: allSpots.zh001.beds[1].id, // R1-B2
      startDate: new Date(now.getTime() - 45 * DAY),
      compatibilityScore: score_0_1.compatibilityScore,
      lifestyleScore: score_0_1.lifestyleScore,
      socialScore: score_0_1.socialScore,
      practicalScore: score_0_1.practicalScore,
      riskScore: score_0_1.riskScore,
      status: 'ACTIVE',
      placementNotes:
        score_0_1.concerns.length > 0
          ? score_0_1.concerns.join('. ')
          : 'Kompatibilitätsprüfung durchgeführt',
    }),
    // [2] ZH-001 R2-B1: RES-022 (success story)
    createRow(placement, {
      residentId: residents[21].id,
      housingUnitId: units[0].id,
      spotId: allSpots.zh001.beds[2].id, // R2-B1
      startDate: new Date(now.getTime() - 25 * DAY),
      compatibilityScore: score_0_21.compatibilityScore,
      lifestyleScore: score_0_21.lifestyleScore,
      socialScore: score_0_21.socialScore,
      practicalScore: score_0_21.practicalScore,
      riskScore: score_0_21.riskScore,
      status: 'ACTIVE',
      placementNotes: 'Gute Kompatibilität mit bestehenden Bewohnern',
    }),
    // [3] ZH-002: RES-003 private room, [4] RES-004, [5] RES-006 shared rooms
    createRow(placement, {
      residentId: residents[2].id,
      housingUnitId: units[1].id,
      spotId: allSpots.zh002.privateRoom.id,
      startDate: new Date(now.getTime() - 90 * DAY),
      compatibilityScore: Math.round(
        (score_2_3.compatibilityScore + score_2_5.compatibilityScore) / 2,
      ),
      lifestyleScore: Math.round((score_2_3.lifestyleScore + score_2_5.lifestyleScore) / 2),
      socialScore: Math.round((score_2_3.socialScore + score_2_5.socialScore) / 2),
      practicalScore: Math.round((score_2_3.practicalScore + score_2_5.practicalScore) / 2),
      riskScore: Math.round((score_2_3.riskScore + score_2_5.riskScore) / 2),
      status: 'ACTIVE',
      placementNotes: 'Einzelzimmer wegen hohem Privatsphärebedürfnis (med. Dok.)',
    }),
    createRow(placement, {
      residentId: residents[3].id,
      housingUnitId: units[1].id,
      spotId: allSpots.zh002.beds[0].id,
      startDate: new Date(now.getTime() - 75 * DAY),
      compatibilityScore: score_3_5.compatibilityScore,
      lifestyleScore: score_3_5.lifestyleScore,
      socialScore: score_3_5.socialScore,
      practicalScore: score_3_5.practicalScore,
      riskScore: score_3_5.riskScore,
      status: 'ACTIVE',
      placementNotes:
        score_3_5.strengths.length > 0
          ? score_3_5.strengths.join('. ')
          : 'Kompatibilitätsprüfung durchgeführt',
    }),
    createRow(placement, {
      residentId: residents[5].id,
      housingUnitId: units[1].id,
      spotId: allSpots.zh002.beds[1].id,
      startDate: new Date(now.getTime() - 120 * DAY),
      compatibilityScore: score_3_5.compatibilityScore,
      lifestyleScore: score_3_5.lifestyleScore,
      socialScore: score_3_5.socialScore,
      practicalScore: score_3_5.practicalScore,
      riskScore: score_3_5.riskScore,
      status: 'ACTIVE',
      placementNotes: 'Erdgeschoss wegen Mobilität, CPAP-Gerät',
    }),
    // [6] ZH-003: RES-005, [7] RES-007 (private rooms)
    createRow(placement, {
      residentId: residents[4].id,
      housingUnitId: units[2].id,
      spotId: allSpots.zh003.rooms[0].id,
      startDate: new Date(now.getTime() - 30 * DAY),
      compatibilityScore: score_4_6.compatibilityScore,
      lifestyleScore: score_4_6.lifestyleScore,
      socialScore: score_4_6.socialScore,
      practicalScore: score_4_6.practicalScore,
      riskScore: score_4_6.riskScore,
      status: 'ACTIVE',
      placementNotes:
        score_4_6.strengths.length > 0
          ? score_4_6.strengths.join('. ')
          : 'Kompatibilitätsprüfung durchgeführt',
    }),
    createRow(placement, {
      residentId: residents[6].id,
      housingUnitId: units[2].id,
      spotId: allSpots.zh003.rooms[1].id,
      startDate: new Date(now.getTime() - 20 * DAY),
      compatibilityScore: score_4_6.compatibilityScore,
      lifestyleScore: score_4_6.lifestyleScore,
      socialScore: score_4_6.socialScore,
      practicalScore: score_4_6.practicalScore,
      riskScore: score_4_6.riskScore,
      status: 'ACTIVE',
      placementNotes:
        score_4_6.strengths.length > 0
          ? score_4_6.strengths.join('. ')
          : 'Kompatibilitätsprüfung durchgeführt',
    }),
    // [8] ZH-004: RES-014 + RES-015 (good match, R1)
    createRow(placement, {
      residentId: residents[13].id,
      housingUnitId: units[3].id,
      spotId: allSpots.zh004.beds[0].id, // R1-B1
      startDate: new Date(now.getTime() - 35 * DAY),
      compatibilityScore: score_13_14.compatibilityScore,
      lifestyleScore: score_13_14.lifestyleScore,
      socialScore: score_13_14.socialScore,
      practicalScore: score_13_14.practicalScore,
      riskScore: score_13_14.riskScore,
      status: 'ACTIVE',
      placementNotes: 'Gutes Match - ähnlicher Lebensstil',
    }),
    // [9]
    createRow(placement, {
      residentId: residents[14].id,
      housingUnitId: units[3].id,
      spotId: allSpots.zh004.beds[1].id, // R1-B2
      startDate: new Date(now.getTime() - 30 * DAY),
      compatibilityScore: score_13_14.compatibilityScore,
      lifestyleScore: score_13_14.lifestyleScore,
      socialScore: score_13_14.socialScore,
      practicalScore: score_13_14.practicalScore,
      riskScore: score_13_14.riskScore,
      status: 'ACTIVE',
      placementNotes: 'Gutes Match mit RES-014',
    }),
    // [10] ZH-004: RES-018 + RES-019 (stable, R3)
    createRow(placement, {
      residentId: residents[17].id,
      housingUnitId: units[3].id,
      spotId: allSpots.zh004.beds[4].id, // R3-B1
      startDate: new Date(now.getTime() - 50 * DAY),
      compatibilityScore: score_17_18.compatibilityScore,
      lifestyleScore: score_17_18.lifestyleScore,
      socialScore: score_17_18.socialScore,
      practicalScore: score_17_18.practicalScore,
      riskScore: score_17_18.riskScore,
      status: 'ACTIVE',
      placementNotes: 'Stabile Platzierung',
    }),
    // [11]
    createRow(placement, {
      residentId: residents[18].id,
      housingUnitId: units[3].id,
      spotId: allSpots.zh004.beds[5].id, // R3-B2
      startDate: new Date(now.getTime() - 45 * DAY),
      compatibilityScore: score_17_18.compatibilityScore,
      lifestyleScore: score_17_18.lifestyleScore,
      socialScore: score_17_18.socialScore,
      practicalScore: score_17_18.practicalScore,
      riskScore: score_17_18.riskScore,
      status: 'ACTIVE',
      placementNotes: 'Spricht Deutsch, hilft bei Verständigung',
    }),
    // [12] ZH-006: RES-016 + RES-017 (tension pair, R1)
    createRow(placement, {
      residentId: residents[15].id,
      housingUnitId: units[5].id,
      spotId: allSpots.zh006.beds[0].id, // R1-B1
      startDate: new Date(now.getTime() - 28 * DAY),
      compatibilityScore: score_15_16.compatibilityScore,
      lifestyleScore: score_15_16.lifestyleScore,
      socialScore: score_15_16.socialScore,
      practicalScore: score_15_16.practicalScore,
      riskScore: score_15_16.riskScore,
      status: 'ACTIVE',
      placementNotes:
        score_15_16.concerns.length > 0
          ? score_15_16.concerns.join('. ')
          : 'Spannungspotential erkannt',
    }),
    // [13]
    createRow(placement, {
      residentId: residents[16].id,
      housingUnitId: units[5].id,
      spotId: allSpots.zh006.beds[1].id, // R1-B2
      startDate: new Date(now.getTime() - 28 * DAY),
      compatibilityScore: score_15_16.compatibilityScore,
      lifestyleScore: score_15_16.lifestyleScore,
      socialScore: score_15_16.socialScore,
      practicalScore: score_15_16.practicalScore,
      riskScore: score_15_16.riskScore,
      status: 'ACTIVE',
      placementNotes:
        score_15_16.concerns.length > 0
          ? score_15_16.concerns.join('. ')
          : 'Spannungspotential erkannt',
    }),
    // [14] ZH-006: RES-024 (transferred here from ZH-001, R2)
    createRow(placement, {
      residentId: residents[23].id,
      housingUnitId: units[5].id,
      spotId: allSpots.zh006.beds[2].id, // R2-B1
      startDate: new Date(now.getTime() - 15 * DAY),
      compatibilityScore: 72,
      lifestyleScore: 78,
      socialScore: 70,
      practicalScore: 75,
      riskScore: 15,
      status: 'ACTIVE',
      placementNotes: 'Versetzung aus ZH-001 zu besserem Match',
    }),
  ])

  // =========================================================================
  // ENDED PLACEMENTS (transfer/conflict stories)
  // =========================================================================

  const endedPlacements = await Promise.all([
    // RES-020 was in ZH-004 for 40 days, ended with CONFLICT
    createRow(placement, {
      residentId: residents[19].id,
      housingUnitId: units[3].id,
      spotId: allSpots.zh004.beds[2].id, // R2-B1
      startDate: new Date(now.getTime() - 80 * DAY),
      endDate: new Date(now.getTime() - 40 * DAY),
      compatibilityScore: score_19_17.compatibilityScore,
      lifestyleScore: score_19_17.lifestyleScore,
      socialScore: score_19_17.socialScore,
      practicalScore: score_19_17.practicalScore,
      riskScore: score_19_17.riskScore,
      status: 'ENDED',
      endReason: 'CONFLICT',
      satisfactionRating: 2,
      placementNotes: 'Niedrige Kompatibilität, Nachteulen-Problematik',
      outcomeNotes: 'Mehrere Konflikte, Versetzung notwendig',
      conflictGap: 'NOISE',
      wasPredictable: true,
    }),
    // RES-024 was in ZH-001 for 20 days, ended with UPGRADE
    createRow(placement, {
      residentId: residents[23].id,
      housingUnitId: units[0].id,
      spotId: allSpots.zh001.beds[3].id, // R2-B2
      startDate: new Date(now.getTime() - 50 * DAY),
      endDate: new Date(now.getTime() - 15 * DAY),
      compatibilityScore: score_0_21.compatibilityScore,
      lifestyleScore: score_0_21.lifestyleScore,
      socialScore: score_0_21.socialScore,
      practicalScore: score_0_21.practicalScore,
      riskScore: score_0_21.riskScore,
      status: 'ENDED',
      endReason: 'UPGRADE',
      satisfactionRating: 3,
      placementNotes: 'Initiale Platzierung, besseres Match gefunden',
      outcomeNotes: 'Versetzt nach ZH-006 für bessere Kompatibilität',
    }),
    // RES-004 historical: was in ZH-004, natural exit before current placement
    createRow(placement, {
      residentId: residents[3].id,
      housingUnitId: units[3].id,
      spotId: allSpots.zh004.beds[6].id, // R4-B1
      startDate: new Date(now.getTime() - 200 * DAY),
      endDate: new Date(now.getTime() - 100 * DAY),
      compatibilityScore: 65,
      lifestyleScore: 70,
      socialScore: 60,
      practicalScore: 68,
      riskScore: 20,
      status: 'ENDED',
      endReason: 'NATURAL',
      satisfactionRating: 4,
      placementNotes: 'Erste Platzierung im System',
      outcomeNotes: 'Bewohner vorübergehend aus System ausgetreten',
    }),
  ])

  console.log(`✅ Created ${placements.length} active + ${endedPlacements.length} ended placements`)

  // Update spot statuses to OCCUPIED for spots with active placements
  await Promise.all([
    // ZH-001
    db
      .update(placementSpot)
      .set({ status: 'OCCUPIED' })
      .where(eq(placementSpot.id, allSpots.zh001.beds[0].id)),
    db
      .update(placementSpot)
      .set({ status: 'OCCUPIED' })
      .where(eq(placementSpot.id, allSpots.zh001.beds[1].id)),
    db
      .update(placementSpot)
      .set({ status: 'OCCUPIED' })
      .where(eq(placementSpot.id, allSpots.zh001.beds[2].id)),
    // ZH-002
    db
      .update(placementSpot)
      .set({ status: 'OCCUPIED' })
      .where(eq(placementSpot.id, allSpots.zh002.privateRoom.id)),
    db
      .update(placementSpot)
      .set({ status: 'OCCUPIED' })
      .where(eq(placementSpot.id, allSpots.zh002.beds[0].id)),
    db
      .update(placementSpot)
      .set({ status: 'OCCUPIED' })
      .where(eq(placementSpot.id, allSpots.zh002.beds[1].id)),
    // ZH-003
    db
      .update(placementSpot)
      .set({ status: 'OCCUPIED' })
      .where(eq(placementSpot.id, allSpots.zh003.rooms[0].id)),
    db
      .update(placementSpot)
      .set({ status: 'OCCUPIED' })
      .where(eq(placementSpot.id, allSpots.zh003.rooms[1].id)),
    // ZH-004
    db
      .update(placementSpot)
      .set({ status: 'OCCUPIED' })
      .where(eq(placementSpot.id, allSpots.zh004.beds[0].id)),
    db
      .update(placementSpot)
      .set({ status: 'OCCUPIED' })
      .where(eq(placementSpot.id, allSpots.zh004.beds[1].id)),
    db
      .update(placementSpot)
      .set({ status: 'OCCUPIED' })
      .where(eq(placementSpot.id, allSpots.zh004.beds[4].id)),
    db
      .update(placementSpot)
      .set({ status: 'OCCUPIED' })
      .where(eq(placementSpot.id, allSpots.zh004.beds[5].id)),
    // ZH-006
    db
      .update(placementSpot)
      .set({ status: 'OCCUPIED' })
      .where(eq(placementSpot.id, allSpots.zh006.beds[0].id)),
    db
      .update(placementSpot)
      .set({ status: 'OCCUPIED' })
      .where(eq(placementSpot.id, allSpots.zh006.beds[1].id)),
    db
      .update(placementSpot)
      .set({ status: 'OCCUPIED' })
      .where(eq(placementSpot.id, allSpots.zh006.beds[2].id)),
  ])

  // =========================================================================
  // COMPATIBILITY ASSESSMENTS
  // =========================================================================

  const assessments = await Promise.all([
    // ZH-001 roommates
    createRow(compatibilityAssessment, {
      residentId: residents[0].id,
      comparedWithId: residents[1].id,
      overallScore: score_0_1.compatibilityScore,
      lifestyleScore: score_0_1.lifestyleScore,
      socialScore: score_0_1.socialScore,
      practicalScore: score_0_1.practicalScore,
      riskScore: score_0_1.riskScore,
      strengths: score_0_1.strengths,
      concerns: score_0_1.concerns,
      recommendations: score_0_1.recommendations,
    }),
    createRow(compatibilityAssessment, {
      residentId: residents[0].id,
      comparedWithId: residents[21].id,
      overallScore: score_0_21.compatibilityScore,
      lifestyleScore: score_0_21.lifestyleScore,
      socialScore: score_0_21.socialScore,
      practicalScore: score_0_21.practicalScore,
      riskScore: score_0_21.riskScore,
      strengths: score_0_21.strengths,
      concerns: score_0_21.concerns,
      recommendations: score_0_21.recommendations,
    }),
    createRow(compatibilityAssessment, {
      residentId: residents[1].id,
      comparedWithId: residents[21].id,
      overallScore: score_1_21.compatibilityScore,
      lifestyleScore: score_1_21.lifestyleScore,
      socialScore: score_1_21.socialScore,
      practicalScore: score_1_21.practicalScore,
      riskScore: score_1_21.riskScore,
      strengths: score_1_21.strengths,
      concerns: score_1_21.concerns,
      recommendations: score_1_21.recommendations,
    }),
    // ZH-002
    createRow(compatibilityAssessment, {
      residentId: residents[2].id,
      comparedWithId: residents[3].id,
      overallScore: score_2_3.compatibilityScore,
      lifestyleScore: score_2_3.lifestyleScore,
      socialScore: score_2_3.socialScore,
      practicalScore: score_2_3.practicalScore,
      riskScore: score_2_3.riskScore,
      strengths: score_2_3.strengths,
      concerns: score_2_3.concerns,
      recommendations: score_2_3.recommendations,
    }),
    createRow(compatibilityAssessment, {
      residentId: residents[2].id,
      comparedWithId: residents[5].id,
      overallScore: score_2_5.compatibilityScore,
      lifestyleScore: score_2_5.lifestyleScore,
      socialScore: score_2_5.socialScore,
      practicalScore: score_2_5.practicalScore,
      riskScore: score_2_5.riskScore,
      strengths: score_2_5.strengths,
      concerns: score_2_5.concerns,
      recommendations: score_2_5.recommendations,
    }),
    createRow(compatibilityAssessment, {
      residentId: residents[3].id,
      comparedWithId: residents[5].id,
      overallScore: score_3_5.compatibilityScore,
      lifestyleScore: score_3_5.lifestyleScore,
      socialScore: score_3_5.socialScore,
      practicalScore: score_3_5.practicalScore,
      riskScore: score_3_5.riskScore,
      strengths: score_3_5.strengths,
      concerns: score_3_5.concerns,
      recommendations: score_3_5.recommendations,
    }),
    // ZH-003
    createRow(compatibilityAssessment, {
      residentId: residents[4].id,
      comparedWithId: residents[6].id,
      overallScore: score_4_6.compatibilityScore,
      lifestyleScore: score_4_6.lifestyleScore,
      socialScore: score_4_6.socialScore,
      practicalScore: score_4_6.practicalScore,
      riskScore: score_4_6.riskScore,
      strengths: score_4_6.strengths,
      concerns: score_4_6.concerns,
      recommendations: score_4_6.recommendations,
    }),
    // ZH-004
    createRow(compatibilityAssessment, {
      residentId: residents[13].id,
      comparedWithId: residents[14].id,
      overallScore: score_13_14.compatibilityScore,
      lifestyleScore: score_13_14.lifestyleScore,
      socialScore: score_13_14.socialScore,
      practicalScore: score_13_14.practicalScore,
      riskScore: score_13_14.riskScore,
      strengths: score_13_14.strengths,
      concerns: score_13_14.concerns,
      recommendations: score_13_14.recommendations,
    }),
    createRow(compatibilityAssessment, {
      residentId: residents[17].id,
      comparedWithId: residents[18].id,
      overallScore: score_17_18.compatibilityScore,
      lifestyleScore: score_17_18.lifestyleScore,
      socialScore: score_17_18.socialScore,
      practicalScore: score_17_18.practicalScore,
      riskScore: score_17_18.riskScore,
      strengths: score_17_18.strengths,
      concerns: score_17_18.concerns,
      recommendations: score_17_18.recommendations,
    }),
    // ZH-006 tension pair
    createRow(compatibilityAssessment, {
      residentId: residents[15].id,
      comparedWithId: residents[16].id,
      overallScore: score_15_16.compatibilityScore,
      lifestyleScore: score_15_16.lifestyleScore,
      socialScore: score_15_16.socialScore,
      practicalScore: score_15_16.practicalScore,
      riskScore: score_15_16.riskScore,
      strengths: score_15_16.strengths,
      concerns: score_15_16.concerns,
      recommendations: score_15_16.recommendations,
    }),
  ])

  console.log(`✅ Created ${assessments.length} compatibility assessments`)

  // =========================================================================
  // SATISFACTION CHECK-INS
  // =========================================================================

  const checkIns = await Promise.all([
    // ZH-001 tension pair: Initial (low) → Regular (improving) → Recent (stable)
    createRow(satisfactionCheckIn, {
      placementId: placements[0].id, // RES-001
      checkInType: 'INITIAL',
      weekNumber: 1,
      overallSatisfaction: 3,
      roommateRelations: 2,
      facilitySatisfaction: 4,
      safetyFeeling: 4,
      concerns: 'Mitbewohner ist laut abends',
      collectedBy: 'Frau Müller',
    }),
    createRow(satisfactionCheckIn, {
      placementId: placements[0].id,
      checkInType: 'REGULAR',
      weekNumber: 4,
      overallSatisfaction: 3,
      roommateRelations: 3,
      facilitySatisfaction: 4,
      safetyFeeling: 4,
      positives: 'Kopfhörer-Regelung hilft',
      collectedBy: 'Frau Müller',
    }),
    createRow(satisfactionCheckIn, {
      placementId: placements[0].id,
      checkInType: 'REGULAR',
      weekNumber: 8,
      overallSatisfaction: 4,
      roommateRelations: 3,
      facilitySatisfaction: 4,
      safetyFeeling: 5,
      positives: 'Situation hat sich stabilisiert',
      collectedBy: 'Frau Müller',
    }),
    // ZH-002: Consistently high
    createRow(satisfactionCheckIn, {
      placementId: placements[4].id, // RES-004
      checkInType: 'INITIAL',
      weekNumber: 1,
      overallSatisfaction: 4,
      roommateRelations: 4,
      facilitySatisfaction: 5,
      safetyFeeling: 5,
      positives: 'Ruhige Umgebung, nette Mitbewohner',
      collectedBy: 'Herr Schmidt',
    }),
    createRow(satisfactionCheckIn, {
      placementId: placements[4].id,
      checkInType: 'REGULAR',
      weekNumber: 6,
      overallSatisfaction: 5,
      roommateRelations: 5,
      facilitySatisfaction: 4,
      safetyFeeling: 5,
      positives: 'Fühle mich wohl hier',
      collectedBy: 'Herr Schmidt',
    }),
    // ZH-003: High satisfaction (private rooms)
    createRow(satisfactionCheckIn, {
      placementId: placements[6].id, // RES-005
      checkInType: 'INITIAL',
      weekNumber: 1,
      overallSatisfaction: 5,
      roommateRelations: 4,
      facilitySatisfaction: 5,
      safetyFeeling: 5,
      positives: 'Eigenes Zimmer ist sehr wichtig für mich',
      collectedBy: 'Frau Müller',
    }),
    createRow(satisfactionCheckIn, {
      placementId: placements[7].id, // RES-007
      checkInType: 'INITIAL',
      weekNumber: 1,
      overallSatisfaction: 4,
      roommateRelations: 4,
      facilitySatisfaction: 5,
      safetyFeeling: 5,
      positives: 'Ruhige Lage am See',
      collectedBy: 'Frau Müller',
    }),
    // ZH-004: Mixed — good for stable pair, flagged for departed RES-020
    createRow(satisfactionCheckIn, {
      placementId: placements[8].id, // RES-014
      checkInType: 'INITIAL',
      weekNumber: 1,
      overallSatisfaction: 4,
      roommateRelations: 5,
      facilitySatisfaction: 3,
      safetyFeeling: 4,
      positives: 'Mitbewohner ist super nett',
      collectedBy: 'Herr Schmidt',
    }),
    createRow(satisfactionCheckIn, {
      placementId: endedPlacements[0].id, // RES-020 (ended)
      checkInType: 'INITIAL',
      weekNumber: 1,
      overallSatisfaction: 2,
      roommateRelations: 2,
      facilitySatisfaction: 3,
      safetyFeeling: 3,
      concerns: 'Kann nachts nicht schlafen wegen Mitbewohner',
      collectedBy: 'Herr Schmidt',
    }),
    // ZH-006: Tension pair check-ins
    createRow(satisfactionCheckIn, {
      placementId: placements[12].id, // RES-016
      checkInType: 'INITIAL',
      weekNumber: 1,
      overallSatisfaction: 3,
      roommateRelations: 2,
      facilitySatisfaction: 4,
      safetyFeeling: 4,
      concerns: 'Mitbewohnerin ist zu laut am Morgen',
      collectedBy: 'Frau Müller',
    }),
    createRow(satisfactionCheckIn, {
      placementId: placements[13].id, // RES-017
      checkInType: 'INITIAL',
      weekNumber: 1,
      overallSatisfaction: 3,
      roommateRelations: 3,
      facilitySatisfaction: 4,
      safetyFeeling: 4,
      concerns: 'Mitbewohnerin geht sehr spät ins Bett, Licht stört',
      collectedBy: 'Frau Müller',
    }),
  ])

  console.log(`✅ Created ${checkIns.length} satisfaction check-ins`)

  // =========================================================================
  // INCIDENTS (6 existing + 6 new = 12)
  // =========================================================================

  const incidents = await Promise.all([
    // --- Existing 6 incidents ---
    createRow(incident, {
      housingUnitId: units[0].id,
      placementId: placements[0].id,
      reportedById: residents[0].id,
      subjectId: residents[1].id,
      date: new Date(now.getTime() - 10 * DAY),
      category: 'INTERPERSONAL',
      type: 'NOISE_COMPLAINT',
      severity: 'MEDIUM',
      description: 'RES-001 beschwert sich über laute Musik nach 23 Uhr von RES-002',
      resolution: 'Gespräch geführt, Kopfhörer-Regelung vereinbart',
      resolvedAt: new Date(now.getTime() - 8 * DAY),
      predictable: true,
      compatibilityGap: 'lifestyle',
    }),
    createRow(incident, {
      housingUnitId: units[0].id,
      placementId: placements[1].id,
      subjectId: residents[1].id,
      date: new Date(now.getTime() - 3 * DAY),
      category: 'INTERPERSONAL',
      type: 'SCHEDULE_CONFLICT',
      severity: 'LOW',
      description: 'Diskussion über Badezimmernutzung am Morgen',
      predictable: true,
      compatibilityGap: 'lifestyle',
    }),
    createRow(incident, {
      housingUnitId: units[1].id,
      date: new Date(now.getTime() - 5 * DAY),
      category: 'MAINTENANCE',
      type: 'PLUMBING',
      severity: 'MEDIUM',
      description: 'Wasserhahn in der Küche tropft',
    }),
    createRow(incident, {
      housingUnitId: units[1].id,
      date: new Date(now.getTime() - 2 * DAY),
      category: 'MAINTENANCE',
      type: 'HEATING_COOLING',
      severity: 'HIGH',
      description: 'Heizung im Zimmer von RES-006 funktioniert nicht richtig',
    }),
    createRow(incident, {
      housingUnitId: units[2].id,
      date: new Date(now.getTime() - 14 * DAY),
      category: 'MAINTENANCE',
      type: 'ELECTRICAL',
      severity: 'LOW',
      description: 'Lampe im Flur defekt',
      resolution: 'Leuchtmittel ersetzt',
      resolvedAt: new Date(now.getTime() - 12 * DAY),
    }),
    createRow(incident, {
      housingUnitId: units[3].id,
      date: new Date(now.getTime() - 60 * DAY),
      category: 'MAINTENANCE',
      type: 'APPLIANCE',
      severity: 'MEDIUM',
      description: 'Kühlschrank macht laute Geräusche',
      resolution: 'Neuer Kühlschrank installiert',
      resolvedAt: new Date(now.getTime() - 55 * DAY),
    }),
    // --- 6 new incidents ---
    // ZH-006: Interpersonal conflict between tension pair (correlates with low compatibility)
    createRow(incident, {
      housingUnitId: units[5].id,
      placementId: placements[12].id,
      reportedById: residents[15].id, // RES-016
      subjectId: residents[16].id, // RES-017
      date: new Date(now.getTime() - 18 * DAY),
      category: 'INTERPERSONAL',
      type: 'NOISE_COMPLAINT',
      severity: 'MEDIUM',
      description: 'RES-016 beschwert sich: RES-017 macht morgens um 5:30 Uhr Lärm in der Küche',
      resolution: 'Vermittlungsgespräch, Küchenzeiten vereinbart',
      resolvedAt: new Date(now.getTime() - 16 * DAY),
      predictable: true,
      compatibilityGap: 'lifestyle',
      followUpPriority: 'NORMAL',
      nextFollowUpDate: new Date(now.getTime() + 3 * DAY),
    }),
    // ZH-006: Second incident — same tension pair, cleanliness
    createRow(incident, {
      housingUnitId: units[5].id,
      placementId: placements[13].id,
      reportedById: residents[15].id, // RES-016
      subjectId: residents[16].id, // RES-017
      date: new Date(now.getTime() - 7 * DAY),
      category: 'INTERPERSONAL',
      type: 'CLEANLINESS_DISPUTE',
      severity: 'LOW',
      description: 'Streit über Küchensauberkeit, RES-016 empfindet RES-017 als unordentlich',
      predictable: true,
      compatibilityGap: 'lifestyle',
    }),
    // ZH-004: Safety concern
    createRow(incident, {
      housingUnitId: units[3].id,
      date: new Date(now.getTime() - 12 * DAY),
      category: 'SAFETY',
      type: 'SAFETY_CONCERN',
      severity: 'HIGH',
      description: 'Eingangstür nachts nicht abgeschlossen vorgefunden',
      resolution: 'Bewohner erinnert, automatischer Türschliesser wird installiert',
      resolvedAt: new Date(now.getTime() - 10 * DAY),
      followUpPriority: 'HIGH',
      nextFollowUpDate: new Date(now.getTime() - 5 * DAY),
    }),
    // ZH-004: Conflict involving RES-020 before transfer (resolved)
    createRow(incident, {
      housingUnitId: units[3].id,
      placementId: endedPlacements[0].id,
      reportedById: residents[17].id, // RES-018
      subjectId: residents[19].id, // RES-020
      date: new Date(now.getTime() - 50 * DAY),
      category: 'INTERPERSONAL',
      type: 'NOISE_COMPLAINT',
      severity: 'HIGH',
      description: 'RES-020 stört nachts Mitbewohner durch lautes Telefonieren',
      resolution: 'Versetzung von RES-020 eingeleitet',
      resolvedAt: new Date(now.getTime() - 40 * DAY),
      predictable: true,
      compatibilityGap: 'lifestyle',
    }),
    // ZH-004: Second conflict with RES-020
    createRow(incident, {
      housingUnitId: units[3].id,
      placementId: endedPlacements[0].id,
      subjectId: residents[19].id, // RES-020
      date: new Date(now.getTime() - 45 * DAY),
      category: 'INTERPERSONAL',
      type: 'PERSONAL_CONFLICT',
      severity: 'MEDIUM',
      description: 'Lautstärker Streit zwischen RES-020 und Mitbewohnern über Gemeinschaftsräume',
      resolution: 'Vermittlungsgespräch, Versetzungsentscheid bestätigt',
      resolvedAt: new Date(now.getTime() - 42 * DAY),
      predictable: true,
      compatibilityGap: 'social',
    }),
    // ZH-001: Cultural friction (resolved positively — shows system tracking outcomes)
    createRow(incident, {
      housingUnitId: units[0].id,
      placementId: placements[2].id,
      reportedById: residents[21].id, // RES-022
      date: new Date(now.getTime() - 15 * DAY),
      category: 'INTERPERSONAL',
      type: 'CULTURAL_FRICTION',
      severity: 'LOW',
      description: 'Missverständnis über Küchennutzung wegen unterschiedlicher Gewohnheiten',
      resolution: 'Küchenplan erstellt, Situation geklärt durch gemeinsames Kochen',
      resolvedAt: new Date(now.getTime() - 13 * DAY),
      predictable: false,
      compatibilityGap: 'practical',
    }),
  ])

  console.log(`✅ Created ${incidents.length} incidents`)

  // Incident follow-ups
  const followUps = await Promise.all([
    // Follow-up on ZH-006 noise complaint (incident index 6)
    createRow(incidentFollowUp, {
      incidentId: incidents[6].id,
      action: 'Nachgespräch mit beiden Bewohnerinnen',
      notes: 'Küchenzeiten werden eingehalten, Situation leicht verbessert',
      outcome: 'Teilweise Verbesserung',
      staffName: 'Frau Müller',
      scheduledNextDate: new Date(now.getTime() + 7 * DAY),
    }),
    // Follow-up on ZH-004 safety concern (incident index 8)
    createRow(incidentFollowUp, {
      incidentId: incidents[8].id,
      action: 'Türschliesser installiert, alle Bewohner informiert',
      notes: 'Automatischer Türschliesser funktioniert',
      outcome: 'Problem behoben',
      staffName: 'Herr Schmidt',
    }),
    // Follow-up on RES-020 conflict (incident index 9)
    createRow(incidentFollowUp, {
      incidentId: incidents[9].id,
      action: 'Versetzungsgespräch mit RES-020 durchgeführt',
      notes: 'Bewohner versteht Gründe, akzeptiert Versetzung',
      outcome: 'Versetzung durchgeführt',
      staffName: 'Herr Schmidt',
    }),
  ])

  console.log(`✅ Created ${followUps.length} incident follow-ups`)

  // =========================================================================
  // MAINTENANCE REQUESTS
  // =========================================================================

  const maintenanceRequests = await Promise.all([
    // Open: plumbing issue in ZH-006
    createRow(maintenanceRequest, {
      housingUnitId: units[5].id,
      category: 'PLUMBING',
      priority: 'NORMAL',
      title: 'Dusche tropft',
      description: 'Duschkopf in Badezimmer 1 tropft kontinuierlich',
      location: 'Badezimmer 1',
      reportedById: residents[15].id,
      status: 'OPEN',
    }),
    // Open: heating repair in ZH-002
    createRow(maintenanceRequest, {
      housingUnitId: units[1].id,
      category: 'HEATING_COOLING',
      priority: 'HIGH',
      title: 'Heizung Zimmer 2 defekt',
      description: 'Heizung heizt nicht mehr richtig, Zimmer wird kalt',
      location: 'Zimmer 2',
      reportedById: residents[5].id,
      status: 'ASSIGNED',
      assignedTo: 'Hauswart Keller',
      assignedAt: new Date(now.getTime() - 1 * DAY),
    }),
    // Completed: electrical fix in ZH-003
    createRow(maintenanceRequest, {
      housingUnitId: units[2].id,
      category: 'ELECTRICAL',
      priority: 'NORMAL',
      title: 'Steckdose funktioniert nicht',
      description: 'Steckdose neben Bett in Einzelzimmer 1 ohne Strom',
      location: 'Einzelzimmer 1',
      reportedById: residents[4].id,
      status: 'COMPLETED',
      assignedTo: 'Elektriker Meyer',
      assignedAt: new Date(now.getTime() - 10 * DAY),
      startedAt: new Date(now.getTime() - 8 * DAY),
      completedAt: new Date(now.getTime() - 7 * DAY),
      resolution: 'Sicherung war defekt, ersetzt',
      cost: 85.0,
    }),
    // Completed: appliance replacement in ZH-004
    createRow(maintenanceRequest, {
      housingUnitId: units[3].id,
      category: 'APPLIANCE',
      priority: 'NORMAL',
      title: 'Waschmaschine defekt',
      description: 'Waschmaschine schleudert nicht mehr richtig',
      location: 'Waschküche',
      reporterName: 'Hauswart Keller',
      status: 'COMPLETED',
      assignedTo: 'Electrolux Service',
      assignedAt: new Date(now.getTime() - 20 * DAY),
      startedAt: new Date(now.getTime() - 15 * DAY),
      completedAt: new Date(now.getTime() - 12 * DAY),
      resolution: 'Neue Waschmaschine installiert',
      cost: 890.0,
    }),
  ])

  console.log(`✅ Created ${maintenanceRequests.length} maintenance requests`)

  // =========================================================================
  // TRANSFER REQUESTS
  // =========================================================================

  const transferRequests = await Promise.all([
    // PENDING: RES-001 wants to move from ZH-001 to ZH-002 (awaiting staff review)
    createRow(transferRequest, {
      residentId: residents[0].id,
      currentPlacementId: placements[0].id,
      targetUnitId: units[1].id,
      reason:
        'Meine aktuelle Wohngemeinschaft ist sehr laut und ich schlafe schlecht. Ich würde gerne in eine ruhigere Unterkunft wechseln.',
      status: 'PENDING',
    }),
    // APPROVED: RES-004 requested transfer from ZH-002 to ZH-003 (approved 5 days ago)
    createRow(transferRequest, {
      residentId: residents[3].id,
      currentPlacementId: placements[4].id,
      targetUnitId: units[2].id,
      reason: 'Ich möchte in eine kleinere Unterkunft wechseln, da ich mehr Privatsphäre benötige.',
      status: 'APPROVED',
      staffNotes: 'Transferanfrage genehmigt. Verlegung wird nächste Woche koordiniert.',
      reviewedBy: `${BRAND.codePrefix}ADMIN1`,
      reviewedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    }),
    // DENIED: RES-006 requested transfer (denied — no suitable spot available)
    createRow(transferRequest, {
      residentId: residents[5].id,
      currentPlacementId: placements[5].id,
      reason: 'Ich möchte näher an meiner Sprachschule wohnen, um den Weg zu verkürzen.',
      status: 'DENIED',
      staffNotes:
        'Leider kein geeigneter Platz in der gewünschten Lage verfügbar. Bitte in 4 Wochen erneut anfragen.',
      reviewedBy: `${BRAND.codePrefix}ADMIN1`,
      reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    }),
  ])

  console.log(`✅ Created ${transferRequests.length} transfer requests`)

  // =========================================================================
  // HOUSEHOLD TASKS
  // =========================================================================

  const householdTasks = await Promise.all([
    // Kitchen cleaning schedule (recurring) in ZH-001
    createRow(householdTask, {
      housingUnitId: units[0].id,
      title: 'Küche reinigen',
      description: 'Arbeitsflächen, Herd und Spüle reinigen',
      instructions: 'Alle Oberflächen abwischen, Herd reinigen, Spüle putzen, Boden wischen',
      taskType: 'RECURRING_SCHEDULED',
      category: 'CLEANING',
      priority: 'NORMAL',
      scheduleHuman: 'Jeden Montag und Donnerstag',
      estimatedMinutes: 30,
      currentStatus: 'IDLE',
      createdByStaff: 'Frau Müller',
    }),
    // Trash duty (recurring) in ZH-004
    createRow(householdTask, {
      housingUnitId: units[3].id,
      title: 'Müll rausbringen',
      description: 'Kehrichtsack und Recycling zur Sammelstelle bringen',
      instructions: 'Kehricht (grauer Sack) Dienstag, Papier/Karton Mittwoch, PET jederzeit',
      taskType: 'RECURRING_SCHEDULED',
      category: 'TRASH',
      priority: 'NORMAL',
      scheduleHuman: 'Jeden Dienstag (Kehricht), Mittwoch (Papier)',
      estimatedMinutes: 15,
      currentStatus: 'IDLE',
      createdByStaff: 'Herr Schmidt',
    }),
    // One-time deep clean in ZH-006
    createRow(householdTask, {
      housingUnitId: units[5].id,
      title: 'Grundreinigung Badezimmer',
      description: 'Gründliche Reinigung beider Badezimmer',
      instructions: 'Fliesen, Fugen, WC, Dusche, Waschbecken, Spiegel reinigen',
      taskType: 'ONE_TIME',
      category: 'CLEANING',
      priority: 'HIGH',
      estimatedMinutes: 60,
      currentStatus: 'NEEDS_ATTENTION',
      createdByStaff: 'Frau Müller',
    }),
    // Kitchen cleaning (recurring) in ZH-002
    createRow(householdTask, {
      housingUnitId: units[1].id,
      title: 'Küche und Gemeinschaftsräume',
      description: 'Wöchentliche Reinigung der Gemeinschaftsräume',
      instructions: 'Küche reinigen, Wohnbereich staubsaugen, Oberflächen abwischen',
      taskType: 'RECURRING_SCHEDULED',
      category: 'CLEANING',
      priority: 'NORMAL',
      scheduleHuman: 'Jeden Freitag',
      estimatedMinutes: 45,
      currentStatus: 'IDLE',
      createdByStaff: 'Herr Schmidt',
    }),
  ])

  console.log(`✅ Created ${householdTasks.length} household tasks`)

  // =========================================================================
  // UPDATE UNIT STATUSES
  // =========================================================================

  // ZH-001: 3/4 beds occupied
  // ZH-002: 3/6 beds occupied
  // ZH-003: 2/3 rooms occupied
  // ZH-004: 4/8 beds occupied
  // ZH-005: maintenance
  // ZH-006: 3/6 beds occupied
  // ZH-007: empty, available
  // ZH-008: empty, available

  // Pilot baseline config (from CLAUDE.md example metrics — pre-system Phase-1 data)
  const earliestPlacement = await db.query.placement.findFirst({
    orderBy: [asc(placement.startDate)],
    columns: { startDate: true },
  })
  await db
    .insert(systemConfig)
    .values({
      id: 'singleton',
      pilotBaselineIncidentsPerMonth: 15,
      pilotBaselineRelocationsPerMonth: 4,
      pilotBaselineMediationHoursPerWeek: 12,
      pilotStartDate: earliestPlacement?.startDate ?? new Date('2025-11-01'),
    })
    .onConflictDoUpdate({
      target: systemConfig.id,
      set: {
        pilotBaselineIncidentsPerMonth: 15,
        pilotBaselineRelocationsPerMonth: 4,
        pilotBaselineMediationHoursPerWeek: 12,
        pilotStartDate: earliestPlacement?.startDate ?? new Date('2025-11-01'),
      },
    })

  // ---------------------------------------------------------------------------
  // GOVERNANCE — AOZ rule catalog + a house that has started using it
  // ---------------------------------------------------------------------------

  // The AOZ tier is reference data, not demo data: it must exist in production
  // too. Idempotent, so re-seeding never duplicates or resets acknowledgements.
  const ruleSync = await syncOrgRules(db)

  const quietRule = await db.query.houseRule.findFirst({ where: eq(houseRule.key, 'night_quiet') })
  const kitchenRule = await db.query.houseRule.findFirst({
    where: eq(houseRule.key, 'kitchen_use'),
  })
  const cleaningRule = await db.query.houseRule.findFirst({
    where: eq(houseRule.key, 'shared_cleaning'),
  })

  const demoUnit = units[0]
  let houseRuleCount = 0
  let proposalCount = 0

  if (demoUnit && kitchenRule && quietRule && cleaningRule) {
    // A house that has already decided one topic...
    const existingHouseRule = await db.query.houseRule.findFirst({
      where: and(
        eq(houseRule.scope, 'UNIT'),
        eq(houseRule.housingUnitId, demoUnit.id),
        eq(houseRule.parentRuleId, kitchenRule.id),
      ),
    })

    if (!existingHouseRule) {
      await createRow(houseRule, {
        scope: 'UNIT',
        housingUnitId: demoUnit.id,
        parentRuleId: kitchenRule.id,
        category: kitchenRule.category,
        title: 'Küche: abwaschen am selben Abend',
        body: 'Wer kocht, wäscht am selben Abend ab. Geschirr, das über Nacht stehen bleibt, wird in eine Kiste neben der Spüle geräumt. Am Sonntag räumt die Person auf, die in der Woche dran war.',
        delegation: kitchenRule.delegation,
        status: 'ACTIVE',
        version: 1,
      })
      houseRuleCount++
    }

    // ...and one still being decided, so the voting UI has something to show.
    const demoUnitResidents = await db.query.placement.findMany({
      where: and(eq(placement.housingUnitId, demoUnit.id), eq(placement.status, 'ACTIVE')),
      columns: { residentId: true },
    })
    const voterIds = Array.from(new Set(demoUnitResidents.map((p) => p.residentId)))

    const existingProposal = await db.query.proposal.findFirst({
      where: eq(proposalTable.housingUnitId, demoUnit.id),
    })

    if (!existingProposal && voterIds.length >= 3) {
      const votingEndsAt = new Date()
      votingEndsAt.setDate(votingEndsAt.getDate() + 4)

      const proposal = await createRow(proposalTable, {
        housingUnitId: demoUnit.id,
        type: 'ADD_RULE',
        category: cleaningRule.category,
        title: 'Putzplan mit fixem Wochentag',
        body: 'Vorschlag: Jede Person übernimmt eine Woche lang Küche und Bad. Der Wechsel ist immer am Sonntagabend. Wer in seiner Woche verhindert ist, tauscht vorher mit jemandem.',
        parentOrgRuleId: cleaningRule.id,
        proposedByResidentId: voterIds[0],
        status: 'VOTING',
        decisionMode: 'RESIDENT_BINDING',
        threshold: 'SIMPLE_MAJORITY',
        quorumPercent: 50,
        approvalPercent: 51,
        eligibleVoterCount: voterIds.length,
        votingOpenedAt: new Date(),
        votingEndsAt,
      })
      proposalCount++

      // Enough votes to be interesting but not yet decided.
      await db
        .insert(vote)
        .values([
          { proposalId: proposal.id, residentId: voterIds[0], choice: 'YES' },
          { proposalId: proposal.id, residentId: voterIds[1], choice: 'YES' },
        ])
        .onConflictDoNothing()
    }
  }

  console.log('✅ Database seeded successfully!')
  console.log('')
  console.log('📊 Summary:')
  console.log(`   - ${units.length} housing units`)
  const placed = residents.filter((r) => r.status === 'PLACED').length
  const active = residents.filter((r) => r.status === 'ACTIVE').length
  const transferred = residents.filter((r) => r.status === 'TRANSFERRED').length
  console.log(
    `   - ${residents.length} residents (${placed} placed, ${active} waiting, ${transferred} transferred)`,
  )
  console.log(`   - ${placements.length} active + ${endedPlacements.length} ended placements`)
  console.log(`   - ${assessments.length} compatibility assessments`)
  console.log(`   - ${checkIns.length} satisfaction check-ins`)
  console.log(`   - ${incidents.length} incidents (${followUps.length} follow-ups)`)
  console.log(`   - ${maintenanceRequests.length} maintenance requests`)
  console.log(`   - ${transferRequests.length} transfer requests (1 pending, 1 approved, 1 denied)`)
  console.log(`   - ${householdTasks.length} household tasks`)
  console.log(
    `   - ${ruleSync.created + ruleSync.unchanged + ruleSync.amended} AOZ rules ` +
      `(${ruleSync.created} new), ${houseRuleCount} house rule(s), ${proposalCount} open decision(s)`,
  )
  console.log('')
  console.log('🚀 Ready to run: pnpm run dev')
}

main()
  .then(() => {
    // The pg Pool keeps the event loop alive — exit explicitly on success.
    process.exit(0)
  })
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
