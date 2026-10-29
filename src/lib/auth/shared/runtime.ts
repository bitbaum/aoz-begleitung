/**
 * AOZ on AccountKit: the shared credential lifecycle, wired to AOZ's
 * identities. Off until AUTH_RUNTIME=accountkit; the legacy handlers stay
 * authoritative until the final import and switch (docs/ACCOUNTKIT-MIGRATION.md).
 *
 * - A login code is a domain proof: it opens a session scoped to its own side.
 * - A claim link or a code gives its identity a first password through
 *   AccountKit's claim, and joins a second identity only on the existing
 *   account's own password.
 * - Imported bcrypt hashes keep working under their original ids.
 */
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { createAuthRuntime } from '@bitbaum/accountkit/auth/next'
import { createAuthMailer } from '@bitbaum/accountkit/auth/mail'
import type { AccountProvisioning } from '@bitbaum/accountkit/auth/server'
import { BRAND } from '@/lib/config/brand'
import { getAppUrl } from '@/lib/config/app-url'
import { db, resident } from '@/lib/db'
import { releaseClaimInvite, takeClaimInvite } from '../claim-invites'
import { SESSION_DURATION_SECONDS } from '../constants'
import { bindSessionScope, linkIdentity, sharedUserForCode, sharedUserHoldsStaff } from './identity'

/** Whether the shared runtime answers. The legacy handlers answer otherwise. */
export function sharedAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.AUTH_RUNTIME === 'accountkit'
}

/** Proofs a claim may carry: a personal claim link, or a login code. */
export const CLAIM_PROOF = {
  link: (token: string) => `link:${token}`,
  code: (code: string) => `code:${code}`,
} as const

const site = () => ({
  url: getAppUrl(),
  title: BRAND.productName,
  slug: 'aoz',
})

/** A claimed resident profile is a person's, not a seed's. */
async function clearPlaceholder(side: string, actorId: string): Promise<void> {
  if (side !== 'resident') return
  await db.update(resident).set({ isPlaceholder: false }).where(eq(resident.id, actorId))
}

export const provisioning: AccountProvisioning = {
  async resolve(credential) {
    const split = credential.indexOf(':')
    const kind = credential.slice(0, split)
    const value = credential.slice(split + 1)
    if (split < 1 || !value) return null

    let release: (() => Promise<void>) | undefined
    let code = value
    if (kind === 'link') {
      // Taken now, so two claims of one link cannot both succeed.
      const taken = await takeClaimInvite(value)
      if (!taken) return null
      code = taken.code
      release = () => releaseClaimInvite(taken.id)
    } else if (kind !== 'code') {
      return null
    }

    const identity = await sharedUserForCode(code)
    if (!identity) {
      await release?.()
      return null
    }
    return {
      userId: identity.sharedUserId,
      link: (target) => linkIdentity(identity.side, identity.actorId, target),
      complete: () => clearPlaceholder(identity.side, identity.actorId),
      release,
    }
  },
}

export const domainCredentials = {
  async verify(code: string) {
    const identity = await sharedUserForCode(code.trim())
    if (!identity) return null
    return {
      userId: identity.sharedUserId,
      // A code opens its own side only: a resident code on a dual account
      // must not open the staff surface, and the other way round.
      bindSession: (sessionId: string) =>
        bindSessionScope(sessionId, { side: identity.side, impersonatorStaffId: null }),
    }
  },
}

/** Account mail through the fleet transport (RESEND_*), the one AOZ already sends with. */
export const sharedAuthMailer = createAuthMailer({
  site: site(),
  subjects: {
    verify: `E-Mail-Adresse für ${BRAND.productName} bestätigen`,
    magicLink: `Bei ${BRAND.productName} anmelden`,
    reset: `Passwort für ${BRAND.productName} zurücksetzen`,
  },
})

export const sharedAuth = createAuthRuntime({
  site: site(),
  mail: sharedAuthMailer,
  isDatabaseConfigured: (env) => sharedAuthEnabled(env) && Boolean(env.DATABASE_URL),
  getDatabase: () => db,
  legacyBcrypt: bcrypt,
  domainCredentials,
  provisioning,
  // Staff sessions keep AOZ's 8-hour idle limit (SESSION_DURATION); anyone
  // holding a staff identity gets it, on every session of that account.
  sessionLifetime: async (userId) =>
    (await sharedUserHoldsStaff(userId)) ? SESSION_DURATION_SECONDS : null,
})
