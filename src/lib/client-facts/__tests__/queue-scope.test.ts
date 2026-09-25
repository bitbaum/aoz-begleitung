import { readFileSync } from 'fs'
import { join } from 'path'

import { describe, expect, it } from 'vitest'

import { ROLE_PERMISSIONS } from '@/lib/auth/role-policy'
import { STAFF_ROUTES } from '@/lib/auth/route-boundaries'
import { MEGAMENU_GROUPS } from '@/lib/config/navigation'

/**
 * The approval queue must not hand anyone more than their job needs.
 *
 * `clientFacts:read` says only that a person HAS a queue. Which facts appear
 * in it is decided per kind against the seats they hold — so the dangerous
 * mistake is not a missing permission, it is a page that reads the permission
 * and then queries everything.
 */

const ROOT = join(__dirname, '..', '..', '..', '..')

function codeOf(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

describe('who holds the permission', () => {
  const holders = Object.entries(ROLE_PERMISSIONS)
    .filter(([, permissions]) => (permissions as readonly string[]).includes('clientFacts:read'))
    .map(([role]) => role)
    .sort()

  it('is the care roles that support a person, plus the coach for permits', () => {
    expect(holders).toEqual(['ADMIN', 'BETREUUNG', 'JOBCOACH', 'SOZIALARBEIT'])
  })

  it('is NOT held by the role that runs the buildings', () => {
    // The Liegenschaften lead places people into flats. That is not a reason to hold anyone's
    // health insurance or their list of doctors.
    expect(ROLE_PERMISSIONS.LIEGENSCHAFTEN as readonly string[]).not.toContain('clientFacts:read')
  })

  it('is NOT held by the volunteering coordinator', () => {
    expect(ROLE_PERMISSIONS.FREIWILLIGENARBEIT as readonly string[]).not.toContain(
      'clientFacts:read',
    )
  })

  it('is a permission of its own, not residents:read', () => {
    // All four care roles hold residents:read, so gating on it is a check
    // nobody fails — the exact error the messages pages shipped with.
    const page = codeOf('src/app/(admin)/approvals/page.tsx')
    expect(page).toMatch(/requirePermission\(['"]clientFacts:read['"]\)/)
  })
})

describe('the page narrows in the query, not in the markup', () => {
  it('passes the viewer scope and own seat to the queue', () => {
    // Asserted as "derives the seat AND passes it", not as one literal call
    // shape: the seat is now computed once and shared with the renewals list,
    // and a gate that pins formatting rather than behaviour fails on a
    // refactor that changed nothing it cares about.
    const page = codeOf('src/app/(admin)/approvals/page.tsx')
    expect(page).toMatch(/pendingFactQueue\(/)
    expect(page).toMatch(/scope: viewer\.scope/)
    expect(page).toMatch(/ownSeat\(viewer\.role\)/)
    expect(page).toMatch(/ownDomain:/)
  })

  it('asks the policy which kinds to query at all', () => {
    // A kind the viewer may not read must be a query never issued. Fetching
    // and filtering afterwards puts the rows in the payload, and the payload
    // is the leak — the same defect as employer contact details on the
    // opportunities board.
    const queue = codeOf('src/lib/client-facts/queue.ts')
    expect(queue).toMatch(/mayReadFact\(/)
  })
})

describe('the surfaces are reachable and guarded', () => {
  it('declares /approvals staff-only', () => {
    expect(STAFF_ROUTES).toContain('/approvals')
  })

  it('links it from the client group with its own permission', () => {
    const items = MEGAMENU_GROUPS.flatMap((group) => ('items' in group ? group.items : [])) as {
      href?: string
      permission?: string
    }[]
    const entry = items.find((item) => item.href === '/approvals')
    expect(entry).toBeDefined()
    expect(entry?.permission).toBe('clientFacts:read')
  })
})
