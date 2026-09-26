/**
 * The marketplace's boundaries, which are all quiet failures.
 *
 * Every one of these is invisible in a screenshot: a post claimed by the person
 * who wrote it looks identical to a real match, a contact note leaking to the
 * whole site looks like a normal card, and a category filed under the wrong
 * half of the board sorts into the wrong list forever. None of it throws.
 */

import type { MockedFunction } from 'vitest'
import { marketplacePost } from '@/lib/db'
import { and, eq, inArray } from 'drizzle-orm'
import { getPortalAuth } from '@/lib/portal-auth'
import {
  claimMarketplacePost,
  createMarketplacePost,
  deleteMarketplacePost,
  listMyMarketplacePosts,
  listPortalMarketplacePosts,
  releaseMarketplaceClaim,
  reopenMarketplacePost,
} from '../marketplace'

const mockFindFirst = vi.fn()
const mockFindMany = vi.fn()
// Receives the insert payload of db.insert(...).values(payload).
const mockInsert = vi.fn()
// Receives (set payload, where expression) of a plain awaited update.
const mockUpdate = vi.fn()
// Receives (set payload, where expression) of an update awaited via .returning();
// resolves with the returned rows array.
const mockUpdateReturning = vi.fn()
// Receives the where expression of db.delete(...).where(where).
const mockDelete = vi.fn()

vi.mock('@/lib/db', async () => ({
  ...(await vi.importActual<object>('@/lib/db')),
  db: {
    query: {
      marketplacePost: {
        findFirst: (...a: unknown[]) => mockFindFirst(...a),
        findMany: (...a: unknown[]) => mockFindMany(...a),
      },
    },
    insert: vi.fn(() => ({
      values: (v: unknown): Promise<unknown> => Promise.resolve(mockInsert(v)),
    })),
    update: vi.fn(() => ({
      set: (v: unknown) => ({
        // The same builder is either awaited directly or via .returning();
        // record only the path the code actually takes.
        where: (w: unknown) => ({
          then: (
            resolve: (value: unknown) => unknown,
            reject: (reason: unknown) => unknown,
          ): Promise<unknown> => Promise.resolve(mockUpdate(v, w)).then(resolve, reject),
          returning: (): Promise<unknown[]> => Promise.resolve(mockUpdateReturning(v, w)),
        }),
      }),
    })),
    delete: vi.fn(() => ({
      where: (w: unknown): Promise<unknown> => Promise.resolve(mockDelete(w)),
    })),
  },
}))

vi.mock('next/cache', async () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/portal-auth', async () => ({ getPortalAuth: vi.fn() }))
vi.mock('@/lib/auth', async () => ({ getCurrentUser: vi.fn() }))

const mockAuth = getPortalAuth as MockedFunction<typeof getPortalAuth>

const ME = 'resident-me'
const OTHER = 'resident-other'
const MY_UNIT = 'unit-mine'

function signedInAsMe() {
  mockAuth.mockResolvedValue({
    resident: { id: ME },
    placement: { housingUnitId: MY_UNIT },
  } as unknown as Awaited<ReturnType<typeof getPortalAuth>>)
}

function form(entries: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.append(key, value)
  return data
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    title: 'Wasserkocher',
    description: 'Funktioniert',
    kind: 'GIVE_AWAY',
    category: 'KITCHEN',
    status: 'OPEN',
    createdAt: new Date('2026-08-01T10:00:00Z'),
    contactNote: 'Zimmer 2, abends',
    hiddenByStaff: false,
    hiddenReason: null,
    housingUnit: { id: MY_UNIT, code: 'DEMO-1' },
    postedBy: { code: 'RES-AAA', displayName: 'Yasmin' },
    claimedBy: null,
    postedById: OTHER,
    claimedById: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  signedInAsMe()
})

describe('claiming', () => {
  it('refuses the post you wrote yourself', async () => {
    // Nothing stopped this, and the result was a listing marked "Übernommen
    // von <the person who wrote it>": off the open board, unreachable by
    // anyone who actually wanted it, and indistinguishable from a real match.
    mockFindFirst.mockResolvedValue({
      id: 'post-1',
      status: 'OPEN',
      hiddenByStaff: false,
      postedById: ME,
      claimedById: null,
    })

    const result = await claimMarketplacePost(form({ id: 'post-1' }))

    expect(result.success).toBe(false)
    expect(mockUpdateReturning).not.toHaveBeenCalled()
  })

  it('claims somebody else’s open post', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'post-1',
      status: 'OPEN',
      hiddenByStaff: false,
      postedById: OTHER,
      claimedById: null,
    })
    mockUpdateReturning.mockResolvedValue([{ id: 'post-1' }])

    const result = await claimMarketplacePost(form({ id: 'post-1' }))

    expect(result.success).toBe(true)
    // Conditional on still being OPEN, so two people pressing at the same
    // moment produce one winner rather than a silent overwrite.
    expect(mockUpdateReturning).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CLAIMED', claimedById: ME }),
      and(eq(marketplacePost.id, 'post-1'), eq(marketplacePost.status, 'OPEN')),
    )
  })

  it('loses the race rather than overwriting the winner', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'post-1',
      status: 'OPEN',
      hiddenByStaff: false,
      postedById: OTHER,
      claimedById: null,
    })
    mockUpdateReturning.mockResolvedValue([])

    expect((await claimMarketplacePost(form({ id: 'post-1' }))).success).toBe(false)
  })

  it('refuses a post staff have hidden', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'post-1',
      status: 'OPEN',
      hiddenByStaff: true,
      postedById: OTHER,
      claimedById: null,
    })

    expect((await claimMarketplacePost(form({ id: 'post-1' }))).success).toBe(false)
  })
})

describe('backing out', () => {
  it('lets the claimer release, putting the post back on the board', async () => {
    // The only way out used to be CLOSE, which takes the item off the board
    // entirely — one person's second thoughts destroyed the offer for everyone.
    mockFindFirst.mockResolvedValue({
      id: 'post-1',
      status: 'CLAIMED',
      postedById: OTHER,
      claimedById: ME,
    })

    const result = await releaseMarketplaceClaim(form({ id: 'post-1' }))

    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      { status: 'OPEN', claimedById: null, claimedAt: null },
      eq(marketplacePost.id, 'post-1'),
    )
  })

  it('lets the poster release a claimer who never turned up', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'post-1',
      status: 'CLAIMED',
      postedById: ME,
      claimedById: OTHER,
    })

    expect((await releaseMarketplaceClaim(form({ id: 'post-1' }))).success).toBe(true)
  })

  it('refuses a release from a bystander', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'post-1',
      status: 'CLAIMED',
      postedById: OTHER,
      claimedById: 'someone-else',
    })

    expect((await releaseMarketplaceClaim(form({ id: 'post-1' }))).success).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('withdrawing', () => {
  it('deletes your own untouched post', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'post-1',
      status: 'OPEN',
      postedById: ME,
      claimedById: null,
    })

    expect((await deleteMarketplacePost(form({ id: 'post-1' }))).success).toBe(true)
    expect(mockDelete).toHaveBeenCalled()
  })

  it('refuses to delete a post somebody has already answered', async () => {
    // Deleting it would erase the other person's side of an arrangement
    // without telling them. A claimed post can only be closed.
    mockFindFirst.mockResolvedValue({
      id: 'post-1',
      status: 'CLAIMED',
      postedById: ME,
      claimedById: OTHER,
    })

    expect((await deleteMarketplacePost(form({ id: 'post-1' }))).success).toBe(false)
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('refuses to delete somebody else’s post', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'post-1',
      status: 'OPEN',
      postedById: OTHER,
      claimedById: null,
    })

    expect((await deleteMarketplacePost(form({ id: 'post-1' }))).success).toBe(false)
  })

  it('reopens only for the poster', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'post-1',
      status: 'CLOSED',
      postedById: OTHER,
      claimedById: null,
    })

    expect((await reopenMarketplacePost(form({ id: 'post-1' }))).success).toBe(false)
  })
})

describe('posting', () => {
  it('keeps a category that fits the kind', async () => {
    await createMarketplacePost(
      form({ title: 'Sofa', description: 'Rot', kind: 'GIVE_AWAY', category: 'FURNITURE' }),
    )

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'GIVE_AWAY', category: 'FURNITURE' }),
    )
  })

  it('falls back rather than filing furniture under an offer to translate', async () => {
    // Not a cosmetic mismatch: the row would sort into the goods half of the
    // board forever, and nothing downstream would ever notice. Falling back
    // beats rejecting — the person wrote a real post, and losing it to a
    // dropdown would be the worse outcome.
    await createMarketplacePost(
      form({
        title: 'Briefe',
        description: 'Ich helfe',
        kind: 'OFFER_HELP',
        category: 'FURNITURE',
      }),
    )

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'OFFER_HELP', category: 'OTHER' }),
    )
  })

  it('refuses a kind that is not a kind', async () => {
    const result = await createMarketplacePost(
      form({ title: 'x', description: 'y', kind: 'SELL_FOR_CASH', category: 'OTHER' }),
    )

    expect(result.success).toBe(false)
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

describe('reading the board', () => {
  it('hands the contact note only to the two people the handover is between', async () => {
    // The payload is the leak, not the markup: a note dropped in the JSX still
    // ships to every browser that renders the page.
    mockFindMany.mockResolvedValue([
      row({ id: 'theirs', postedById: OTHER, claimedById: null }),
      row({ id: 'mine', postedById: ME, claimedById: null }),
      row({ id: 'claimed-by-me', postedById: OTHER, claimedById: ME }),
    ])

    const result = await listPortalMarketplacePosts()
    const byId = Object.fromEntries((result?.own ?? []).map((post) => [post.id, post]))

    expect(byId['theirs'].contactNote).toBeNull()
    expect(byId['mine'].contactNote).toBe('Zimmer 2, abends')
    expect(byId['claimed-by-me'].contactNote).toBe('Zimmer 2, abends')
  })

  it('shows other units only what is still open', async () => {
    mockFindMany.mockResolvedValue([
      row({ id: 'other-open', housingUnit: { id: 'unit-x', code: 'X' }, status: 'OPEN' }),
      row({ id: 'other-closed', housingUnit: { id: 'unit-x', code: 'X' }, status: 'CLOSED' }),
      row({ id: 'own-closed', status: 'CLOSED' }),
    ])

    const result = await listPortalMarketplacePosts()

    expect(result?.open.map((post) => post.id)).toEqual(['other-open'])
    // Your own household's finished business stays visible — it is your record.
    expect(result?.own.map((post) => post.id)).toEqual(['own-closed'])
  })

  it('filters to one half of the board when asked', async () => {
    mockFindMany.mockResolvedValue([
      row({ id: 'thing', kind: 'GIVE_AWAY' }),
      row({ id: 'help', kind: 'OFFER_HELP' }),
    ])

    const result = await listPortalMarketplacePosts('SERVICE')

    expect(result?.own.map((post) => post.id)).toEqual(['help'])
  })
})

/**
 * The dashboard card exists because the board never told anyone anything.
 *
 * Posting, claiming and releasing all work; not one of them notifies. So a
 * resident could offer a wardrobe, someone could claim it, and the first
 * person would learn about it only by happening to reopen the marketplace —
 * with `contactNote`, the entire mechanism for arranging the handover, sitting
 * on a page nobody was sent to.
 */
describe('your own posts, for the dashboard', () => {
  it('asks only for your own posts that are still live', async () => {
    mockFindMany.mockResolvedValue([])

    await listMyMarketplacePosts()

    const [args] = mockFindMany.mock.calls[0]
    expect(args.where).toEqual(
      and(
        eq(marketplacePost.postedById, ME),
        eq(marketplacePost.hiddenByStaff, false),
        inArray(marketplacePost.status, ['OPEN', 'CLAIMED']),
      ),
    )
  })

  it('carries the contact note, which is the point of the card', async () => {
    mockFindMany.mockResolvedValue([
      row({
        postedById: ME,
        status: 'CLAIMED',
        claimedBy: { code: 'RES-BBB', displayName: 'Hana' },
        claimedById: OTHER,
      }),
    ])

    const [post] = await listMyMarketplacePosts()

    expect(post.status).toBe('CLAIMED')
    expect(post.claimedByName).toBe('Hana')
    // You are the poster, so the handover details are yours to see.
    expect(post.contactNote).toBe('Zimmer 2, abends')
  })

  it('returns nothing rather than throwing when nobody is signed in', async () => {
    mockAuth.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof getPortalAuth>>)

    await expect(listMyMarketplacePosts()).resolves.toEqual([])
    expect(mockFindMany).not.toHaveBeenCalled()
  })
})
