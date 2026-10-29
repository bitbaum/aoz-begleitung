import { NextRequest } from 'next/server'
import { GET, POST } from '../route'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  resident: vi.fn(),
  thread: vi.fn(),
  load: vi.fn(),
  read: vi.fn(),
  append: vi.fn(),
  audit: vi.fn(),
}))
vi.mock('@/lib/auth', () => ({ requireStaffAuth: mocks.auth }))
vi.mock('@/lib/messaging/queries', () => ({
  findMessageResident: mocks.resident,
  getOrCreateThread: mocks.thread,
  loadThreadMessages: mocks.load,
  markThreadRead: mocks.read,
  appendMessage: mocks.append,
}))
vi.mock('@/lib/audit', () => ({ logAudit: mocks.audit }))
vi.mock('@/lib/logger', () => ({ logger: { errorWithCause: vi.fn() } }))

const staff = {
  id: 'staff-1',
  name: 'Staff',
  role: 'BETREUUNG',
  scope: 'OWN_DOMAIN',
  isSystemAdmin: false,
  siteAccess: 'ASSIGNED_UNITS',
  assignedUnitIds: ['house-1'],
}
const params = { params: Promise.resolve({ residentId: 'resident-1' }) }
function request(method: string) {
  return new NextRequest('http://localhost/api/messages/resident-1', {
    method,
    ...(method === 'POST'
      ? {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ body: 'Eine Nachricht.' }),
        }
      : {}),
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue(staff)
  mocks.resident.mockResolvedValue({ id: 'resident-1' })
  mocks.thread.mockResolvedValue({ id: 'thread-1' })
  mocks.load.mockResolvedValue([])
  mocks.append.mockResolvedValue({ id: 'saved-1' })
})

for (const [method, handler] of [
  ['GET', GET],
  ['POST', POST],
] as const) {
  describe(`${method} private staff conversation`, () => {
    it.each(['JOBCOACH', 'FREIWILLIGENARBEIT', 'LIEGENSCHAFTEN'])(
      'denies %s before touching any resident or thread',
      async (role) => {
        mocks.auth.mockResolvedValue({ ...staff, role })
        expect((await handler(request(method), params)).status).toBe(403)
        expect(mocks.resident).not.toHaveBeenCalled()
        expect(mocks.thread).not.toHaveBeenCalled()
        expect(mocks.append).not.toHaveBeenCalled()
      },
    )
    it('returns not found for a resident outside the staff unit scope', async () => {
      mocks.resident.mockResolvedValue(undefined)
      expect((await handler(request(method), params)).status).toBe(404)
      expect(mocks.resident).toHaveBeenCalledWith('resident-1', staff)
      expect(mocks.thread).not.toHaveBeenCalled()
      expect(mocks.read).not.toHaveBeenCalled()
      expect(mocks.append).not.toHaveBeenCalled()
    })
    it('requires a staff session', async () => {
      mocks.auth.mockRejectedValue(new Error('no session'))
      expect((await handler(request(method), params)).status).toBe(401)
      expect(mocks.resident).not.toHaveBeenCalled()
    })
    it('allows care staff only after the scoped resident check', async () => {
      expect((await handler(request(method), params)).status).toBe(200)
      expect(mocks.resident).toHaveBeenCalledWith('resident-1', staff)
      expect(mocks.resident.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.thread.mock.invocationCallOrder[0],
      )
    })
  })
}
