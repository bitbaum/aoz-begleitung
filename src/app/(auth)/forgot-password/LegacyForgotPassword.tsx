'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { AuthShell, AuthSuccess } from '@/components/auth/AuthShell'
import { LOGIN_LABELS, FORGOT_PASSWORD_LABELS } from '@/lib/constants/labels'

type ForgotState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success' }
  | { status: 'error'; message: string }

export function LegacyForgotPassword() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<ForgotState>({ status: 'idle' })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setState({ status: 'loading' })

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await response.json()

      if (!data.success) {
        setState({ status: 'error', message: data.error || LOGIN_LABELS.error.generic })
        return
      }

      setState({ status: 'success' })
    } catch {
      setState({ status: 'error', message: LOGIN_LABELS.error.generic })
    }
  }

  return (
    <AuthShell title={FORGOT_PASSWORD_LABELS.title} subtitle={FORGOT_PASSWORD_LABELS.subtitle}>
      {state.status === 'success' ? (
        <AuthSuccess message={FORGOT_PASSWORD_LABELS.success} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {state.status === 'error' && (
            <div className="alert-error" role="alert" aria-live="polite">
              {state.message}
            </div>
          )}

          <div>
            <label htmlFor="email" className="label">
              {LOGIN_LABELS.email}
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={LOGIN_LABELS.emailPlaceholder}
              required
              autoComplete="email"
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
              ? FORGOT_PASSWORD_LABELS.submitting
              : FORGOT_PASSWORD_LABELS.submit}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm">
        <Link
          href="/login"
          className="text-ui-muted underline-offset-2 hover:text-ui-text hover:underline"
        >
          {FORGOT_PASSWORD_LABELS.backToLogin}
        </Link>
      </p>
    </AuthShell>
  )
}
