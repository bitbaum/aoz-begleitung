import { connection } from 'next/server'
import Link from 'next/link'
import { authLabelsFor } from '@bitbaum/accountkit/auth'
import { AuthShell } from '@/components/auth/AuthShell'
import { aozMethods } from '@/lib/auth/methods'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { FORGOT_PASSWORD_LABELS } from '@/lib/constants/labels'
import { LegacyForgotPassword } from './LegacyForgotPassword'
import { RecoveryScreen } from './RecoveryScreen'

/**
 * "Passwort vergessen?": AccountKit's recovery form with the shared runtime on.
 * The mailed link lands on /login, which sets the new password. Without
 * account mail the page says so instead of pretending a link was sent.
 */
export default async function ForgotPasswordPage() {
  await connection()
  if (!sharedAuthEnabled()) return <LegacyForgotPassword />
  const methods = aozMethods()
  return (
    <AuthShell title={FORGOT_PASSWORD_LABELS.title} subtitle={FORGOT_PASSWORD_LABELS.subtitle}>
      <div className="space-y-4">
        {methods.passwordReset ? (
          <RecoveryScreen
            labels={authLabelsFor('de')}
            methods={methods}
            next="/"
            signInPath="/login"
          />
        ) : (
          <div className="alert-error" role="alert">
            {FORGOT_PASSWORD_LABELS.unavailable}
          </div>
        )}
        <Link
          href="/login"
          className="inline-flex items-center min-h-[44px] text-sm text-ui-muted underline-offset-2 hover:text-ui-text hover:underline"
        >
          {FORGOT_PASSWORD_LABELS.backToLogin}
        </Link>
      </div>
    </AuthShell>
  )
}
