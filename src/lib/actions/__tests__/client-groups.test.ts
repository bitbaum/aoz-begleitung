/**
 * Saved client groups: every refusal is RETURNED (never thrown into the error
 * boundary), and only the creator or a system admin may change a group.
 */

import { clientGroup } from '@/lib/db'
import { CLIENT_GROUP_LABELS } from '@/lib/constants/labels/residents'
import { createClientGroup, deleteClientGroup, renameClientGroup } from '../client-groups'

const E = CLIENT_GROUP_LABELS.errors

const mockFindFirst = vi.fn()
const mockInsert = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockRequirePermission = vi.fn()

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    query: { clientGroup: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } },
    insert: (table: unknown) => ({
      values: (values: unknown) => ({
        returning: () => Promise.resolve(mockInsert(table, values)),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: unknown) => ({ where: () => Promise.resolve(mockUpdate(table, values)) }),
    }),
    delete: (table: unknown) => ({ where: () => Promise.resolve(mockDelete(table)) }),
  },
}))
vi.mock('next/cache', async () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', async () => ({ logAudit: vi.fn() }))
vi.mock('@/lib/logger', async () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), errorWithCause: vi.fn() },
}))
vi.mock('@/lib/auth', async () => ({
  requirePermission: (...a: unknown[]) => mockRequirePermission(...a),
}))

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.append(key, value)
  return data
}

const CREATOR = { id: 'creator', role: 'BETREUUNG', isSystemAdmin: false }
const COLLEAGUE = { id: 'colleague', role: 'JOBCOACH', isSystemAdmin: false }
const SYSADMIN = { id: 'admin', role: 'BETREUUNG', isSystemAdmin: true }

beforeEach(() => {
  vi.clearAllMocks()
  mockRequirePermission.mockResolvedValue(CREATOR)
  mockInsert.mockReturnValue([{ id: 'group-1' }])
  mockFindFirst.mockResolvedValue({ id: 'group-1', name: 'Alt', createdByUserId: 'creator' })
})

describe('createClientGroup', () => {
  const create = (entries: Record<string, string>) => createClientGroup({}, form(entries))

  it('asks for residents:read — a group is a saved view, not data', async () => {
    await create({ name: 'Arabisch', filters: JSON.stringify({ lang: ['AR'] }) })
    expect(mockRequirePermission).toHaveBeenCalledWith('residents:read')
  })

  it('saves the filters without their neutral values, owned by the viewer', async () => {
    const state = await create({
      name: '  Arabisch sprechend  ',
      description: '',
      filters: JSON.stringify({ stand: 'all', seat: 'all', lang: ['AR'] }),
    })
    expect(state).toEqual({ ok: true, groupId: 'group-1' })
    expect(mockInsert).toHaveBeenCalledWith(clientGroup, {
      name: 'Arabisch sprechend',
      description: null,
      filters: { lang: ['AR'] },
      createdByUserId: 'creator',
    })
  })

  it.each([
    ['no name', { name: '   ', filters: '{"lang":["AR"]}' }, E.nameRequired],
    ['a name too long', { name: 'x'.repeat(81), filters: '{"lang":["AR"]}' }, E.nameTooLong],
    ['unparseable filters', { name: 'A', filters: '{lang' }, E.invalidFilters],
    ['an unknown filter id', { name: 'A', filters: '{"permit":"B"}' }, E.invalidFilters],
    ['only neutral filters', { name: 'A', filters: '{"seat":"all","stand":"all"}' }, E.noFilters],
  ])('returns the reason for %s', async (_label, entries, error) => {
    const state = await create(entries)
    expect(state.error).toBe(error)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('returns a message when the database refuses', async () => {
    mockInsert.mockImplementation(() => {
      throw new Error('connection reset')
    })
    const state = await create({ name: 'A', filters: '{"lang":["AR"]}' })
    expect(state.error).toBe(E.saveFailed)
  })
})

describe('renameClientGroup', () => {
  const rename = () => renameClientGroup({}, form({ id: 'group-1', name: 'Neu' }))

  it('lets the creator rename', async () => {
    expect(await rename()).toEqual({ ok: true, groupId: 'group-1' })
    expect(mockUpdate).toHaveBeenCalledWith(clientGroup, { name: 'Neu', description: null })
  })

  it('lets a system admin rename someone else’s group', async () => {
    mockRequirePermission.mockResolvedValue(SYSADMIN)
    expect((await rename()).ok).toBe(true)
  })

  it('refuses a colleague, by returning the reason', async () => {
    mockRequirePermission.mockResolvedValue(COLLEAGUE)
    expect((await rename()).error).toBe(E.notYours)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('says when the group is gone', async () => {
    mockFindFirst.mockResolvedValue(undefined)
    expect((await rename()).error).toBe(E.notFound)
  })
})

describe('deleteClientGroup', () => {
  const remove = () => deleteClientGroup({}, form({ id: 'group-1' }))

  it('lets the creator delete', async () => {
    expect(await remove()).toEqual({ ok: true })
    expect(mockDelete).toHaveBeenCalledWith(clientGroup)
  })

  it('refuses a colleague', async () => {
    mockRequirePermission.mockResolvedValue(COLLEAGUE)
    expect((await remove()).error).toBe(E.notYours)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('refuses an empty id without a query', async () => {
    expect((await deleteClientGroup({}, form({ id: '' }))).error).toBe(E.notFound)
    expect(mockFindFirst).not.toHaveBeenCalled()
  })
})
