'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'
import { requirePermission } from '@/lib/auth'
import { getResidentCookie } from '@/lib/portal-auth'
import { isFull } from '@/lib/opportunities/pipeline'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import {
  db,
  isUniqueViolation,
  learningRecord,
  opportunity as opportunityTable,
  opportunityApplication,
  resident as residentTable,
  type Opportunity,
} from '@/lib/db'
import {
  ApplicationCreateSchema,
  ApplicationStageChangeSchema,
  OpportunityInputSchema,
  OpportunityUpdateSchema,
  ValidationError,
  validateFormData,
} from '@/lib/validation'
import { evidenceForStartedApplication } from '@/lib/opportunities/pipeline'
import { permitRequirementIsStated, type OpportunityStatusId } from '@/lib/config/opportunities'
import {
  localesNeedingTranslation,
  type ListingTranslations,
} from '@/lib/opportunities/translation'
import { portalLocaleIds, translateListing } from '@/lib/opportunities/translate'
import type { LocaleId } from '@/lib/i18n/locales'

function revalidateOpportunity(opportunityId?: string) {
  revalidatePath('/opportunities')
  revalidatePath('/learning')
  if (opportunityId) {
    revalidatePath(`/opportunities/${opportunityId}`)
    revalidatePath(`/opportunities/${opportunityId}/edit`)
  }
}

/**
 * Bring a published listing's translations up to date with its German.
 *
 * Awaited rather than fired and forgotten: a server action's work stops when
 * the response does, so a detached promise here would be killed roughly half
 * the time and nobody would ever see why. Publishing is a deliberate and
 * infrequent act, the calls run in parallel, and the coach gets a listing that
 * every resident can read the moment it is live.
 *
 * BEST EFFORT, ALWAYS. A model that is down or rate-limited costs a resident a
 * translation; a publish that failed because of it would cost every resident
 * the listing. So this swallows everything and the callers ignore it — the
 * German still renders, and the next edit or re-publish tries again.
 */
async function refreshTranslations(opportunityId: string): Promise<void> {
  try {
    const listing = await db.query.opportunity.findFirst({
      where: eq(opportunityTable.id, opportunityId),
      columns: {
        status: true,
        title: true,
        description: true,
        requirementNote: true,
        translations: true,
      },
    })
    // Drafts and archived listings are on nobody's portal, so translating them
    // would spend calls on text that may never be read and will likely change.
    if (!listing || listing.status !== 'PUBLISHED') return

    const existing = (listing.translations ?? null) as ListingTranslations | null
    const wanted = localesNeedingTranslation(listing, existing, portalLocaleIds())
    if (wanted.length === 0) return

    const translations = await translateListing(listing, wanted as LocaleId[], existing)

    await db
      .update(opportunityTable)
      .set({ translations })
      .where(eq(opportunityTable.id, opportunityId))
  } catch (error) {
    logger.errorWithCause('Failed to refresh listing translations', error, { opportunityId })
  }
}

/** Empty strings from a form are absent values, not blank ones. */
function nullifyBlanks<T extends Record<string, unknown>>(data: T): T {
  const out = { ...data }
  for (const key of Object.keys(out) as (keyof T)[]) {
    if (out[key] === '') out[key] = null as T[keyof T]
  }
  return out
}

/**
 * What the form gets back when a save does not go through.
 *
 * ## The bug this exists to end
 *
 * `validateFormData` throws a `ValidationError` carrying a carefully written
 * German sentence. Nothing caught it, so it reached Next's error boundary and
 * the coach saw "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut." —
 * and the form was gone, taking every field with it.
 *
 * Observed live on 2026-09-04 while posting a real AOZ vacancy: publishing an
 * Arbeitsstelle whose Bewilligungsweg was still the `NONE` default correctly
 * hit the work-permit gate, and the one message that would have told the coach
 * what to do next ("... Sonst als Entwurf speichern und mit der Sozialarbeit
 * klären") was replaced by a shrug. Adding AI fill made the loss far worse:
 * fourteen fields, gone.
 *
 * So a failed save now RETURNS. The form is a client component holding every
 * value in its own store, so returning — rather than throwing — leaves that
 * store untouched and the coach edits one field instead of starting again.
 */
export interface OpportunityFormState {
  error?: string
  /** Keyed by field name, so a future version can mark the offending input. */
  fieldErrors?: Record<string, string[] | undefined>
}

/** Every save path shares this, so no caller has to remember to catch. */
function toFormState(error: unknown, fallback: string): OpportunityFormState {
  if (error instanceof ValidationError) {
    return { error: error.message, fieldErrors: error.fieldErrors }
  }
  return { error: error instanceof Error ? error.message : fallback }
}

export async function createOpportunity(
  _previous: OpportunityFormState,
  formData: FormData,
): Promise<OpportunityFormState> {
  const user = await requirePermission('opportunities:write')

  let data
  try {
    data = validateFormData(OpportunityInputSchema, formData)
  } catch (error) {
    return toFormState(error, 'Einsatzplatz konnte nicht erstellt werden')
  }

  let created
  try {
    const [row] = await db
      .insert(opportunityTable)
      .values({
        ...nullifyBlanks(data),
        createdByUserId: user.id,
        updatedByUserId: user.id,
      })
      .returning()
    created = row

    await logAudit({
      action: 'CREATE',
      entity: 'OPPORTUNITY',
      entityId: created.id,
      userId: user.id,
      changes: { title: data.title, kind: data.kind, status: data.status },
    })
  } catch (error) {
    logger.errorWithCause('Failed to create opportunity', error, { title: data.title })
    throw new Error('Einsatzplatz konnte nicht erstellt werden')
  }

  await refreshTranslations(created.id)
  revalidateOpportunity(created.id)
  redirect(`/opportunities/${created.id}`)
}

export async function updateOpportunity(
  _previous: OpportunityFormState,
  formData: FormData,
): Promise<OpportunityFormState> {
  const user = await requirePermission('opportunities:write')

  let parsed
  try {
    parsed = validateFormData(OpportunityUpdateSchema, formData)
  } catch (error) {
    return toFormState(error, 'Einsatzplatz konnte nicht aktualisiert werden')
  }
  const { id, ...data } = parsed

  try {
    const [updated] = await db
      .update(opportunityTable)
      .set({ ...nullifyBlanks(data), updatedByUserId: user.id })
      .where(eq(opportunityTable.id, id))
      .returning({ id: opportunityTable.id })
    // Prisma's update threw when the id matched no row; keep that error path.
    if (!updated) throw new Error('Einsatzplatz nicht gefunden')

    await logAudit({
      action: 'UPDATE',
      entity: 'OPPORTUNITY',
      entityId: id,
      userId: user.id,
      changes: data,
    })
  } catch (error) {
    logger.errorWithCause('Failed to update opportunity', error, { opportunityId: id })
    throw new Error('Einsatzplatz konnte nicht aktualisiert werden')
  }

  // After the write, so the hash is computed over the text as saved. Editing
  // the German invalidates the stored translations by hash, and this is what
  // replaces them — otherwise the listing would fall back to German silently
  // and stay that way until somebody happened to re-publish it.
  await refreshTranslations(id)
  revalidateOpportunity(id)
  redirect(`/opportunities/${id}`)
}

async function setStatus(opportunityId: string, status: OpportunityStatusId): Promise<void> {
  const user = await requirePermission('opportunities:write')

  // The same rule the form enforces, applied to the button that skips the
  // form. Publishing from a list view never runs OpportunityInputSchema, so
  // without this a work listing saved as a draft with permitRequirement NONE
  // could go live one click later still claiming no authorisation is needed —
  // the gate would exist and be trivially walked around.
  if (status === 'PUBLISHED') {
    const existing = await db.query.opportunity.findFirst({
      where: eq(opportunityTable.id, opportunityId),
      columns: { kind: true, permitRequirement: true },
    })
    if (!existing) throw new Error('Einsatzplatz nicht gefunden')
    if (!permitRequirementIsStated(existing.kind, existing.permitRequirement)) {
      throw new Error(
        'Für Arbeitsstellen und Praktika muss der Bewilligungsweg angegeben sein, ' +
          'bevor der Eintrag veröffentlicht wird.',
      )
    }
  }

  try {
    const [updated] = await db
      .update(opportunityTable)
      .set({ status, updatedByUserId: user.id })
      .where(eq(opportunityTable.id, opportunityId))
      .returning({ id: opportunityTable.id })
    // Prisma's update threw when the id matched no row; keep that error path.
    if (!updated) throw new Error('Einsatzplatz nicht gefunden')

    await logAudit({
      action: status === 'ARCHIVED' ? 'ARCHIVE' : 'UPDATE',
      entity: 'OPPORTUNITY',
      entityId: opportunityId,
      userId: user.id,
      changes: { status },
    })
  } catch (error) {
    logger.errorWithCause('Failed to change opportunity status', error, { opportunityId, status })
    throw new Error('Stand konnte nicht geändert werden')
  }

  // Only does anything when the listing is now PUBLISHED and something is
  // missing — publishing a draft is the usual case, and archiving costs
  // nothing because the helper returns immediately.
  await refreshTranslations(opportunityId)
  revalidateOpportunity(opportunityId)
}

export async function publishOpportunity(opportunityId: string): Promise<void> {
  await setStatus(opportunityId, 'PUBLISHED')
}

/**
 * The edit page's «Veröffentlichen» button.
 *
 * `publishOpportunity` keeps throwing — it is the server-side guard and its
 * refusal is pinned by `work-permit-gate.test.ts`. But a throw reaching a
 * button renders the same shrug as above, so this wraps it and sends the
 * reason back to the page as a URL param.
 *
 * The fallible work is in its own function so that `redirect()` — which works
 * by throwing — is never called inside the `try` that would catch it. Same
 * split as `expressInterest` on the portal side.
 */
async function tryPublish(opportunityId: string): Promise<string | null> {
  try {
    await setStatus(opportunityId, 'PUBLISHED')
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'Veröffentlichen nicht möglich'
  }
}

export async function publishOpportunityFromEdit(opportunityId: string): Promise<void> {
  const failure = await tryPublish(opportunityId)
  redirect(
    failure
      ? `/opportunities/${opportunityId}/edit?error=${encodeURIComponent(failure)}`
      : `/opportunities/${opportunityId}`,
  )
}

export async function archiveOpportunity(opportunityId: string): Promise<void> {
  await setStatus(opportunityId, 'ARCHIVED')
}

export async function addApplicant(formData: FormData): Promise<void> {
  const user = await requirePermission('opportunities:write')
  const data = validateFormData(ApplicationCreateSchema, formData)

  try {
    await db.insert(opportunityApplication).values({
      opportunityId: data.opportunityId,
      residentId: data.residentId,
      note: data.note || null,
      stage: 'INTERESTED',
      // Staff put this person forward. The resident portal will set
      // 'RESIDENT' for self-service interest in the next phase.
      createdBy: 'STAFF',
      supportedByUserId: user.id,
    })

    await logAudit({
      action: 'CREATE',
      entity: 'OPPORTUNITY_APPLICATION',
      entityId: data.opportunityId,
      userId: user.id,
      changes: { residentId: data.residentId, stage: 'INTERESTED' },
    })
  } catch (error) {
    logger.errorWithCause('Failed to add applicant', error, {
      opportunityId: data.opportunityId,
      residentId: data.residentId,
    })
    throw new Error('Person konnte nicht zugeordnet werden')
  }

  revalidateOpportunity(data.opportunityId)
}

/**
 * "Ich kümmere mich darum" — take up a request a resident raised, from the
 * Eingang, without opening the listing first.
 *
 * Claiming is exactly what ends `isAwaitingAnswer`: the row stays INTERESTED
 * (nothing about the application has been decided yet) but now names the
 * person answering it. Conditional on still being unclaimed, so two colleagues
 * pressing it in the same minute cannot silently overwrite each other — the
 * second press is a no-op and their Eingang simply no longer lists the row.
 */
export async function claimApplication(formData: FormData): Promise<void> {
  const user = await requirePermission('opportunities:write')
  const applicationId = formData.get('applicationId')
  if (typeof applicationId !== 'string' || applicationId === '') {
    throw new Error('Anfrage nicht gefunden')
  }

  const [claimed] = await db
    .update(opportunityApplication)
    .set({ supportedByUserId: user.id })
    .where(
      and(
        eq(opportunityApplication.id, applicationId),
        isNull(opportunityApplication.supportedByUserId),
      ),
    )
    .returning({ opportunityId: opportunityApplication.opportunityId })

  if (claimed) {
    await logAudit({
      action: 'UPDATE',
      entity: 'OPPORTUNITY_APPLICATION',
      entityId: applicationId,
      userId: user.id,
      changes: { supportedByUserId: user.id },
    })
    revalidateOpportunity(claimed.opportunityId)
  }
  revalidatePath('/', 'layout')
}

/**
 * Move one thread along, and keep the evidence in step with it.
 *
 * Everything happens in ONE transaction. A LearningRecord written without its
 * back-link would be an orphan certificate that reappears on every later stage
 * change — the resident's dossier would slowly fill with duplicates of one
 * afternoon's work, and nothing would report an error.
 */
export async function changeApplicationStage(formData: FormData): Promise<void> {
  const user = await requirePermission('opportunities:write')
  const { applicationId, stage, hours } = validateFormData(ApplicationStageChangeSchema, formData)

  const application = await db.query.opportunityApplication.findFirst({
    where: eq(opportunityApplication.id, applicationId),
    with: { opportunity: true },
  })
  if (!application) throw new Error('Bewerbung nicht gefunden')

  const now = new Date()

  try {
    await db.transaction(async (tx) => {
      let learningRecordId = application.learningRecordId

      // Generate the evidence exactly once. A coach correcting a misclick
      // back and forth through STARTED must not mint a record each time —
      // `learningRecordId` is unique, so the second insert would throw and
      // the stage move would fail for a reason nobody could act on.
      if (stage === 'STARTED' && !learningRecordId) {
        const [record] = await tx
          .insert(learningRecord)
          .values({
            residentId: application.residentId,
            // (`db.query`'s relation typing collapses to an untyped fallback
            // for this schema; at runtime `.opportunity` is one row.)
            ...evidenceForStartedApplication(
              application.opportunity as unknown as Opportunity,
              now,
            ),
          })
          .returning({ id: learningRecord.id })
        learningRecordId = record.id
      }

      // The total is only knowable when the engagement is over, which is why
      // it is asked for here and never derived from hoursPerWeek.
      if (stage === 'ENDED' && learningRecordId) {
        await tx
          .update(learningRecord)
          .set({
            status: 'COMPLETED',
            completedAt: now,
            ...(hours !== null ? { hours } : {}),
          })
          .where(eq(learningRecord.id, learningRecordId))
      }

      await tx
        .update(opportunityApplication)
        .set({
          stage,
          stageChangedAt: now,
          learningRecordId,
          supportedByUserId: application.supportedByUserId ?? user.id,
        })
        .where(eq(opportunityApplication.id, applicationId))
    })

    await logAudit({
      action: 'UPDATE',
      entity: 'OPPORTUNITY_APPLICATION',
      entityId: applicationId,
      userId: user.id,
      changes: { from: application.stage, to: stage, ...(hours !== null ? { hours } : {}) },
    })
  } catch (error) {
    logger.errorWithCause('Failed to change application stage', error, { applicationId, stage })
    throw new Error('Stand konnte nicht geändert werden')
  }

  revalidateOpportunity(application.opportunityId)
}

/* ------------------------------------------------------------------ *
 * Resident self-service
 *
 * These share the tables above and NOTHING else. They are guarded by the
 * resident cookie, never by a staff permission, and they may only ever touch
 * the acting resident's own row — a resident holding an application id that is
 * not theirs must get the same answer as one holding an id that does not
 * exist.
 * ------------------------------------------------------------------ */

// Module-private on purpose: a `'use server'` file may export nothing but
// async functions, and every non-function export it grows fails the build
// while passing lint, tsc and the whole test suite.
const PORTAL_OPPORTUNITY_PATH = '/portal/opportunities'

/**
 * Outcomes the board can report back, as URL params.
 *
 * A string rather than a thrown error because every one of these is a normal
 * thing that can happen to a resident — the last seat went while they were
 * reading, staff pulled the listing — and none of them is a fault of theirs to
 * be shown a crash for.
 */
type PortalOutcome =
  | 'ok=interest'
  | 'ok=withdrawn'
  | 'error=unavailable'
  | 'error=full'
  | 'error=locked'
  | 'error=failed'

async function actingResidentId(): Promise<string | null> {
  const code = await getResidentCookie()
  if (!code) return null

  const resident = await db.query.resident.findFirst({
    where: eq(residentTable.code, code),
    columns: { id: true },
  })
  return resident?.id ?? null
}

/** All the fallible work, so `redirect()` never runs inside a `try`. */
async function recordInterest(opportunityId: string, residentId: string): Promise<PortalOutcome> {
  const opportunity = await db.query.opportunity.findFirst({
    where: eq(opportunityTable.id, opportunityId),
    with: { applications: { columns: { stage: true } } },
  })

  // A DRAFT is a listing staff are still writing and an ARCHIVED one is over.
  // Neither is on the board, so arriving here means a stale page or a guessed
  // id — either way, nobody gets attached to a place that is not on offer.
  if (!opportunity || opportunity.status !== 'PUBLISHED') return 'error=unavailable'
  if (
    isFull(
      opportunity,
      opportunity.applications.map((a) => a.stage),
    )
  )
    return 'error=full'

  try {
    await db.insert(opportunityApplication).values({
      opportunityId,
      residentId,
      stage: 'INTERESTED',
      // The resident put themselves forward. `supportedByUserId` stays null
      // on purpose: it is the honest record that nobody on the staff side has
      // picked this up yet, which is exactly what the queue is filtering for.
      createdBy: 'RESIDENT',
    })
  } catch (error) {
    // Already attached. That IS the state they asked for, so reporting a
    // failure would be a lie about a button that worked the first time.
    if (isUniqueViolation(error)) {
      return 'ok=interest'
    }
    logger.errorWithCause('Failed to record resident interest', error, { opportunityId })
    return 'error=failed'
  }

  await logAudit({
    action: 'CREATE',
    entity: 'OPPORTUNITY_APPLICATION',
    entityId: opportunityId,
    // No `userId`: no member of staff did this. The actor is named in the
    // payload instead, because an audit row that silently attributes a
    // resident's own choice to nobody reads as a system action.
    changes: { residentId, stage: 'INTERESTED', actor: 'RESIDENT' },
  })

  return 'ok=interest'
}

export async function expressInterest(formData: FormData): Promise<void> {
  const residentId = await actingResidentId()
  if (!residentId) redirect('/login')

  const opportunityId = String(formData.get('opportunityId') || '')
  const outcome: PortalOutcome = opportunityId
    ? await recordInterest(opportunityId, residentId)
    : 'error=unavailable'

  revalidatePath(PORTAL_OPPORTUNITY_PATH)
  revalidateOpportunity(opportunityId || undefined)
  redirect(`${PORTAL_OPPORTUNITY_PATH}?${outcome}`)
}

/**
 * Take back an interest you registered yourself and nobody has acted on.
 *
 * The two conditions are the whole point. Once staff have moved the thread
 * along, a conversation has happened and deleting the row would erase THEIR
 * record of it; and a row staff created is their note that they suggested this
 * person, which is not the resident's to remove. Changing your mind later is a
 * thing you say to a person, not a row you delete — so those cases send you to
 * your team instead of failing silently.
 */
async function removeInterest(applicationId: string, residentId: string): Promise<PortalOutcome> {
  const application = await db.query.opportunityApplication.findFirst({
    where: eq(opportunityApplication.id, applicationId),
    columns: { id: true, residentId: true, opportunityId: true, createdBy: true, stage: true },
  })

  // Same answer for "not yours" as for "does not exist": a distinguishable
  // response would confirm that some other resident holds this application.
  if (!application || application.residentId !== residentId) return 'error=unavailable'
  if (application.createdBy !== 'RESIDENT' || application.stage !== 'INTERESTED') {
    return 'error=locked'
  }

  try {
    await db.delete(opportunityApplication).where(eq(opportunityApplication.id, applicationId))
  } catch (error) {
    logger.errorWithCause('Failed to withdraw resident interest', error, { applicationId })
    return 'error=failed'
  }

  await logAudit({
    action: 'DELETE',
    entity: 'OPPORTUNITY_APPLICATION',
    entityId: application.opportunityId,
    changes: { residentId, actor: 'RESIDENT' },
  })

  return 'ok=withdrawn'
}

export async function withdrawInterest(formData: FormData): Promise<void> {
  const residentId = await actingResidentId()
  if (!residentId) redirect('/login')

  const applicationId = String(formData.get('applicationId') || '')
  const outcome: PortalOutcome = applicationId
    ? await removeInterest(applicationId, residentId)
    : 'error=unavailable'

  revalidatePath(PORTAL_OPPORTUNITY_PATH)
  revalidatePath('/opportunities')
  redirect(`${PORTAL_OPPORTUNITY_PATH}?${outcome}`)
}
