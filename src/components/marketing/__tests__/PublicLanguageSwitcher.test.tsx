// @vitest-environment jsdom
/**
 * Issue 361: a stranger at `/` sees the default language's landing through a
 * rewrite, so the server renders the switcher for LANDING_ROUTE while the
 * browser's first render reads `/`. They must produce the same markup, or
 * React throws #418 and re-renders the page.
 */
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { LANDING_ROUTE } from '@/lib/auth/route-boundaries'
import { publicLocales } from '@/lib/constants/labels/marketing'

const nav = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))

const { PublicLanguageSwitcher } = await import('../PublicLanguageSwitcher')

function markupAt(pathname: string): string {
  nav.pathname = pathname
  return renderToString(<PublicLanguageSwitcher />)
}

describe('PublicLanguageSwitcher', () => {
  it('renders the same at / as at the landing route it is rewritten to', () => {
    expect(markupAt('/')).toBe(markupAt(LANDING_ROUTE))
  })

  it('marks the default language as current at /', () => {
    const html = markupAt('/')
    if (publicLocales().length < 2) {
      expect(html).toBe('')
      return
    }
    expect(html).toContain('aria-current="page"')
  })

  it('still renders nothing on a page that is not a landing page', () => {
    expect(markupAt('/blog')).toBe('')
  })
})

describe('PublicLanguageSwitcher tap targets', () => {
  it('gives every chip a 44x44 minimum, not just 44px of height', () => {
    // QA, 12 Nov 2026: "DE", "EN", "FR" measured 29-31px wide at 390px.
    const html = markupAt(LANDING_ROUTE)
    if (publicLocales().length < 2) return
    const chips = html.match(/<a [^>]*>/g) ?? []
    expect(chips).toHaveLength(publicLocales().length)
    for (const chip of chips) {
      expect(chip).toContain('min-w-[44px]')
      expect(chip).toContain('min-h-[44px]')
    }
  })
})
