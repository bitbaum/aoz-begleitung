'use server'

/**
 * Saved client groups: create from the current filters, rename, delete.
 *
 * Every refusal is RETURNED, never thrown (CLAUDE.md, "Server actions: return
 * what the user must act on"): a thrown rule reaches the error boundary as
 * "Etwas ist schiefgelaufen" and the person never learns what to change.
 *
 * Groups are saved VIEWS, not data — they hold filters, never people — so the
 * permission is the one that lets someone see the list at all.
 */

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { clientGroup, db } from '@/lib/db'
import { idSchema } from '@/lib/validation/schemas'
import { clientFilterStateSchema, savableClientFilters } from '@/lib/config/client-filters'
import { CLIENT_GROUP_LABELS } from '@/lib/constants/labels/residents'
import { mayManageClientGroup } from '@/lib/client-groups/resolve'

const E = CLIENT_GROUP_LABELS.errors

export interface ClientGroupFormState {
  error?: string
  /** Set on success, so the client can navigate to the group it just made. */
  groupId?: string
  ok?: boolean
}

const NAME_MAX = 80
const DESCRIPTION_MAX = 280

const nameSchema = z.string().trim().min(1, E.nameRequired).max(NAME_MAX, E.nameTooLong)

const descriptionSchema = z
  .string()
  .trim()
  .max(DESCRIPTION_MAX, E.descriptionTooLong)
  .transform((value) => (value.length > 0 ? value : null))

function text(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? E.saveFailed
}

export async function createClientGroup(
  _previous: ClientGroupFormState,
  formData: FormData,
): Promise<ClientGroupFormState> {
  const viewer = await requirePermission('residents:read')

  const name = nameSchema.safeParse(text(formData, 'name'))
  if (!name.success) return { error: firstIssue(name.error) }
  const description = descriptionSchema.safeParse(text(formData, 'description'))
  if (!description.success) return { error: firstIssue(description.error) }

  let raw: unknown
  try {
    raw = JSON.parse(text(formData, 'filters') || 'null')
  } catch {
    return { error: E.invalidFilters }
  }
  const parsed = clientFilterStateSchema.safeParse(raw)
  if (!parsed.success) return { error: E.invalidFilters }
  const filters = savableClientFilters(parsed.data)
  if (Object.keys(filters).length === 0) return { error: E.noFilters }

  let groupId: string
  try {
    const [row] = await db
      .insert(clientGroup)
      .values({
        name: name.data,
        description: description.data,
        filters,
        createdByUserId: viewer.id,
      })
      .returning({ id: clientGroup.id })
    groupId = row.id
  } catch (error) {
    logger.errorWithCause('client group create failed', error)
    return { error: E.saveFailed }
  }

  await logAudit({
    action: 'CREATE',
    entity: 'CLIENT_GROUP',
    entityId: groupId,
    userId: viewer.id,
    changes: { name: name.data, filters },
  })
  revalidatePath('/residents')
  return { ok: true, groupId }
}

/** Load a group and check the viewer may change it; the refusal is returned. */
async function manageableGroup(
  viewer: { id: string; isSystemAdmin: boolean },
  rawId: string,
): Promise<{ id: string; name: string } | { error: string }> {
  const id = idSchema.safeParse(rawId)
  if (!id.success) return { error: E.notFound }
  const group = await db.query.clientGroup.findFirst({
    where: eq(clientGroup.id, id.data),
    columns: { id: true, name: true, createdByUserId: true },
  })
  if (!group) return { error: E.notFound }
  if (!mayManageClientGroup(viewer, group)) return { error: E.notYours }
  return group
}

export async function renameClientGroup(
  _previous: ClientGroupFormState,
  formData: FormData,
): Promise<ClientGroupFormState> {
  const viewer = await requirePermission('residents:read')

  const group = await manageableGroup(viewer, text(formData, 'id'))
  if ('error' in group) return group

  const name = nameSchema.safeParse(text(formData, 'name'))
  if (!name.success) return { error: firstIssue(name.error) }
  const description = descriptionSchema.safeParse(text(formData, 'description'))
  if (!description.success) return { error: firstIssue(description.error) }

  try {
    await db
      .update(clientGroup)
      .set({ name: name.data, description: description.data })
      .where(eq(clientGroup.id, group.id))
  } catch (error) {
    logger.errorWithCause('client group rename failed', error)
    return { error: E.saveFailed }
  }

  await logAudit({
    action: 'UPDATE',
    entity: 'CLIENT_GROUP',
    entityId: group.id,
    userId: viewer.id,
    changes: { name: { from: group.name, to: name.data } },
  })
  revalidatePath('/residents')
  return { ok: true, groupId: group.id }
}

export async function deleteClientGroup(
  _previous: ClientGroupFormState,
  formData: FormData,
): Promise<ClientGroupFormState> {
  const viewer = await requirePermission('residents:read')

  const group = await manageableGroup(viewer, text(formData, 'id'))
  if ('error' in group) return group

  try {
    await db.delete(clientGroup).where(eq(clientGroup.id, group.id))
  } catch (error) {
    logger.errorWithCause('client group delete failed', error)
    return { error: E.saveFailed }
  }

  await logAudit({
    action: 'DELETE',
    entity: 'CLIENT_GROUP',
    entityId: group.id,
    userId: viewer.id,
    changes: { name: group.name },
  })
  revalidatePath('/residents')
  return { ok: true }
}
