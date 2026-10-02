'use client'

/**
 * Saved client groups: a row of chips that apply a group's filters, plus the
 * controls to save the current filters as a group and to rename or delete the
 * open one.
 *
 * Every form keeps its own values on a refusal: the actions RETURN the reason
 * (`ClientGroupFormState`) instead of throwing, so the error boundary never
 * replaces the page.
 */

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'
import {
  createClientGroup,
  deleteClientGroup,
  renameClientGroup,
  type ClientGroupFormState,
} from '@/lib/actions/client-groups'
import { CLIENT_GROUP_LABELS as L } from '@/lib/constants/labels/residents'

export interface ClientGroupChip {
  id: string
  name: string
  description: string | null
  href: string
  /** Null when the stored filters no longer validate. */
  memberCount: number | null
  active: boolean
  manageable: boolean
}

export function ClientGroupChips({ groups }: { groups: ClientGroupChip[] }) {
  if (groups.length === 0) return null
  return (
    <nav aria-label={L.rowLabel} className="flex items-center gap-2">
      <span className="eyebrow shrink-0">{L.rowLabel}</span>
      <div className="scroll-fade flex min-w-0 gap-2">
        {groups.map((group) => (
          <Link
            key={group.id}
            href={group.href}
            aria-current={group.active ? 'page' : undefined}
            title={group.memberCount === null ? L.invalidFilters : (group.description ?? undefined)}
            className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-md border px-3 text-sm font-medium transition-colors ${
              group.active
                ? 'border-ui-text bg-ui-text text-ui-inverse'
                : 'border-ui-border bg-ui-surface text-ui-text hover:border-ui-border-strong hover:bg-ui-subtle'
            }`}
          >
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {group.name}
            <span className="numeric text-xs opacity-75">
              {group.memberCount === null ? '—' : L.memberCount(group.memberCount)}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  )
}

function NameFields({ name, description }: { name?: string; description?: string | null }) {
  return (
    <>
      <label className="block">
        <span className="label">{L.name}</span>
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={name}
          placeholder={L.namePlaceholder}
          className="input"
          autoComplete="off"
        />
      </label>
      <label className="block">
        <span className="label">{L.description}</span>
        <input
          name="description"
          maxLength={280}
          defaultValue={description ?? ''}
          className="input"
          autoComplete="off"
        />
      </label>
    </>
  )
}

/** "Als Gruppe speichern" — shown only while filters are active. */
export function SaveClientGroup({
  filtersJson,
  currentHref,
}: {
  filtersJson: string
  currentHref: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<ClientGroupFormState, FormData>(
    createClientGroup,
    {},
  )

  useEffect(() => {
    if (state.ok && state.groupId) {
      const separator = currentHref.includes('?') ? '&' : '?'
      router.push(`${currentHref}${separator}group=${encodeURIComponent(state.groupId)}`)
    }
  }, [state, currentHref, router])

  if (!open) {
    return (
      <button type="button" className="btn-outline w-full sm:w-auto" onClick={() => setOpen(true)}>
        {L.save}
      </button>
    )
  }

  return (
    <form action={formAction} className="card w-full space-y-3 sm:max-w-md">
      <input type="hidden" name="filters" value={filtersJson} />
      <NameFields />
      <p className="text-xs text-ui-muted">{L.saveHint}</p>
      {state.error && (
        <p role="alert" className="alert-error text-sm">
          {state.error}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="submit" className="btn-secondary" disabled={pending}>
          {L.saveSubmit}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          {L.cancel}
        </button>
      </div>
    </form>
  )
}

/** Rename / delete for the open group — rendered only for its creator or a sysadmin. */
export function ManageClientGroup({
  group,
  afterDeleteHref,
}: {
  group: { id: string; name: string; description: string | null }
  afterDeleteHref: string
}) {
  const router = useRouter()
  const [renaming, setRenaming] = useState(false)
  const [renameState, renameAction, renamePending] = useActionState<ClientGroupFormState, FormData>(
    async (previous, formData) => {
      const next = await renameClientGroup(previous, formData)
      if (next.ok) setRenaming(false)
      return next
    },
    {},
  )
  const [deleteState, deleteAction, deletePending] = useActionState<ClientGroupFormState, FormData>(
    deleteClientGroup,
    {},
  )

  useEffect(() => {
    if (deleteState.ok) router.push(afterDeleteHref)
  }, [deleteState, afterDeleteHref, router])

  const error = renameState.error ?? deleteState.error

  return (
    <div className="space-y-2">
      {renaming ? (
        <form action={renameAction} className="card w-full space-y-3 sm:max-w-md">
          <input type="hidden" name="id" value={group.id} />
          <NameFields name={group.name} description={group.description} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" className="btn-primary" disabled={renamePending}>
              {L.renameSubmit}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setRenaming(false)}>
              {L.cancel}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="btn-outline" onClick={() => setRenaming(true)}>
            {L.rename}
          </button>
          <form
            action={deleteAction}
            onSubmit={(event) => {
              if (!window.confirm(L.deleteConfirm)) event.preventDefault()
            }}
          >
            <input type="hidden" name="id" value={group.id} />
            <button type="submit" className="btn-ghost w-full" disabled={deletePending}>
              {L.delete}
            </button>
          </form>
        </div>
      )}
      {error && (
        <p role="alert" className="alert-error text-sm">
          {error}
        </p>
      )}
    </div>
  )
}
