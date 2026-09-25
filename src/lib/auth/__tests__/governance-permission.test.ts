import { readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'vitest'

import { ROLE_PERMISSIONS, STAFF_ROLES } from '@/lib/auth/role-policy'
import { DASHBOARD_SECTIONS } from '@/lib/config/dashboard'

/**
 * Answering a household's proposals is not the same job as running its
 * building.
 *
 * WHAT SHIPPED, AND FOR HOW LONG: every action in `lib/actions/governance.ts`
 * took `requireStaffAuth()` — signed in, nothing more. Ten of them. So any
 * staff member could confirm a house decision, create or archive an AOZ rule,
 * close voting or advance a conflict stage, including two roles that cannot
 * see /rules in their own navigation. The menu honoured a boundary the code
 * did not, exactly as the message and maintenance surfaces once did.
 *
 * The /rules PAGE had no permission check either — `requireStaffAuth()` while
 * its nav entry declared `housing:read`.
 *
 * And the dashboard queue for it was gated on `housing:read`, which was a fair
 * approximation while `housing:read` implied a care role. Adding
 * LIEGENSCHAFTEN broke that silently: the Liegenschaften lead holds `housing:read` to run the
 * building stock, and it handed that role the queue where SAFETY and
 * NON-DISCRIMINATION proposals land — the topics this product refuses to put
 * to a vote precisely because a majority must not decide them.
 *
 * Found by opening the dashboard as the Liegenschaften lead.
 */

const ROOT = join(__dirname, '..', '..', '..', '..')

function codeOf(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

const ACTIONS = 'src/lib/actions/governance.ts'

describe('who may answer a household', () => {
  const holders = STAFF_ROLES.filter((role) =>
    (ROLE_PERMISSIONS[role] as readonly string[]).includes('governance:confirm'),
  ).sort()

  it('is the roles that support the people living there', () => {
    expect(holders).toEqual(['ADMIN', 'BETREUUNG', 'SOZIALARBEIT'])
  })

  it('is NOT the role that runs the buildings', () => {
    // The Liegenschaften lead keeps housing:read and can still READ the rule book of a house it
    // runs. Answering the household is a different job.
    const liegenschaften = ROLE_PERMISSIONS.LIEGENSCHAFTEN as readonly string[]
    expect(liegenschaften).not.toContain('governance:confirm')
    expect(liegenschaften).toContain('housing:read')
  })

  it('is NOT the integration roles', () => {
    for (const role of ['JOBCOACH', 'FREIWILLIGENARBEIT'] as const) {
      expect(ROLE_PERMISSIONS[role] as readonly string[]).not.toContain('governance:confirm')
    }
  })
})

describe('every governance action enforces it', () => {
  it('no action falls back to "merely signed in"', () => {
    // The whole defect in one assertion. requireStaffAuth() proves a session,
    // never a right.
    expect(codeOf(ACTIONS)).not.toMatch(/requireStaffAuth\(/)
  })

  it('and each one names the permission', () => {
    const source = codeOf(ACTIONS)
    const exported = [...source.matchAll(/^export async function (\w+)/gm)].map((m) => m[1])
    const guards = [...source.matchAll(/requirePermission\(\s*'governance:confirm'\s*\)/g)].length

    // Every exported action except the pure date helper performs a write.
    expect(exported.length).toBeGreaterThan(8)
    expect(guards).toBeGreaterThanOrEqual(exported.length - 1)
  })
})

describe('the surfaces agree with each other', () => {
  it('the work queue is gated on being able to do the work', () => {
    expect(DASHBOARD_SECTIONS.proposals).toBe('governance:confirm')
  })

  it('the rules page checks a permission at all', () => {
    // It previously took only a session, while its nav entry declared
    // housing:read — the menu enforcing what the page did not.
    const page = codeOf('src/app/(admin)/rules/page.tsx')
    expect(page).toMatch(/requirePermission\(/)
    expect(page).not.toMatch(/requireStaffAuth\(/)
  })

  it('reading the rule book stays wider than answering it', () => {
    // Deliberate: a person who runs a house may read its rules. If these two
    // ever collapse into one permission, somebody has lost that distinction.
    expect(DASHBOARD_SECTIONS.proposals).not.toBe('housing:read')
  })
})
