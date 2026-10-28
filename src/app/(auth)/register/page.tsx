'use client'

import { useState, FormEvent, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { AuthShell, AuthSuccess } from '@/components/auth/AuthShell'
import { LOGIN_LABELS, REGISTER_LABELS } from '@/lib/constants/labels'
import { BRAND } from '@/lib/config/brand'

type RegisterState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; type: 'staff' | 'resident'; roles: Array<'staff' | 'resident'> }
  | { status: 'household'; residentCode: string }
  | { status: 'error'; message: string }

/** Claim an identity that exists, or create a household that does not. */
type RegisterMode = 'code' | 'household'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [displayName, setDisplayName] = useState('')
  // An invite link carries a code, so that visitor is here to claim it — the
  // household door must not steal a flow that was already decided elsewhere.
  const [mode, setMode] = useState<RegisterMode>('code')
  const [state, setState] = useState<RegisterState>({ status: 'idle' })
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selfServe = BRAND.features.selfServeHousehold

  // Invite links can pre-fill the code (same param as /login).
  useEffect(() => {
    const urlCode = searchParams.get('code')
    if (urlCode) setCode(urlCode.toUpperCase())
  }, [searchParams])

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setState({ status: 'loading' })

    const claiming = mode === 'code'
    const endpoint = claiming ? '/api/auth/signup' : '/api/auth/household'
    const payload = claiming
      ? { code: code.trim(), email: email.trim(), password }
      : {
          email: email.trim(),
          password,
          householdName: householdName.trim(),
          displayName: displayName.trim() || undefined,
        }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!data.success) {
        setState({ status: 'error', message: data.error || LOGIN_LABELS.error.generic })
        return
      }

      if (!claiming) {
        // No auto-redirect here. The resident code is shown exactly once, and
        // bouncing to /portal after a second would take it away before it
        // could be written down.
        setState({ status: 'household', residentCode: data.residentCode })
        return
      }

      setState({ status: 'success', type: data.type, roles: data.roles ?? [data.type] })
      redirectTimerRef.current = setTimeout(() => {
        router.push(data.type === 'staff' ? '/' : '/portal')
        router.refresh()
      }, 1000)
    } catch {
      setState({ status: 'error', message: LOGIN_LABELS.error.generic })
    }
  }

  return (
    <AuthShell
      title={REGISTER_LABELS.title}
      subtitle={mode === 'household' ? REGISTER_LABELS.householdSubtitle : REGISTER_LABELS.subtitle}
    >
      {state.status === 'household' ? (
        <div>
          <AuthSuccess message={REGISTER_LABELS.householdSuccess} />
          <div className="mt-4 rounded-lg border border-ui-border bg-ui-subtle p-4 text-center">
            <p className="eyebrow mb-2">{REGISTER_LABELS.householdCodeTitle}</p>
            <p className="numeric text-2xl font-semibold text-ui-text">{state.residentCode}</p>
            <p className="mt-2 text-xs text-ui-muted">{REGISTER_LABELS.householdCodeHint}</p>
          </div>
          <Button
            onClick={() => {
              router.push('/portal')
              router.refresh()
            }}
            className="mt-4 w-full"
          >
            {LOGIN_LABELS.submit}
          </Button>
        </div>
      ) : state.status === 'success' ? (
        <AuthSuccess
          message={
            state.roles.length > 1 ? REGISTER_LABELS.successBothRoles : REGISTER_LABELS.success
          }
          detail={LOGIN_LABELS.success.redirecting}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Only where a second door exists. On AOZ there is exactly one way
              to get an identity, and a disabled tab advertising the other
              would promise something the deployment must never offer. */}
          {selfServe && (
            <div className="grid grid-cols-2 gap-2" role="tablist">
              {(['code', 'household'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => {
                    setMode(value)
                    setState({ status: 'idle' })
                  }}
                  className={`min-h-[44px] rounded-md px-3 text-sm font-medium transition-colors ${
                    mode === value
                      ? 'bg-ui-text text-ui-inverse'
                      : 'bg-ui-subtle text-ui-muted hover:bg-ui-border'
                  }`}
                >
                  {value === 'code'
                    ? REGISTER_LABELS.modeCodeTab
                    : REGISTER_LABELS.modeHouseholdTab}
                </button>
              ))}
            </div>
          )}

          {state.status === 'error' && (
            <div className="alert-error" role="alert" aria-live="polite">
              {state.message}
            </div>
          )}

          {mode === 'code' ? (
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
                className="input font-mono"
              />
              <p className="mt-1.5 text-xs text-ui-muted">{REGISTER_LABELS.codeHint}</p>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="householdName" className="label">
                  {REGISTER_LABELS.householdNameLabel}
                </label>
                <input
                  type="text"
                  id="householdName"
                  name="householdName"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  placeholder={REGISTER_LABELS.householdNamePlaceholder}
                  required
                  maxLength={80}
                  className="input"
                />
                <p className="mt-1.5 text-xs text-ui-muted">{REGISTER_LABELS.householdNameHint}</p>
              </div>
              <div>
                <label htmlFor="displayName" className="label">
                  {REGISTER_LABELS.displayNameLabel}
                </label>
                <input
                  type="text"
                  id="displayName"
                  name="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={80}
                  autoComplete="nickname"
                  className="input"
                />
                <p className="mt-1.5 text-xs text-ui-muted">{REGISTER_LABELS.displayNameHint}</p>
              </div>
            </>
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
              className="input"
            />
          </div>

          <div>
            <label htmlFor="password" className="label">
              {LOGIN_LABELS.password}
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="input"
            />
          </div>

          <Button
            type="submit"
            disabled={state.status === 'loading'}
            className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {state.status === 'loading'
              ? mode === 'household'
                ? REGISTER_LABELS.householdSubmitting
                : REGISTER_LABELS.submitting
              : mode === 'household'
                ? REGISTER_LABELS.householdSubmit
                : REGISTER_LABELS.submit}
          </Button>

          {/* Linking a second code is only meaningful when you are claiming
              one. On the household door it would explain a mechanic the form
              in front of you does not have. */}
          {mode === 'code' && (
            <div className="rounded-lg border border-ui-border bg-ui-subtle p-3">
              <p className="eyebrow mb-1">{REGISTER_LABELS.linkTitle}</p>
              <p className="text-xs text-ui-muted">{REGISTER_LABELS.linkHint}</p>
            </div>
          )}

          <p className="text-center text-sm text-ui-muted">
            {REGISTER_LABELS.hasAccount}{' '}
            <Link href="/login" className="font-medium text-ui-text underline underline-offset-2">
              {REGISTER_LABELS.loginLink}
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
