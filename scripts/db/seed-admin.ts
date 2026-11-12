/**
 * Seed Initial Admin User (code-based auth)
 *
 * Usage:
 *   pnpm run db:seed:admin
 *
 * Without ADMIN_CODE a random code is generated and printed once. There is no
 * default code: the old default was published in this repository, so anyone
 * could sign in with it, and the login now refuses it (published-codes.ts).
 */

import { eq } from 'drizzle-orm'
import { db, user, account } from '@/lib/db'
import { BRAND } from '@/lib/config/brand'
import { WIDEST_CAPABILITIES } from '@/lib/auth/role-policy'
import { generateStaffCode } from '@/lib/auth/code-generation'
import { isPublishedCode } from '@/lib/auth/published-codes'

// Random unless given, with the active brand's prefix. Never a fixed default.
const ADMIN_CODE = process.env.ADMIN_CODE?.trim() || generateStaffCode()
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrator'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@aoz.ch'

async function main() {
  if (isPublishedCode(ADMIN_CODE)) {
    throw new Error(
      'ADMIN_CODE is a code that was published in this repository; the login refuses it. ' +
        'Unset ADMIN_CODE to have a random one generated.',
    )
  }

  console.log('Creating admin user...')

  // Check if admin already exists by code
  const existingByCode = await db.query.user.findFirst({
    where: eq(user.code, ADMIN_CODE),
  })

  if (existingByCode) {
    console.log(`Admin user already exists with code: ${ADMIN_CODE}`)
    return
  }

  // Email lives on the Account, not the User — an admin seeded under a former
  // code prefix is found through the account that carries the same email.
  const existingByEmail = ADMIN_EMAIL
    ? await db.query.account.findFirst({
        where: eq(account.email, ADMIN_EMAIL.toLowerCase()),
        columns: { userId: true },
      })
    : null

  if (existingByEmail?.userId) {
    // Update existing user to have a code
    await db.update(user).set({ code: ADMIN_CODE }).where(eq(user.id, existingByEmail.userId))
    console.log(`Updated existing admin with code: ${ADMIN_CODE}`)
    return
  }

  // Create admin user. No password: the account is deliberately unclaimed, so
  // the first sign-in proves mailbox control via /forgot-password.
  //
  // Reach is SPREAD from the SSOT, never restated here. This row used to say
  // `role: 'ADMIN'` and nothing else, which was complete while ADMIN meant all
  // three things at once. Once they became separate columns, the same line
  // produced a bootstrap admin holding the column DEFAULTS — own domain, no
  // administration — so a freshly seeded instance had no system administrator
  // and an unreachable settings page. The migration only backfilled rows that
  // already existed; seeding is the other way an admin is born, and it was not
  // updated. Spreading the SSOT means a third axis cannot repeat this.
  const admin = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(user)
      .values({
        code: ADMIN_CODE,
        name: ADMIN_NAME,
        ...WIDEST_CAPABILITIES,
        active: true,
      })
      .returning()
    await tx.insert(account).values({ email: ADMIN_EMAIL.toLowerCase(), userId: created.id })
    return created
  })

  console.log('Admin user created successfully!')
  console.log(`  Code: ${admin.code}`)
  console.log(`  Name: ${admin.name}`)
  console.log(`  Role: ${admin.role}`)
  console.log('')
  console.log(`Use code "${admin.code}" to log in.`)
  console.log('')
  console.log(`To generate additional staff codes, use: ${generateStaffCode()}`)
}

main()
  .then(() => {
    // The pg Pool keeps the event loop alive — exit explicitly on success.
    process.exit(0)
  })
  .catch((e) => {
    console.error('Error creating admin user:', e)
    process.exit(1)
  })
