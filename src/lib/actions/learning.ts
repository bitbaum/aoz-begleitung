'use server'

import { IN_CARE_RESIDENT_STATUSES } from '@/lib/config/resident-status'
import { revalidatePath } from 'next/cache'
import { db, learningRecord, resident, careAssignment, placement, escapeLike } from '@/lib/db'
import { and, asc, count, desc, eq, ilike, inArray, notInArray, or, sql } from 'drizzle-orm'
import { getCurrentUser, hasPermission, requirePermission } from '@/lib/auth'
import { getResidentCookie } from '@/lib/portal-auth'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { idSchema } from '@/lib/validation/schemas'
import {
  boardKinds,
  CEFR_LEVELS,
  LEARNING_CATEGORIES,
  LEARNING_KINDS,
  LEARNING_RECORD_PROBLEM_LABELS,
  LEARNING_STATUSES,
  GERMAN_TEST_KIND,
  GERMAN_LANGUAGE_CODE,
  learningRecordProblem,
  mayChangeLearningRecord,
  type LearningRecordActor,
  type LearningRecordProblem,
} from '@/lib/config/learning'
import type { IntegrationBoardId } from '@/lib/config/integration-boards'
import type { LearningKind, LearningStatus, ResidentOrStaff } from '@/lib/db'

/**
 * What every learning action answers. A refusal is RETURNED with the reason —
 * a thrown error reaches the error boundary, which says «Etwas ist
 * schiefgelaufen» and unmounts the form with everything typed into it.
 * `problem` lets the portal put the reason into the reader's language.
 */
export type LearningActionResult =
  { success: true } | { success: false; error: string; problem?: LearningRecordProblem }

function parseDate(value: FormDataEntryValue | null): Date | null {
  if (!value || typeof value !== 'string' || value.trim() === '') return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function parseKind(value: FormDataEntryValue | null): LearningKind | null {
  if (typeof value !== 'string') return null
  return (LEARNING_KINDS as readonly string[]).includes(value) ? (value as LearningKind) : null
}

function parseStatus(value: FormDataEntryValue | null): LearningStatus {
  if (typeof value === 'string' && (LEARNING_STATUSES as readonly string[]).includes(value)) {
    return value as LearningStatus
  }
  return 'PLANNED'
}

type ParsedRecord =
  | { ok: true; data: ReturnType<typeof recordFields> & { kind: LearningKind } }
  | { ok: false; problem: LearningRecordProblem }

function recordFields(formData: FormData) {
  const categoryRaw = String(formData.get('category') || '')
  const category = (LEARNING_CATEGORIES as readonly string[]).includes(categoryRaw)
    ? categoryRaw
    : null

  const cefrRaw = String(formData.get('cefrLevel') || '')
  const cefrLevel = (CEFR_LEVELS as readonly string[]).includes(cefrRaw) ? cefrRaw : null

  const hoursRaw = formData.get('hours')
  const hours = hoursRaw && String(hoursRaw).trim() !== '' ? Number(hoursRaw) : null
  const kind = parseKind(formData.get('kind'))

  return {
    title: String(formData.get('title') || '').trim(),
    status: parseStatus(formData.get('status')),
    // Language and level only mean something on a language test. Carrying a
    // stale level over from a kind switch would file a course as «DE B1».
    languageCode:
      kind === 'LANGUAGE_TEST'
        ? String(formData.get('languageCode') || '')
            .trim()
            .toUpperCase() || null
        : null,
    cefrLevel: kind === 'LANGUAGE_TEST' ? cefrLevel : null,
    provider: String(formData.get('provider') || '').trim() || null,
    category,
    hours: hours !== null && Number.isFinite(hours) && hours >= 0 ? Math.round(hours) : null,
    startedAt: parseDate(formData.get('startedAt')),
    completedAt: parseDate(formData.get('completedAt')),
    notes: String(formData.get('notes') || '').trim() || null,
  }
}

function parseRecord(formData: FormData): ParsedRecord {
  const kind = parseKind(formData.get('kind'))
  const fields = recordFields(formData)
  const problem = learningRecordProblem({ kind, ...fields })
  if (problem || !kind) return { ok: false, problem: problem ?? 'TITLE_OR_KIND' }
  return { ok: true, data: { ...fields, kind } }
}

function refused(problem: LearningRecordProblem): LearningActionResult {
  return { success: false, error: LEARNING_RECORD_PROBLEM_LABELS[problem], problem }
}

function parseRecordId(formData: FormData): string | null {
  const parsed = idSchema.safeParse(formData.get('id'))
  return parsed.success ? parsed.data : null
}

function revalidateLearning(residentId: string) {
  revalidatePath(`/residents/${residentId}`)
  revalidatePath('/learning')
  revalidatePath('/portal/learning')
}

/** The acting staff member, if they may write learning — else the refusal. */
async function staffWriter() {
  const user = await getCurrentUser()
  if (!user) return { user: null, error: ERROR_MESSAGES.NOT_AUTHENTICATED } as const
  if (!hasPermission(user, 'learning:write')) {
    return { user: null, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS } as const
  }
  return { user, error: null } as const
}

async function actingResident() {
  const code = await getResidentCookie()
  if (!code) return null
  return (
    (await db.query.resident.findFirst({
      where: eq(resident.code, code),
      columns: { id: true },
    })) ?? null
  )
}

async function loadOwnership(id: string) {
  return (
    (await db.query.learningRecord.findFirst({
      where: eq(learningRecord.id, id),
      columns: { id: true, residentId: true, recordedBy: true },
    })) ?? null
  )
}

export async function createLearningRecordForResident(
  formData: FormData,
): Promise<LearningActionResult> {
  const { user, error } = await staffWriter()
  if (!user) return { success: false, error }
  const residentParsed = idSchema.safeParse(formData.get('residentId'))
  if (!residentParsed.success) return { success: false, error: ERROR_MESSAGES.RESIDENT_NOT_FOUND }
  const residentId = residentParsed.data

  const parsed = parseRecord(formData)
  if (!parsed.ok) return refused(parsed.problem)

  try {
    const [created] = await db
      .insert(learningRecord)
      .values({
        ...parsed.data,
        residentId,
        recordedBy: 'STAFF' as ResidentOrStaff,
        recordedByUserId: user.id,
      })
      .returning({ id: learningRecord.id })
    await logAudit({
      action: 'CREATE',
      entity: 'LEARNING_RECORD',
      entityId: created.id,
      userId: user.id,
      changes: { residentId, kind: parsed.data.kind },
    })
  } catch (cause) {
    logger.errorWithCause('Failed to create learning record', cause, { residentId })
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }

  revalidateLearning(residentId)
  return { success: true }
}

/**
 * Staff correct a record — any record, including the client's own and the
 * evidence a STARTED thread generated. Audited, because a level or an hours
 * total is read by the KPIs and the dossier, and "who changed this" must have
 * an answer.
 */
export async function updateLearningRecord(formData: FormData): Promise<LearningActionResult> {
  const { user, error } = await staffWriter()
  if (!user) return { success: false, error }
  const id = parseRecordId(formData)
  const existing = id ? await loadOwnership(id) : null
  if (!id || !existing) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }

  const actor: LearningRecordActor = { kind: 'staff', mayWriteLearning: true }
  if (!mayChangeLearningRecord(actor, existing)) {
    return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }
  }

  const parsed = parseRecord(formData)
  if (!parsed.ok) return refused(parsed.problem)

  try {
    await db.update(learningRecord).set(parsed.data).where(eq(learningRecord.id, id))
    await logAudit({
      action: 'UPDATE',
      entity: 'LEARNING_RECORD',
      entityId: id,
      userId: user.id,
      changes: { residentId: existing.residentId, ...parsed.data },
    })
  } catch (cause) {
    logger.errorWithCause('Failed to update learning record', cause, { id })
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }

  revalidateLearning(existing.residentId)
  return { success: true }
}

/**
 * Staff remove a record. Evidence generated from an opportunity may be removed
 * too — the application keeps its stage, and its `learningRecordId` falls to
 * null through the foreign key, so a later ENDED does not resurrect it.
 */
export async function deleteLearningRecord(formData: FormData): Promise<LearningActionResult> {
  const { user, error } = await staffWriter()
  if (!user) return { success: false, error }
  const id = parseRecordId(formData)
  const existing = id ? await loadOwnership(id) : null
  if (!id || !existing) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }

  try {
    await db.delete(learningRecord).where(eq(learningRecord.id, id))
    await logAudit({
      action: 'DELETE',
      entity: 'LEARNING_RECORD',
      entityId: id,
      userId: user.id,
      changes: { residentId: existing.residentId, recordedBy: existing.recordedBy },
    })
  } catch (cause) {
    logger.errorWithCause('Failed to delete learning record', cause, { id })
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }

  revalidateLearning(existing.residentId)
  return { success: true }
}

export async function createOwnLearningRecord(formData: FormData): Promise<LearningActionResult> {
  const residentRow = await actingResident()
  if (!residentRow) return { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED }

  const parsed = parseRecord(formData)
  if (!parsed.ok) return refused(parsed.problem)

  try {
    await db
      .insert(learningRecord)
      .values({ ...parsed.data, residentId: residentRow.id, recordedBy: 'RESIDENT' })
  } catch (cause) {
    logger.errorWithCause('Failed to create own learning record', cause)
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }

  revalidateLearning(residentRow.id)
  return { success: true }
}

/**
 * A client corrects or removes what THEY entered — and only that. A record the
 * team filed gets the same answer as one that does not exist, so a guessed id
 * reveals nothing.
 */
async function ownRecordFor(formData: FormData) {
  const residentRow = await actingResident()
  if (!residentRow) return null
  const id = parseRecordId(formData)
  const existing = id ? await loadOwnership(id) : null
  if (!existing) return null
  const actor: LearningRecordActor = { kind: 'resident', residentId: residentRow.id }
  return mayChangeLearningRecord(actor, existing) ? existing : null
}

export async function updateOwnLearningRecord(formData: FormData): Promise<LearningActionResult> {
  const existing = await ownRecordFor(formData)
  if (!existing) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }

  const parsed = parseRecord(formData)
  if (!parsed.ok) return refused(parsed.problem)

  try {
    await db.update(learningRecord).set(parsed.data).where(eq(learningRecord.id, existing.id))
  } catch (cause) {
    logger.errorWithCause('Failed to update own learning record', cause)
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }

  revalidateLearning(existing.residentId)
  return { success: true }
}

export async function deleteOwnLearningRecord(formData: FormData): Promise<LearningActionResult> {
  const existing = await ownRecordFor(formData)
  if (!existing) return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }

  try {
    await db.delete(learningRecord).where(eq(learningRecord.id, existing.id))
  } catch (cause) {
    logger.errorWithCause('Failed to delete own learning record', cause)
    return { success: false, error: ERROR_MESSAGES.SAVE_ERROR }
  }

  revalidateLearning(existing.residentId)
  return { success: true }
}

/**
 * Clients with no German language test on file — a TASK list («Kein
 * Deutsch-Test erfasst»), so it names only people somebody serves. A
 * placeholder profile has nobody behind it to test; filtering it out here, in
 * the query, means the `limit` counts real people and no page has to remember
 * to filter afterwards. @see lib/analytics/real-data.ts
 */
function missingGermanTestFilter() {
  return and(
    eq(resident.isPlaceholder, false),
    notInArray(
      resident.id,
      db
        .select({ id: learningRecord.residentId })
        .from(learningRecord)
        .where(
          and(
            eq(learningRecord.kind, GERMAN_TEST_KIND),
            eq(learningRecord.languageCode, GERMAN_LANGUAGE_CODE),
          ),
        ),
    ),
  )
}

export async function listLearningQueue(kind?: LearningKind) {
  await requirePermission('learning:read')

  const [records, missingGerman] = await Promise.all([
    db.query.learningRecord.findMany({
      where: and(
        inArray(learningRecord.status, ['PLANNED', 'IN_PROGRESS']),
        ...(kind ? [eq(learningRecord.kind, kind)] : []),
      ),
      with: {
        resident: { columns: { id: true, code: true, displayName: true, languages: true } },
      },
      orderBy: [desc(learningRecord.updatedAt)],
      limit: 50,
    }),
    kind
      ? Promise.resolve([])
      : db.query.resident.findMany({
          where: and(
            inArray(resident.status, [...IN_CARE_RESIDENT_STATUSES]),
            missingGermanTestFilter(),
          ),
          columns: { id: true, code: true, displayName: true, languages: true },
          orderBy: [asc(resident.code)],
          limit: 40,
        }),
  ])

  return { records, missingGerman }
}

export interface LearningBoardFilters {
  board: IntegrationBoardId
  status?: LearningStatus | 'ALL'
  query?: string
  mineOnly?: boolean
  recordedBy?: ResidentOrStaff | 'ALL'
  category?: (typeof LEARNING_CATEGORIES)[number] | 'ALL'
}

export async function listLearningBoard(filters: LearningBoardFilters) {
  const user = await requirePermission('learning:read')
  const query = filters.query?.trim() || ''
  const kinds = boardKinds(filters.board)
  const pattern = `%${escapeLike(query)}%`

  // Residents assigned to me (Prisma's `careAssignments: { some: { staffId } }`)
  const myResidentIds = db
    .select({ id: careAssignment.residentId })
    .from(careAssignment)
    .where(eq(careAssignment.staffId, user.id))

  const residentWhere = filters.mineOnly ? inArray(resident.id, myResidentIds) : undefined

  const recordWhere = and(
    kinds.length ? inArray(learningRecord.kind, [...kinds] as LearningKind[]) : sql`false`,
    ...(filters.status && filters.status !== 'ALL'
      ? [eq(learningRecord.status, filters.status)]
      : []),
    ...(filters.recordedBy && filters.recordedBy !== 'ALL'
      ? [eq(learningRecord.recordedBy, filters.recordedBy)]
      : []),
    ...(filters.category && filters.category !== 'ALL'
      ? [eq(learningRecord.category, filters.category)]
      : []),
    ...(query
      ? [
          or(
            ilike(learningRecord.title, pattern),
            ilike(learningRecord.provider, pattern),
            ilike(learningRecord.notes, pattern),
            inArray(
              learningRecord.residentId,
              db
                .select({ id: resident.id })
                .from(resident)
                .where(or(ilike(resident.code, pattern), ilike(resident.displayName, pattern))),
            ),
          ),
        ]
      : []),
    ...(filters.mineOnly ? [inArray(learningRecord.residentId, myResidentIds)] : []),
  )

  const [records, missingGerman, total, statusGroups, sourceGroups] = await Promise.all([
    db.query.learningRecord.findMany({
      where: recordWhere,
      with: {
        recordedByUser: { columns: { role: true } },
        fromApplication: { columns: { id: true } },
        resident: {
          columns: {
            id: true,
            code: true,
            displayName: true,
            supportLevel: true,
          },
          with: {
            placements: {
              where: eq(placement.status, 'ACTIVE'),
              columns: {},
              with: { housingUnit: { columns: { code: true } } },
              limit: 1,
            },
          },
        },
      },
      orderBy: [asc(learningRecord.status), desc(learningRecord.updatedAt)],
      limit: 200,
    }),
    filters.board === 'volunteering'
      ? Promise.resolve([])
      : db.query.resident.findMany({
          where: and(
            inArray(resident.status, [...IN_CARE_RESIDENT_STATUSES]),
            missingGermanTestFilter(),
            ...(residentWhere ? [residentWhere] : []),
          ),
          columns: {
            id: true,
            code: true,
            displayName: true,
            supportLevel: true,
          },
          with: {
            placements: {
              where: eq(placement.status, 'ACTIVE'),
              columns: {},
              with: { housingUnit: { columns: { code: true } } },
              limit: 1,
            },
          },
          orderBy: [asc(resident.code)],
          limit: 40,
        }),
    db.$count(learningRecord, recordWhere),
    db
      .select({ status: learningRecord.status, count: count() })
      .from(learningRecord)
      .where(recordWhere)
      .groupBy(learningRecord.status),
    db
      .select({ recordedBy: learningRecord.recordedBy, count: count() })
      .from(learningRecord)
      .where(recordWhere)
      .groupBy(learningRecord.recordedBy),
  ])

  const stats = {
    total,
    planned: statusGroups.find((group) => group.status === 'PLANNED')?.count ?? 0,
    inProgress: statusGroups.find((group) => group.status === 'IN_PROGRESS')?.count ?? 0,
    completed: statusGroups.find((group) => group.status === 'COMPLETED')?.count ?? 0,
    residentLogged: sourceGroups.find((group) => group.recordedBy === 'RESIDENT')?.count ?? 0,
    staffLogged: sourceGroups.find((group) => group.recordedBy === 'STAFF')?.count ?? 0,
  }

  return { user, records, missingGerman, stats }
}

export async function listResidentLearningEvidence() {
  const code = await getResidentCookie()
  if (!code) return null

  return (
    (await db.query.resident.findFirst({
      where: eq(resident.code, code),
      columns: { id: true },
      with: {
        learningRecords: {
          orderBy: [desc(learningRecord.updatedAt)],
          // The role only — the portal names WHICH part of the team entered
          // something, never the colleague's name.
          with: { recordedByUser: { columns: { role: true } } },
        },
      },
    })) ?? null
  )
}
