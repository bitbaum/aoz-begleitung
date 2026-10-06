'use client'

import { useRouter } from 'next/navigation'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { showToast } from '@/components/ui/Toast'

interface Props {
  eventId: string
  action: (formData: FormData) => Promise<{ success: boolean; error?: string }>
  /** Every word, so the staff page passes German and the portal its language. */
  copy: {
    trigger: string
    title: string
    message: string
    confirm: string
    cancel: string
    processing: string
    failed: string
  }
  buttonClassName?: string
}

/**
 * «Absagen» and «Löschen» on an event, behind a confirmation.
 *
 * «Absagen» used to be a bare submit button: one stray tap cancelled a house
 * meeting and dropped it from every resident who had said «Ich komme». The
 * dialog says what will happen to those people before it happens.
 */
export function ConfirmEventAction({ eventId, action, copy, buttonClassName }: Props) {
  const router = useRouter()

  async function run() {
    const formData = new FormData()
    formData.set('id', eventId)
    const result = await action(formData)
    if (!result.success) {
      showToast('error', copy.failed)
      return
    }
    router.refresh()
  }

  return (
    <ConfirmDialog
      title={copy.title}
      message={copy.message}
      confirmLabel={copy.confirm}
      cancelLabel={copy.cancel}
      processingLabel={copy.processing}
      variant="danger"
      onConfirm={run}
    >
      <button type="button" className={buttonClassName ?? 'btn-outline min-h-[44px] px-4'}>
        {copy.trigger}
      </button>
    </ConfirmDialog>
  )
}
