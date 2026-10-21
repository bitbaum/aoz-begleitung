'use client'

import { useEffect, useState, FormEvent, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { AuthShell, AuthSuccess } from '@/components/auth/AuthShell'
import { CLAIM_LABELS, LOGIN_LABELS, REGISTER_LABELS } from '@/lib/constants/labels'

type ClaimState =
  | { status: 'checking' }
  | { status: 'invalid'; message: string }
  | { status: 'ready'; name: string }
  | { status: 'loading'; name: string }
  | { status: 'error'; name: string; message: string }
  | { status: 'success' }

/**
 * /claim?token=… — a colleague takes over the account provisioned for them.
 * The link is personal and single-use; see lib/auth/claim-invites.ts.
 */
function ClaimForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, setState] = useState<ClaimState>({ status: 'checking' })

  useEffect(() => {
    if (!token) {
      setState({ status: 'invalid', message: CLAIM_LABELS.invalid })
      return
    }
    let cancelled = false
    fetch(`/api/auth/claim?token=${encodeURIComponent(token)}`)
      .then((response) => response.json())
      .then((body: { success: boolean; data?: { name: string }; error?: string }) => {
        if (cancelled) return
        if (body.success && body.data) setState({ status: 'ready', name: body.data.name })
        else setState({ status: 'invalid', message: body.error || CLAIM_LABELS.invalid })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'invalid', message: LOGIN_LABELS.error.generic })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const name = 'name' in state ? state.name : ''

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setState({ status: 'loading', name })
    try {
      const response = await fetch('/api/auth/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: email.trim(), password }),
      })
      const data = await response.json()
      if (response.status === 410) {
        setState({ status: 'invalid', message: data.error || CLAIM_LABELS.invalid })
        return
      }
      if (!data.success) {
        setState({ status: 'error', name, message: data.error || LOGIN_LABELS.error.generic })
        return
      }
      setState({ status: 'success' })
      setTimeout(() => {
        router.push(data.type === 'resident' ? '/portal' : '/')
        router.refresh()
      }, 1000)
    } catch {
      setState({ status: 'error', name, message: LOGIN_LABELS.error.generic })
    }
  }

  return (
    <AuthShell title={CLAIM_LABELS.title} subtitle={CLAIM_LABELS.subtitle}>
      {state.status === 'checking' ? (
        <p className="text-center text-sm text-ui-muted" role="status">
          {CLAIM_LABELS.checking}
        </p>
      ) : state.status === 'invalid' ? (
        <div className="space-y-4">
          <div className="alert-warning" role="alert">
            {state.message}
          </div>
          <p className="text-center text-sm">
            <Link href="/login" className="font-medium text-ui-text underline underline-offset-2">
              {CLAIM_LABELS.toLogin}
            </Link>
          </p>
        </div>
      ) : state.status === 'success' ? (
        <AuthSuccess message={REGISTER_LABELS.success} detail={LOGIN_LABELS.success.redirecting} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm font-medium text-ui-text">{CLAIM_LABELS.greeting(name)}</p>
          {state.status === 'error' && (
            <div className="alert-error" role="alert" aria-live="polite">
              {state.message}
            </div>
          )}
          <div>
            <label htmlFor="email" className="label">
              {CLAIM_LABELS.email}
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              className="input"
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              {CLAIM_LABELS.password}
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="input"
            />
            <p className="mt-1.5 text-xs text-ui-muted">{REGISTER_LABELS.passwordHint}</p>
          </div>
          <Button
            type="submit"
            disabled={state.status === 'loading'}
            className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.status === 'loading' ? CLAIM_LABELS.submitting : CLAIM_LABELS.submit}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}

export default function ClaimPage() {
  return (
    <Suspense>
      <ClaimForm />
    </Suspense>
  )
}
