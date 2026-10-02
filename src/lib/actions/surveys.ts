'use server'

/**
 * Staff side of anonymous surveys: create a draft, open it to an audience
 * (or invite more people while open), close it.
 *
 * Every refusal is RETURNED (CLAUDE.md, "Server actions: return what the user
 * must act on"). The audience is resolved AS THE SENDER: a saved group runs
 * through `resolveGroupMembers(group, viewer)` and the sender's own site
 * scope, so a survey never reaches somebody the sender could not see.
 *
 * Audit entries carry COUNTS, never the list of people invited — the list is
 * the SurveyInvitation table, and copying it into the audit log would make a
 * second, longer-lived record of who was asked.
 */

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { db, survey, surveyInvitation } from '@/lib/db'
import { idSchema } from '@/lib/validation/schemas'
import { SURVEY_MIN_RESPONSES, surveyTemplate } from '@/lib/config/survey-templates'
import { SURVEY_LABELS } from '@/lib/constants/labels/surveys'
import { resolveSurveyAudience, type SurveyAudience } from '@/lib/surveys/audience'

const E = SURVEY_LABELS.errors

export interface SurveyFormState {
  error?: string
  ok?: boolean
  surveyId?: string
  /** How many invitations this call created. */
  invited?: number
}

const K_RANGE = E.minResponses(SURVEY_MIN_RESPONSES.min, SURVEY_MIN_RESPONSES.max)
const TITLE_MAX = 120
const INTRO_MAX = 1000

function text(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

const createSchema = z.object({
  templateId: z.string().min(1),
  title: z.string().trim().min(1, E.titleRequired).max(TITLE_MAX, E.titleTooLong),
  intro: z
    .string()
    .trim()
    .max(INTRO_MAX, E.introTooLong)
    .transform((value) => (value.length > 0 ? value : null)),
  minResponses: z.coerce
    .number({ error: K_RANGE })
    .int(K_RANGE)
    .min(SURVEY_MIN_RESPONSES.min, K_RANGE)
    .max(SURVEY_MIN_RESPONSES.max, K_RANGE),
})

export async function createSurvey(
  _previous: SurveyFormState,
  formData: FormData,
): Promise<SurveyFormState> {
  const viewer = await requirePermission('surveys:write')

  const parsed = createSchema.safeParse({
    templateId: text(formData, 'templateId'),
    title: text(formData, 'title'),
    intro: text(formData, 'intro'),
    minResponses: text(formData, 'minResponses') || SURVEY_MIN_RESPONSES.default,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? E.saveFailed }

  const template = surveyTemplate(parsed.data.templateId)
  if (!template) return { error: E.templateUnknown }

  let surveyId: string
  try {
    const [row] = await db
      .insert(survey)
      .values({
        templateId: template.id,
        title: parsed.data.title,
        intro: parsed.data.intro,
        questions: template.questions,
        minResponses: parsed.data.minResponses,
        createdByUserId: viewer.id,
      })
      .returning({ id: survey.id })
    surveyId = row.id
  } catch (error) {
    logger.errorWithCause('survey create failed', error)
    return { error: E.saveFailed }
  }

  await logAudit({
    action: 'CREATE',
    entity: 'SURVEY',
    entityId: surveyId,
    userId: viewer.id,
    changes: {
      templateId: template.id,
      title: parsed.data.title,
      minResponses: parsed.data.minResponses,
    },
  })
  revalidatePath('/surveys')
  return { ok: true, surveyId }
}

/** Read the audience fields of the send form. Null when none was chosen. */
function audienceFrom(formData: FormData): SurveyAudience | null {
  const kind = text(formData, 'audience')
  if (kind === 'group') {
    const groupId = idSchema.safeParse(text(formData, 'groupId'))
    return groupId.success ? { kind: 'group', groupId: groupId.data } : null
  }
  if (kind === 'individuals') {
    const ids = formData
      .getAll('residentIds')
      .filter((value): value is string => typeof value === 'string')
      .filter((value) => idSchema.safeParse(value).success)
    return ids.length > 0 ? { kind: 'individuals', residentIds: ids } : null
  }
  return null
}

/**
 * Invite an audience. A DRAFT is opened by the first send; an OPEN survey may
 * invite more people (already-invited clients are skipped); a CLOSED one may
 * not invite anyone.
 */
export async function sendSurvey(
  _previous: SurveyFormState,
  formData: FormData,
): Promise<SurveyFormState> {
  const viewer = await requirePermission('surveys:write')

  const id = idSchema.safeParse(text(formData, 'id'))
  if (!id.success) return { error: E.notFound }
  const row = await db.query.survey.findFirst({
    where: eq(survey.id, id.data),
    columns: { id: true, status: true },
  })
  if (!row) return { error: E.notFound }
  if (row.status === 'CLOSED') return { error: E.notSendable }

  const audience = audienceFrom(formData)
  if (!audience) return { error: E.noAudience }

  const resolved = await resolveSurveyAudience(audience, viewer)
  if (!resolved.ok) {
    return {
      error:
        resolved.reason === 'group-not-found'
          ? E.groupNotFound
          : resolved.reason === 'group-invalid'
            ? E.groupInvalid
            : E.emptyAudience,
    }
  }

  let invited = 0
  try {
    invited = await db.transaction(async (tx) => {
      const created = await tx
        .insert(surveyInvitation)
        .values(resolved.residentIds.map((residentId) => ({ surveyId: row.id, residentId })))
        .onConflictDoNothing({ target: [surveyInvitation.surveyId, surveyInvitation.residentId] })
        .returning({ id: surveyInvitation.id })
      if (row.status === 'DRAFT') {
        await tx
          .update(survey)
          .set({ status: 'OPEN', openedAt: new Date() })
          .where(and(eq(survey.id, row.id), eq(survey.status, 'DRAFT')))
      }
      return created.length
    })
  } catch (error) {
    logger.errorWithCause('survey send failed', error, { surveyId: row.id })
    return { error: E.saveFailed }
  }

  await logAudit({
    action: 'UPDATE',
    entity: 'SURVEY',
    entityId: row.id,
    userId: viewer.id,
    changes: {
      status: row.status === 'DRAFT' ? { from: 'DRAFT', to: 'OPEN' } : undefined,
      audience: audience.kind,
      ...(audience.kind === 'group' ? { groupId: audience.groupId } : {}),
      invited,
    },
  })
  revalidatePath('/surveys')
  revalidatePath(`/surveys/${row.id}`)
  revalidatePath('/portal')
  return { ok: true, surveyId: row.id, invited }
}

export async function closeSurvey(
  _previous: SurveyFormState,
  formData: FormData,
): Promise<SurveyFormState> {
  const viewer = await requirePermission('surveys:write')

  const id = idSchema.safeParse(text(formData, 'id'))
  if (!id.success) return { error: E.notFound }

  let closed: { id: string }[]
  try {
    closed = await db
      .update(survey)
      .set({ status: 'CLOSED', closedAt: new Date() })
      .where(and(eq(survey.id, id.data), eq(survey.status, 'OPEN')))
      .returning({ id: survey.id })
  } catch (error) {
    logger.errorWithCause('survey close failed', error, { surveyId: id.data })
    return { error: E.saveFailed }
  }
  if (closed.length === 0) {
    const exists = await db.query.survey.findFirst({
      where: eq(survey.id, id.data),
      columns: { id: true },
    })
    return { error: exists ? E.notOpen : E.notFound }
  }

  await logAudit({
    action: 'UPDATE',
    entity: 'SURVEY',
    entityId: id.data,
    userId: viewer.id,
    changes: { status: { from: 'OPEN', to: 'CLOSED' } },
  })
  revalidatePath('/surveys')
  revalidatePath(`/surveys/${id.data}`)
  revalidatePath('/portal')
  return { ok: true, surveyId: id.data }
}
