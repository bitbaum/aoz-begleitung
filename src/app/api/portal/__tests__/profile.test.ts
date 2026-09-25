/**
 * Tests for resident self-profile, photo, and apartment-nickname APIs
 *
 * Endpoints:
 *   PATCH  /api/portal/profile              — displayName / bio
 *   POST   /api/portal/profile/photo        — upload avatar
 *   DELETE /api/portal/profile/photo        — remove avatar
 *   GET    /api/portal/residents/[id]/photo — serve to self + roommates only
 *   PATCH  /api/portal/apartment            — resident-chosen apartment name
 */

import { NextRequest } from 'next/server'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { PHOTO_LIMITS } from '@/lib/config/profile'

// --- Mocks ---

const mockGetPortalAuth = vi.fn()
const mockGetPortalResident = vi.fn()
vi.mock('@/lib/portal-auth', async () => ({
  getPortalAuth: () => mockGetPortalAuth(),
  getPortalResident: () => mockGetPortalResident(),
}))

// The photo route asks whether the viewer is staff before it asks anything
// else. Default: nobody is, so the resident-facing cases are unaffected.
const mockGetCurrentUser = vi.fn().mockResolvedValue(null)
vi.mock('@/lib/auth', async () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}))

const mockResidentUpdate = vi.fn()
// Every photo request now loads the subject's visibility setting first.
const mockResidentFindFirst = vi.fn()
const mockPhotoUpsert = vi.fn()
const mockPhotoDeleteMany = vi.fn()
const mockPhotoFindFirst = vi.fn()
const mockPlacementFindFirst = vi.fn()
const mockUnitUpdate = vi.fn()
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db')
  return {
    ...actual,
    db: {
      query: {
        resident: { findFirst: (...args: unknown[]) => mockResidentFindFirst(...args) },
        residentPhoto: { findFirst: (...args: unknown[]) => mockPhotoFindFirst(...args) },
        placement: { findFirst: (...args: unknown[]) => mockPlacementFindFirst(...args) },
      },
      // Profile PATCH updates Resident; apartment PATCH updates HousingUnit.
      // Both mocks receive { set, where } and resolve the .returning() array.
      update: (table: unknown) => ({
        set: (v: unknown) => ({
          where: (w: unknown) => ({
            returning: (): Promise<unknown[]> =>
              table === actual.resident
                ? mockResidentUpdate({ set: v, where: w })
                : mockUnitUpdate({ set: v, where: w }),
          }),
        }),
      }),
      // Photo upload is insert…onConflictDoUpdate (an upsert).
      insert: () => ({
        values: (v: unknown) => ({
          onConflictDoUpdate: (conflict: unknown): Promise<unknown> =>
            mockPhotoUpsert({ values: v, conflict }),
        }),
      }),
      delete: () => ({ where: (w: unknown): Promise<unknown> => mockPhotoDeleteMany(w) }),
      // The photo route builds a "shares a unit" subquery from db.select();
      // it is never awaited, only embedded into inArray(), so a plain
      // chainable stub is enough.
      select: () => ({
        from: () => {
          const chain = { where: () => chain }
          return chain
        },
      }),
    },
  }
})

const mockLogAudit = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/audit', async () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
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

import { PATCH as patchProfile } from '../profile/route'
import { POST as uploadPhoto, DELETE as deletePhoto } from '../profile/photo/route'
import { GET as getPhoto } from '../residents/[id]/photo/route'
import { PATCH as patchApartment } from '../apartment/route'
import { housingUnit, residentPhoto } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

// --- Helpers ---

const RESIDENT = { id: 'georgy', code: 'RES-GEO001' }
const AUTH = { resident: RESIDENT, placement: { id: 'placement-1', housingUnitId: 'unit-1' } }

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function photoRequest(file: File | null): NextRequest {
  const formData = new FormData()
  if (file) formData.append('photo', file)
  return new NextRequest('http://localhost/api/portal/profile/photo', {
    method: 'POST',
    body: formData,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetPortalResident.mockResolvedValue(RESIDENT)
  mockGetPortalAuth.mockResolvedValue(AUTH)
  mockGetCurrentUser.mockResolvedValue(null)
  // Default subject: the ROOMMATES setting, which is what the route enforced
  // before the setting existed — so these cases keep testing the old rule.
  // Echoes the id that was asked for, the way the real query does — a fixed id
  // would make "am I looking at my own profile" false for everyone. The id is
  // the bound parameter of the drizzle eq() expression.
  mockResidentFindFirst.mockImplementation((args: { where: never }) => {
    const id = new PgDialect().sqlToQuery(args.where).params[0] as string
    return Promise.resolve({ id, profileVisibility: 'ROOMMATES' })
  })
  mockResidentUpdate.mockImplementation((args: { set: unknown }) =>
    Promise.resolve([{ id: 'georgy', code: 'RES-GEO001', ...(args.set as object) }]),
  )
  mockUnitUpdate.mockImplementation((args: { set: { nickname: string | null } }) =>
    Promise.resolve([{ id: 'unit-1', nickname: args.set.nickname }]),
  )
})

describe('PATCH /api/portal/profile', () => {
  it('returns 401 without a session', async () => {
    mockGetPortalResident.mockResolvedValue(null)
    const response = await patchProfile(
      jsonRequest('/api/portal/profile', { displayName: 'Georgy' }),
    )
    expect(response.status).toBe(401)
  })

  it('updates displayName and bio', async () => {
    const response = await patchProfile(
      jsonRequest('/api/portal/profile', { displayName: '  Georgy ', bio: 'Zimmer 1' }),
    )
    expect(response.status).toBe(200)
    expect(mockResidentUpdate.mock.calls[0][0].set).toEqual({
      displayName: 'Georgy',
      bio: 'Zimmer 1',
      updatedAt: expect.any(Date),
    })
  })

  it('clears a field when the empty string is sent', async () => {
    await patchProfile(jsonRequest('/api/portal/profile', { displayName: '' }))
    expect(mockResidentUpdate.mock.calls[0][0].set).toEqual({
      displayName: null,
      updatedAt: expect.any(Date),
    })
  })

  it('leaves untouched fields out of the update', async () => {
    await patchProfile(jsonRequest('/api/portal/profile', { bio: 'Nur Bio' }))
    expect(mockResidentUpdate.mock.calls[0][0].set).toEqual({
      bio: 'Nur Bio',
      updatedAt: expect.any(Date),
    })
  })

  it('rejects an over-long displayName', async () => {
    const response = await patchProfile(
      jsonRequest('/api/portal/profile', { displayName: 'x'.repeat(100) }),
    )
    expect(response.status).toBe(400)
    expect(mockResidentUpdate).not.toHaveBeenCalled()
  })
})

describe('POST /api/portal/profile/photo', () => {
  it('stores an allowed image', async () => {
    const file = new File([new Uint8Array(1024)], 'me.jpg', { type: 'image/jpeg' })
    const response = await uploadPhoto(photoRequest(file))
    expect(response.status).toBe(200)
    const upsert = mockPhotoUpsert.mock.calls[0][0]
    expect(upsert.values.residentId).toBe('georgy')
    expect(upsert.values.mimeType).toBe('image/jpeg')
    // Conflict on residentId makes the insert an upsert per resident.
    expect(upsert.conflict.target).toBe(residentPhoto.residentId)
    expect(upsert.conflict.set.mimeType).toBe('image/jpeg')
  })

  it('rejects a disallowed mime type', async () => {
    const file = new File(['<svg/>'], 'evil.svg', { type: 'image/svg+xml' })
    const response = await uploadPhoto(photoRequest(file))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe(ERROR_MESSAGES.PHOTO_TYPE_INVALID)
    expect(mockPhotoUpsert).not.toHaveBeenCalled()
  })

  it('rejects an oversized image', async () => {
    const file = new File([new Uint8Array(PHOTO_LIMITS.maxBytes + 1)], 'big.jpg', {
      type: 'image/jpeg',
    })
    const response = await uploadPhoto(photoRequest(file))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe(ERROR_MESSAGES.PHOTO_TOO_LARGE)
  })

  it('rejects a missing file', async () => {
    const response = await uploadPhoto(photoRequest(null))
    expect(response.status).toBe(400)
  })

  it('DELETE removes the photo', async () => {
    const response = await deletePhoto()
    expect(response.status).toBe(200)
    expect(mockPhotoDeleteMany).toHaveBeenCalledWith(eq(residentPhoto.residentId, 'georgy'))
  })
})

describe('GET /api/portal/residents/[id]/photo', () => {
  const PHOTO = { residentId: 'hana', data: Buffer.from([1, 2, 3]), mimeType: 'image/jpeg' }

  function get(id: string) {
    return getPhoto(new NextRequest(`http://localhost/api/portal/residents/${id}/photo`), {
      params: Promise.resolve({ id }),
    })
  }

  it('serves your own photo without a placement check', async () => {
    mockPhotoFindFirst.mockResolvedValue({ ...PHOTO, residentId: 'georgy' })
    const response = await get('georgy')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/jpeg')
    expect(mockPlacementFindFirst).not.toHaveBeenCalled()
  })

  it('serves the photo to staff, whatever the resident chose', async () => {
    // Staff can always identify the person they are supporting. This is the
    // deliberate change from the route's original behaviour, which hid photos
    // from staff too.
    mockGetCurrentUser.mockResolvedValue({ id: 'staff-1', role: 'ADMIN' })
    mockResidentFindFirst.mockResolvedValue({ id: 'hana', profileVisibility: 'PRIVATE' })
    mockPhotoFindFirst.mockResolvedValue(PHOTO)

    const response = await get('hana')

    expect(response.status).toBe(200)
    // Staff never need a shared-unit lookup — they are not a flatmate.
    expect(mockPlacementFindFirst).not.toHaveBeenCalled()
  })

  it('404s for a roommate when the resident chose PRIVATE', async () => {
    mockResidentFindFirst.mockResolvedValue({ id: 'hana', profileVisibility: 'PRIVATE' })
    mockPlacementFindFirst.mockResolvedValue({ id: 'placement-1' })
    mockPhotoFindFirst.mockResolvedValue(PHOTO)

    expect((await get('hana')).status).toBe(404)
  })

  it('serves a resident of another unit when the setting is RESIDENTS', async () => {
    mockResidentFindFirst.mockResolvedValue({ id: 'hana', profileVisibility: 'RESIDENTS' })
    mockPlacementFindFirst.mockResolvedValue(null)
    mockPhotoFindFirst.mockResolvedValue(PHOTO)

    expect((await get('hana')).status).toBe(200)
  })

  it('404s for an unknown resident without touching the photo table', async () => {
    // Ordering matters: looking up the photo first would answer "does this
    // person have a picture" for an id the caller may simply have guessed.
    mockResidentFindFirst.mockResolvedValue(null)

    expect((await get('nobody')).status).toBe(404)
    expect(mockPhotoFindFirst).not.toHaveBeenCalled()
  })

  it("serves a roommate's photo when a shared unit exists", async () => {
    mockPlacementFindFirst.mockResolvedValue({ id: 'placement-1' })
    mockPhotoFindFirst.mockResolvedValue(PHOTO)
    const response = await get('hana')
    expect(response.status).toBe(200)
  })

  it('404s for residents of other units (no photo-existence leak)', async () => {
    mockPlacementFindFirst.mockResolvedValue(null)
    const response = await get('hana')
    expect(response.status).toBe(404)
    expect(mockPhotoFindFirst).not.toHaveBeenCalled()
  })

  it('404s when the roommate has no photo', async () => {
    mockPlacementFindFirst.mockResolvedValue({ id: 'placement-1' })
    mockPhotoFindFirst.mockResolvedValue(null)
    const response = await get('hana')
    expect(response.status).toBe(404)
  })
})

describe('PATCH /api/portal/apartment', () => {
  it('sets the nickname for the own unit', async () => {
    const response = await patchApartment(
      jsonRequest('/api/portal/apartment', { nickname: 'Singapur' }),
    )
    expect(response.status).toBe(200)
    expect(mockUnitUpdate.mock.calls[0][0]).toMatchObject({
      set: { nickname: 'Singapur' },
      where: eq(housingUnit.id, 'unit-1'),
    })
  })

  it('clears the nickname with an empty string', async () => {
    await patchApartment(jsonRequest('/api/portal/apartment', { nickname: '' }))
    expect(mockUnitUpdate.mock.calls[0][0].set).toEqual({ nickname: null })
  })

  it('returns 401 without a placement-backed session', async () => {
    mockGetPortalAuth.mockResolvedValue(null)
    const response = await patchApartment(
      jsonRequest('/api/portal/apartment', { nickname: 'Singapur' }),
    )
    expect(response.status).toBe(401)
    expect(mockUnitUpdate).not.toHaveBeenCalled()
  })
})
