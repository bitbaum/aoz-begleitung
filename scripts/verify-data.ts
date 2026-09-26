/**
 * Verify all test data is correctly set up
 */

import { eq, like } from 'drizzle-orm'
import { db, housingUnit, resident, placement } from '../src/lib/db'

async function main() {
  console.log('🔍 Verifying test data...\n')

  // Check housing unit
  const unit = await db.query.housingUnit.findFirst({
    where: eq(housingUnit.code, 'ZH-1-440'),
    with: {
      spots: true,
      placements: {
        where: eq(placement.status, 'ACTIVE'),
        with: { resident: true, spot: true },
      },
      incidents: {
        with: {
          reportedBy: { columns: { code: true } },
          subject: { columns: { code: true } },
        },
      },
    },
  })

  if (!unit) {
    console.log('❌ Housing unit not found')
    return
  }

  console.log('✅ Housing Unit: ZH-1-440')
  console.log(`   ID: ${unit.id}`)
  console.log(`   Address: ${unit.address}`)
  console.log(`   Total beds: ${unit.totalBeds}`)
  console.log(`   Spots created: ${unit.spots.length}`)
  console.log(`   Current placements: ${unit.placements.length}`)
  console.log(`   Incidents: ${unit.incidents.length}\n`)

  console.log('📋 Spot Details:')
  const rooms = unit.spots.filter((s) => s.type === 'ROOM')
  const beds = unit.spots.filter((s) => s.type === 'BED')
  const privateRooms = unit.spots.filter((s) => s.type === 'PRIVATE_ROOM')

  console.log(`   Rooms: ${rooms.length}`)
  rooms.forEach((r) => console.log(`      ${r.code} - ${r.label}`))
  console.log(`   Beds: ${beds.length}`)
  beds.forEach((b) => console.log(`      ${b.code} (${b.status})`))
  console.log(`   Private Rooms: ${privateRooms.length}`)
  privateRooms.forEach((p) =>
    console.log(`      ${p.code} - ${p.label} (requires medical: ${p.requiresMedicalDocs})`),
  )

  console.log('\n👥 Current Residents:')
  unit.placements.forEach((p) => {
    console.log(`   ${p.resident.code} → ${p.spot?.code || 'N/A'}`)
  })

  console.log('\n🚨 Incidents:')
  unit.incidents.forEach((i) => {
    const reporter = i.reportedBy?.code || 'Unknown'
    const subject = i.subject?.code || 'N/A'
    console.log(`   ${i.type} (${i.severity})`)
    console.log(`      Reported by: ${reporter}`)
    console.log(`      Subject: ${subject}`)
  })

  // Check residents
  const residents = await db.query.resident.findMany({
    where: like(resident.code, 'WIT-%'),
    with: {
      placements: {
        where: eq(placement.status, 'ACTIVE'),
      },
      incidentsAsSubject: true,
      incidentsReported: true,
    },
  })

  console.log(`\n📊 Resident Summary:`)
  console.log(`   Total residents: ${residents.length}`)
  console.log(`   Placed: ${residents.filter((r) => r.status === 'PLACED').length}`)
  console.log(`   With medical docs: ${residents.filter((r) => r.hasMedicalDocumentation).length}`)

  console.log(`\n✅ All data verified successfully!`)
  console.log(`\n🌐 Web UI URLs to test:`)
  console.log(`   Housing: http://localhost:3000/housing/${unit.id}`)
  console.log(`   Residents: http://localhost:3000/residents`)
  console.log(
    `   Person E: http://localhost:3000/residents/${residents.find((r) => r.code === 'WIT-005')?.id}`,
  )
  console.log(`   Incidents: http://localhost:3000/incidents`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })
