import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { LOCALES } from '@/lib/i18n'
import { getRequestTranslator } from '@/lib/i18n/request'
import { LocaleProvider } from '@/lib/i18n/LocaleProvider'
import { PortalUrlFeedback } from '@/components/portal/PortalUrlFeedback'
import { PortalNav } from '@/components/portal/PortalNav'
import { PortalSidebar } from '@/components/portal/PortalSidebar'
import { PortalTabBar } from '@/components/portal/PortalTabBar'
import { BRAND } from '@/lib/config/brand'
import { RESIDENT_COOKIE, STAFF_COOKIE } from '@/lib/auth/constants'
import { db, resident as residentTable } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { residentUnreadCount } from '@/lib/messaging/queries'

/**
 * The portal names itself in the reader's language.
 *
 * This said "Bewohnerportal" — a fourth name for the portal, beside
 * `BRAND.portalName`, the translated `portalTitleKey` the nav renders, and the
 * product name the root layout appends. A Russian-speaking resident's tab read
 * "Bewohnerportal | WG Zuhause": two German words for one place, neither of
 * them the name the page itself was showing them.
 *
 * Reading the brand fixed the DUPLICATION but not the LANGUAGE: a static
 * `metadata` export is evaluated once, so the tab kept saying "Mein Bereich"
 * above a page rendered in Russian. `generateMetadata` runs per request, which
 * is what lets the title resolve through the same translator and the same
 * `portalTitleKey` the navigation already uses — one name for this place, in
 * whatever language the reader chose.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestTranslator()
  const portalName = t(BRAND.portalTitleKey)

  return {
    title: {
      template: `%s | ${portalName}`,
      default: portalName,
    },
  }
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const residentCode = cookieStore.get(RESIDENT_COOKIE)?.value
  const hasStaffAccess = !!cookieStore.get(STAFF_COOKIE)?.value
  const resident = residentCode
    ? await db.query.resident.findFirst({
        where: eq(residentTable.code, residentCode),
        columns: { id: true },
      })
    : null
  const messageUnreadCount = resident ? await residentUnreadCount(resident.id) : 0

  const { locale, t } = await getRequestTranslator()

  if (!residentCode) {
    return <div className="min-h-screen bg-ui-canvas text-ui-text">{children}</div>
  }

  return (
    // Bottom padding clears the fixed tab bar. `lang`/`dir` sit here rather
    // than on <html> so the landing page stays prerenderable.
    <div
      lang={locale}
      dir={LOCALES[locale].dir}
      className="min-h-screen bg-ui-canvas text-ui-text flex flex-col pb-[4.5rem] lg:pb-0"
    >
      <LocaleProvider locale={locale}>
        <PortalUrlFeedback />
        <a href="#portal-main" className="skip-link">
          Zum Inhalt springen
        </a>

        <header className="chrome-bar sticky top-0 z-30 h-14">
          <div className="h-full px-4 lg:px-6 flex items-center">
            <PortalNav hasStaffAccess={hasStaffAccess} />
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          <PortalSidebar messageUnreadCount={messageUnreadCount} />

          <div className="flex-1 min-w-0 flex flex-col">
            <main id="portal-main" className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 sm:py-8">
              {children}
            </main>

            <footer className="border-t border-ui-border bg-ui-surface mt-auto">
              <div className="max-w-4xl mx-auto px-4 py-4 sm:py-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-ui-muted">
                  <p className="text-center sm:text-start">{t('safety.emergency')}</p>
                  <Link
                    href="/portal/help"
                    className="hover:text-ui-text min-h-[44px] flex items-center"
                  >
                    {t('nav.help')}
                  </Link>
                </div>
              </div>
            </footer>
          </div>
        </div>

        <PortalTabBar messageUnreadCount={messageUnreadCount} />
      </LocaleProvider>
    </div>
  )
}
