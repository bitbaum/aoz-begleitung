/**
 * Opportunity queries. I/O only — the pipeline rules live in
 * `lib/opportunities/pipeline.ts` so they can be tested without a database.
 */

import { IN_CARE_RESIDENT_STATUSES } from '@/lib/config/resident-status'
import { and, asc, desc, eq, ilike, inArray, isNull, notInArray, or, type SQL } from 'drizzle-orm'
import { db, escapeLike, opportunity, opportunityApplication, resident } from '@/lib/db'
import { RESIDENT_NAME_SELECT } from '@/lib/utils/resident-name'
import type {
  ApplicationStageId,
  OpportunityKindId,
  OpportunityStatusId,
} from '@/lib/config/opportunities'
import { isActiveStage, maySeeContact, occupiesSeat, openSeats } from '@/lib/opportunities/pipeline'
import {
  readableListing,
  type ListingTranslations,
  type TranslatableListing,
} from '@/lib/opportunities/translation'

/** Rows that reach the UI carry `displayName`, never a bare code. */
const APPLICATION_INCLUDE = {
  resident: { columns: RESIDENT_NAME_SELECT },
  supportedBy: { columns: { id: true, name: true } },
  learningRecord: { columns: { id: true } },
} as const

/**
 * The SQL form of `isAwaitingAnswer` — resident-raised, still INTERESTED, and
 * unclaimed. The predicate itself lives in `lib/jobcoach/queue.ts`; this is the
 * same three clauses expressed where the database can filter on them, and
 * `awaiting-answer-agrees.test.ts` holds the two to each other.
 */
export function awaitingAnswerFilter() {
  return and(
    eq(opportunityApplication.createdBy, 'RESIDENT'),
    eq(opportunityApplication.stage, 'INTERESTED'),
    isNull(opportunityApplication.supportedByUserId),
  )
}

export interface OpportunityListFilters {
  status?: OpportunityStatusId
  kind?: OpportunityKindId
  /**
   * The board's half of the domain. Separate from `kind` because they answer
   * different questions: `kinds` is "which work is mine", `kind` is "show me
   * only Praktika within it". Both may apply at once.
   */
  kinds?: readonly OpportunityKindId[]
  query?: string
  publishedOnly?: boolean
}

function listWhere(filters: OpportunityListFilters): SQL | undefined {
  const query = filters.query?.trim() ?? ''
  const conditions: SQL[] = []
  if (filters.publishedOnly) {
    conditions.push(eq(opportunity.status, 'PUBLISHED'))
  } else if (filters.status) {
    conditions.push(eq(opportunity.status, filters.status))
  }
  if (filters.kind) {
    conditions.push(eq(opportunity.kind, filters.kind))
  }
  // An empty array would compile to invalid SQL, and it can only arise from a
  // caller asking for nothing — which is not the same request as "no filter".
  if (filters.kinds && filters.kinds.length > 0) {
    conditions.push(inArray(opportunity.kind, [...filters.kinds]))
  }
  if (query) {
    const pattern = `%${escapeLike(query)}%`
    const textMatch = or(
      ilike(opportunity.title, pattern),
      ilike(opportunity.organisation, pattern),
      ilike(opportunity.location, pattern),
    )
    if (textMatch) conditions.push(textMatch)
  }
  return and(...conditions)
}

/**
 * Listings with the stages of everyone attached, so a caller can compute open
 * seats without a second query per row.
 */
export async function listOpportunities(filters: OpportunityListFilters = {}) {
  return db.query.opportunity.findMany({
    where: listWhere(filters),
    with: {
      // `createdBy` and `supportedByUserId` ride along so the board can mark
      // the listings somebody is waiting on without a query per row.
      applications: {
        columns: {
          id: true,
          // Selected even though every row here belongs to the listing being
          // fetched: `CareApplicationInput` requires it, so a row that reaches
          // the queue can always say WHICH thread it is about.
          opportunityId: true,
          stage: true,
          createdBy: true,
          supportedByUserId: true,
        },
      },
    },
    orderBy: [asc(opportunity.status), asc(opportunity.startsAt), desc(opportunity.updatedAt)],
  })
}

export async function getOpportunityDetail(id: string) {
  const row = await db.query.opportunity.findFirst({
    where: eq(opportunity.id, id),
    with: {
      applications: {
        with: APPLICATION_INCLUDE,
        orderBy: [desc(opportunityApplication.stageChangedAt)],
      },
    },
  })
  return row ?? null
}

/**
 * The five numbers the board leads with.
 *
 * `activePeople` and `openThreads` count APPLICATIONS, not listings, because
 * "how many places exist" is not the question a coach opens this page with —
 * "who is mid-flight and who is waiting on me" is.
 */
export async function opportunityStats(kinds?: readonly OpportunityKindId[]) {
  // The tiles must describe the list underneath them. Once the board opens on
  // the coach's own half, unscoped totals would report the Freiwilligenarbeit coordinator's waiting people
  // above the Jobcoach's listings — a number that is true of nothing on the screen.
  const scoped = kinds && kinds.length > 0 ? inArray(opportunity.kind, [...kinds]) : undefined

  const listingsIn = (extra?: SQL) => (scoped ? and(scoped, extra) : extra)

  // Applications reach `kind` only through their listing, so they scope by
  // membership rather than by a column of their own.
  const applicationsOn = (extra: SQL | undefined): SQL | undefined =>
    scoped
      ? and(
          extra,
          inArray(
            opportunityApplication.opportunityId,
            db.select({ id: opportunity.id }).from(opportunity).where(scoped),
          ),
        )
      : extra

  const [total, published, drafts, activePeople, openThreads, awaitingAnswer] = await Promise.all([
    db.$count(opportunity, listingsIn()),
    db.$count(opportunity, listingsIn(eq(opportunity.status, 'PUBLISHED'))),
    db.$count(opportunity, listingsIn(eq(opportunity.status, 'DRAFT'))),
    db.$count(opportunityApplication, applicationsOn(eq(opportunityApplication.stage, 'STARTED'))),
    db.$count(
      opportunityApplication,
      applicationsOn(
        inArray(opportunityApplication.stage, ['INTERESTED', 'APPLIED', 'INTERVIEW', 'ACCEPTED']),
      ),
    ),
    // The SQL twin of `isAwaitingAnswer`. Kept beside the other counts rather
    // than derived in a page, so "somebody is waiting on a person" is a number
    // this board leads with instead of a state you have to notice.
    db.$count(opportunityApplication, applicationsOn(awaitingAnswerFilter())),
  ])

  return { total, published, drafts, activePeople, openThreads, awaitingAnswer }
}

/**
 * Residents who could still be added to this listing.
 *
 * Excludes anyone already attached — the pair is unique in the database, so
 * offering them again would produce a constraint error at the one moment a
 * coach is trying to record something real.
 */
export async function residentsAvailableFor(opportunityId: string) {
  const attached = await db.query.opportunityApplication.findMany({
    where: eq(opportunityApplication.opportunityId, opportunityId),
    columns: { residentId: true },
  })

  const attachedIds = attached.map((row) => row.residentId)

  return db.query.resident.findMany({
    where: and(
      // Everyone still in AOZ's care, housed or not. This was `ACTIVE` alone,
      // and a placement sets a resident to `PLACED` — so the moment someone had
      // a roof over their head they vanished from this list, and a coach could
      // not put forward exactly the people most ready for a job. Housing is one
      // part of a person's situation, not a gate on the others.
      inArray(resident.status, [...IN_CARE_RESIDENT_STATUSES]),
      // `notInArray` with an empty list is invalid SQL; with nobody attached
      // there is nothing to exclude.
      ...(attachedIds.length ? [notInArray(resident.id, attachedIds)] : []),
    ),
    columns: RESIDENT_NAME_SELECT,
    orderBy: [asc(resident.displayName), asc(resident.code)],
  })
}

export async function getApplication(id: string) {
  const row = await db.query.opportunityApplication.findFirst({
    where: eq(opportunityApplication.id, id),
    with: { ...APPLICATION_INCLUDE, opportunity: true },
  })
  return row ?? null
}

/** Everything a resident is currently attached to — used by their dossier. */
export async function listApplicationsForResident(residentId: string) {
  return db.query.opportunityApplication.findMany({
    where: eq(opportunityApplication.residentId, residentId),
    with: { opportunity: true },
    orderBy: [desc(opportunityApplication.stageChangedAt)],
  })
}

/**
 * What ONE resident may see: the places on offer, and their own threads.
 *
 * The seat count is folded in here and the `applications` rows are dropped
 * before returning, deliberately. A resident needs to know whether a place is
 * still free; they have no business knowing WHO is in it. Returning the rows
 * and "just not rendering them" is the same mistake as selecting a password
 * hash and not printing it — the payload is the leak, not the JSX.
 */
/**
 * One listing as this reader should see it.
 *
 * Resolved here rather than in the page, and the `translations` bag is dropped
 * on the way out. A reader needs the language they chose; shipping five
 * languages of every listing to a phone on a shared connection is the same
 * mistake as shipping the applicant rows, in a cheaper currency.
 *
 * The German original rides along ONLY when the text shown is not it, so the
 * card can offer it without ever carrying the same string twice.
 */
function localise<T extends TranslatableListing & { translations?: unknown }>(
  listing: T,
  locale: string,
) {
  const readable = readableListing(
    listing,
    (listing.translations ?? null) as ListingTranslations | null,
    locale,
  )
  const { translations: _dropped, ...rest } = listing

  return {
    ...rest,
    title: readable.title,
    description: readable.description,
    requirementNote: readable.requirementNote,
    machineTranslated: readable.machineTranslated,
    original: readable.machineTranslated
      ? { title: listing.title, description: listing.description }
      : null,
  }
}

export async function residentOpportunityBoard(residentId: string, locale: string = 'de') {
  const [mine, published] = await Promise.all([
    db.query.opportunityApplication.findMany({
      where: eq(opportunityApplication.residentId, residentId),
      with: { opportunity: true },
      orderBy: [desc(opportunityApplication.stageChangedAt)],
    }),
    db.query.opportunity.findMany({
      where: eq(opportunity.status, 'PUBLISHED'),
      with: { applications: { columns: { stage: true } } },
      orderBy: [asc(opportunity.startsAt), desc(opportunity.updatedAt)],
    }),
  ])

  // Contact details are stripped from the rows themselves, not hidden in the
  // JSX. `with: { opportunity: true }` selects every column, so before this the
  // board shipped an organisation's direct line to anyone who had pressed
  // "Ich habe Interesse". @see lib/opportunities/pipeline.ts
  const myThreads = mine.map(({ opportunity: listing, ...application }) => {
    const visible = maySeeContact(application.stage)
      ? listing
      : { ...listing, contactName: null, contactEmail: null, contactPhone: null, website: null }
    return { ...application, opportunity: localise(visible, locale) }
  })

  const attached = new Set(mine.map((application) => application.opportunityId))

  const open = published
    .filter((opportunityRow) => !attached.has(opportunityRow.id))
    .map(({ applications, ...opportunityRow }) => ({
      ...opportunityRow,
      seatsLeft: openSeats(
        opportunityRow,
        applications.map((a) => a.stage as ApplicationStageId),
      ),
    }))
    // Places someone can still take come first; a full one stays visible rather
    // than vanishing, so "it was here yesterday" has an answer on the page.
    .sort((a, b) => Number(a.seatsLeft === 0) - Number(b.seatsLeft === 0))
    // Nobody on the open board has been accepted onto anything, so nobody there
    // gets a contact address. Same rule, applied where the stage is implicit.
    .map(({ contactName, contactEmail, contactPhone, website, ...listing }) =>
      localise(listing, locale),
    )

  return { mine: myThreads, open }
}

export type ResidentOpportunityBoard = Awaited<ReturnType<typeof residentOpportunityBoard>>
export type ResidentApplicationRow = ResidentOpportunityBoard['mine'][number]
export type ResidentOpenRow = ResidentOpportunityBoard['open'][number]

export type OpportunityListRow = Awaited<ReturnType<typeof listOpportunities>>[number]
export type OpportunityDetail = NonNullable<Awaited<ReturnType<typeof getOpportunityDetail>>>
export type ApplicationRow = OpportunityDetail['applications'][number]

/** Stage helpers re-exported so pages import one module, not two. */
export function seatStages(
  applications: readonly { stage: ApplicationStageId }[],
): ApplicationStageId[] {
  return applications.map((a) => a.stage)
}

export function countActive(applications: readonly { stage: ApplicationStageId }[]): number {
  return applications.filter((a) => isActiveStage(a.stage)).length
}

export function countHoldingSeat(applications: readonly { stage: ApplicationStageId }[]): number {
  return applications.filter((a) => occupiesSeat(a.stage)).length
}
