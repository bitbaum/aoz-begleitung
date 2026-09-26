'use client'

import { useState, FormEvent, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { AuthShell, AuthSuccess } from '@/components/auth/AuthShell'
import { LOGIN_LABELS } from '@/lib/constants/labels'
import { BRAND } from '@/lib/config/brand'

type LoginState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; type: 'staff' | 'resident'; message: string }
  | { status: 'error'; message: string }

type LoginMode = 'email' | 'code'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Which door opens first is a brand flag. Invite links with ?code= still
  // land on the code form so the invited person just presses Anmelden.
  const [mode, setMode] = useState<LoginMode>(
    searchParams.get('code') ? 'code' : BRAND.features.codeFirstLogin ? 'code' : 'email',
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [state, setState] = useState<LoginState>({ status: 'idle' })
  // Which demo doors this deployment offers — server truth, not a build-baked
  // flag, so a button only appears when pressing it can succeed. One per role:
  // the product looks entirely different depending on who you are, and a
  // single "staff" door shows a fifth of it while implying it is the whole.
  const [demoDoors, setDemoDoors] = useState<{ id: string; label: string }[]>([])
  // Set only where this instance has no doors of its own (production): the
  // way to try the product without an account is the demo instance.
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/demo')
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled && body?.success) {
          setDemoDoors(body.data?.doors ?? [])
        }
      })
      .catch(() => {
        // No demo section on failure — the login form is unaffected.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Pre-fill code from URL param (used by email invite links)
  useEffect(() => {
    const urlCode = searchParams.get('code')
    if (urlCode) setCode(urlCode.toUpperCase())
  }, [searchParams])

  // Clear any pending redirect timer on unmount
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    }
  }, [])

  // Outcome banners from email flows (verification link, password reset).
  const verified = searchParams.get('verified')
  const resetDone = searchParams.get('reset') === '1'

  function scheduleRedirect(role: 'staff' | 'resident') {
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    redirectTimerRef.current = setTimeout(() => {
      router.push(role === 'staff' ? '/' : '/portal')
      router.refresh()
    }, 1000)
  }

  async function submitLogin(body: Record<string, string>) {
    setState({ status: 'loading' })

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!data.success) {
        setState({ status: 'error', message: data.error || LOGIN_LABELS.error.generic })
        return
      }

      const successMessage =
        data.type === 'staff' ? LOGIN_LABELS.success.staff : LOGIN_LABELS.success.resident

      setState({ status: 'success', type: data.type, message: successMessage })
      scheduleRedirect(data.type)
    } catch {
      setState({ status: 'error', message: LOGIN_LABELS.error.generic })
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'email') {
      await submitLogin({ email: email.trim(), password })
    } else {
      await submitLogin({ code: code.trim() })
    }
  }

  async function submitDemo(role: string) {
    setState({ status: 'loading' })

    try {
      const response = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await response.json()

      if (!data.success) {
        setState({ status: 'error', message: data.error || LOGIN_LABELS.error.generic })
        return
      }

      const successMessage =
        data.type === 'staff' ? LOGIN_LABELS.success.staff : LOGIN_LABELS.success.resident

      setState({ status: 'success', type: data.type, message: successMessage })
      scheduleRedirect(data.type)
    } catch {
      setState({ status: 'error', message: LOGIN_LABELS.error.generic })
    }
  }

  /**
   * The doors come FIRST, above the form.
   *
   * Someone arriving here without an account previously met a password field
   * and a code field — two ways of being told no — with the thing they could
   * actually do buried underneath. What most visitors want is to look at the
   * product, and looking requires no credentials at all.
   */
  const demoDoorPanel =
    demoDoors.length > 0 && state.status !== 'success' ? (
      <div className="mb-6 rounded-lg border border-ui-border bg-ui-subtle p-4">
        <p className="text-sm font-medium text-ui-text">{LOGIN_LABELS.demo.title}</p>
        <p className="mt-0.5 mb-3 text-xs text-ui-muted">{LOGIN_LABELS.demo.description}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {demoDoors.map((door) => (
            // Outline, not brand: these are six equal choices, and brand red
            // marks the ONE action that matters on a screen. Six red blocks
            // spend the whole palette on a menu and leave the form's own
            // submit with nothing to be louder than.
            <Button
              key={door.id}
              onClick={() => submitDemo(door.id)}
              disabled={state.status === 'loading'}
              variant="outline"
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {door.label}
            </Button>
          ))}
        </div>
      </div>
    ) : null

  return (
    <AuthShell
      title={LOGIN_LABELS.title}
      subtitle={mode === 'email' ? LOGIN_LABELS.subtitle : LOGIN_LABELS.codeSubtitle}
    >
      {state.status === 'success' ? (
        <AuthSuccess message={state.message} detail={LOGIN_LABELS.success.redirecting} />
      ) : (
        <>
          {demoDoorPanel}
          <form onSubmit={handleSubmit} className="space-y-4">
            {verified === '1' && (
              <div className="alert-success" role="status">
                {LOGIN_LABELS.emailVerified}
              </div>
            )}
            {verified === '0' && (
              <div className="alert-warning" role="status">
                {LOGIN_LABELS.emailVerifyFailed}
              </div>
            )}
            {resetDone && (
              <div className="alert-success" role="status">
                {LOGIN_LABELS.passwordResetDone}
              </div>
            )}
            {state.status === 'error' && (
              <div className="alert-error" role="alert" aria-live="polite">
                {state.message}
              </div>
            )}

            {mode === 'email' ? (
              <>
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
                <div>
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="password" className="label">
                      {LOGIN_LABELS.password}
                    </label>
                    {/* inline-flex + min-h so the tap target clears 44px without
                      moving the label off the password row's baseline. */}
                    <Link
                      href="/forgot-password"
                      className="inline-flex items-center min-h-[44px] text-xs text-ui-muted underline-offset-2 hover:text-ui-text hover:underline"
                    >
                      {LOGIN_LABELS.forgotPassword}
                    </Link>
                  </div>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="input"
                  />
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="code" className="label">
                  {LOGIN_LABELS.code}
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder={LOGIN_LABELS.codePlaceholder}
                  required
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  autoFocus={!searchParams.get('code')}
                  className="input font-mono text-center text-lg tracking-wider"
                />
                <p className="mt-1.5 text-xs text-ui-muted">{LOGIN_LABELS.codeHint}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={state.status === 'loading'}
              className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.status === 'loading' ? LOGIN_LABELS.submitting : LOGIN_LABELS.submit}
            </Button>

            {/* gap-x, not justify-between alone: inside the narrow auth card the two
                items fill the line, and "Mit Code anmelden" ran straight into
                "Noch kein Konto?" with nothing between them. */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 text-sm">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'email' ? 'code' : 'email')
                  setState({ status: 'idle' })
                }}
                className="min-h-[44px] text-ui-muted underline-offset-2 hover:text-ui-text hover:underline"
              >
                {mode === 'email' ? LOGIN_LABELS.useCode : LOGIN_LABELS.useEmail}
              </button>
              <span className="text-ui-muted">
                {LOGIN_LABELS.noAccount}{' '}
                <Link
                  href="/register"
                  className="inline-flex items-center min-h-[44px] font-medium text-ui-text underline underline-offset-2"
                >
                  {LOGIN_LABELS.registerLink}
                </Link>
              </span>
            </div>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-xs text-ui-muted">{LOGIN_LABELS.help}</p>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
