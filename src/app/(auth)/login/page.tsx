import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { authLabelsFor } from '@bitbaum/accountkit/auth'
import { SignInForm } from '@/components/auth/AuthForms'
import { aozMethods } from '@/lib/auth/methods'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { LOGIN_LABELS } from '@/lib/constants/labels'
import { LoginForm } from './LoginForm'

type Props = { searchParams: Promise<{ from?: string; error?: string }> }

/** Only a same-origin path, never `//host` or a full URL. */
function landing(from: string | undefined): string {
  return from && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/\\')
    ? from
    : '/'
}

/**
 * Sign-in. With AUTH_RUNTIME=accountkit the email door is AccountKit's form
 * with every method this deployment offers; it lands on `from`, or on `/`,
 * which sends staff to their dashboard and residents to the portal (proxy.ts).
 */
export default async function LoginPage({ searchParams }: Props) {
  // Which methods are offered is the box's env, read per request.
  await connection()
  const { from, error } = await searchParams
  const accountkit = sharedAuthEnabled() ? (
    <SignInForm
      labels={authLabelsFor('de')}
      methods={aozMethods()}
      next={landing(from)}
      signInPath="/login"
      initialError={Boolean(error)}
      signUpLink={
        <Link
          href="/register"
          className="inline-flex items-center min-h-[44px] font-medium text-ui-text underline underline-offset-2"
        >
          {LOGIN_LABELS.registerLink}
        </Link>
      }
    />
  ) : undefined
  return (
    <Suspense>
      <LoginForm accountkit={accountkit} />
    </Suspense>
  )
}
