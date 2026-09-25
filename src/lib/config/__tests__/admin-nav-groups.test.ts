/**
 * The admin nav, checked against EVERY role — which is the whole point.
 *
 * `AdminSidebar.test.tsx` has forbidden one-item accordions since the sidebar
 * shipped, and it asserted it for ADMIN: the one viewer whose groups are always
 * full, so the rule could never fire. Walked live on 2026-09-03, the Jobcoach
 * (JOBCOACH) had THREE one-item accordions and the Freiwilligenarbeit coordinator had the same, with the
 * suite green throughout.
 *
 * That is the same shape as the portal defect CLAUDE.md documents — a group
 * named "Zusammen entscheiden" holding nothing to decide, because the check ran
 * against a configuration where the group was full. `portal-nav-groups.test.ts`
 * fixed it there by testing every brand's flags. This is the staff-side twin:
 * test every role, because the ROLE is what empties a group here.
 */

import { MEGAMENU_GROUPS, visibleMegaMenuGroups } from '../navigation'
import {
  ASSIGNABLE_STAFF_ROLES,
  STAFF_SCOPES,
  type StaffCapabilities,
} from '@/lib/auth/role-policy'

/** Every shape a real staff member can have, minus the system-admin axis. */
const VIEWERS: StaffCapabilities[] = ASSIGNABLE_STAFF_ROLES.flatMap((role) =>
  STAFF_SCOPES.map((scope) => ({ role, scope, isSystemAdmin: false })),
)

const describeViewer = (v: StaffCapabilities) => `${v.role} / ${v.scope}`

describe('no role sees an accordion wrapping a single link', () => {
  it.each(VIEWERS.map((v) => [describeViewer(v), v] as const))('%s', (_name, viewer) => {
    const groups = visibleMegaMenuGroups(viewer)
    const oneItem = groups.filter((g) => 'items' in g && g.items.length === 1)

    expect(oneItem.map((g) => g.label)).toEqual([])
  })
})

describe('a group heading is never left describing something it no longer holds', () => {
  /**
   * "Wohnen" used to survive for a Jobcoach holding ONLY "Statistiken" —
   * every other item there needs `housing:read`. A group named for the roof
   * over someone's head, containing one reporting link.
   */
  it.each(VIEWERS.map((v) => [describeViewer(v), v] as const))(
    '%s sees no group whose items all sit outside its subject',
    (_name, viewer) => {
      const groups = visibleMegaMenuGroups(viewer)
      const wohnen = groups.find((g) => g.label === 'Wohnen')

      // Either the housing group has real housing content, or it is gone.
      if (wohnen && 'items' in wohnen) {
        expect(wohnen.items.length).toBeGreaterThan(1)
      }
    },
  )

  it('the reporting page is top level, not filed under one mission area', () => {
    // It renders the viewer's OWN domain KPIs now, so filing it under housing
    // mislabels it for everyone else.
    const top = MEGAMENU_GROUPS.find((g) => 'href' in g && g.href === '/analytics')
    expect(top).toBeDefined()

    const insideAGroup = MEGAMENU_GROUPS.some(
      (g) => 'items' in g && g.items.some((i) => i.href === '/analytics'),
    )
    expect(insideAGroup).toBe(false)
  })
})

describe('flattening keeps the boundary it had inside the group', () => {
  it('carries the item permission onto the promoted link', () => {
    // Without this the flattened entry would be offered to roles the grouped
    // version correctly hid it from — a dead end dressed as a destination.
    //
    // Liegenschaften: since "Lernen & Beruf" moved in with the people, every
    // integration role keeps two or more items in "Klient*innen" and stays an
    // accordion. The building team reads the register and nothing else of it,
    // which is the one-survivor shape the flattening rule is about.
    const coordinator: StaffCapabilities = {
      role: 'LIEGENSCHAFTEN',
      scope: 'OWN_DOMAIN',
      isSystemAdmin: false,
    }
    const groups = visibleMegaMenuGroups(coordinator)

    const residents = groups.find((g) => 'href' in g && g.href === '/residents')
    expect(residents).toBeDefined()
    expect(residents && 'permission' in residents ? residents.permission : undefined).toBe(
      'residents:read',
    )
  })

  it('still groups when more than one item survives', () => {
    // The flattening must not swallow genuine groups: an ALL_DOMAINS viewer
    // keeps every accordion that has real content.
    const wide: StaffCapabilities = {
      role: 'BETREUUNG',
      scope: 'ALL_DOMAINS',
      isSystemAdmin: false,
    }
    const groups = visibleMegaMenuGroups(wide)
    expect(groups.some((g) => 'items' in g && g.items.length > 1)).toBe(true)
  })
})
