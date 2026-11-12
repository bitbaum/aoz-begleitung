import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { isPublicRoute } from '@/lib/auth/route-boundaries'
import {
  LOCALISED_LOGIN_ROUTES,
  PUBLIC_DEFAULT_LOCALE,
  PUBLIC_LOCALE_IDS,
  PREFIXED_LOCALE_IDS,
  loginPath,
  publicLocaleOfPath,
} from '@/lib/config/public-locales'
import { LOGIN_COPY } from '@/lib/constants/labels/auth'
import { PUBLIC_CHROME } from '@/lib/constants/labels/public-chrome'

/**
 * QA, 12 Nov 2026: `/en/login` and `/fr/login` answered 404, so a reader who
 * followed the English landing page to "sign in" met a dead end. Each public
 * language now has its own sign-in URL, and the middleware lets it through.
 */
describe('localised sign-in', () => {
  it('keeps German at /login and prefixes the others', () => {
    expect(loginPath(PUBLIC_DEFAULT_LOCALE)).toBe('/login')
    expect(loginPath('en')).toBe('/en/login')
    expect(loginPath('fr')).toBe('/fr/login')
  })

  it('declares every prefixed sign-in URL public', () => {
    expect(LOCALISED_LOGIN_ROUTES).toEqual(PREFIXED_LOCALE_IDS.map((id) => `/${id}/login`))
    for (const route of LOCALISED_LOGIN_ROUTES) expect(isPublicRoute(route)).toBe(true)
  })

  it('has the sign-in words and the chrome in every public language', () => {
    for (const locale of PUBLIC_LOCALE_IDS) {
      for (const value of Object.values(LOGIN_COPY[locale])) expect(value.trim()).not.toBe('')
      for (const value of Object.values(PUBLIC_CHROME[locale])) expect(value.trim()).not.toBe('')
    }
  })

  it('does not leave German on the English or French sign-in page', () => {
    for (const locale of PREFIXED_LOCALE_IDS) {
      expect(LOGIN_COPY[locale].title).not.toBe(LOGIN_COPY.de.title)
      expect(PUBLIC_CHROME[locale].backToHome).not.toBe(PUBLIC_CHROME.de.backToHome)
    }
  })

  it('reads the language of a URL from its first segment', () => {
    expect(publicLocaleOfPath('/fr/login')).toBe('fr')
    expect(publicLocaleOfPath('/en/willkommen')).toBe('en')
    expect(publicLocaleOfPath('/login')).toBe('de')
    expect(publicLocaleOfPath('/xx/login')).toBe('de')
    expect(publicLocaleOfPath(null)).toBe('de')
  })
})

describe('/preise', () => {
  it('is a permanent redirect to the landing page, not a 404', () => {
    // There is no price list to build: nothing on the site sells the product.
    const config = readFileSync(join(process.cwd(), 'next.config.js'), 'utf8')
    expect(config).toMatch(
      /source:\s*'\/preise',\s*destination:\s*'\/willkommen',\s*permanent:\s*true/,
    )
  })
})
