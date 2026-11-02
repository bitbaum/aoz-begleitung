import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AccountSecurity } from '@/components/auth/AccountSecurity'
import { PageHeader, PageShell } from '@/components/ui/Page'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { getRequestTranslator } from '@/lib/i18n/request'
import { requireResidentCookie } from '@/lib/portal-auth'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestTranslator()
  return { title: t('nav.accountSecurity') }
}

/**
 * A resident's own sign-in methods (AccountKit's panel, in their language).
 * A resident who signed in with their code sees AccountKit's own note that
 * security changes need a password, passkey or provider sign-in first.
 */
export default async function ResidentAccountPage() {
  await requireResidentCookie('/login')
  // Before the switch there are no shared sign-in methods to show.
  if (!sharedAuthEnabled()) redirect('/portal/profile')
  const { locale, t } = await getRequestTranslator()
  return (
    <PageShell>
      <PageHeader title={t('nav.accountSecurity')} />
      <AccountSecurity
        locale={locale}
        accountPath="/portal/konto"
        homePath="/portal"
        words={{ deletion: t('accountSecurity.deletion'), help: t('accountSecurity.help') }}
      />
    </PageShell>
  )
}
