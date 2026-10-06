'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { showToast } from '@/components/ui/Toast'
import type {
  LearningFormCopy,
  LearningRecordActionCopy,
  LearningRecordProblem,
} from '@/lib/config/learning'
import { LearningForm, type LearningFormInitial } from './LearningForm'

type ActionResult = { success: boolean; error?: string; problem?: LearningRecordProblem }

interface Props {
  record: LearningFormInitial
  formCopy: LearningFormCopy
  copy: LearningRecordActionCopy
  audience: 'staff' | 'resident'
  updateAction: (formData: FormData) => Promise<ActionResult>
  deleteAction: (formData: FormData) => Promise<ActionResult>
}

/**
 * Edit and delete for one learning record — the dossier, `/learning` and the
 * portal all use this, so the three cannot disagree about what "delete" asks.
 * Which records it is rendered for is the caller's question, answered by
 * `mayChangeLearningRecord`; the server asks it again.
 */
export function LearningRecordActions({
  record,
  formCopy,
  copy,
  audience,
  updateAction,
  deleteAction,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)

  async function remove() {
    const formData = new FormData()
    formData.set('id', record.id)
    const result = await deleteAction(formData)
    if (!result.success) {
      showToast('error', copy.deleteFailed)
      return
    }
    showToast('success', copy.deleted)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="mt-3 border-t border-ui-border pt-3">
        <LearningForm
          action={updateAction}
          copy={formCopy}
          audience={audience}
          initial={record}
          successMessage={copy.updated}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" className="btn-ghost" onClick={() => setEditing(true)}>
        {copy.edit}
      </button>
      <ConfirmDialog
        title={copy.deleteConfirmTitle}
        message={copy.deleteConfirm}
        confirmLabel={copy.delete}
        cancelLabel={copy.cancel}
        processingLabel={copy.saving}
        variant="danger"
        onConfirm={remove}
      >
        <button type="button" className="btn-ghost text-status-error">
          {copy.delete}
        </button>
      </ConfirmDialog>
    </div>
  )
}
