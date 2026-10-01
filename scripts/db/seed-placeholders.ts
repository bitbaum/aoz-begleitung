/**
 * Seed CLAIMABLE PLACEHOLDER profiles into real AOZ flats.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"CommonJS"}' \
 *     scripts/db/seed-placeholders.ts [--dry-run]
 *
 * ## What this is
 *
 * The invented demo world that preceded it (DEMO-prefixed rows, re-seeded
 * nightly) was removed on 2026-10-01. Nobody could take one of those profiles
 * over, because the takeover was erased before morning.
 *
 * These are the opposite. Real AOZ addresses, real unit codes already in the
 * database, real generated login codes — and `isPlaceholder`, which is the only
 * thing separating them from a client. When the person who moves in registers
 * with that code, the flag clears and the profile is theirs, along with its
 * placement, its flat and its history. Same shape as a staff account: the code
 * is minted first, the human arrives later.
 *
 * ## Two refusals, both deliberate
 *
 * - A flat that already holds ACTIVE placements is skipped, never overwritten.
 *   Re-running can therefore not duplicate people or evict anybody.
 * - A flat holding a resident who is NOT a placeholder is skipped even if the
 *   codes match. Real clients are never in the blast radius of a seed script.
 *
 * Codes are printed ONCE and committed nowhere. A placeholder's code is still a
 * credential: whoever holds it takes the profile over.
 */

import { and, eq, inArray } from 'drizzle-orm'
import { db, housingUnit, placement, placementSpot, resident as residentTable } from '@/lib/db'
import { PLACEHOLDER_APARTMENTS, type PlaceholderApartment } from './real/witikonerstrasse-426'
import { generateResidentCode } from '@/lib/auth/code-generation'

const DRY_RUN = process.argv.includes('--dry-run')

async function uniqueResidentCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateResidentCode()
    const clash = await db.query.resident.findFirst({
      where: eq(residentTable.code, code),
      columns: { id: true },
    })
    if (!clash) return code
  }
  throw new Error('could not generate a unique resident code')
}

/** Why this flat cannot be seeded, or null when it can. */
async function refusalFor(apartment: PlaceholderApartment): Promise<string | null> {
  const unit = await db.query.housingUnit.findFirst({
    where: eq(housingUnit.code, apartment.unit.code),
    columns: { id: true },
    with: {
      placements: {
        where: eq(placement.status, 'ACTIVE'),
        columns: { id: true, residentId: true },
      },
    },
  })
  if (!unit) return null
  if (unit.placements.length === 0) return null

  const residentIds = unit.placements.map((row) => row.residentId)
  const real = await db.query.resident.findMany({
    where: and(inArray(residentTable.id, residentIds), eq(residentTable.isPlaceholder, false)),
    columns: { code: true },
  })

  return real.length > 0
    ? `holds ${real.length} REAL client(s) — never touched by a seed`
    : `already holds ${unit.placements.length} active placement(s)`
}

async function seedApartment(apartment: PlaceholderApartment): Promise<number> {
  const refusal = await refusalFor(apartment)
  if (refusal) {
    console.log(`  ✋ ${apartment.unit.code}: ${refusal} — skipped`)
    return 0
  }
  if (DRY_RUN) {
    console.log(
      `  · ${apartment.unit.code}: would seed ${apartment.residents.length} placeholder(s)`,
    )
    return 0
  }

  // The unit row usually EXISTS already, imported with AOZ's stock and sitting
  // CLOSED with zero beds. Its code is unique, so inserting would collide;
  // this activates the real row rather than inventing a second one.
  const existing = await db.query.housingUnit.findFirst({
    where: eq(housingUnit.code, apartment.unit.code),
    columns: { id: true },
  })

  const unitValues = { ...apartment.unit, status: 'AVAILABLE' as const }
  const unit = existing
    ? (
        await db
          .update(housingUnit)
          .set(unitValues)
          .where(eq(housingUnit.id, existing.id))
          .returning()
      )[0]
    : (await db.insert(housingUnit).values(unitValues).returning())[0]

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
        status: 'AVAILABLE',
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
  let seeded = 0

  for (const person of apartment.residents) {
    const bedIds = bedsByRoom.get(person.room)
    if (!bedIds || bedIds.length === 0) {
      throw new Error(`no free bed left in ${person.room} for ${person.displayName}`)
    }
    const bedId = bedIds.shift()!
    const code = await uniqueResidentCode()

    const [created] = await db
      .insert(residentTable)
      .values({
        code,
        displayName: person.displayName,
        // Neutral throughout. Inventing preferences would feed fiction into
        // the compatibility algorithm and back out as a recommendation.
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
        isPlaceholder: true,
      })
      .returning()

    await db.insert(placement).values({
      residentId: created.id,
      housingUnitId: unit.id,
      spotId: bedId,
      startDate,
      status: 'ACTIVE',
    })
    await db.update(placementSpot).set({ status: 'OCCUPIED' }).where(eq(placementSpot.id, bedId))

    console.log(
      `  ✓ ${person.displayName.padEnd(8)} ${code}  ${apartment.unit.code} ${person.room}`,
    )
    seeded += 1
  }

  return seeded
}

async function main() {
  console.log(
    DRY_RUN
      ? 'Placeholder seed — DRY RUN, nothing is written\n'
      : 'Seeding claimable placeholder profiles\n',
  )

  let total = 0
  for (const apartment of PLACEHOLDER_APARTMENTS) {
    total += await seedApartment(apartment)
  }

  console.log(
    `\n${total} placeholder profile(s) seeded.\n` +
      'Each code above CLAIMS that profile at /register — hand one out and the\n' +
      'person who registers with it owns the profile, its flat and its history.\n' +
      'These codes are printed once and stored nowhere.',
  )
  process.exit(0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
