import type { Metadata } from 'next'
import { AccountSecurity } from '@/components/auth/AccountSecurity'
import { PageHeader, PageShell } from '@/components/ui/Page'
import { requireStaffAuth } from '@/lib/auth'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { BRAND } from '@/lib/config/brand'
import { ACCOUNT_SECURITY_LABELS } from '@/lib/constants/labels'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: ACCOUNT_SECURITY_LABELS.title }

/** A staff member's own sign-in methods (AccountKit's panel). */
export default async function StaffAccountPage() {
  await requireStaffAuth()
  return (
    <PageShell>
      <PageHeader
        title={ACCOUNT_SECURITY_LABELS.title}
        description={ACCOUNT_SECURITY_LABELS.description}
      />
      {sharedAuthEnabled() ? (
        <AccountSecurity
          locale="de"
          accountPath="/konto"
          homePath="/"
          words={{
            deletion: ACCOUNT_SECURITY_LABELS.deletion(BRAND.shortName),
            help: ACCOUNT_SECURITY_LABELS.help,
          }}
        />
      ) : (
        <p className="alert-info">{ACCOUNT_SECURITY_LABELS.unavailable}</p>
      )}
    </PageShell>
  )
}
