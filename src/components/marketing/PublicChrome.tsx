'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SiteFooter, SiteMasthead } from '@bitbaum/sitekit/react'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { PublicLanguageSwitcher } from './PublicLanguageSwitcher'
import { APP_LABELS } from '@/lib/constants/labels'
import { PUBLIC_CHROME, type PublicChromeCopy } from '@/lib/constants/labels/public-chrome'
import { AI_DISCLOSURE_HREF } from '@/lib/config/ai-disclosure'
import { IMPRESSUM_HREF, PRIVACY_HREF } from '@/lib/config/legal'
import { loginPath, publicLocaleOfPath, type PublicLocaleId } from '@/lib/config/public-locales'
import { LOCALES } from '@/lib/i18n/locales'

/**
 * The chrome around every public page, in the language of the page.
 *
 * The landing copy came in English and French while this stayed German, so
 * `/fr/willkommen` opened with "Zum Inhalt springen" and offered "Zur
 * Anmeldung" (QA walk, 12 Nov 2026). The public layout is not handed its
 * child's params, but every localised URL starts with its language, so the
 * pathname is enough — and `/`, rewritten to the German landing, reads as
 * German.
 *
 * Client components for that reason only: `usePathname` is how a layout-level
 * component learns which page it wraps. Everything here still renders on the
 * server first; nothing waits for JavaScript.
 */
function usePublicLocale(): PublicLocaleId {
  return publicLocaleOfPath(usePathname())
}

function publicNav(copy: PublicChromeCopy) {
  return [
    { path: 'blog', label: copy.nav.blog },
    { path: 'roadmap', label: copy.nav.roadmap },
    { path: 'changelog', label: copy.nav.changelog },
  ]
}

function chromeSpec(copy: PublicChromeCopy) {
  return { name: APP_LABELS.name, tagline: copy.tagline, footerNote: copy.blogTitle }
}

export function PublicMasthead() {
  const pathname = usePathname()
  const locale = usePublicLocale()
  const copy = PUBLIC_CHROME[locale]
  return (
    <>
      <SiteMasthead
        appearance="application"
        chrome={chromeSpec(copy)}
        navItems={publicNav(copy)}
        currentPath={pathname.split('/')[1] ?? ''}
        Link={Link}
        mainId="public-main"
        skipLabel={copy.skipLink}
        navLabel={copy.navLabel}
        menuLabel={copy.menu}
        brand={<Logo size="md" />}
        actions={<Link href={loginPath(locale)}>{copy.toLogin}</Link>}
      />
      <div className="bb-frame flex items-center justify-end gap-1">
        <PublicLanguageSwitcher />
        <ThemeToggle labels={copy.theme} />
      </div>
    </>
  )
}

export function PublicFooter() {
  const copy = PUBLIC_CHROME[usePublicLocale()]
  return (
    <SiteFooter
      appearance="application"
      chrome={chromeSpec(copy)}
      Link={Link}
      label={copy.footerLabel}
      links={[
        { href: '/blog', label: copy.nav.blog },
        { href: '/roadmap', label: copy.nav.roadmap },
        { href: '/changelog', label: copy.nav.changelog },
        { href: AI_DISCLOSURE_HREF, label: copy.aiLink },
        { href: PRIVACY_HREF, label: copy.privacy },
        { href: IMPRESSUM_HREF, label: copy.impressum },
      ]}
    />
  )
}

/**
 * The outer frame, carrying the page's language. `lang` on the shell rather
 * than on `<html>`, for the reason `Landing` gives: the root layout is shared
 * with the whole product and cannot know this route's language — and the
 * chrome, not only the landing copy, has to be read with the right rules.
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
  const locale = usePublicLocale()
  return (
    <div
      className="public-shell min-h-screen flex flex-col bg-ui-canvas"
      lang={LOCALES[locale].intlTag}
    >
      {children}
    </div>
  )
}
