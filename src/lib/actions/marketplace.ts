'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { db, marketplacePost } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { getPortalAuth, type PortalAuthResult } from '@/lib/portal-auth'
import { hasPermission } from '@/lib/auth/role-policy'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { RESIDENT_NAME_SELECT, residentName } from '@/lib/utils/resident-name'
import {
  MARKETPLACE_KIND_VALUES,
  MARKETPLACE_CATEGORY_VALUES,
  categoryFitsKind,
  natureOfKind,
  type MarketplaceNature,
} from '@/lib/config/marketplace'
import type { MarketplacePostKind, MarketplacePostStatus } from '@/lib/db'

export type MarketplacePostSummary = {
  id: string
  title: string
  description: string
  kind: MarketplacePostKind
  nature: MarketplaceNature
  category: string
  status: MarketplacePostStatus
  createdAt: Date
  housingUnitId: string
  housingUnitCode: string
  postedByName: string
  postedById: string
  claimedByName: string | null
  claimedById: string | null
  /**
   * Present ONLY when the reader is entitled to it — the poster, the person
   * who claimed, or staff. Everyone else gets null, and the field is dropped
   * from the row before it leaves this module rather than hidden in the JSX:
   * the payload is the leak, not the markup.
   */
  contactNote: string | null
  hiddenByStaff: boolean
  hiddenReason: string | null
}

function parseKind(value: FormDataEntryValue | null): MarketplacePostKind | null {
  return typeof value === 'string' && (MARKETPLACE_KIND_VALUES as string[]).includes(value)
    ? (value as MarketplacePostKind)
    : null
}

function parseCategory(value: FormDataEntryValue | null): string {
  return typeof value === 'string' && MARKETPLACE_CATEGORY_VALUES.includes(value) ? value : 'OTHER'
}

function revalidateMarketplace() {
  revalidatePath('/portal/marketplace')
  revalidatePath('/marketplace')
}

type ActionResult = { success: boolean; error?: string }

/**
 * How every resident action on an existing post opens: the signed-in
 * resident and the post the form names. `post` may then be in any state —
 * which states an action accepts is that action's own rule, stated inline.
 */
async function residentAndPost(
  formData: FormData,
): Promise<
  | { ok: true; auth: PortalAuthResult; post: typeof marketplacePost.$inferSelect }
  | { ok: false; error: string }
> {
  const auth = await getPortalAuth()
  if (!auth) return { ok: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED }

  const id = String(formData.get('id') || '')
  const post = await db.query.marketplacePost.findFirst({ where: eq(marketplacePost.id, id) })
  if (!post) return { ok: false, error: ERROR_MESSAGES.SAVE_ERROR }

  return { ok: true, auth, post }
}

/** The error a staff moderation action returns, or null when the user may moderate. */
async function moderationRefusal(): Promise<string | null> {
  const user = await getCurrentUser()
  if (!user) return ERROR_MESSAGES.NOT_AUTHENTICATED
  if (!hasPermission(user, 'marketplace:moderate')) return ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS
  return null
}

const POST_INCLUDE = {
  housingUnit: { columns: { id: true, code: true } },
  postedBy: { columns: RESIDENT_NAME_SELECT },
  claimedBy: { columns: RESIDENT_NAME_SELECT },
} as const

/**
 * `db.query`'s relation typing collapses to an untyped fallback for this
 * schema, so rows are re-asserted to the shape `mapPost` consumes. The runtime
 * shape is exactly this — to-one relations come back as single objects (or
 * null), never arrays.
 */
type PostRow = Parameters<typeof mapPost>[0]

/**
 * The board as one reader sees it.
 *
 * `own` is everything from your own unit — including what is already claimed or
 * closed, because that is your household's own record. `open` is what the rest
 * of the site currently has going, filtered to OPEN: another unit's finished
 * giveaway from three weeks ago is not something you can act on, and a list you
 * cannot act on is a list you stop reading.
 */
export async function listPortalMarketplacePosts(nature?: MarketplaceNature): Promise<{
  own: MarketplacePostSummary[]
  open: MarketplacePostSummary[]
} | null> {
  const auth = await getPortalAuth()
  if (!auth) return null

  const rows = await db.query.marketplacePost.findMany({
    where: eq(marketplacePost.hiddenByStaff, false),
    with: POST_INCLUDE,
    orderBy: [desc(marketplacePost.createdAt)],
  })

  const mine = auth.resident.id
  const unitId = auth.placement.housingUnitId
  const mapped = rows
    .map((row) =>
      mapPost(row as unknown as PostRow, {
        // Contact details reach the two people the handover is between, and
        // nobody else. Computed here, once, from the reader's identity.
        canSeeContact: row.postedById === mine || row.claimedById === mine,
      }),
    )
    .filter((post) => !nature || post.nature === nature)

  return {
    own: mapped.filter((post) => post.housingUnitId === unitId),
    open: mapped.filter((post) => post.housingUnitId !== unitId && post.status === 'OPEN'),
  }
}

/**
 * What the reader themselves has posted — for the portal dashboard.
 *
 * The board works end to end and tells nobody anything: someone claims your
 * wardrobe and you find out only if you happen to reopen the marketplace,
 * because there is no notification, no email, and the dashboard did not
 * mention the marketplace at all. `contactNote` — the entire mechanism by
 * which two people who matched arrange the handover — therefore sat on a page
 * nobody was sent to.
 *
 * Closed posts are excluded: a finished giveaway is not something the reader
 * has to do anything about, and a dashboard card is for what is still open.
 */
export async function listMyMarketplacePosts(): Promise<MarketplacePostSummary[]> {
  const auth = await getPortalAuth()
  if (!auth) return []

  const rows = await db.query.marketplacePost.findMany({
    where: and(
      eq(marketplacePost.postedById, auth.resident.id),
      eq(marketplacePost.hiddenByStaff, false),
      inArray(marketplacePost.status, ['OPEN', 'CLAIMED']),
    ),
    with: POST_INCLUDE,
    // Claimed first: a post someone answered is the one needing the reader's
    // attention, and it is what this card exists to surface.
    orderBy: [desc(marketplacePost.status), desc(marketplacePost.createdAt)],
  })

  return rows.map((row) => mapPost(row as unknown as PostRow, { canSeeContact: true }))
}

export async function listStaffMarketplacePosts(): Promise<MarketplacePostSummary[]> {
  const rows = await db.query.marketplacePost.findMany({
    with: POST_INCLUDE,
    orderBy: [desc(marketplacePost.createdAt)],
  })
  // Staff moderate the board, so they read it whole — that is the job.
  return rows.map((row) => mapPost(row as unknown as PostRow, { canSeeContact: true }))
}

function mapPost(
  row: {
    id: string
    title: string
    description: string
    kind: MarketplacePostKind
    category: string
    status: MarketplacePostStatus
    createdAt: Date
    contactNote: string | null
    hiddenByStaff: boolean
    hiddenReason: string | null
    housingUnit: { id: string; code: string }
    postedBy: { code: string; displayName: string | null }
    claimedBy: { code: string; displayName: string | null } | null
    postedById: string
    claimedById: string | null
  },
  viewer: { canSeeContact: boolean },
): MarketplacePostSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    nature: natureOfKind(row.kind),
    category: row.category,
    status: row.status,
    createdAt: row.createdAt,
    housingUnitId: row.housingUnit.id,
    housingUnitCode: row.housingUnit.code,
    postedByName: residentName(row.postedBy),
    postedById: row.postedById,
    claimedByName: row.claimedBy ? residentName(row.claimedBy) : null,
    claimedById: row.claimedById,
    contactNote: viewer.canSeeContact ? row.contactNote : null,
    hiddenByStaff: row.hiddenByStaff,
    hiddenReason: row.hiddenReason,
  }
}

export async function createMarketplacePost(formData: FormData): Promise<ActionResult> {
  const auth = await getPortalAuth()
  if (!auth) return { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED }

  const title = String(formData.get('title') || '').trim()
  const description = String(formData.get('description') || '').trim()
  const contactNote = String(formData.get('contactNote') || '').trim() || null
  const kind = parseKind(formData.get('kind'))
  if (!title || !description || !kind) {
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }

  // A furniture category on an offer to translate a letter is not a cosmetic
  // mismatch — it is a row that filters into the wrong half of the board
  // forever, and nothing downstream would ever notice. Fall back rather than
  // reject: the person wrote a real post, and losing it to a dropdown would be
  // the worse outcome.
  const requested = parseCategory(formData.get('category'))
  const category = categoryFitsKind(kind, requested) ? requested : 'OTHER'

  await db.insert(marketplacePost).values({
    housingUnitId: auth.placement.housingUnitId,
    postedById: auth.resident.id,
    title,
    description,
    contactNote,
    kind,
    category,
  })

  revalidateMarketplace()
  return { success: true }
}

export async function claimMarketplacePost(formData: FormData): Promise<ActionResult> {
  const opened = await residentAndPost(formData)
  if (!opened.ok) return { success: false, error: opened.error }
  const { auth, post } = opened
  if (post.status !== 'OPEN' || post.hiddenByStaff) {
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }

  // You cannot answer your own advertisement. Nothing stopped this before, and
  // the result was a post marked "Übernommen von <the person who wrote it>" —
  // off the open list, unreachable by the person who might actually have
  // wanted it, and impossible to tell apart from a real match.
  if (post.postedById === auth.resident.id) {
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }

  // Conditional on still being OPEN, so two people pressing at once produces
  // one winner rather than a silent overwrite of the first claim.
  const claimed = await db
    .update(marketplacePost)
    .set({ status: 'CLAIMED', claimedById: auth.resident.id, claimedAt: new Date() })
    .where(and(eq(marketplacePost.id, post.id), eq(marketplacePost.status, 'OPEN')))
    .returning({ id: marketplacePost.id })
  if (claimed.length === 0) {
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }

  revalidateMarketplace()
  return { success: true }
}

/**
 * The claimer changes their mind.
 *
 * Without this the only way out of a claim was to CLOSE it, which takes the
 * item off the board entirely — so one person's second thoughts destroyed the
 * offer for everybody. Releasing puts it back where it was.
 */
export async function releaseMarketplaceClaim(formData: FormData): Promise<ActionResult> {
  const opened = await residentAndPost(formData)
  if (!opened.ok) return { success: false, error: opened.error }
  const { auth, post } = opened
  if (post.status !== 'CLAIMED') {
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }
  // The poster may also release — a claimer who never turned up should not be
  // able to hold an item hostage indefinitely.
  const mayRelease = post.claimedById === auth.resident.id || post.postedById === auth.resident.id
  if (!mayRelease) {
    return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
  }

  await db
    .update(marketplacePost)
    .set({ status: 'OPEN', claimedById: null, claimedAt: null })
    .where(eq(marketplacePost.id, post.id))

  revalidateMarketplace()
  return { success: true }
}

export async function closeMarketplacePost(formData: FormData): Promise<ActionResult> {
  const opened = await residentAndPost(formData)
  if (!opened.ok) return { success: false, error: opened.error }
  const { auth, post } = opened
  const isOwner = post.postedById === auth.resident.id || post.claimedById === auth.resident.id
  if (!isOwner) return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }

  await db
    .update(marketplacePost)
    .set({ status: 'CLOSED', closedAt: new Date() })
    .where(eq(marketplacePost.id, post.id))

  revalidateMarketplace()
  return { success: true }
}

/** The handover fell through, or the thing came back. Poster only. */
export async function reopenMarketplacePost(formData: FormData): Promise<ActionResult> {
  const opened = await residentAndPost(formData)
  if (!opened.ok) return { success: false, error: opened.error }
  const { auth, post } = opened
  if (post.status === 'OPEN') {
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }
  if (post.postedById !== auth.resident.id) {
    return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
  }

  await db
    .update(marketplacePost)
    .set({ status: 'OPEN', claimedById: null, claimedAt: null, closedAt: null })
    .where(eq(marketplacePost.id, post.id))

  revalidateMarketplace()
  return { success: true }
}

/**
 * Withdraw a post entirely. Poster only, and only while nobody has claimed it.
 *
 * Deleting a post somebody has already answered would erase their side of an
 * arrangement without telling them, so a claimed post can only be closed.
 */
export async function deleteMarketplacePost(formData: FormData): Promise<ActionResult> {
  const opened = await residentAndPost(formData)
  if (!opened.ok) return { success: false, error: opened.error }
  const { auth, post } = opened
  if (post.postedById !== auth.resident.id || post.status !== 'OPEN') {
    return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
  }

  await db.delete(marketplacePost).where(eq(marketplacePost.id, post.id))

  revalidateMarketplace()
  return { success: true }
}

export async function hideMarketplacePost(formData: FormData): Promise<ActionResult> {
  const refused = await moderationRefusal()
  if (refused) return { success: false, error: refused }

  const id = String(formData.get('id') || '')
  const reason = String(formData.get('reason') || '').trim() || null
  if (!id) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }

  const hidden = await db
    .update(marketplacePost)
    .set({ hiddenByStaff: true, hiddenReason: reason })
    .where(eq(marketplacePost.id, id))
    .returning({ id: marketplacePost.id })
  // Prisma's update threw when the id matched no row; keep that error path.
  if (hidden.length === 0) throw new Error(ERROR_MESSAGES.SAVE_ERROR)

  revalidateMarketplace()
  return { success: true }
}

export async function unhideMarketplacePost(formData: FormData): Promise<ActionResult> {
  const refused = await moderationRefusal()
  if (refused) return { success: false, error: refused }

  const id = String(formData.get('id') || '')
  if (!id) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }

  const unhidden = await db
    .update(marketplacePost)
    .set({ hiddenByStaff: false, hiddenReason: null })
    .where(eq(marketplacePost.id, id))
    .returning({ id: marketplacePost.id })
  // Prisma's update threw when the id matched no row; keep that error path.
  if (unhidden.length === 0) throw new Error(ERROR_MESSAGES.SAVE_ERROR)

  revalidateMarketplace()
  return { success: true }
}
