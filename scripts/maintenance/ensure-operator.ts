/**
 * Link the house operator's resident login to a staff identity that can work
 * all three care seats (Wohnen, Sozialarbeit, Jobcoach).
 *
 * One human, one Account, two identities — the existing auth model. Leitung
 * (ADMIN) is the staff role that may write every domain; specialists stay
 * one-seat. Empty care seats on active residents are filled with this person.
 *
 * Usage (from repo root, against the live DB env):
 *   OPERATOR_RESIDENT_NAME='<name as shown in the portal>' npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/maintenance/ensure-operator.ts
 */

import { and, asc, eq, inArray } from 'drizzle-orm'
import { db, user, account, careAssignment, resident as residentTable } from '../../src/lib/db'
import { generateStaffCode } from '../../src/lib/auth/code-generation'
import { CARE_ROLES } from '../../src/lib/config/care'

// No default: the operator's name is not in this public repository, and a
// guessed name would link the wrong resident to a staff identity.
const RESIDENT_NAME = requiredName()

function requiredName(): string {
  const name = process.env.OPERATOR_RESIDENT_NAME?.trim()
  if (!name) {
    throw new Error("Set OPERATOR_RESIDENT_NAME to the operator's name as shown in the portal.")
  }
  return name
}

/**
 * What "may work all three care seats" is, now that it is sayable.
 *
 * This script used to write `role: 'ADMIN'`, which was the only way to express
 * breadth back when one enum meant role, reach and administration at once. It
 * therefore also handed the operator the settings page as a side effect, and it
 * minted a role `/api/auth/register` now refuses. Reach is `scope`; running the
 * house is not the same as configuring the product, so `isSystemAdmin` stays
 * false and the role stays the true one.
 */
const OPERATOR_CAPABILITIES = {
  role: 'BETREUUNG',
  scope: 'ALL_DOMAINS',
  isSystemAdmin: false,
} as const

async function uniqueStaffCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateStaffCode()
    if (!(await db.query.user.findFirst({ where: eq(user.code, code), columns: { id: true } }))) {
      return code
    }
  }
  throw new Error('could not generate a unique staff code')
}

async function main() {
  const resident = await db.query.resident.findFirst({
    where: and(
      eq(residentTable.displayName, RESIDENT_NAME),
      inArray(residentTable.status, ['ACTIVE', 'PLACED']),
    ),
    orderBy: [asc(residentTable.createdAt)],
  })
  if (!resident) {
    throw new Error(`No active resident named ${RESIDENT_NAME}`)
  }

  // Fetched directly (Account.residentId is unique) rather than via `with`,
  // whose inferred type for a one() relation declared without fields is too
  // loose to read `.userId` off.
  const residentAccount =
    (await db.query.account.findFirst({ where: eq(account.residentId, resident.id) })) ?? null

  let staffId = residentAccount?.userId ?? null
  let staffCode: string | null = null
  let createdStaff = false

  if (staffId) {
    const existing = await db.query.user.findFirst({
      where: eq(user.id, staffId),
      columns: { id: true, code: true, role: true, active: true },
    })
    if (!existing?.active) {
      throw new Error('Linked staff identity is missing or inactive')
    }
    staffCode = existing.code
    await db.update(user).set(OPERATOR_CAPABILITIES).where(eq(user.id, existing.id))
  } else {
    const named = await db.query.user.findFirst({
      where: and(eq(user.name, resident.displayName || RESIDENT_NAME), eq(user.active, true)),
      columns: { id: true, code: true },
      with: { account: { columns: { id: true } } },
    })
    if (named && !named.account) {
      staffId = named.id
      staffCode = named.code
      await db.update(user).set(OPERATOR_CAPABILITIES).where(eq(user.id, named.id))
    } else {
      const code = await uniqueStaffCode()
      const [created] = await db
        .insert(user)
        .values({
          code,
          name: resident.displayName || RESIDENT_NAME,
          ...OPERATOR_CAPABILITIES,
          active: true,
        })
        .returning()
      staffId = created.id
      staffCode = created.code
      createdStaff = true
    }

    if (residentAccount) {
      await db.update(account).set({ userId: staffId }).where(eq(account.id, residentAccount.id))
    }
  }

  const residents = await db.query.resident.findMany({
    where: inArray(residentTable.status, ['ACTIVE', 'PLACED']),
    columns: { id: true, displayName: true },
  })

  let seatsFilled = 0
  for (const person of residents) {
    for (const role of CARE_ROLES) {
      const existing = await db.query.careAssignment.findFirst({
        where: and(eq(careAssignment.residentId, person.id), eq(careAssignment.role, role)),
        columns: { id: true },
      })
      if (existing) continue
      await db.insert(careAssignment).values({ residentId: person.id, staffId: staffId!, role })
      seatsFilled += 1
    }
  }

  console.log(`Resident ${resident.displayName} (${resident.code})`)
  console.log(`Staff ${staffCode} — Leitung, all three care domains`)
  if (createdStaff) {
    console.log('New staff code created. Register it with the SAME email as the resident account.')
  } else if (residentAccount?.userId || residentAccount) {
    console.log(
      'Staff identity is on the same login as the resident. Sign in once, switch in the nav.',
    )
  } else {
    console.log(
      'No resident Account yet. Register the resident code, then this staff code, with one email.',
    )
  }
  console.log(`Empty care seats filled: ${seatsFilled}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })
