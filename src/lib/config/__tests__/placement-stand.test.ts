/**
 * One definition of "placed" on /residents.
 *
 * Live 2026-10-02, /residents?seat=all: tabs «Platziert 12 / Unplatziert 1»,
 * header «2 ohne Platzierung», tiles «Platziert 11 / Unplatziert 2». The tabs
 * read `Resident.status`, the tiles and header the active placement, and one
 * person had status PLACED with no active placement.
 */

import { readFileSync } from 'fs'
import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { clientFilterWhere, placedClientsWhere, unplacedClientsWhere } from '../client-filters'
import { placementStand } from '../resident-status'

const dialect = new PgDialect()
const sqlOf = (fragment: Parameters<PgDialect['sqlToQuery']>[0]) => dialect.sqlToQuery(fragment).sql

// The mismatch cases, both directions.
const FIXTURE = [
  { id: 'a', status: 'PLACED', placements: [{}] }, // consistent, placed
  { id: 'b', status: 'PLACED', placements: [] }, // flag says placed, no placement
  { id: 'c', status: 'ACTIVE', placements: [{}] }, // flag says not, has a placement
  { id: 'd', status: 'ACTIVE', placements: [] }, // consistent, unplaced
  { id: 'e', status: 'EXITED', placements: [{}] }, // left care
]

describe('placementStand — the placement decides, not the status flag', () => {
  it('reads every mismatch from the placement row', () => {
    expect(Object.fromEntries(FIXTURE.map((r) => [r.id, placementStand(r)]))).toEqual({
      a: 'placed',
      b: 'unplaced',
      c: 'placed',
      d: 'unplaced',
      e: 'exited',
    })
  })

  it('splits everyone in care into exactly placed + unplaced', () => {
    const inCare = FIXTURE.filter((r) => placementStand(r) !== 'exited')
    const placed = inCare.filter((r) => placementStand(r) === 'placed').length
    const unplaced = inCare.filter((r) => placementStand(r) === 'unplaced').length
    expect(placed + unplaced).toBe(inCare.length)
  })
})

describe('its SQL twin', () => {
  it('filters the tabs by the placement, never by status = PLACED / ACTIVE alone', () => {
    const placed = sqlOf(
      clientFilterWhere({ stand: 'placed' }, { viewerId: 'v', now: new Date() })!,
    )
    const unplaced = sqlOf(
      clientFilterWhere({ stand: 'unplaced' }, { viewerId: 'v', now: new Date() })!,
    )
    expect(placed).toBe(sqlOf(placedClientsWhere()))
    expect(unplaced).toBe(sqlOf(unplacedClientsWhere()))
    expect(placed).toContain('"Resident"."id" in (select "residentId" from "Placement"')
    expect(unplaced).toContain('"Resident"."id" not in (select "residentId" from "Placement"')
    for (const sql of [placed, unplaced]) expect(sql).not.toMatch(/"status" = \$1/)
  })

  it('is what /residents counts its tabs, header, tiles and banner with', () => {
    const page = readFileSync('src/app/(admin)/residents/page.tsx', 'utf8')
    expect(page).toContain('placedClientsWhere()')
    expect(page).toContain('unplacedClientsWhere()')
    expect(page).toMatch(/placementStand\(r\) === 'placed'/)
    expect(page).toMatch(/placementStand\(r\) === 'unplaced'/)
    // The old drifting definitions must not come back.
    expect(page).not.toMatch(/statusCounts\.PLACED/)
    expect(page).not.toMatch(/eq\(resident\.status, 'ACTIVE'\)/)
  })
})
