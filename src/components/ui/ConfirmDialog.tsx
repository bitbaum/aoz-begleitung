'use client'

import { useState, useTransition, useRef, useEffect, useId } from 'react'
import { UI_LABELS } from '@/lib/constants'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => Promise<void> | void
  children: React.ReactNode
  variant?: 'primary' | 'danger'
  /** Shown on the confirm button while it runs. Defaults to the German staff word. */
  processingLabel?: string
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = UI_LABELS.confirm,
  cancelLabel = UI_LABELS.cancel,
  onConfirm,
  children,
  variant = 'primary',
  processingLabel = UI_LABELS.processing,
}: ConfirmDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const titleId = useId()
  const messageId = useId()
  // Element that had focus before the dialog opened — restored on close so
  // keyboard users aren't dumped at the top of the document.
  const triggerRef = useRef<HTMLElement | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  const close = () => setIsOpen(false)

  const handleConfirm = () => {
    startTransition(async () => {
      await onConfirm()
      setIsOpen(false)
    })
  }

  // Move focus into the dialog on open and restore it to the trigger on close.
  // Also lock body scroll while the modal is visible so the background can't
  // scroll behind it on touch devices.
  useEffect(() => {
    if (!isOpen) return
    triggerRef.current = document.activeElement as HTMLElement | null
    cancelButtonRef.current?.focus()

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = prevOverflow
      triggerRef.current?.focus?.()
    }
  }, [isOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isPending) {
      e.stopPropagation()
      close()
    }
  }

  return (
    <>
      {/* Trigger — children is an interactive element (button/link) that
          bubbles its click here, keeping keyboard activation intact. */}
      <div onClick={() => setIsOpen(true)} className="contents">
        {children}
      </div>

      {/* Modal */}
      {isOpen && (
        <div
          className="scrim z-50 flex items-center justify-center"
          onClick={() => !isPending && close()}
          onKeyDown={handleKeyDown}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={messageId}
            className="overlay-panel max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-ui-border">
              <h3 id={titleId} className="text-lg font-semibold text-ui-text">
                {title}
              </h3>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <p id={messageId} className="text-ui-muted">
                {message}
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-ui-border flex justify-end gap-3">
              <button
                ref={cancelButtonRef}
                onClick={close}
                disabled={isPending}
                className="btn-outline"
              >
                {cancelLabel}
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className={
                  variant === 'danger'
                    ? 'bg-status-error text-ui-on-accent px-4 py-2.5 rounded-md font-medium hover:bg-status-error/90 disabled:opacity-50 min-h-[44px]'
                    : 'btn-primary'
                }
              >
                {isPending ? processingLabel : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
