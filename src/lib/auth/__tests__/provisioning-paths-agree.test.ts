/**
 * The two ways to create a colleague must accept the same roles.
 *
 * This product has provisioned staff through two endpoints since the role split:
 * `/api/auth/register` (admin-only, code returned) and `/api/auth/invite`
 * (admin-only, code emailed). They have now diverged TWICE.
 *
 * The first time was the permission check — `register`'s docstring said
 * admin-only while the code checked only that you were signed in, so any
 * authenticated Jobcoach could mint themselves a Leitung account. Fixed, and
 * the comment left behind in that file says "the two provisioning paths simply
 * disagreed".
 *
 * The second time was this one, and it survived because nobody looked for the
 * same class again: `invite` validated with `isStaffRole`, which accepts the
 * RETIRED `ADMIN`, while `register` had refused it since the split. The
 * settings form — the only staff-creation UI in the product — posts to
 * `invite`, and its dropdown offered "Leitung".
 *
 * So the rule is asserted about the SHARED source of truth rather than about
 * either route's implementation, and the source files are read to prove that
 * neither has quietly gone back to its own list.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ASSIGNABLE_STAFF_ROLES, STAFF_ROLES } from '../role-policy'

const INVITE = join(process.cwd(), 'src/app/api/auth/invite/route.ts')
const REGISTER = join(process.cwd(), 'src/app/api/auth/register/route.ts')
const FORM = join(process.cwd(), 'src/app/(admin)/settings/InviteForm.tsx')

const read = (path: string) => readFileSync(path, 'utf8')

describe('ADMIN is retired, and every path that creates staff knows it', () => {
  it('is in the enum but never assignable', () => {
    // It stays in STAFF_ROLES so existing rows and live JWTs keep resolving.
    expect(STAFF_ROLES).toContain('ADMIN')
    expect(ASSIGNABLE_STAFF_ROLES).not.toContain('ADMIN')
  })

  it.each([
    ['invite', INVITE],
    ['register', REGISTER],
  ])('/api/auth/%s validates against ASSIGNABLE_STAFF_ROLES', (_name, path) => {
    const source = read(path)
    expect(source).toContain('ASSIGNABLE_STAFF_ROLES')
  })

  it('the settings form offers only assignable roles', () => {
    // Iterating STAFF_ROLES here is what put "Leitung" in front of an
    // administrator as a thing they could create.
    const source = read(FORM)
    expect(source).toContain('ASSIGNABLE_STAFF_ROLES.map')
    // Lookbehind, because `ASSIGNABLE_STAFF_ROLES.map` CONTAINS the substring
    // `STAFF_ROLES.map` — a plain `not.toContain` fails against the correct
    // code, which is a test that can only ever be satisfied by the bug.
    expect(source).not.toMatch(/(?<!ASSIGNABLE_)STAFF_ROLES\.map/)
  })
})

describe('the form can describe the real team', () => {
  it('offers reach, because otherwise "Leitung" is the only way to say it', () => {
    /**
     * The all-domains Betreuerin is BETREUUNG + ALL_DOMAINS. Before this field existed, the only
     * way to create that account through the UI was to pick the retired role — which is
     * WHY it survived in the dropdown. Removing the option without adding this
     * would have taken away the only way to express that shape, so the two changes
     * belong together and this test says so.
     */
    const source = read(FORM)
    expect(source).toContain('STAFF_SCOPES.map')
    expect(source).toMatch(/scope/)
  })

  it('does not offer system administration on an invite form', () => {
    // Running the houses is not reconfiguring the product. Granting that is a
    // rare, deliberate act and must not ride along with adding a colleague.
    const source = read(FORM)
    expect(source).not.toContain('isSystemAdmin')
    expect(read(INVITE)).toContain('NARROWEST_CAPABILITIES.isSystemAdmin')
  })
})
