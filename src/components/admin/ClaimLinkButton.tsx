'use client'

import { useState } from 'react'
import { CLAIM_INVITE_LABELS } from '@/lib/constants/labels'

interface ClaimLinkButtonProps {
  userId: string
  name: string
}

/**
 * Issues a colleague's personal, single-use claim link (14 days) and shows it
 * once so the administrator can pass it on. Issuing again revokes the old one.
 */
export function ClaimLinkButton({ userId, name }: ClaimLinkButtonProps) {
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function call(method: 'POST' | 'DELETE') {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/auth/claim-invite', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = (await response.json()) as {
        success: boolean
        error?: string
        data?: { url: string; expiresAt: string }
      }
      if (!response.ok || !data.success) {
        setMessage(data.error ?? CLAIM_INVITE_LABELS.failed)
      } else if (method === 'POST' && data.data) {
        setLink(data.data)
        setCopied(false)
      } else {
        setLink(null)
        setMessage(CLAIM_INVITE_LABELS.revoked)
      }
    } catch {
      setMessage(CLAIM_INVITE_LABELS.failed)
    }
    setBusy(false)
  }

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
    } catch {
      // Clipboard can be blocked; the link stays selectable.
    }
  }

  if (link) {
    return (
      <div className="flex max-w-xs flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={link.url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={`${CLAIM_INVITE_LABELS.action}: ${name}`}
            className="input text-xs"
          />
          <button type="button" onClick={copy} className="btn-secondary text-xs">
            {copied ? CLAIM_INVITE_LABELS.copied : CLAIM_INVITE_LABELS.copy}
          </button>
          <button
            type="button"
            onClick={() => call('DELETE')}
            disabled={busy}
            className="btn-ghost text-xs"
          >
            {CLAIM_INVITE_LABELS.revoke}
          </button>
        </div>
        <p className="text-right text-xs text-ui-muted">
          {CLAIM_INVITE_LABELS.validUntil(new Date(link.expiresAt).toLocaleDateString('de-CH'))}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => call('POST')}
        disabled={busy}
        className="btn-outline text-xs"
        aria-label={`${CLAIM_INVITE_LABELS.action}: ${name}`}
        title={CLAIM_INVITE_LABELS.actionHint}
      >
        {busy ? CLAIM_INVITE_LABELS.creating : CLAIM_INVITE_LABELS.action}
      </button>
      {message && (
        <p className="text-right text-xs text-ui-muted" role="status">
          {message}
        </p>
      )}
    </div>
  )
}
