/**
 * Provision the real AOZ team, idempotently.
 *
 * Reads the local team file (see `scripts/db/real/aoz-team.ts` for where it
 * lives; it is never committed) and makes the database match it. Safe to run
 * repeatedly: an existing person is matched by name and UPDATED to the shape
 * the config declares, so this doubles as the way to correct someone's reach
 * after the fact. A code is minted only for someone who does not exist yet,
 * and it is printed ONCE — this script is the only time anybody sees it.
 *
 * Usage (from repo root, against the target DB env):
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/maintenance/ensure-aoz-team.ts
 *
 * Add DRY_RUN=1 to see what it would do without writing.
 */

import { eq } from 'drizzle-orm'
import { db, user } from '../../src/lib/db'
import { loadTeamConfig } from '../db/real/aoz-team'
import { BRAND } from '../../src/lib/config/brand'
import { generateStaffCode } from '../../src/lib/auth/code-generation'
import { CARE_ROLES, CARE_ROLE_LABELS, STAFF_ROLE_CARE_DOMAIN } from '../../src/lib/config/care'

const DRY_RUN = process.env.DRY_RUN === '1'

/**
 * A code is minted with the BRAND's prefix, and `BRAND` falls back to
 * `DEFAULT_BRAND_ID` when `NEXT_PUBLIC_BRAND` is unset — which it always is on
 * a laptop. So running this against a deployment without carrying that
 * deployment's brand across mints credentials for the wrong product and says
 * nothing: the codes still WORK, because login resolves by exact string, so
 * there is no failure to notice. Three people would simply be holding codes
 * branded for something else, forever, since a code outlives the brand that
 * issued it and can never be re-prefixed.
 *
 * It went unnoticed the first time this ran only because the default happens
 * to equal what production is set to. That is luck, not a guarantee — and
 * CLAUDE.md still described the live brand as a different one, so the belief
 * that would have "explained" the mismatch was itself wrong.
 *
 * So: say which deployment you are provisioning, or do not mint.
 */
function requireExplicitBrand(): void {
  if (process.env.NEXT_PUBLIC_BRAND) return
  throw new Error(
    'NEXT_PUBLIC_BRAND is not set, so new codes would take the default brand ' +
      `prefix ("${BRAND.codePrefix}") rather than the target deployment's. ` +
      'Export the brand from the deployment you are provisioning, e.g.\n' +
      "  NEXT_PUBLIC_BRAND=$(ssh root@<box> 'grep -m1 ^NEXT_PUBLIC_BRAND= " +
      "/opt/<app>/shared/.env' | cut -d= -f2)",
  )
}

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
  const AOZ_TEAM = loadTeamConfig()
  const minted: { name: string; code: string }[] = []
  console.log(
    `Brand: ${process.env.NEXT_PUBLIC_BRAND ?? '(unset)'} — neue Codes: ${BRAND.codePrefix}…`,
  )

  for (const person of AOZ_TEAM) {
    const capabilities = {
      role: person.role,
      scope: person.scope,
      isSystemAdmin: person.isSystemAdmin,
    }

    const existing = await db.query.user.findFirst({
      where: eq(user.name, person.name),
      columns: { id: true, code: true, role: true, scope: true, isSystemAdmin: true, active: true },
    })

    if (existing) {
      const drifted =
        existing.role !== person.role ||
        existing.scope !== person.scope ||
        existing.isSystemAdmin !== person.isSystemAdmin ||
        !existing.active

      if (!drifted) {
        console.log(`= ${person.name} (${existing.code}) already matches the config`)
        continue
      }
      console.log(
        `~ ${person.name} (${existing.code}): ${existing.role}/${existing.scope}` +
          `${existing.isSystemAdmin ? '/admin' : ''}` +
          ` -> ${person.role}/${person.scope}${person.isSystemAdmin ? '/admin' : ''}`,
      )
      if (!DRY_RUN) {
        await db
          .update(user)
          .set({ ...capabilities, active: true })
          .where(eq(user.id, existing.id))
      }
      continue
    }

    // Checked at the moment of minting, not at startup: a run that only
    // UPDATES existing people needs no brand, and refusing it would be a gate
    // that fires where there is nothing to get wrong.
    requireExplicitBrand()
    const code = DRY_RUN ? `${BRAND.codePrefix}<generated at run time>` : await uniqueStaffCode()
    console.log(`+ ${person.name}: ${person.role}/${person.scope}`)
    if (!DRY_RUN) {
      await db.insert(user).values({ code, name: person.name, ...capabilities, active: true })
      minted.push({ name: person.name, code })
    }
  }

  // Which care seats nobody is staffed for. AOZ has no Sozialarbeit person, so
  // this is expected to report SOCIAL — but reporting it is the point: an
  // unstaffed seat is a fact somebody should know, not an empty column that
  // quietly looks the same as a staffed one nobody has used yet.
  const staffedDomains = new Set(AOZ_TEAM.map((p) => STAFF_ROLE_CARE_DOMAIN[p.role]))
  const covers = AOZ_TEAM.filter((p) => p.scope === 'ALL_DOMAINS').map((p) => p.name)
  const unstaffed = CARE_ROLES.filter((domain) => !staffedDomains.has(domain))

  console.log('')
  for (const person of AOZ_TEAM) console.log(`  ${person.name} — ${person.note}`)

  if (unstaffed.length > 0) {
    console.log('')
    console.log(
      `Kein eigenes Personal für: ${unstaffed.map((d) => CARE_ROLE_LABELS[d]).join(', ')}`,
    )
    console.log(
      covers.length > 0
        ? `  abgedeckt durch: ${covers.join(', ')} (ALL_DOMAINS)`
        : '  NIEMAND deckt diese Bereiche ab — Anfragen dort landen bei niemandem.',
    )
  }

  if (minted.length > 0) {
    console.log('')
    console.log('Login-Codes — EINMALIG angezeigt, nirgends gespeichert:')
    for (const { name, code } of minted) console.log(`  ${name}: ${code}`)
    console.log('')
    console.log('Diese Codes persönlich weitergeben und danach dieses Terminal schliessen.')
  }

  if (DRY_RUN) console.log('\n(DRY_RUN=1 — nichts geschrieben)')
}

main()
  .catch((e) => {
    console.error('ensure-aoz-team failed:', e)
    process.exit(1)
  })
  .finally(() => {
    process.exit(0)
  })
