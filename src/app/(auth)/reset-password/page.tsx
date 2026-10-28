'use client'

import { useState, FormEvent, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { AuthShell } from '@/components/auth/AuthShell'
import { LOGIN_LABELS, REGISTER_LABELS, RESET_PASSWORD_LABELS } from '@/lib/constants/labels'

type ResetState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string }

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [state, setState] = useState<ResetState>({ status: 'idle' })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setState({ status: 'loading' })

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await response.json()

      if (!data.success) {
        setState({ status: 'error', message: data.error || LOGIN_LABELS.error.generic })
        return
      }

      // Success feedback renders on /login (one place, one banner).
      router.push('/login?reset=1')
    } catch {
      setState({ status: 'error', message: LOGIN_LABELS.error.generic })
    }
  }

  return (
    <AuthShell title={RESET_PASSWORD_LABELS.title} subtitle={RESET_PASSWORD_LABELS.subtitle}>
      {!token ? (
        <div className="space-y-4">
          <div className="alert-warning" role="alert">
            {RESET_PASSWORD_LABELS.missingToken}
          </div>
          <p className="text-center text-sm">
            <Link
              href="/forgot-password"
              className="font-medium text-ui-text underline underline-offset-2"
            >
              {RESET_PASSWORD_LABELS.requestNew}
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {state.status === 'error' && (
            <div className="alert-error" role="alert" aria-live="polite">
              {state.message}
            </div>
          )}

          <div>
            <label htmlFor="password" className="label">
              {RESET_PASSWORD_LABELS.newPassword}
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              autoFocus
              className="input"
            />
          </div>

          <Button
            type="submit"
            disabled={state.status === 'loading'}
            className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.status === 'loading'
              ? RESET_PASSWORD_LABELS.submitting
              : RESET_PASSWORD_LABELS.submit}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
