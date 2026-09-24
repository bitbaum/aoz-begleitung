'use server'

import { IN_CARE_RESIDENT_STATUSES } from '@/lib/config/resident-status'
import { revalidatePath } from 'next/cache'
import { db, learningRecord, resident, careAssignment, placement, escapeLike } from '@/lib/db'
import { and, asc, count, desc, eq, ilike, inArray, notInArray, or, sql } from 'drizzle-orm'
import { requirePermission } from '@/lib/auth'
import { getResidentCookie } from '@/lib/portal-auth'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import {
  boardKinds,
  CEFR_LEVELS,
  LEARNING_CATEGORIES,
  LEARNING_KINDS,
  LEARNING_STATUSES,
  GERMAN_TEST_KIND,
  GERMAN_LANGUAGE_CODE,
} from '@/lib/config/learning'
import type { IntegrationBoardId } from '@/lib/config/integration-boards'
import type { LearningKind, LearningStatus, ResidentOrStaff } from '@/lib/db'

const INVALID_RECORD_MESSAGE = 'Art und Bezeichnung sind erforderlich'

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

function parseRecord(formData: FormData) {
  const kind = parseKind(formData.get('kind'))
  const title = String(formData.get('title') || '').trim()
  if (!kind || title.length < 2) {
    throw new Error(INVALID_RECORD_MESSAGE)
  }

  const categoryRaw = String(formData.get('category') || '')
  const category = (LEARNING_CATEGORIES as readonly string[]).includes(categoryRaw)
    ? categoryRaw
    : null

  const cefrRaw = String(formData.get('cefrLevel') || '')
  const cefrLevel = (CEFR_LEVELS as readonly string[]).includes(cefrRaw) ? cefrRaw : null

  const hoursRaw = formData.get('hours')
  const hours = hoursRaw && String(hoursRaw).trim() !== '' ? Number(hoursRaw) : null
  const startedAt = parseDate(formData.get('startedAt'))
  const completedAt = parseDate(formData.get('completedAt'))

  if (startedAt && completedAt && completedAt < startedAt) {
    throw new Error(ERROR_MESSAGES.INVALID_INPUT_DATA)
  }

  return {
    kind,
    title,
    status: parseStatus(formData.get('status')),
    languageCode:
      String(formData.get('languageCode') || '')
        .trim()
        .toUpperCase() || null,
    cefrLevel,
    provider: String(formData.get('provider') || '').trim() || null,
    category,
    hours: hours !== null && Number.isFinite(hours) && hours >= 0 ? Math.round(hours) : null,
    startedAt,
    completedAt,
    notes: String(formData.get('notes') || '').trim() || null,
  }
}

export async function createLearningRecordForResident(formData: FormData): Promise<void> {
  const user = await requirePermission('learning:write')
  const residentId = String(formData.get('residentId') || '')
  if (!residentId) throw new Error(ERROR_MESSAGES.RESIDENT_NOT_FOUND)

  const data = parseRecord(formData)
  await db
    .insert(learningRecord)
    .values({ ...data, residentId, recordedBy: 'STAFF' as ResidentOrStaff })

  revalidatePath(`/residents/${residentId}`)
  revalidatePath('/learning')
  void user
}

export async function createOwnLearningRecord(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const code = await getResidentCookie()
  if (!code) return { success: false, error: ERROR_MESSAGES.NOT_AUTHENTICATED }

  const residentRow = await db.query.resident.findFirst({
    where: eq(resident.code, code),
    columns: { id: true },
  })
  if (!residentRow) return { success: false, error: ERROR_MESSAGES.RESIDENT_NOT_FOUND }

  try {
    const data = parseRecord(formData)
    await db
      .insert(learningRecord)
      .values({ ...data, residentId: residentRow.id, recordedBy: 'RESIDENT' })
  } catch (error) {
    if (error instanceof Error && error.message === INVALID_RECORD_MESSAGE) {
      return { success: false, error: ERROR_MESSAGES.INVALID_INPUT_DATA }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : ERROR_MESSAGES.SAVE_ERROR,
    }
  }

  revalidatePath('/portal/learning')
  return { success: true }
}

// Residents with no German language test on file (Prisma's `learningRecords: { none: … }`)
function missingGermanTestFilter() {
  return notInArray(
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
        learningRecords: { orderBy: [desc(learningRecord.updatedAt)] },
      },
    })) ?? null
  )
}
