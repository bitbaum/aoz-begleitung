/**
 * Self-serve onboarding: sign up with no code and create your own household.
 *
 * WHY THIS IS ONE ATOMIC OPERATION AND NOT A TWO-STEP WIZARD
 * ----------------------------------------------------------
 * This product has no session for an account that holds no identity. Cookies
 * are minted PER IDENTITY — `staff_session` for a `User`, `resident_code` for
 * a `Resident` — and `establishSessions()` sets whichever the account's
 * identities call for. An account with neither would therefore be logged in as
 * nothing: it could not reach a second "now create your household" screen,
 * because every guarded page resolves the viewer from one of those two cookies.
 *
 * Adding a third "account session" cookie to carry a half-finished signup would
 * mean a new authenticated state that every guard, every middleware branch and
 * every audit line has to learn about — for a state that lasts thirty seconds.
 * So the whole thing happens in one transaction instead: account, household,
 * resident and placement, or none of them.
 *
 * WHAT THIS DELIBERATELY DOES NOT CREATE: a staff `User`.
 * -------------------------------------------------------
 * Staff permissions are GLOBAL. `requirePermission('residents:read')` asks what
 * role you hold, not which household you belong to, so a self-serve staff
 * account would be able to read every resident in the database — on a shared
 * deployment that is every resident of every flat. The portal is unit-scoped by
 * construction (`getPortalAuth()` resolves the viewer's current placement), so
 * the self-serve door opens onto the portal and nowhere else. A household needs
 * no administrator; it needs the people who live in it.
 *
 * Gated by `BRAND.features.selfServeHousehold`, which is OFF for AOZ. @see brand.ts
 */

import {
  db,
  account,
  housingUnit,
  placement,
  resident,
  isUniqueViolation,
  type NewResident,
} from '@/lib/db'
import { eq } from 'drizzle-orm'
import { BRAND } from '@/lib/config/brand'
import { generateResidentCode } from './code-generation'
import { hashPassword } from './passwords'
import { sendVerificationEmail, type AccountIdentities } from './account'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { logger } from '@/lib/logger'

/**
 * Compatibility defaults for a person who has answered nothing yet.
 *
 * Onboarding asks for a household name and what to call you. It does NOT ask
 * for age band, gender, family status or sleep schedule, because this product's
 * first principle is to collect the minimum — and none of those are needed to
 * split a grocery bill or run a cleaning rota. They exist for MATCHING, which
 * is an AOZ placement concern and not something a flat does to itself.
 *
 * So every one of them starts neutral and the resident fills them in later at
 * /portal/preferences if they ever want matching to mean anything.
 * `preferencesCompletedAt` stays null, which is the existing signal for
 * "this person has not told us their preferences" — the same one staff-created
 * residents use, so nothing downstream needs a new case.
 *
 * `gender: PREFER_NOT_SAY` is the point, not a placeholder: the schema requires
 * a value and the honest one for a question nobody asked is the refusal.
 */
function unansweredPreferences() {
  return {
    ageRange: 'ADULT',
    gender: 'PREFER_NOT_SAY',
    familyStatus: 'SINGLE',
    sleepSchedule: 'STANDARD',
    noiseTolerance: 3,
    cleanlinessPractice: 3,
    socialStyle: 'MODERATE',
    smokingStatus: 'NON_SMOKER',
    mobilityNeeds: 'NONE',
    privacyNeed: 3,
    // A function, not a shared constant: `languages` is an array, and one
    // frozen instance handed to every create is the kind of shared mutable
    // default that goes wrong quietly and late.
    languages: [] as string[],
  } satisfies Partial<NewResident>
}

/**
 * A brand-new flat, sized for one person.
 *
 * Deliberately minimal: the founder is the only occupant that exists, so
 * claiming "4 beds" would be inventing capacity nobody entered. Adding rooms
 * and flatmates is a normal edit afterwards; a wrong number on day one is a
 * number somebody has to notice and correct.
 */
const NEW_HOUSEHOLD_SHAPE = {
  totalBeds: 1,
  totalRooms: 1,
  sharedRooms: 0,
  privateRooms: 1,
  sharedBathrooms: 1,
  privateBathrooms: 0,
} as const

export interface CreateHouseholdInput {
  email: string
  password: string
  /** What this person wants to be called. Optional — the code still works. */
  displayName?: string
  /** The flat's name, e.g. "Singapur" or a street address. */
  householdName: string
}

export type CreateHouseholdResult =
  | { success: true; identities: AccountIdentities; residentCode: string }
  | { success: false; error: string }

/** Unit codes are internal references, not login codes — but still unique. */
function newHouseholdCode(): string {
  return `${BRAND.codePrefix}WG${Math.floor(Math.random() * 900000 + 100000)}`
}

export async function registerWithNewHousehold(
  input: CreateHouseholdInput,
): Promise<CreateHouseholdResult> {
  if (!BRAND.features.selfServeHousehold) {
    // Not a 404 and not a lie: this deployment provisions identities through
    // intake, and saying so is better than a door that silently does nothing.
    return { success: false, error: ERROR_MESSAGES.AUTH_CODE_REQUIRED }
  }

  const { email, password, displayName, householdName } = input

  // One email is one account, always — the unique index is the only thing
  // that could tell staff and resident logins apart, and it does not.
  const existing = await db.query.account.findFirst({
    where: eq(account.email, email),
    columns: { id: true },
  })
  if (existing) return { success: false, error: ERROR_MESSAGES.AUTH_EMAIL_TAKEN }

  const passwordHash = await hashPassword(password)

  try {
    const created = await db.transaction(async (tx) => {
      const [unit] = await tx
        .insert(housingUnit)
        .values({
          code: newHouseholdCode(),
          // The name the person typed IS the address line until they edit it.
          // A blank address on a required column would be a lie stored forever.
          address: householdName,
          nickname: householdName,
          ...NEW_HOUSEHOLD_SHAPE,
          // One bed, one occupant: this flat is at capacity the moment it is
          // created. AVAILABLE would advertise a free bed that does not exist.
          status: 'FULL',
        })
        .returning({ id: housingUnit.id })

      const [founder] = await tx
        .insert(resident)
        .values({
          code: generateResidentCode(),
          displayName: displayName?.trim() || null,
          status: 'PLACED',
          ...unansweredPreferences(),
        })
        .returning({ id: resident.id, code: resident.code })

      await tx.insert(placement).values({
        residentId: founder.id,
        housingUnitId: unit.id,
        startDate: new Date(),
      })

      const [acct] = await tx
        .insert(account)
        .values({ email, passwordHash, residentId: founder.id })
        .returning({ id: account.id })

      return { accountId: acct.id, resident: founder }
    })

    // Outside the transaction AND swallowed on purpose.
    //
    // The household, the resident and the account are already committed. If the
    // mail provider is down and this throws, the caller returns 500 and the
    // person is told their signup failed — while it actually succeeded, and
    // their email is now taken, so retrying returns "already in use". They
    // would be locked out of a flat that exists.
    //
    // Verification is a nicety here (it does not gate login), so a failed send
    // is logged and dropped. The password-reset flow makes the opposite call
    // for the opposite reason: there, a silent failure IS the lockout.
    await sendVerificationEmail(created.accountId, email).catch((error: unknown) => {
      logger.errorWithCause('Household created but verification email failed', error)
    })

    return {
      success: true,
      residentCode: created.resident.code,
      // Resident only, and no `staff` key at all — see the header: a
      // self-serve staff identity would read every resident in the database.
      identities: {
        resident: { id: created.resident.id, code: created.resident.code },
      },
    }
  } catch (error) {
    // The only realistic collision is a generated code that already exists.
    // Reporting it as a generic save failure is right: the caller retries, and
    // nothing about our code space is the user's business.
    if (isUniqueViolation(error)) {
      return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
    }
    throw error
  }
}
