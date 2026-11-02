import Link from 'next/link'
import { headers } from 'next/headers'
import { authLabelsFor, isDeliverable } from '@bitbaum/accountkit/auth'
import { AccountPanel } from '@/components/auth/AuthForms'
import { aozMethods } from '@/lib/auth/methods'
import { sharedAuth } from '@/lib/auth/shared/runtime'

/**
 * How this person signs in — password, passkeys, a second factor, linked
 * sign-ins, sign-out — on AccountKit's panel, for staff (/konto) and residents
 * (/portal/konto) alike. Names live on AOZ's own rows (`User`, `Resident`), so
 * the panel leaves them out; and nobody deletes their own login (the runtime's
 * `accountDeletion: false`), so the panel says whom to ask instead.
 */
export async function AccountSecurity({
  locale,
  accountPath,
  homePath,
  words,
}: {
  locale: string
  accountPath: string
  homePath: string
  /** In the reader's language: staff German, residents their portal language. */
  words: { deletion: string; help: string }
}) {
  const requestHeaders = await headers()
  const [shared, accounts] = await Promise.all([
    sharedAuth.getSession(),
    sharedAuth
      .getAuth()
      .api.listUserAccounts({ headers: requestHeaders })
      .catch(() => []),
  ])
  if (!shared) return null
  const user = shared.user as typeof shared.user & { twoFactorEnabled?: boolean | null }
  return (
    <AccountPanel
      labels={authLabelsFor(locale)}
      user={{
        name: user.name ?? '',
        email: isDeliverable(user.email) ? user.email : null,
        emailVerified: Boolean(user.emailVerified),
        role: 'customer',
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
      }}
      linked={accounts.map((a) => a.providerId)}
      methods={aozMethods()}
      accountPath={accountPath}
      homePath={homePath}
      ownProfile
      deletion={
        <p className="text-sm text-ui-muted">
          {words.deletion}{' '}
          <Link
            href="/portal/help"
            className="inline-flex items-center min-h-[44px] font-medium text-ui-text underline underline-offset-2"
          >
            {words.help}
          </Link>
        </p>
      }
    />
  )
}
