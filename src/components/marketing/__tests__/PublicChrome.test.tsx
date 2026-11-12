// @vitest-environment jsdom
/**
 * QA walk, 12 Nov 2026: `/en/willkommen` and `/fr/willkommen` kept German
 * chrome — "Zum Inhalt springen", "Zur Anmeldung", "Weitere Seiten". The chrome
 * now follows the URL's language, and every public page keeps the legal links.
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PUBLIC_CHROME } from '@/lib/constants/labels/public-chrome'

const nav = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))

const { PublicMasthead, PublicFooter } = await import('../PublicChrome')
const { AuthShell } = await import('@/components/auth/AuthShell')

function at(pathname: string, node: () => React.ReactElement): string {
  nav.pathname = pathname
  return renderToString(node())
}

const decode = (html: string) => html.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&')

describe('public chrome per language', () => {
  it.each([
    ['/en/willkommen', 'en', '/en/login'],
    ['/fr/willkommen', 'fr', '/fr/login'],
    ['/willkommen', 'de', '/login'],
    ['/', 'de', '/login'],
  ] as const)('%s speaks %s and signs in at %s', (path, locale, login) => {
    const copy = PUBLIC_CHROME[locale]
    const head = decode(at(path, () => <PublicMasthead />))
    expect(head).toContain(copy.skipLink)
    expect(head).toContain(copy.toLogin)
    expect(head).toContain(`href="${login}"`)
    if (locale !== 'de') {
      expect(head).not.toContain(PUBLIC_CHROME.de.skipLink)
      expect(head).not.toContain(PUBLIC_CHROME.de.toLogin)
    }

    const foot = decode(at(path, () => <PublicFooter />))
    expect(foot).toContain(copy.footerLabel)
    expect(foot).toContain(copy.impressum)
    expect(foot).toContain(copy.privacy)
  })

  it.each(['/willkommen', '/en/willkommen', '/blog', '/impressum'])(
    'the footer at %s links the Impressum and the privacy statement',
    (path) => {
      const foot = at(path, () => <PublicFooter />)
      expect(foot).toContain('href="/impressum"')
      expect(foot).toContain('href="/datenschutz"')
    },
  )
})

describe('account pages', () => {
  it.each(['de', 'en', 'fr'] as const)('carry the legal links in %s', (locale) => {
    const html = decode(
      at('/login', () => (
        <AuthShell title="t" locale={locale}>
          <span />
        </AuthShell>
      )),
    )
    expect(html).toContain('href="/impressum"')
    expect(html).toContain('href="/datenschutz"')
    expect(html).toContain(PUBLIC_CHROME[locale].impressum)
    // The tagline under the wordmark was German on /fr/login.
    expect(html).toContain(PUBLIC_CHROME[locale].tagline)
  })
})
