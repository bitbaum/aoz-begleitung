/**
 * The real team — its SHAPE and loader. The people are not in this file.
 *
 * The repository is public, and who works for an organisation in which role is
 * personal data about them. So the list lives outside git, exactly like the
 * apartment config beside it:
 *
 *   1. `REAL_TEAM_FILE=/path/to/aoz-team.json`, or
 *   2. `scripts/db/real/aoz-team.local.json` (gitignored).
 *
 * `aoz-team.example.json` shows the shape with invented people; copy it and
 * fill in the real ones. Read by `scripts/maintenance/ensure-aoz-team.ts`.
 *
 * What the shape is for: role, reach and administration are three separate
 * columns, so a person can be described as they are rather than by the nearest
 * enum value. A Betreuer*in who also sees every client keeps the role and gets
 * `ALL_DOMAINS`; someone responsible for the buildings themselves holds
 * `LIEGENSCHAFTEN`, the one role staffed for no care domain
 * (`STAFF_ROLE_CARE_DOMAIN` leaves it undefined, `roleHasCaseload()` is how the
 * product asks). Running the house is not configuring the product:
 * `isSystemAdmin` is a deliberate, separate grant.
 *
 * ⚠️ The operator account is NOT part of this list and must not be added. It
 * is provisioned by `ensure-operator.ts`, matched by code, and keeps the
 * retired ADMIN role on purpose.
 *
 * ⚠️ People are matched by NAME. Changing a name in the local file later does
 * not rename anybody — it mints a SECOND user. Correct a name in the database,
 * not by editing the file.
 *
 * Login codes are never in the file either: they are generated when the script
 * runs and printed once.
 */

import { existsSync, readFileSync } from 'fs'
import { isAbsolute, join, relative, resolve } from 'path'

import { z } from 'zod'

import {
  STAFF_ROLES,
  STAFF_SCOPES,
  type StaffRole,
  type StaffScopeId,
} from '../../../src/lib/auth/role-policy'

export interface RealStaffSeed {
  /** Shown wherever staff are listed; never a bare code. */
  name: string
  /** The care domain this person is staffed for — or the work they do, when
   *  that is not a care domain at all (Liegenschaften). */
  role: StaffRole
  /** Whose files they may open. */
  scope: StaffScopeId
  /** May they reconfigure the product? */
  isSystemAdmin: boolean
  /** Why this shape, in one line — read by the script's output. */
  note: string
}

export const DEFAULT_TEAM_FILE = join(__dirname, 'aoz-team.local.json')
export const EXAMPLE_TEAM_FILE = join(__dirname, 'aoz-team.example.json')

const staffSchema = z.object({
  name: z.string().min(1),
  role: z.enum(STAFF_ROLES as readonly [StaffRole, ...StaffRole[]]),
  scope: z.enum(STAFF_SCOPES),
  isSystemAdmin: z.boolean(),
  note: z.string().min(1),
})

const teamSchema = z.object({ team: z.array(staffSchema).min(1) }).superRefine((config, ctx) => {
  const seen = new Set<string>()
  for (const person of config.team) {
    // Matching is by name, so two entries with one name are one user.
    if (seen.has(person.name)) {
      ctx.addIssue({ code: 'custom', message: `"${person.name}" is listed twice` })
    }
    seen.add(person.name)
  }
})

/** Parse a config object. Exported so the example file can be tested. */
export function parseTeamConfig(raw: unknown, source = 'team config'): readonly RealStaffSeed[] {
  const parsed = teamSchema.safeParse(raw)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
    throw new Error(`${source} is not valid:\n${issues}`)
  }
  return parsed.data.team
}

function configPath(): string {
  const fromEnv = process.env.REAL_TEAM_FILE?.trim()
  if (!fromEnv) return DEFAULT_TEAM_FILE
  return isAbsolute(fromEnv) ? fromEnv : resolve(process.cwd(), fromEnv)
}

/**
 * Read the local team file, or exit with a message that says exactly where to
 * put it. The script has nothing useful to do without it.
 */
export function loadTeamConfig(): readonly RealStaffSeed[] {
  const path = configPath()
  if (!existsSync(path)) {
    const shown = relative(process.cwd(), path) || path
    const example = relative(process.cwd(), EXAMPLE_TEAM_FILE)
    console.error(
      [
        `✋ No team config at ${shown}.`,
        '',
        'The real team (names and roles) is personal data and is not in this public',
        'repository. Put it in a local file:',
        '',
        `  cp ${example} scripts/db/real/aoz-team.local.json   # gitignored`,
        '  # then replace the invented people with the real ones',
        '',
        'or point REAL_TEAM_FILE at a file kept anywhere else.',
      ].join('\n'),
    )
    process.exit(1)
  }

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`could not read ${path} as JSON: ${(error as Error).message}`)
  }
  return parseTeamConfig(raw, path)
}
