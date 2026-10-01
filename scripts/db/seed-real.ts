/**
 * Seed a REAL apartment (no demo data) from scripts/db/real/*.ts config.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"CommonJS"}' scripts/db/seed-real.ts
 *
 * Idempotent: if the unit already has active placements the script refuses to
 * run, so a re-run can never duplicate people. (The `--wipe` flag that
 * truncated a demo instance was removed with the demo world on 2026-10-01.)
 *
 * Login codes are GENERATED here and printed once — hand them out and store
 * them; they are intentionally not committed anywhere.
 */

import { eq } from 'drizzle-orm'
import { db, housingUnit, placement, placementSpot, resident as residentTable } from '@/lib/db'
import { REAL_APARTMENT } from './real/witikonerstrasse-458'
import { generateResidentCode } from '@/lib/auth/code-generation'
import { syncOrgRules } from '@/lib/governance/sync-org-rules'

async function uniqueResidentCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateResidentCode()
    if (
      !(await db.query.resident.findFirst({
        where: eq(residentTable.code, code),
        columns: { id: true },
      }))
    ) {
      return code
    }
  }
  throw new Error('could not generate a unique resident code')
}

async function main() {
  const existing = await db.query.housingUnit.findFirst({
    where: eq(housingUnit.code, REAL_APARTMENT.unit.code),
    columns: { id: true },
    with: { placements: { where: eq(placement.status, 'ACTIVE'), columns: { id: true } } },
  })
  if (existing && existing.placements.length > 0) {
    console.error(
      `✋ ${REAL_APARTMENT.unit.code} already has ${existing.placements.length} active placements — refusing to seed twice.`,
    )
    process.exit(1)
  }

  const [unit] = await db
    .insert(housingUnit)
    .values({ ...REAL_APARTMENT.unit, status: 'FULL' })
    .returning()

  // Rooms with their beds (the spot hierarchy the rest of the app expects).
  const bedsByRoom = new Map<string, string[]>()
  for (const room of REAL_APARTMENT.rooms) {
    const [roomSpot] = await db
      .insert(placementSpot)
      .values({
        housingUnitId: unit.id,
        code: room.code,
        label: room.label,
        type: 'ROOM',
        capacity: room.beds,
        status: 'OCCUPIED',
      })
      .returning()
    const bedIds: string[] = []
    for (let i = 1; i <= room.beds; i++) {
      const [bed] = await db
        .insert(placementSpot)
        .values({
          housingUnitId: unit.id,
          code: `${room.code}-B${i}`,
          type: 'BED',
          parentSpotId: roomSpot.id,
          capacity: 1,
          status: 'AVAILABLE',
        })
        .returning()
      bedIds.push(bed.id)
    }
    bedsByRoom.set(room.code, bedIds)
  }

  const startDate = new Date()
  const credentials: Array<{ name: string; code: string; room: string }> = []

  for (const person of REAL_APARTMENT.residents) {
    const bedIds = bedsByRoom.get(person.room)
    if (!bedIds || bedIds.length === 0) {
      throw new Error(`no free bed left in ${person.room} for ${person.displayName}`)
    }
    const bedId = bedIds.shift()!

    const code = await uniqueResidentCode()
    const [resident] = await db
      .insert(residentTable)
      .values({
        code,
        displayName: person.displayName,
        // Neutral defaults — everyone refines their own preferences in the
        // portal. Nothing here is a statement about the person.
        ageRange: 'ADULT',
        gender: 'PREFER_NOT_SAY',
        familyStatus: 'SINGLE',
        sleepSchedule: 'STANDARD',
        noiseTolerance: 3,
        cleanlinessPractice: 3,
        socialStyle: 'MODERATE',
        languages: [],
        smokingStatus: 'NON_SMOKER',
        mobilityNeeds: 'NONE',
        privacyNeed: 3,
        status: 'PLACED',
      })
      .returning()

    await db.insert(placement).values({
      residentId: resident.id,
      housingUnitId: unit.id,
      spotId: bedId,
      startDate,
      status: 'ACTIVE',
    })
    await db.update(placementSpot).set({ status: 'OCCUPIED' }).where(eq(placementSpot.id, bedId))

    credentials.push({ name: person.displayName, code, room: person.room })
  }

  await syncOrgRules(db)

  console.log(`\n🏠 Seeded ${REAL_APARTMENT.unit.code} (${REAL_APARTMENT.unit.address})`)
  console.log('\nLogin codes — hand these out, they are shown ONCE:\n')
  for (const c of credentials) {
    console.log(`  ${c.name.padEnd(10)} ${c.room}  →  ${c.code}`)
  }
  console.log('')
}

main()
  .then(() => {
    // The pg Pool keeps the event loop alive — exit explicitly on success.
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
