/**
 * Demo access configuration (SSOT).
 *
 * The demo is not a separate product — it is the REAL product behind a door
 * that needs no account. Anyone landing on /login can try it exactly as a
 * resident (or, where configured, staff) would use it. The credentials are
 * public BY DESIGN; safety comes from the reset (api/cron/reset-demo), the
 * login rate limit, and the operator opt-in via env.
 *
 * ⚠️ THERE IS NO LONGER A DEMO WORLD TO RESET. The fabricated one — 15
 * invented residents in 5 `DEMO-` units, truncated and re-seeded nightly — was
 * deleted from production on 2026-09-08 along with its seed, its two reset
 * scopes and its cron endpoint. What remains here is the DOOR: which no-account
 * logins this deployment offers into the real product.
 *
 * The data behind that door is now real flats holding CLAIMABLE PLACEHOLDER
 * profiles (`scripts/db/seed-placeholders.ts`), which persist precisely because
 * a profile you can take over must survive the night.
 *
 * Relative-import-safe (no '@/' aliases): seeding scripts load this through
 * ts-node, which does not resolve tsconfig path aliases.
 */

// Relative on purpose — see the note above about ts-node and path aliases.
import { ALL_RESIDENT_CODE_PREFIXES, RESIDENT_CODE_PREFIX } from '../auth/code-prefixes'

/**
 * Master switch — server-side. The login page asks GET /api/auth/demo.
 *
 * SECURITY: Demo access is ALWAYS disabled in production, regardless of env var.
 * Demo logins create real sessions against the live database, so they must never
 * be enabled where real data exists.
 *
 * In non-production environments (development, test), the DEMO_ACCESS_ENABLED
 * env var controls availability.
 */
export function isDemoEnabled(): boolean {
  // Hard gate: demo access is NEVER available in production
  if (process.env.NODE_ENV === 'production') {
    return false
  }

  // In non-production, the env var controls it
  return process.env.DEMO_ACCESS_ENABLED === 'true'
}

/**
 * The demo staff login code. A DEDICATED account (not a real admin's code) so
 * drive-by demo sessions never share a real staff member's identity or audit
 * trail.
 *
 * It no longer self-heals nightly, because there is no nightly reset: the
 * account is provisioned once, like any other staff account. `DEMO_RESET_SCOPE`
 * and `getDemoResetScope()` were removed with the fabricated world they chose
 * between.
 */
export function getDemoStaffCode(): string | null {
  return process.env.DEMO_STAFF_CODE || null
}

/** Display name for the upserted demo staff account (German UI). */
export const DEMO_STAFF_NAME = 'Demo-Zugang'

/**
 * Every fictional resident in the demo world gets a code with this prefix,
 * so the scoped reset can always find them for deletion — even after a
 * visitor edited their profiles.
 *
 * Derived from the brand's client prefix rather than hardcoded, so demo codes
 * speak the same register as real ones.
 */
export const DEMO_RESIDENT_CODE_PREFIX = `${RESIDENT_CODE_PREFIX}DEMO`

/**
 * Demo prefixes under EVERY client prefix the product has ever issued.
 *
 * The reset deletes by prefix. If it matched only today's prefix, demo rows
 * seeded under a previous one would survive every reset — invisible, never
 * cleaned, and on a `unit`-scope instance sitting next to real data forever.
 * A cleanup that silently stops covering old rows is worse than no cleanup,
 * because the summary still says it succeeded.
 */
export const ALL_DEMO_RESIDENT_CODE_PREFIXES: readonly string[] = ALL_RESIDENT_CODE_PREFIXES.map(
  (prefix) => `${prefix}DEMO`,
)

/**
 * Every demo housing unit's code carries this prefix. It is what makes the
 * scoped reset safe on an instance holding real data: deletion targets
 * prefixes, never tables.
 */
export const DEMO_UNIT_CODE_PREFIX = 'DEMO-'

/**
 * The demo resident login code — the seed assigns it to a PLACED resident,
 * so the portal demo shows a lived-in apartment, not an empty shell.
 * Always resolvable: env override, else the default.
 */
export function resolveDemoResidentCode(): string {
  return process.env.DEMO_RESIDENT_CODE || `${DEMO_RESIDENT_CODE_PREFIX}1`
}
