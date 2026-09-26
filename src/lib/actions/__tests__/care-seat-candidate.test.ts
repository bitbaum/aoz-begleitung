/**
 * `saveCareSeat` checks who is EDITING. It did not check who is being NAMED.
 *
 * The picker on a client's page offered every active account for every seat,
 * because `listAssignableStaff` selected `role` and read it nowhere — so
 * the Liegenschaften lead (`LIEGENSCHAFTEN`, a role mapping to no care domain) was offered as a
 * Jobcoach. Filtering the dropdown fixes what a person sees; it does not fix
 * what the action accepts, and a dropdown is a suggestion rather than a rule.
 *
 * The damage is quiet, which is why it needs a test rather than a filter. A
 * wrongly staffed seat looks exactly like a correctly staffed one: the client
 * reads as covered, and the named person never sees them on any queue, because
 * every queue is built from `careAssignment.role` matching the viewer's own
 * domain. Nobody is told, and nobody is looking.
 */

import { saveCareSeat } from '../care'

const mockUserFindFirst = vi.fn()
const mockInsertValues = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/lib/db', async () => {
  return {
    ...(await vi.importActual<object>('@/lib/db')),
    db: {
      query: {
        user: { findFirst: (...a: unknown[]) => mockUserFindFirst(...a) },
      },
      insert: vi.fn(() => ({
        values: (v: unknown) => ({
          onConflictDoUpdate: () => mockInsertValues(v),
        }),
      })),
      delete: vi.fn(() => ({ where: () => mockDelete() })),
    },
  }
})

vi.mock('next/cache', async () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', async () => ({ logAudit: vi.fn() }))

// The widest possible EDITOR, so nothing is refused for the wrong reason.
vi.mock('@/lib/auth', async () => ({
  getCurrentUser: vi.fn(async () => ({
    id: 'staff-admin',
    name: 'Georgy',
    role: 'BETREUUNG' as const,
    scope: 'ALL_DOMAINS' as const,
    isSystemAdmin: true,
  })),
}))

function seatForm(role: string, staffId: string): FormData {
  const fd = new FormData()
  fd.set('residentId', 'res-1')
  fd.set('role', role)
  fd.set('staffId', staffId)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('saveCareSeat checks the person being named', () => {
  it('refuses a role that works no care domain at all', async () => {
    mockUserFindFirst.mockResolvedValue({
      id: 'liegenschaften-lead',
      role: 'LIEGENSCHAFTEN',
      scope: 'OWN_DOMAIN',
    })

    const result = await saveCareSeat(seatForm('JOB', 'liegenschaften-lead'))

    expect(result.success).toBe(false)
    expect(mockInsertValues).not.toHaveBeenCalled()
  })

  it('refuses a specialist in somebody else’s domain', async () => {
    mockUserFindFirst.mockResolvedValue({
      id: 'jobcoach',
      role: 'JOBCOACH',
      scope: 'OWN_DOMAIN',
    })

    const result = await saveCareSeat(seatForm('VOLUNTEERING', 'jobcoach'))

    expect(result.success).toBe(false)
    expect(mockInsertValues).not.toHaveBeenCalled()
  })

  it('accepts a specialist in their own domain', async () => {
    mockUserFindFirst.mockResolvedValue({
      id: 'coordinator',
      role: 'FREIWILLIGENARBEIT',
      scope: 'OWN_DOMAIN',
    })

    const result = await saveCareSeat(seatForm('VOLUNTEERING', 'coordinator'))

    expect(result.success).toBe(true)
    expect(mockInsertValues).toHaveBeenCalled()
  })

  it('accepts somebody who covers every domain', async () => {
    mockUserFindFirst.mockResolvedValue({
      id: 'all-domains',
      role: 'BETREUUNG',
      scope: 'ALL_DOMAINS',
    })

    const result = await saveCareSeat(seatForm('SOCIAL', 'all-domains'))

    expect(result.success).toBe(true)
    expect(mockInsertValues).toHaveBeenCalled()
  })

  it('still allows clearing a seat, which names nobody', async () => {
    const fd = new FormData()
    fd.set('residentId', 'res-1')
    fd.set('role', 'JOB')
    fd.set('staffId', '')

    const result = await saveCareSeat(fd)

    expect(result.success).toBe(true)
    expect(mockDelete).toHaveBeenCalled()
    expect(mockUserFindFirst).not.toHaveBeenCalled()
  })
})
