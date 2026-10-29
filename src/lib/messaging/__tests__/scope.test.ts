import { PgDialect } from 'drizzle-orm/pg-core'
import { findMessageResident, staffInbox } from '../queries'

const queries = vi.hoisted(() => ({ resident: vi.fn(), threads: vi.fn() }))
vi.mock('@/lib/db', async () => {
  const schema = await import('@/lib/db/schema')
  const { QueryBuilder } = await import('drizzle-orm/pg-core')
  const builder = new QueryBuilder()
  return {
    ...schema,
    db: {
      select: builder.select.bind(builder),
      query: {
        resident: { findFirst: queries.resident },
        messageThread: { findMany: queries.threads },
      },
    },
  }
})
const restricted = { siteAccess: 'ASSIGNED_UNITS' as const, assignedUnitIds: ['house-1'] }
beforeEach(() => {
  vi.clearAllMocks()
  queries.resident.mockResolvedValue(undefined)
  queries.threads.mockResolvedValue([])
})

it('scopes a direct conversation to active placements in the staff units', async () => {
  await findMessageResident('resident-1', restricted)
  const query = new PgDialect().sqlToQuery(queries.resident.mock.calls[0][0].where)
  expect(query.params).toContain('resident-1')
  expect(query.params).toContain('ACTIVE')
  expect(query.params).toContain('house-1')
  expect(query.sql).toContain('Placement')
})
it('applies the same scope before reading the staff inbox', async () => {
  await staffInbox(restricted)
  const query = new PgDialect().sqlToQuery(queries.threads.mock.calls[0][0].where)
  expect(query.params).toContain('ACTIVE')
  expect(query.params).toContain('house-1')
  expect(query.sql).toContain('Resident')
})
it('retains explicit all-unit access without adding a unit restriction', async () => {
  const viewer = { siteAccess: 'ALL_UNITS' as const, assignedUnitIds: [] }
  await findMessageResident('resident-1', viewer)
  expect(new PgDialect().sqlToQuery(queries.resident.mock.calls[0][0].where).params).toEqual([
    'resident-1',
  ])
  await staffInbox(viewer)
  expect(queries.threads.mock.calls[0][0].where).toBeUndefined()
})
