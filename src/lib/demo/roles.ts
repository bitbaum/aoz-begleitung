/**
 * Every door the demo offers — one per staff role, plus the resident.
 *
 * The product is only understandable from the inside, and it looks completely
 * different depending on who you are: Leitung sees the whole register, a
 * Jobcoach sees learning and the people they coach, a resident sees their own
 * flat. A demo that offers a single staff door shows one of those five and
 * calls it "the app".
 *
 * The list is DERIVED from `STAFF_ROLES` rather than written out again, so a
 * new role gets a door by existing. A hand-maintained second list is how the
 * demo ends up silently missing the role somebody added last month.
 *
 * Codes are derived too — `<brand prefix>DEMO-<role>` — so a rebrand carries
 * them along and nothing has to be re-typed into an env file. They are public
 * BY DESIGN: safety comes from the deployment opt-in (`DEMO_ACCESS_ENABLED`),
 * the per-IP rate limit, and the fact that a demo instance must hold only
 * seeded data.
 *
 * Relative-import-safe (no '@/' aliases): reached from ts-node seeds.
 */

import {
  NARROWEST_CAPABILITIES,
  STAFF_ROLES,
  WIDEST_CAPABILITIES,
  type StaffRole,
} from '../auth/role-policy'
import { BRAND } from '../config/brand'

/**
 * Short, stable token per role. Deliberately NOT the full role name: a login
 * code is read aloud and typed by hand, and `AOZ-DEMOFREIWILLIGENARBEIT` is
 * neither. Codes stay under the length a person can hold in their head.
 */
const ROLE_TOKEN: Record<StaffRole, string> = {
  ADMIN: 'LEIT',
  BETREUUNG: 'BETR',
  SOZIALARBEIT: 'SOZ',
  JOBCOACH: 'JOB',
  FREIWILLIGENARBEIT: 'FREI',
  LIEGENSCHAFTEN: 'LIEG',
}

/**
 * The login code for one role's demo account.
 *
 * `DEMO_STAFF_CODE` still wins for the Leitung door. A deployment already
 * running that env var (the live instance uses `WG-DEMO01`) has that code in
 * circulation — in a README, a message, somebody's notes — and silently
 * retiring it would break the one door people already know. Legacy codes
 * outlive the scheme that generated them, exactly like resident codes.
 */
export function demoStaffCodeFor(role: StaffRole): string {
  if (role === 'ADMIN') {
    const configured = process.env.DEMO_STAFF_CODE
    if (configured) return configured
  }
  return `${BRAND.codePrefix}DEMO${ROLE_TOKEN[role]}`
}

/**
 * How much each demo door sees, stated rather than implied by its role name.
 *
 * The Leitung door is the "sees everything" one, and since role, scope and
 * administration were separated that has to be SAID: a bare `role: 'ADMIN'`
 * row now takes the column defaults — own domain, no administration — which
 * would leave that door with no care seats at all and no settings page. The
 * shape below is the all-domains Betreuerin's: one domain of record, oversight over the rest.
 */
export function demoStaffReachFor(role: StaffRole): {
  scope: 'OWN_DOMAIN' | 'ALL_DOMAINS'
  isSystemAdmin: boolean
} {
  const { scope, isSystemAdmin } = role === 'ADMIN' ? WIDEST_CAPABILITIES : NARROWEST_CAPABILITIES
  return { scope, isSystemAdmin }
}

/** Display name for the upserted account, so staff lists never show a bare code. */
export function demoStaffNameFor(role: StaffRole): string {
  return `Demo ${ROLE_TOKEN[role]}`
}

export interface DemoStaffDoor {
  role: StaffRole
  code: string
  name: string
}

/**
 * Every staff door, in the order the role SSOT declares them.
 *
 * A function, not a const: the Leitung code can come from the environment, and
 * a module-level constant would freeze whatever `DEMO_STAFF_CODE` happened to
 * be at import time. That is invisible in production (env is set before the
 * process starts) and wrong everywhere else — a test setting the variable, or
 * a config reload, would be silently ignored by a value computed once.
 */
export function demoStaffDoors(): DemoStaffDoor[] {
  return STAFF_ROLES.map((role) => ({
    role,
    code: demoStaffCodeFor(role),
    name: demoStaffNameFor(role),
  }))
}

/** Every demo staff code, for the reset to recognise and restore. */
export function demoStaffCodes(): string[] {
  return demoStaffDoors().map((door) => door.code)
}

/**
 * The prefix every demo staff code shares.
 *
 * The scoped reset deletes by prefix, and these accounts must be findable the
 * same way demo residents are — otherwise a visitor who renamed one would
 * leave it renamed forever.
 */
export const DEMO_STAFF_CODE_PREFIX = `${BRAND.codePrefix}DEMO`
