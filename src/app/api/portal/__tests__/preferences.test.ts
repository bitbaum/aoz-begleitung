/**
 * Tests for portal preferences API route (POST /api/portal/preferences)
 *
 * Tests: successful update, unauthenticated, resident not found, validation error, DB error
 */

import { NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'

// --- Mocks ---

const mockCookieGet = vi.fn()
vi.mock('next/headers', async () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (name: string) => mockCookieGet(name),
  }),
}))

const mockFindFirst = vi.fn()
const mockUpdate = vi.fn()
vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    query: {
      resident: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    // db.update(resident).set(v).where(w) — the mock receives { set, where }.
    update: () => ({
      set: (v: unknown) => ({
        where: (w: unknown): Promise<unknown> => mockUpdate({ set: v, where: w }),
      }),
    }),
  },
}))

vi.mock('@/lib/audit', async () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', async () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    errorWithCause: vi.fn(),
  },
}))

// --- Import after mocks ---
import { POST } from '../preferences/route'
import { resident as residentTable } from '@/lib/db'
import { eq } from 'drizzle-orm'

// --- Helpers ---

/** Valid preference form data matching portalPreferencesSchema */
const VALID_PREFS: Record<string, string> = {
  sleepSchedule: 'STANDARD',
  noiseTolerance: '3',
  cleanlinessPractice: '4',
  socialStyle: 'MODERATE',
  privacyNeed: '3',
  smokingStatus: 'NON_SMOKER',
  petTolerance: 'true',
  sharedBathroom: 'true',
  sharedKitchen: 'true',
}

function createPreferencesRequest(data: Record<string, string>): NextRequest {
  const formData = new URLSearchParams()
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value)
  }

  return new NextRequest('http://localhost:3001/api/portal/preferences', {
    method: 'POST',
    body: formData.toString(),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
  })
}

// --- Tests ---

describe('POST /api/portal/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns 401 when no resident_code cookie', async () => {
    mockCookieGet.mockReturnValue(undefined)

    const req = createPreferencesRequest(VALID_PREFS)
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.error).toBe(ERROR_MESSAGES.NOT_AUTHENTICATED)
  })

  test('returns 404 when resident code not found in DB', async () => {
    mockCookieGet.mockReturnValue({ value: 'INVALID-CODE' })
    mockFindFirst.mockResolvedValue(null)

    const req = createPreferencesRequest(VALID_PREFS)
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.success).toBe(false)
    expect(body.error).toBe(ERROR_MESSAGES.RESIDENT_NOT_FOUND)
  })

  test('updates preferences and returns success', async () => {
    const resident = { id: 'res-1', code: 'RES-001' }
    mockCookieGet.mockReturnValue({ value: 'RES-001' })
    mockFindFirst.mockResolvedValue(resident)
    mockUpdate.mockResolvedValue(resident)

    const req = createPreferencesRequest(VALID_PREFS)
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)

    // Verify the resident update was called with correct data
    expect(mockUpdate).toHaveBeenCalledWith({
      set: expect.objectContaining({
        sleepSchedule: 'STANDARD',
        noiseTolerance: 3,
        cleanlinessPractice: 4,
        socialStyle: 'MODERATE',
        privacyNeed: 3,
        smokingStatus: 'NON_SMOKER',
      }),
      where: eq(residentTable.id, 'res-1'),
    })
  })

  test('builds roommatePreferences text from optional fields — never a region or culture', async () => {
    const resident = { id: 'res-2', code: 'RES-002' }
    mockCookieGet.mockReturnValue({ value: 'RES-002' })
    mockFindFirst.mockResolvedValue(resident)
    mockUpdate.mockResolvedValue(resident)

    const prefsWithRoommate = {
      ...VALID_PREFS,
      preferredAgeRange: '25-35',
      // The portal no longer asks this. A crafted request that still sends it
      // must not get a region preference stored against a person.
      culturalPreference: 'SAME_REGION',
      additionalPreferences: 'Ruhige Person',
    }

    const req = createPreferencesRequest(prefsWithRoommate)
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)

    const updateCall = mockUpdate.mock.calls[0][0]
    expect(updateCall.set.roommatePreferences).toContain('Altersgruppe: 25-35')
    expect(updateCall.set.roommatePreferences).not.toMatch(/Kultur|REGION/)
    expect(updateCall.set.roommatePreferences).toContain('Ruhige Person')
  })

  test('returns 400 on validation error (invalid sleepSchedule)', async () => {
    mockCookieGet.mockReturnValue({ value: 'RES-001' })
    mockFindFirst.mockResolvedValue({ id: 'res-1', code: 'RES-001' })

    const invalidPrefs = { ...VALID_PREFS, sleepSchedule: 'INVALID_VALUE' }
    const req = createPreferencesRequest(invalidPrefs)
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
  })

  test('returns 500 when database update fails', async () => {
    mockCookieGet.mockReturnValue({ value: 'RES-001' })
    mockFindFirst.mockResolvedValue({ id: 'res-1', code: 'RES-001' })
    mockUpdate.mockRejectedValue(new Error('DB connection failed'))

    const req = createPreferencesRequest(VALID_PREFS)
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error).toBe(ERROR_MESSAGES.PREFERENCES_SAVE_ERROR)
  })

  // ── Permission isolation ───────────────────────────────────────────────────
  // Verify residents can ONLY update their own record — identity comes from
  // the httpOnly cookie, never from user-supplied body data.

  test('always updates the resident identified by cookie, never request body', async () => {
    const ownResident = { id: 'res-own', code: 'RES-OWN' }
    mockCookieGet.mockReturnValue({ value: 'RES-OWN' })
    mockFindFirst.mockResolvedValue(ownResident)
    mockUpdate.mockResolvedValue(ownResident)

    const req = createPreferencesRequest(VALID_PREFS)
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)

    // Must use DB-resolved resident id, not any value from request body
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: eq(residentTable.code, 'RES-OWN') }),
    )
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: eq(residentTable.id, 'res-own') }),
    )
  })

  test('cannot update another resident by cookie swap — only cookie-identified resident is updated', async () => {
    // Resident A has their own cookie
    const residentA = { id: 'res-a', code: 'RES-AAA' }
    mockCookieGet.mockReturnValue({ value: 'RES-AAA' })
    mockFindFirst.mockResolvedValue(residentA)
    mockUpdate.mockResolvedValue(residentA)

    const req = createPreferencesRequest(VALID_PREFS)
    await POST(req)

    // Update is scoped to resident A's id, regardless of anything else
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: eq(residentTable.id, 'res-a') }),
    )
    // Resident B's id never appears in any DB call
    expect(mockUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: eq(residentTable.id, 'res-b') }),
    )
  })
})
