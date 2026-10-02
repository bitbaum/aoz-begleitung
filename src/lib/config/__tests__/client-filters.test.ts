/**
 * The client filter config: every filter produces the predicate it claims,
 * saved filters are validated against the config, and the URL encoding keeps
 * a group meaning the same thing for every viewer.
 */

import type { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import {
  CLIENT_FILTERS,
  activeClientFilterCount,
  clientFilterDefaults,
  clientFilterStateSchema,
  clientFilterWhere,
  encodeClientFilters,
  parseClientFilterParams,
  savableClientFilters,
  type ClientFilterDef,
  type ClientFilterId,
} from '../client-filters'

const dialect = new PgDialect()
const NOW = new Date('2026-10-02T12:00:00Z')
const CTX = { viewerId: 'viewer-1', now: NOW }
const SOURCES = {
  units: [{ id: 'unit-1', code: 'WIT-458', nickname: 'Singapur' }],
  staff: [{ id: 'staff-2', name: 'Mira Keller' }],
  viewerHasCaseload: true,
}

function compile(fragment: SQL | undefined) {
  if (!fragment) return null
  const query = dialect.sqlToQuery(fragment)
  return { sql: query.sql, params: query.params }
}

interface Case {
  value: unknown
  /** null: the value restricts nothing. */
  sql: string[] | null
  params?: unknown[]
}

/**
 * One row per value worth checking, for EVERY filter in the config. The
 * completeness test below fails when a filter is added without a row here.
 */
const CASES: Record<ClientFilterId, Case[]> = {
  stand: [
    { value: 'active', sql: ['"Resident"."status" in ($1, $2)'], params: ['ACTIVE', 'PLACED'] },
    { value: 'placed', sql: ['"Resident"."status" = $1'], params: ['PLACED'] },
    {
      value: 'unplaced',
      sql: [
        '"Resident"."status" = $1',
        '"Resident"."id" not in (select "residentId" from "Placement"',
      ],
      params: ['ACTIVE', 'ACTIVE'],
    },
    { value: 'archived', sql: ['"Resident"."status" = $1'], params: ['EXITED'] },
    { value: 'all', sql: null },
  ],
  seat: [
    {
      value: 'mine',
      sql: ['"Resident"."id" in (select "residentId" from "CareAssignment"', '"staffId" = $1'],
      params: ['viewer-1'],
    },
    { value: 'staff:staff-2', sql: ['"staffId" = $1'], params: ['staff-2'] },
    {
      value: 'open:JOB',
      sql: ['"Resident"."id" not in (select "residentId" from "CareAssignment"', '"role" = $1'],
      params: ['JOB'],
    },
    { value: 'all', sql: null },
  ],
  unit: [
    {
      value: 'unit-1',
      sql: ['"Resident"."id" in (select "residentId" from "Placement"', '"housingUnitId" = $2'],
      params: ['ACTIVE', 'unit-1'],
    },
  ],
  lang: [{ value: ['AR', 'FA'], sql: ['"Resident"."languages" && $1'], params: ['{"AR","FA"}'] }],
  age: [
    {
      value: ['ADULT', 'SENIOR'],
      sql: ['"Resident"."ageRange" in ($1, $2)'],
      params: ['ADULT', 'SENIOR'],
    },
  ],
  moved: [
    {
      value: '30',
      sql: ['"Placement"."status" = $1', '"Placement"."startDate" >= $2'],
      params: ['ACTIVE', '2026-09-02T12:00:00.000Z'],
    },
    {
      value: '90',
      sql: ['"Placement"."startDate" >= $2'],
      params: ['ACTIVE', '2026-07-04T12:00:00.000Z'],
    },
  ],
  waiting: [
    {
      value: true,
      sql: [
        '"Resident"."id" in (select "residentId" from "OpportunityApplication"',
        '"createdBy" = $1',
        '"stage" = $2',
        '"supportedByUserId" is null',
      ],
      params: ['RESIDENT', 'INTERESTED'],
    },
  ],
}

const DEFS = CLIENT_FILTERS as unknown as readonly ClientFilterDef[]

describe('every filter in the config', () => {
  it('has test cases, so a new filter cannot ship untested', () => {
    expect(Object.keys(CASES).sort()).toEqual(DEFS.map((d) => d.id).sort())
  })

  it('has a unique id and URL param', () => {
    expect(new Set(DEFS.map((d) => d.id)).size).toBe(DEFS.length)
    expect(new Set(DEFS.map((d) => d.param)).size).toBe(DEFS.length)
  })

  it('declares a neutral value wherever it has a default', () => {
    for (const def of DEFS) {
      if (def.defaultFor?.({ viewerHasCaseload: true }) != null) {
        expect(def.neutral, def.id).toBeDefined()
      }
    }
  })

  const rows = DEFS.flatMap((def) =>
    CASES[def.id as ClientFilterId].map((c) => [def.id, JSON.stringify(c.value), def, c] as const),
  )

  it.each(rows)('%s = %s produces the expected predicate', (_id, _label, def, c) => {
    expect(def.schema.safeParse(c.value).success).toBe(true)
    const compiled = compile(def.where(c.value, CTX))
    if (c.sql === null) {
      expect(compiled).toBeNull()
      return
    }
    expect(compiled).not.toBeNull()
    for (const fragment of c.sql) expect(compiled!.sql).toContain(fragment)
    if (c.params) expect(compiled!.params).toEqual(c.params)
  })

  it.each(DEFS.map((d) => [d.id, d] as const))('%s offers labelled options', (_id, def) => {
    const options = def.options(SOURCES)
    expect(options.length).toBeGreaterThan(0)
    for (const option of options) {
      expect(option.label.trim()).not.toBe('')
      // Every offered option must be a value the schema accepts.
      const candidate =
        def.kind === 'multiselect' ? [option.value] : def.kind === 'toggle' ? true : option.value
      expect(def.schema.safeParse(candidate).success, `${def.id}:${option.value}`).toBe(true)
    }
  })
})

describe('clientFilterWhere', () => {
  it('restricts nothing for an empty state', () => {
    expect(clientFilterWhere({}, CTX)).toBeUndefined()
  })

  it('ANDs every applied filter', () => {
    const compiled = compile(
      clientFilterWhere({ stand: 'placed', lang: ['AR'], waiting: true }, CTX),
    )
    expect(compiled!.sql).toContain(' and ')
    expect(compiled!.params).toEqual(['PLACED', '{"AR"}', 'RESIDENT', 'INTERESTED'])
  })
})

describe('saved filters are validated against the config', () => {
  it('accepts a state built from config values', () => {
    const state = {
      stand: 'active',
      seat: 'open:SOCIAL',
      unit: 'unit-1',
      lang: ['AR'],
      age: ['ADULT'],
      moved: '90',
      waiting: true,
    }
    expect(clientFilterStateSchema.safeParse(state).success).toBe(true)
  })

  it.each([
    ['an unknown filter id', { religion: 'x' }],
    ['a client fact smuggled in as a filter', { permit: 'B' }],
    ['a language the factor does not offer', { lang: ['XX'] }],
    ['an empty multiselect', { lang: [] }],
    ['an unknown care seat', { seat: 'open:LEITUNG' }],
    ['an unknown status', { stand: 'deported' }],
    ['a window that is not offered', { moved: '7' }],
    ['a toggle set to false', { waiting: false }],
  ])('rejects %s', (_label, state) => {
    expect(clientFilterStateSchema.safeParse(state).success).toBe(false)
  })
})

describe('URL state', () => {
  it('parses repeated params and comma lists alike, and drops invalid values', () => {
    expect(
      parseClientFilterParams({
        view: 'placed',
        lang: ['FA', 'AR,FA'],
        age: 'NOPE',
        waiting: '1',
        moved: '7',
        q: 'ignored',
      }),
    ).toEqual({ stand: 'placed', lang: ['AR', 'FA'], waiting: true })
  })

  it('lands a caseload holder on "Meine", everyone else on everybody', () => {
    expect(clientFilterDefaults({ viewerHasCaseload: true })).toEqual({
      stand: 'active',
      seat: 'mine',
    })
    expect(clientFilterDefaults({ viewerHasCaseload: false })).toEqual({ stand: 'active' })
  })

  it('a group without a seat filter does not become "Meine" for a caseload holder', () => {
    const defaults = clientFilterDefaults({ viewerHasCaseload: true })
    const params = encodeClientFilters({ stand: 'active', lang: ['AR'] }, defaults)
    expect(params.get('seat')).toBe('all')
    expect(params.get('view')).toBeNull() // equal to the default, left out
    expect(params.get('lang')).toBe('AR')
    // ...and reading it back applies exactly the group's filters.
    const read = parseClientFilterParams(Object.fromEntries(params))
    expect(clientFilterWhere({ ...defaults, ...read }, CTX)).toEqual(
      clientFilterWhere({ stand: 'active', seat: 'all', lang: ['AR'] }, CTX),
    )
  })

  it('a group stores applied values without the neutral ones', () => {
    expect(savableClientFilters({ stand: 'all', seat: 'all', lang: ['AR'] })).toEqual({
      lang: ['AR'],
    })
    expect(savableClientFilters({ stand: 'active', seat: 'mine' })).toEqual({
      stand: 'active',
      seat: 'mine',
    })
  })

  it('counts only bar filters that differ from the defaults', () => {
    const defaults = clientFilterDefaults({ viewerHasCaseload: true })
    expect(activeClientFilterCount(defaults, defaults)).toBe(0)
    expect(activeClientFilterCount({ ...defaults, seat: 'all' }, defaults)).toBe(0)
    expect(
      activeClientFilterCount({ ...defaults, stand: 'archived', lang: ['AR'] }, defaults),
    ).toBe(1)
  })
})
