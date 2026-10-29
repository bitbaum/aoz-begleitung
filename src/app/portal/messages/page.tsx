import type { Metadata } from 'next'
import { getRequestTranslator } from '@/lib/i18n/request'
import { redirect } from 'next/navigation'
import { db, resident as residentTable } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { requireResidentCookie } from '@/lib/portal-auth'
import { PageHeader } from '@/components/ui/Page'
import { MessageThreadView } from '@/components/portal/MessageThread'
import { getOrCreateThread, loadThreadMessages, markThreadRead } from '@/lib/messaging/queries'
import { createTranslator, resolveLocale, LOCALE_COOKIE } from '@/lib/i18n'
import { cookies, headers } from 'next/headers'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestTranslator()
  return { title: t('nav.messages') }
}
export const dynamic = 'force-dynamic'

/**
 * A resident's conversation with the staff team.
 *
 * Every other channel in this product is one-directional and typed — a report
 * goes to a desk, a transfer request comes back approved or denied, a proposal
 * gets voted on. None of them answer "can I ask you something?", and the
 * absence showed up as questions filed as MAINTENANCE reports, because that was
 * the only box on offer.
 */
export default async function PortalMessagesPage() {
  const residentCode = await requireResidentCookie('/portal')

  const resident = await db.query.resident.findFirst({
    where: eq(residentTable.code, residentCode),
    columns: { id: true },
  })
  if (!resident) redirect('/portal?error=account_not_found')

  const thread = await getOrCreateThread(resident.id)
  // Opening the page is reading it. A badge that stays lit after someone has
  // plainly read the messages teaches them to ignore badges.
  await markThreadRead(thread.id, { kind: 'resident', residentId: resident.id })
  const messages = await loadThreadMessages(thread.id)

  const cookieStore = await cookies()
  const locale = resolveLocale({
    cookieValue: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: (await headers()).get('accept-language'),
  })
  const t = createTranslator(locale)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('messages.title')}
        description={t('messages.subtitle')}
        backHref="/portal"
      />
      <MessageThreadView threadId={thread.id} initialMessages={messages} />
    </div>
  )
}
