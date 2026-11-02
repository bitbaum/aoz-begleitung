import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { LegacyResetPassword } from './LegacyResetPassword'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * With the shared runtime on, AccountKit's reset links land on /login, which
 * sets the new password; this address forwards links mailed before the move,
 * with the token and nothing else.
 */
export default async function ResetPasswordPage({ searchParams }: Props) {
  if (!sharedAuthEnabled()) {
    return (
      <Suspense>
        <LegacyResetPassword />
      </Suspense>
    )
  }
  const token = (await searchParams).token
  redirect(
    typeof token === 'string' && token ? `/login?token=${encodeURIComponent(token)}` : '/login',
  )
}
