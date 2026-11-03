import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { authLabelsFor } from '@bitbaum/accountkit/auth'
import { AuthShell } from '@/components/auth/AuthShell'
import { SignInForm } from '@/components/auth/AuthForms'
import { aozMethods } from '@/lib/auth/methods'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { BRAND } from '@/lib/config/brand'
import { LOGIN_LABELS } from '@/lib/constants/labels'
import { LoginForm } from './LoginForm'

type Props = {
  searchParams: Promise<{ from?: string; error?: string; verified?: string }>
}

/** Only a same-origin path, never `//host` or a full URL. */
function landing(from: string | undefined): string {
  return from && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/\\')
    ? from
    : '/'
}

/**
 * Sign-in. With AUTH_RUNTIME=accountkit it is AccountKit's SignInForm with
 * every method this deployment offers and AOZ's personal code as its code door
 * (a domain credential): `/login?code=…`, the link invitations send, signs in
 * at once. It lands on `from`, or on `/`, which sends staff to their
 * dashboard and residents to the portal (proxy.ts). Without the shared
 * runtime the legacy screen answers.
 */
export default async function LoginPage({ searchParams }: Props) {
  // Which methods are offered is the box's env, read per request.
  await connection()
  if (!sharedAuthEnabled()) {
    return (
      <Suspense>
        <LoginForm />
      </Suspense>
    )
  }
  const { from, error, verified } = await searchParams
  return (
    <AuthShell title={LOGIN_LABELS.title} subtitle={LOGIN_LABELS.subtitle}>
      <div className="space-y-4">
        {verified === '1' && !error && (
          <div className="alert-success" role="status">
            {LOGIN_LABELS.emailVerified}
          </div>
        )}
        {verified !== undefined && error && (
          <div className="alert-warning" role="status">
            {LOGIN_LABELS.emailVerifyFailed}
          </div>
        )}
        <SignInForm
          labels={authLabelsFor('de')}
          methods={aozMethods()}
          next={landing(from)}
          signInPath="/login"
          initialError={Boolean(error) && verified === undefined}
          signUpLink={
            <Link
              href="/register"
              className="inline-flex items-center min-h-[44px] font-medium text-ui-text underline underline-offset-2"
            >
              {LOGIN_LABELS.registerLink}
            </Link>
          }
          codeDoor={{
            open: LOGIN_LABELS.useCode,
            label: LOGIN_LABELS.code,
            placeholder: LOGIN_LABELS.codePlaceholder,
            hint: LOGIN_LABELS.codeHint,
            uppercase: true,
            param: 'code',
            first: BRAND.features.codeFirstLogin,
          }}
        />
      </div>
      <p className="mt-6 text-center text-xs text-ui-muted">{LOGIN_LABELS.help}</p>
    </AuthShell>
  )
}
