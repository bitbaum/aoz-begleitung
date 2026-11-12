import { Suspense } from 'react'
import Link from 'next/link'
import { authLabelsFor } from '@bitbaum/accountkit/auth'
import { AuthShell } from '@/components/auth/AuthShell'
import { SignInForm } from '@/components/auth/AuthForms'
import { aozMethods } from '@/lib/auth/methods'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { BRAND } from '@/lib/config/brand'
import { loginPath, type PublicLocaleId } from '@/lib/config/public-locales'
import { LOGIN_COPY, LOGIN_LABELS } from '@/lib/constants/labels'
import { LoginForm } from './LoginForm'

export type LoginSearchParams = { from?: string; error?: string; verified?: string }

/** Only a same-origin path, never `//host` or a full URL. */
function landing(from: string | undefined): string {
  return from && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/\\')
    ? from
    : '/'
}

/**
 * Sign-in, in one public language. With AUTH_RUNTIME=accountkit it is
 * AccountKit's SignInForm with every method this deployment offers and AOZ's
 * personal code as its code door (a domain credential): `/login?code=…`, the
 * link invitations send, signs in at once. It lands on `from`, or on `/`, which
 * sends staff to their dashboard and residents to the portal (proxy.ts).
 * Without the shared runtime the legacy screen answers, in German.
 *
 * `signInPath` is this language's own sign-in URL, so AccountKit's error and
 * magic-link returns come back to the page the reader was on, in their
 * language, rather than to German `/login`.
 */
export function LoginScreen({
  locale,
  searchParams,
}: {
  locale: PublicLocaleId
  searchParams: LoginSearchParams
}) {
  if (!sharedAuthEnabled()) {
    return (
      <Suspense>
        <LoginForm />
      </Suspense>
    )
  }
  const { from, error, verified } = searchParams
  const copy = LOGIN_COPY[locale]
  return (
    <AuthShell title={copy.title} subtitle={copy.subtitle} locale={locale}>
      <div className="space-y-4">
        {verified === '1' && !error && (
          <div className="alert-success" role="status">
            {copy.emailVerified}
          </div>
        )}
        {verified !== undefined && error && (
          <div className="alert-warning" role="status">
            {copy.emailVerifyFailed}
          </div>
        )}
        <SignInForm
          labels={authLabelsFor(locale)}
          methods={aozMethods()}
          next={landing(from)}
          signInPath={loginPath(locale)}
          initialError={Boolean(error) && verified === undefined}
          signUpLink={
            <Link
              href="/register"
              className="inline-flex items-center min-h-[44px] font-medium text-ui-text underline underline-offset-2"
            >
              {copy.registerLink}
            </Link>
          }
          codeDoor={{
            open: copy.useCode,
            label: copy.code,
            placeholder: LOGIN_LABELS.codePlaceholder,
            hint: copy.codeHint,
            uppercase: true,
            param: 'code',
            first: BRAND.features.codeFirstLogin,
          }}
        />
      </div>
      <p className="mt-6 text-center text-xs text-ui-muted">{copy.help}</p>
    </AuthShell>
  )
}
