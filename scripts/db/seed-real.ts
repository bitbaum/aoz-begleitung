/**
 * Seed the REAL apartments (no demo data) listed under `real` in the local
 * apartment config — see scripts/db/real/load.ts for where that file lives.
 * It is gitignored on purpose: addresses and who sleeps where are personal
 * data, and this repository is public.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"CommonJS"}' scripts/db/seed-real.ts
 *
 * Idempotent: a unit that already has active placements is skipped, so a
 * re-run can never duplicate people. (The `--wipe` flag that
 * truncated a demo instance was removed with the demo world on 2026-10-01.)
 *
 * Login codes are GENERATED here and printed once — hand them out and store
 * them; they are intentionally not committed anywhere.
 */

import { eq } from 'drizzle-orm'
import { db, housingUnit, placement, placementSpot, resident as residentTable } from '@/lib/db'
import { loadApartmentsConfig } from './real/load'
import type { RealApartment } from './real/types'
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

async function seedApartment(apartment: RealApartment): Promise<void> {
  const existing = await db.query.housingUnit.findFirst({
    where: eq(housingUnit.code, apartment.unit.code),
    columns: { id: true },
    with: { placements: { where: eq(placement.status, 'ACTIVE'), columns: { id: true } } },
  })
  if (existing && existing.placements.length > 0) {
    console.error(
      `✋ ${apartment.unit.code} already has ${existing.placements.length} active placements — refusing to seed twice.`,
    )
    return
  }

  const [unit] = await db
    .insert(housingUnit)
    .values({ ...apartment.unit, status: 'FULL' })
    .returning()

  // Rooms with their beds (the spot hierarchy the rest of the app expects).
  const bedsByRoom = new Map<string, string[]>()
  for (const room of apartment.rooms) {
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

  for (const person of apartment.residents) {
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

  console.log(`\n🏠 Seeded ${apartment.unit.code} (${apartment.unit.address})`)
  console.log('\nLogin codes — hand these out, they are shown ONCE:\n')
  for (const c of credentials) {
    console.log(`  ${c.name.padEnd(10)} ${c.room}  →  ${c.code}`)
  }
  console.log('')
}

async function main() {
  const { real } = loadApartmentsConfig()
  if (real.length === 0) {
    console.error('✋ The apartment config lists no `real` apartments — nothing to seed.')
    process.exit(1)
  }
  for (const apartment of real) {
    await seedApartment(apartment)
  }
  await syncOrgRules(db)
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
