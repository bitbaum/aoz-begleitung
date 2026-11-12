// @vitest-environment jsdom
/**
 * QA walk, 12 Nov 2026: the 404 button said "Zum Dashboard" and linked to `/`,
 * and the page had no Impressum or privacy link.
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PUBLIC_CHROME } from '@/lib/constants/labels/public-chrome'

const nav = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))

const { NotFoundScreen } = await import('../NotFoundScreen')

function at(pathname: string): string {
  nav.pathname = pathname
  return renderToString(<NotFoundScreen />).replace(/&#x27;/g, "'")
}

describe('404 page', () => {
  it.each([
    ['/nope', 'de', '/'],
    ['/en/nope', 'en', '/en/willkommen'],
    ['/fr/nope', 'fr', '/fr/willkommen'],
  ] as const)('at %s speaks %s and goes home to %s', (path, locale, home) => {
    const html = at(path)
    const copy = PUBLIC_CHROME[locale].notFound
    expect(html).toContain(copy.title)
    expect(html).toContain(`href="${home}"`)
    expect(html).toContain(copy.action)
  })

  it('names the button for where it goes, never "Dashboard"', () => {
    expect(at('/nope')).toContain('Zur Startseite')
    expect(at('/nope')).not.toContain('Dashboard')
  })

  it('links the Impressum and the privacy statement', () => {
    const html = at('/nope')
    expect(html).toContain('href="/impressum"')
    expect(html).toContain('href="/datenschutz"')
  })
})
