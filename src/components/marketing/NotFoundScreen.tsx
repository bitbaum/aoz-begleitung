'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LegalLinks } from '@/components/marketing/LegalLinks'
import { PUBLIC_CHROME } from '@/lib/constants/labels/public-chrome'
import { PUBLIC_DEFAULT_LOCALE, landingPath, publicLocaleOfPath } from '@/lib/config/public-locales'
import { LOCALES } from '@/lib/i18n/locales'

/**
 * The 404 page's content, in the language of the URL that was not found.
 *
 * Its button said "Zum Dashboard" and went to `/` — which shows a stranger the
 * landing page, not a dashboard (QA walk, 12 Nov 2026). It is now named for
 * where it goes, the home page: `/` in German (staff still land on their
 * dashboard there, which is their home page), the language's own landing page
 * otherwise, so `/fr/whatever` does not answer a French reader in German.
 *
 * A client component because the root `not-found` is not handed the path; the
 * path is all it needs, and it renders on the server first regardless.
 */
export function NotFoundScreen() {
  const locale = publicLocaleOfPath(usePathname())
  const copy = PUBLIC_CHROME[locale].notFound
  const home = locale === PUBLIC_DEFAULT_LOCALE ? '/' : landingPath(locale)

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 bg-brand-background"
      lang={LOCALES[locale].intlTag}
    >
      <div className="max-w-md w-full p-8 bg-ui-surface rounded-lg border border-ui-border text-center">
        <div className="icon-container-lg mx-auto mb-6 h-16 w-16">
          <span className="text-3xl text-ui-muted">404</span>
        </div>
        <h1 className="text-xl font-semibold text-ui-text mb-2">{copy.title}</h1>
        <p className="text-ui-muted mb-6 text-sm">{copy.body}</p>
        <Link href={home} className="btn-primary px-6">
          {copy.action}
        </Link>
      </div>
      <LegalLinks locale={locale} />
    </div>
  )
}
