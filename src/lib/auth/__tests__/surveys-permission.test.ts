/**
 * Who may read survey results and who may send surveys.
 *
 * Betreuung and Sozialarbeit — the two roles whose work is how a person is
 * doing at home — hold both. The integration roles and Liegenschaften hold
 * neither. A system admin holds both, as they hold everything.
 */

import fs from 'fs'
import path from 'path'
import { ASSIGNABLE_STAFF_ROLES, hasPermission, type StaffRole } from '../role-policy'

const caps = (
  role: StaffRole,
  extra: { scope?: 'OWN_DOMAIN' | 'ALL_DOMAINS'; isSystemAdmin?: boolean } = {},
) => ({
  role,
  scope: extra.scope ?? ('OWN_DOMAIN' as const),
  isSystemAdmin: extra.isSystemAdmin ?? false,
})

const EXPECTED: Record<Exclude<StaffRole, 'ADMIN'>, boolean> = {
  BETREUUNG: true,
  SOZIALARBEIT: true,
  JOBCOACH: false,
  FREIWILLIGENARBEIT: false,
  LIEGENSCHAFTEN: false,
}

describe('survey permissions', () => {
  it.each(ASSIGNABLE_STAFF_ROLES.map((role) => [role]))('%s', (role) => {
    const expected = EXPECTED[role as Exclude<StaffRole, 'ADMIN'>]
    expect({
      read: hasPermission(caps(role), 'surveys:read'),
      write: hasPermission(caps(role), 'surveys:write'),
    }).toEqual({ read: expected, write: expected })
  })

  it('a system admin holds both whatever their role', () => {
    for (const role of ASSIGNABLE_STAFF_ROLES) {
      expect(hasPermission(caps(role, { isSystemAdmin: true }), 'surveys:write')).toBe(true)
    }
  })

  it('every survey page and action asks for one of them', () => {
    const root = path.resolve(__dirname, '../../../..')
    const files = [
      'src/app/(admin)/surveys/page.tsx',
      'src/app/(admin)/surveys/new/page.tsx',
      'src/app/(admin)/surveys/[id]/page.tsx',
      'src/lib/actions/surveys.ts',
    ]
    for (const file of files) {
      const source = fs.readFileSync(path.join(root, file), 'utf8')
      expect({ file, guarded: /requirePermission\('surveys:(read|write)'\)/.test(source) }).toEqual(
        {
          file,
          guarded: true,
        },
      )
    }
    // Writing actions ask for write, never just read.
    const actions = fs.readFileSync(path.join(root, 'src/lib/actions/surveys.ts'), 'utf8')
    expect(actions).not.toMatch(/requirePermission\('surveys:read'\)/)
  })
})
