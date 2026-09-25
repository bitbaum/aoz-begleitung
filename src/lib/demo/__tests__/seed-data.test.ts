/**
 * Tests for the demo presentation narrative (lib/demo/seed-data.ts).
 *
 * The property that makes the scoped reset SAFE: every unit and resident the
 * seed creates must carry a demo code prefix (or be the configured login
 * code), because deletion targets prefixes — an unprefixed code would leak a
 * row that survives every reset and can never be cleaned up.
 */

import { getTableName } from 'drizzle-orm'
import { seedDemoData } from '../seed-data'
import {
  DEMO_RESIDENT_CODE_PREFIX,
  DEMO_UNIT_CODE_PREFIX,
  resolveDemoResidentCode,
} from '../config'
import type { db } from '@/lib/db'
import { natureOfKind } from '../../config/marketplace'

interface Recorded {
  unitCodes: string[]
  residentCodes: string[]
  /** Expense rows and their shares, joined by id in the assertion below. */
  expenses: Array<{ id: string; amountRappen: number }>
  expenseShares: Array<{ expenseId: string; amountRappen: number }>
  taskTitles: string[]
  proposalStatuses: string[]
  appointmentStatuses: string[]
  maintenanceStatuses: string[]
  maintenance: Array<{ status: string; resolution?: string | null; reportedById?: string }>
  unitRuleTitles: string[]
  /** Resident code → the id the mock handed back, so ownership is assertable. */
  residentIdsByCode: Record<string, string>
  /** Resident code → the display name the seed chose (null if it chose none). */
  residentNamesByCode: Record<string, string | null>
  /** Every residentId that received a learning record. */
  learningResidentIds: string[]
  /** Marketplace posts, so both halves of the board can be asserted. */
  marketplaceKinds: string[]
  /** House events, so the tour is checked for something upcoming AND past. */
  eventStartsAt: Date[]
  /** External activities — only the FULL reset scope may create these. */
  activityCategories: string[]
}

function createDbMock(): { db: typeof db; recorded: Recorded } {
  const recorded: Recorded = {
    unitCodes: [],
    residentCodes: [],
    expenses: [],
    expenseShares: [],
    taskTitles: [],
    proposalStatuses: [],
    appointmentStatuses: [],
    maintenanceStatuses: [],
    maintenance: [],
    unitRuleTitles: [],
    residentIdsByCode: {},
    residentNamesByCode: {},
    learningResidentIds: [],
    marketplaceKinds: [],
    eventStartsAt: [],
    activityCategories: [],
  }
  let id = 0

  type Row = Record<string, unknown>

  // Recording hooks per table, fed the stored row (values + generated id).
  const hooks: Record<string, (row: Row) => void> = {
    HousingUnit: (d) => recorded.unitCodes.push(d.code as string),
    Resident: (d) => {
      recorded.residentCodes.push(d.code as string)
      recorded.residentIdsByCode[d.code as string] = d.id as string
      recorded.residentNamesByCode[d.code as string] = (d.displayName as string | undefined) ?? null
    },
    Expense: (d) =>
      recorded.expenses.push({ id: d.id as string, amountRappen: d.amountRappen as number }),
    ExpenseShare: (d) =>
      recorded.expenseShares.push({
        expenseId: d.expenseId as string,
        amountRappen: d.amountRappen as number,
      }),
    // The living-together half of the demo world (seed-governance.ts).
    HouseholdTask: (d) => recorded.taskTitles.push(d.title as string),
    Proposal: (d) => recorded.proposalStatuses.push(d.status as string),
    MaintenanceRequest: (d) => {
      recorded.maintenanceStatuses.push(d.status as string)
      recorded.maintenance.push(d as Recorded['maintenance'][number])
    },
    // The integration pillar (lib/seed/integration-evidence.ts).
    LearningRecord: (d) => recorded.learningResidentIds.push(d.residentId as string),
    // Appointments, and the reading a completed one carries. Absent from
    // this mock the seed threw on `insert(appointment)` — which is the mock
    // telling the truth: the seed genuinely writes these now.
    Appointment: (d) => recorded.appointmentStatuses.push(d.status as string),
    // Gemeinschaft: the board, the calendar and the external catalogue.
    MarketplacePost: (d) => recorded.marketplaceKinds.push(d.kind as string),
    HouseEvent: (d) => recorded.eventStartsAt.push(d.startsAt as Date),
    Activity: (d) => recorded.activityCategories.push(d.category as string),
    HouseRule: (d) => recorded.unitRuleTitles.push(d.title as string),
  }

  // A small STORE, not a set of empty stubs: `findMany` returns what was
  // inserted. Filtering is deliberately unimplemented — the seed's findMany
  // calls ask for every demo-prefixed resident (or their placements), and the
  // test below proves every resident the seed creates carries that prefix, so
  // "everything" and "everything matching" are the same set here.
  const store: Record<string, Row[]> = {}

  const insert = (table: unknown) => {
    const name = getTableName(table as Parameters<typeof getTableName>[0])
    return {
      values: (data: unknown) => {
        const rows = (Array.isArray(data) ? data : [data]).map((values: Row) => {
          const row = { id: `id-${++id}`, ...values }
          ;(store[name] ??= []).push(row)
          hooks[name]?.(row)
          return row
        })
        // `.values()` alone awaits to a pg result; `.returning()` yields the
        // rows; `.onConflictDoNothing()` still reports the write's rowCount.
        return Object.assign(Promise.resolve({ rowCount: rows.length }), {
          returning: () => Promise.resolve(rows),
          onConflictDoNothing: () => Promise.resolve({ rowCount: rows.length }),
        })
      },
    }
  }

  const dbMock = {
    insert,
    transaction: async (fn: (tx: unknown) => unknown) => fn({ insert }),
    query: {
      resident: { findMany: () => Promise.resolve(store.Resident ?? []) },
      placement: { findMany: () => Promise.resolve(store.Placement ?? []) },
      houseRule: { findFirst: () => Promise.resolve({ id: 'org-night-quiet' }) },
    },
    // Subquery builder feeding the summary's $count calls.
    select: () => ({ from: () => ({ where: () => ({}) }) }),
    $count: (table: unknown) =>
      Promise.resolve(
        (store[getTableName(table as Parameters<typeof getTableName>[0])] ?? []).length,
      ),
  }
  return { db: dbMock as unknown as typeof db, recorded }
}

beforeEach(() => {
  delete process.env.DEMO_RESIDENT_CODE
})

describe('seedDemoData', () => {
  it('creates the full presentation narrative: 5 units, 15 residents', async () => {
    const { db, recorded } = createDbMock()
    await seedDemoData(db)
    expect(recorded.unitCodes).toHaveLength(5)
    expect(recorded.residentCodes).toHaveLength(15)
  })

  it('gives EVERY unit a demo-prefixed code, so the scoped reset can find it', async () => {
    const { db, recorded } = createDbMock()
    await seedDemoData(db)
    for (const code of recorded.unitCodes) {
      expect(code).toMatch(new RegExp(`^${DEMO_UNIT_CODE_PREFIX}`))
    }
  })

  it('gives EVERY resident a demo-prefixed code or the configured login code', async () => {
    process.env.DEMO_RESIDENT_CODE = 'RES-CUSTOM'
    const { db, recorded } = createDbMock()
    await seedDemoData(db)
    for (const code of recorded.residentCodes) {
      if (code === 'RES-CUSTOM') continue
      expect(code).toMatch(new RegExp(`^${DEMO_RESIDENT_CODE_PREFIX}`))
    }
    expect(recorded.residentCodes).toContain('RES-CUSTOM')
  })

  it('gives EVERY demo resident a name — the narrative already uses one', async () => {
    const { db, recorded } = createDbMock()
    await seedDemoData(db)

    // The incident texts name Alexei and Petro; the resident rows used to carry
    // no displayName, so the chore board and the queues called the same person
    // "RES-DEMO07". A visitor meeting one human under two identities is looking
    // at a bug in the tour. (Real residents still start nameless by default —
    // this is the demo's story, not the privacy rule.)
    const nameless = Object.entries(recorded.residentNamesByCode)
      .filter(([, name]) => !name)
      .map(([code]) => code)

    expect(nameless).toEqual([])
  })

  it('assigns the demo login code to a resident (the portal tour identity)', async () => {
    const { db, recorded } = createDbMock()
    const summary = await seedDemoData(db)
    expect(summary.demoResidentCode).toBe(resolveDemoResidentCode())
    expect(recorded.residentCodes).toContain(summary.demoResidentCode)
  })

  it('keeps every expense internally consistent: shares sum to the amount', async () => {
    const { db, recorded } = createDbMock()
    await seedDemoData(db)
    expect(recorded.expenses.length).toBeGreaterThan(0)
    for (const expense of recorded.expenses) {
      const sum = recorded.expenseShares
        .filter((share) => share.expenseId === expense.id)
        .reduce((acc, share) => acc + share.amountRappen, 0)
      expect(sum).toBe(expense.amountRappen)
    }
  })

  // An empty page reads as a missing feature. These pin the surfaces that
  // shipped empty and made the tour look like less than the product is.
  it('fills the chore board, so the tour never shows "Noch keine Aufgaben"', async () => {
    const { db, recorded } = createDbMock()
    await seedDemoData(db)
    expect(recorded.taskTitles.length).toBeGreaterThan(0)
  })

  it('fills the maintenance board with both open and finished work', async () => {
    const { db, recorded } = createDbMock()
    await seedDemoData(db)
    expect(recorded.maintenanceStatuses).toContain('OPEN')
    expect(recorded.maintenanceStatuses).toContain('COMPLETED')
  })

  it('fills BOTH halves of the marketplace, so the service side is not invisible', async () => {
    // A demo showing only furniture teaches a visitor that the board handles
    // objects — which is precisely the belief the service half exists to end.
    const { db, recorded } = createDbMock()
    await seedDemoData(db)

    const halves = recorded.marketplaceKinds.map((kind) => natureOfKind(kind as never))
    expect({
      goods: halves.includes('GOODS'),
      services: halves.includes('SERVICE'),
    }).toEqual({ goods: true, services: true })
  })

  it('seeds an event that has not happened yet AND one that has', async () => {
    // Only past events means an empty "Kommt" section and no RSVP to press;
    // only future ones means the "Vorbei" record never appears at all.
    const { db, recorded } = createDbMock()
    await seedDemoData(db)
    const now = Date.now()

    expect({
      upcoming: recorded.eventStartsAt.some((date) => date.getTime() > now),
      past: recorded.eventStartsAt.some((date) => date.getTime() < now),
    }).toEqual({ upcoming: true, past: true })
  })

  it('creates NO external activity under the default (scoped) options', async () => {
    // The safety property. An Activity has no unit and no code, so a reset that
    // deletes by demo prefix can never reach one. On an instance sharing a
    // database with a real flat they would accumulate nightly and show real
    // residents invented offers with invented phone numbers.
    const { db, recorded } = createDbMock()
    await seedDemoData(db)

    expect(recorded.activityCategories).toEqual([])
  })

  it('creates the activity catalogue only when the caller owns the whole database', async () => {
    const { db, recorded } = createDbMock()
    await seedDemoData(db, { siteWideContent: true })

    // One per category, so every position in the portal's filter row returns
    // something — a filter landing on "Keine Ergebnisse" reads as broken, not
    // as empty.
    expect(new Set(recorded.activityCategories).size).toBe(recorded.activityCategories.length)
    expect(recorded.activityCategories.length).toBeGreaterThanOrEqual(6)
  })

  it('gives the DEMO LOGIN an answered report — a reply to a roommate proves nothing', async () => {
    const { db, recorded } = createDbMock()
    const summary = await seedDemoData(db)
    const demoId = recorded.residentIdsByCode[summary.demoResidentCode]
    const answered = recorded.maintenance.filter((m) => m.status === 'COMPLETED' && m.resolution)
    expect(answered.some((m) => m.reportedById === demoId)).toBe(true)
  })

  it('seeds a proposal ALREADY IN VOTING — a fresh one could never reach a vote', async () => {
    // Voting opens after a 3-day discussion window and the demo world is wiped
    // nightly, so an un-backdated proposal makes the ballot unreachable forever.
    const { db, recorded } = createDbMock()
    await seedDemoData(db)
    expect(recorded.proposalStatuses).toContain('VOTING')
  })

  it('seeds a decided proposal and one awaiting staff, so both queues have content', async () => {
    const { db, recorded } = createDbMock()
    await seedDemoData(db)
    expect(recorded.proposalStatuses).toContain('ACCEPTED')
    expect(recorded.proposalStatuses).toContain('NEEDS_STAFF_CONFIRMATION')
    expect(recorded.proposalStatuses).toContain('DISCUSSION')
  })

  it('adopts a house rule from the accepted proposal, so the two tiers are visible', async () => {
    const { db, recorded } = createDbMock()
    await seedDemoData(db)
    expect(recorded.unitRuleTitles.length).toBeGreaterThan(0)
  })

  // ── Integration pillar ────────────────────────────────────────────────────
  //
  // This shipped blank: /learning rendered five zeroes and an empty list on a
  // demo world of fifteen people, and a Jobcoach evaluating the product
  // concluded the pillar was unbuilt.

  it('gives EVERY demo resident integration evidence', async () => {
    const { db, recorded } = createDbMock()
    const summary = await seedDemoData(db)

    const withEvidence = new Set(recorded.learningResidentIds)
    const everyResidentId = Object.values(recorded.residentIdsByCode)

    expect(summary.learningRecords).toBeGreaterThan(0)
    expect(everyResidentId.length).toBeGreaterThan(0)
    for (const residentId of everyResidentId) {
      expect(withEvidence.has(residentId)).toBe(true)
    }
  })

  it('assigns the care seats when the deployment has a staff account', async () => {
    // Without an assignment, "Meine Klient*innen" — the DEFAULT view for every
    // non-Leitung role — is empty however full the database is.
    const { db } = createDbMock()
    const summary = await seedDemoData(db, { careStaffId: 'demo-staff' })

    expect(summary.careAssignments).toBeGreaterThan(0)
  })

  it('seeds an appointment already held AND one still to hold', async () => {
    // Recording a check-in now happens ONLY when staff close an appointment.
    // A demo world without them therefore demonstrates no check-in at all, and
    // a visitor meets four empty care panels — the same failure the chore and
    // proposal seeds exist to prevent. COMPLETED shows what the feature
    // produces; SCHEDULED is the one the visitor gets to close themselves.
    const { db, recorded } = createDbMock()
    const summary = await seedDemoData(db, { careStaffId: 'demo-staff' })

    expect(summary.appointments).toBeGreaterThan(0)
    expect(recorded.appointmentStatuses).toContain('COMPLETED')
    expect(recorded.appointmentStatuses).toContain('SCHEDULED')
  })

  it('seeds no appointments without a staff account to hold them', async () => {
    const { db, recorded } = createDbMock()
    const summary = await seedDemoData(db)

    expect(summary.appointments).toBe(0)
    expect(recorded.appointmentStatuses).toHaveLength(0)
  })

  it('invents no colleague when the deployment has no demo staff door', async () => {
    // A fake staff row would appear in every real "zuständig" picker on an
    // instance that also holds real data.
    const { db } = createDbMock()
    const summary = await seedDemoData(db)

    expect(summary.careAssignments).toBe(0)
    expect(summary.learningRecords).toBeGreaterThan(0)
  })
})
