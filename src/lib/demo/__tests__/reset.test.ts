/**
 * Tests for the demo reset (lib/demo/reset.ts).
 *
 * The critical property: the wipe must NEVER touch the keep-list — User holds
 * real staff accounts, AlgorithmWeight and SystemConfig hold operator config.
 * Everything else discovered in pg_tables must be truncated, so new schema
 * models are wiped automatically without editing the reset.
 */

const mockSeedDemoData = vi.fn()
vi.mock('../seed-data', async () => ({
  seedDemoData: (...args: unknown[]) => mockSeedDemoData(...args),
}))

const mockSyncOrgRules = vi.fn()
vi.mock('../../governance/sync-org-rules', async () => ({
  syncOrgRules: (...args: unknown[]) => mockSyncOrgRules(...args),
}))

const mockSeedOpportunities = vi.fn()
vi.mock('../../seed/opportunities', async () => ({
  seedOpportunities: (...args: unknown[]) => mockSeedOpportunities(...args),
}))

import { resetDemoData } from '../reset'
import { STAFF_ROLES } from '@/lib/auth/role-policy'
import { account, user, type db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { sqlText } from '@/test-utils/drizzle-where'

const SEED_SUMMARY = {
  residents: 15,
  housingUnits: 5,
  placements: 13,
  incidents: 8,
  demoResidentCode: 'RES-001',
}

/**
 * A drizzle-client stand-in built to the surface the reset actually uses:
 * `execute` (pg_tables SELECT, then the TRUNCATE), the demo-staff upsert
 * (`insert(user)…onConflictDoUpdate…returning`), `delete(account)`, and the
 * resident listing the opportunity seed reads.
 */
function createDbMock(tables: string[]) {
  // Records the TRUNCATE statement's text; the pg_tables SELECT answers with
  // the given table list instead.
  const executeTruncate = vi.fn((statement: string) => {
    void statement
    return Promise.resolve({ rows: [] as unknown[] })
  })
  // Records each staff upsert as { values, target, set }.
  const userUpsert = vi.fn((call: unknown) => {
    void call
    return [{ id: 'demo-user' }]
  })
  const accountDelete = vi.fn().mockResolvedValue({ rowCount: 0 })
  const residentFindMany = vi.fn().mockResolvedValue([{ id: 'demo-resident-1' }])

  const dbMock = {
    execute: vi.fn((query: unknown) => {
      const text = sqlText(query)
      if (text.includes('pg_tables')) {
        return Promise.resolve({ rows: tables.map((tablename) => ({ tablename })) })
      }
      return executeTruncate(text)
    }),
    insert: () => ({
      values: (values: unknown) => ({
        onConflictDoUpdate: ({ target, set }: { target: unknown; set: unknown }) => ({
          returning: () => Promise.resolve(userUpsert({ values, target, set })),
        }),
      }),
    }),
    delete: () => ({ where: (w: unknown) => accountDelete(w) }),
    // The org-wide opportunity directory is seeded from the demo residents
    // this path just created. Unscoped is correct HERE and only here: the
    // wipe above ran first, so every remaining resident is a demo resident.
    query: {
      resident: { findMany: (...args: unknown[]) => residentFindMany(...args) },
    },
  }

  return {
    db: dbMock as unknown as typeof db,
    executeTruncate,
    userUpsert,
    accountDelete,
    residentFindMany,
  }
}

describe('resetDemoData', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DEMO_STAFF_CODE = 'AOZH-DEMO01'
    mockSeedDemoData.mockResolvedValue(SEED_SUMMARY)
    mockSyncOrgRules.mockResolvedValue({ created: 0, amended: 0 })
    mockSeedOpportunities.mockResolvedValue({
      opportunities: 5,
      applications: 10,
      evidenceRecords: 3,
    })
  })

  it('seeds the opportunity directory from the residents it just created', async () => {
    // Mocking a seed away and then never asserting it ran is how a step
    // silently stops happening while the suite stays green.
    const { db } = createDbMock(['Resident'])
    const summary = await resetDemoData(db)

    expect(mockSeedOpportunities).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ residentIds: ['demo-resident-1'], staffId: 'demo-user' }),
    )
    expect(summary.opportunities).toBe(5)
    expect(summary.opportunityApplications).toBe(10)
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('truncates every discovered table except the keep-list', async () => {
    const { db, executeTruncate } = createDbMock([
      '_prisma_migrations',
      'User',
      'AlgorithmWeight',
      'SystemConfig',
      'Resident',
      'HousingUnit',
      'HouseRule',
      'BrandNewFutureModel', // schema growth: wiped without editing the reset
    ])

    await resetDemoData(db)

    expect(executeTruncate).toHaveBeenCalledTimes(1)
    const sql = executeTruncate.mock.calls[0][0] as string
    expect(sql).toContain('"Resident"')
    expect(sql).toContain('"HousingUnit"')
    expect(sql).toContain('"HouseRule"')
    expect(sql).toContain('"BrandNewFutureModel"')
    // Real accounts and operator config must survive every reset.
    expect(sql).not.toContain('"User"')
    expect(sql).not.toContain('"AlgorithmWeight"')
    expect(sql).not.toContain('"SystemConfig"')
    expect(sql).not.toContain('_prisma_migrations')
  })

  it('reseeds, self-heals the demo staff account, and re-syncs the rule catalog', async () => {
    const { db, userUpsert, accountDelete } = createDbMock(['Resident'])

    const summary = await resetDemoData(db)

    // The staff account is upserted BEFORE the seed and handed to it: the
    // care seats it assigns cannot point at a row that does not exist yet.
    expect(mockSeedDemoData).toHaveBeenCalledWith(db, {
      careStaffId: 'demo-user',
      // Full scope owns the whole database, so it may also create content no
      // demo prefix reaches — and truncate it next time round. The scoped
      // reset must NOT pass this; `scoped-reset.test.ts` holds that end.
      siteWideContent: true,
    })
    expect(userUpsert).toHaveBeenCalledWith({
      values: {
        code: 'AOZH-DEMO01',
        name: 'Demo-Zugang',
        role: 'ADMIN',
        scope: 'ALL_DOMAINS',
        isSystemAdmin: true,
      },
      target: user.code,
      set: { name: 'Demo-Zugang', active: true, scope: 'ALL_DOMAINS', isSystemAdmin: true },
    })
    // A visitor-claimed account on the demo code must not outlive the reset.
    expect(accountDelete).toHaveBeenCalledWith(eq(account.userId, 'demo-user'))
    expect(mockSyncOrgRules).toHaveBeenCalledWith(db)
    expect(summary).toEqual({
      ...SEED_SUMMARY,
      tablesWiped: 1,
      demoStaffCode: 'AOZH-DEMO01',
      orgRulesSynced: true,
      opportunities: 5,
      opportunityApplications: 10,
    })
  })

  it('still opens every role door when no staff code is configured', async () => {
    // The full reset builds a DEDICATED demo instance, where the point is to
    // walk the product as each role. Those codes are derived from the brand,
    // so an absent `DEMO_STAFF_CODE` only means the Leitung door uses its
    // derived code — it does not mean "no staff demo", which is what this used
    // to assert back when the single door was the whole feature.
    delete process.env.DEMO_STAFF_CODE
    const { db, userUpsert } = createDbMock(['Resident'])

    const summary = await resetDemoData(db)

    expect(userUpsert).toHaveBeenCalledTimes(STAFF_ROLES.length)
    // The legacy single-door summary field stays null: nothing was configured.
    expect(summary.demoStaffCode).toBeNull()
  })
})
