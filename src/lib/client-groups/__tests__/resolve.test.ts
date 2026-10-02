/**
 * Group membership is the saved filters PLUS the viewer's site scope — a group
 * may narrow what someone sees, never widen it.
 */

import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRows = vi.fn()
const mockWhere = vi.fn()

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    select: () => ({
      from: () => ({
        where: (where: unknown) => {
          mockWhere(where)
          return { orderBy: () => Promise.resolve(mockRows()) }
        },
      }),
    }),
  },
}))

import {
  InvalidGroupFiltersError,
  groupMembersWhere,
  mayManageClientGroup,
  parseGroupFilters,
  resolveGroupMembers,
} from '../resolve'

const dialect = new PgDialect()
const NOW = new Date('2026-10-02T12:00:00Z')
const compile = (fragment: SQL | undefined) => (fragment ? dialect.sqlToQuery(fragment) : null)

const EVERYWHERE = { id: 'viewer-1', siteAccess: 'ALL_UNITS' as const, assignedUnitIds: [] }
const TWO_HOUSES = {
  id: 'viewer-2',
  siteAccess: 'ASSIGNED_UNITS' as const,
  assignedUnitIds: ['unit-a', 'unit-b'],
}
const NOWHERE = { id: 'viewer-3', siteAccess: 'ASSIGNED_UNITS' as const, assignedUnitIds: [] }

beforeEach(() => vi.clearAllMocks())

describe('groupMembersWhere', () => {
  it('is the filters alone for a viewer who covers every unit', () => {
    const q = compile(groupMembersWhere({ lang: ['AR'] }, EVERYWHERE, NOW))
    expect(q!.sql).toBe('"Resident"."languages" && $1')
  })

  it("adds the viewer's units for a site-restricted viewer", () => {
    const q = compile(groupMembersWhere({ lang: ['AR'] }, TWO_HOUSES, NOW))
    expect(q!.sql).toContain('"Placement"."housingUnitId" in ($2, $3)')
    expect(q!.sql).toContain('"Resident"."languages" && $4')
    expect(q!.params).toEqual(['ACTIVE', 'unit-a', 'unit-b', '{"AR"}'])
  })

  it('matches nobody for a restricted viewer assigned nowhere', () => {
    const q = compile(groupMembersWhere({ lang: ['AR'] }, NOWHERE, NOW))
    expect(q!.sql).toContain('false')
  })

  it('reads "mine" as the RESOLVING viewer', () => {
    expect(compile(groupMembersWhere({ seat: 'mine' }, TWO_HOUSES, NOW))!.params).toContain(
      'viewer-2',
    )
  })
})

describe('resolveGroupMembers', () => {
  it('returns the matching resident ids', async () => {
    mockRows.mockReturnValue([{ id: 'r1' }, { id: 'r2' }])
    const ids = await resolveGroupMembers({ id: 'g1', filters: { stand: 'placed' } }, TWO_HOUSES)
    expect(ids).toEqual(['r1', 'r2'])
    // The site scope reached the query, not only the filters.
    expect(compile(mockWhere.mock.calls[0][0] as SQL)!.params).toEqual([
      'ACTIVE',
      'unit-a',
      'unit-b',
      'PLACED',
    ])
  })

  it('refuses stored filters the config no longer knows instead of widening', async () => {
    await expect(
      resolveGroupMembers({ id: 'g1', filters: { stand: 'placed', retired: 'x' } }, EVERYWHERE),
    ).rejects.toBeInstanceOf(InvalidGroupFiltersError)
    expect(mockWhere).not.toHaveBeenCalled()
  })

  it('parseGroupFilters rejects non-objects', () => {
    expect(parseGroupFilters(null).success).toBe(false)
    expect(parseGroupFilters('lang=AR').success).toBe(false)
  })
})

describe('mayManageClientGroup', () => {
  const group = { createdByUserId: 'creator' }
  it.each([
    ['the creator', { id: 'creator', isSystemAdmin: false }, true],
    ['a system admin', { id: 'other', isSystemAdmin: true }, true],
    ['anyone else', { id: 'other', isSystemAdmin: false }, false],
  ])('%s → %s', (_label, viewer, expected) => {
    expect(mayManageClientGroup(viewer, group)).toBe(expected)
  })
})
