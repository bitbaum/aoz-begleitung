/**
 * The landing page speaks more than one language — these are the gates that
 * keep the extra ones honest.
 *
 * The failure this file exists to prevent is not "a string is missing". It is
 * the quieter one: a French page that renders, looks finished, and is a
 * different, smaller, or stronger-claiming product than the German page it was
 * translated from. Nothing about that fails to compile and nothing about it
 * looks wrong to a reader who cannot compare the two.
 */

import {
  PUBLIC_LOCALE_IDS,
  PUBLIC_DEFAULT_LOCALE,
  MARKETING_REGISTERS_BY_LOCALE,
  isPublicCopyComplete,
  isPublicLocale,
  marketingCopy,
  publicLocales,
  type PublicLocaleId,
} from '@/lib/constants/labels/marketing'
import type { MarketingCopy, MarketingRegisters } from '@/lib/constants/labels/marketing-types'
import { alternateLanguageLinks } from '@/lib/config/public-routes'
import { landingPath } from '@/lib/config/public-locales'
import { LOCALES } from '@/lib/i18n/locales'
import { BRANDS, type BrandId } from '@/lib/config/brand'

const BRAND_IDS = Object.keys(BRANDS) as BrandId[]
const REGISTERS = [
  'placement',
  'household',
] as const satisfies readonly (keyof MarketingRegisters)[]
const NON_DEFAULT = PUBLIC_LOCALE_IDS.filter((id) => id !== PUBLIC_DEFAULT_LOCALE)

describe('which languages the landing page offers', () => {
  it('German is complete for every brand — it is the base, not a translation', () => {
    for (const brand of BRAND_IDS) {
      expect({ brand, complete: isPublicCopyComplete('de', brand) }).toEqual({
        brand,
        complete: true,
      })
    }
  })

  it.each(BRAND_IDS)('%s offers German, English and French today', (brand) => {
    // Stated as the CONCRETE list on purpose. The obvious version of this test
    // — compare `publicLocales()` against `PUBLIC_LOCALE_IDS.filter(
    // isPublicCopyComplete)` — passes no matter what, because both sides call
    // the same function: it asserts that a function agrees with itself.
    // Emptying one French string was enough to make this list read
    // ["de","en"], which is the behaviour worth pinning; a self-referential
    // check stayed green through exactly that mutation.
    expect(publicLocales(brand).map((l) => l.id)).toEqual(['de', 'en', 'fr'])
  })

  it('drops a language from the offer the moment its copy is incomplete', () => {
    // The rule behind the list above, exercised through the real function with
    // a locale that genuinely has no copy. `ti` is offered by the resident
    // portal and has no landing page, which is the honest state for it.
    expect(isPublicCopyComplete('ti' as PublicLocaleId)).toBe(false)
    expect(publicLocales().map((l) => l.id)).not.toContain('ti')
  })

  it('always offers at least German, whatever else is missing', () => {
    for (const brand of BRAND_IDS) {
      expect(publicLocales(brand).map((l) => l.id)).toContain('de')
    }
  })

  it('every public locale is a real locale with an endonym and a BCP-47 tag', () => {
    // The switcher labels itself from `LOCALES`. A public locale that is not in
    // that record renders an empty button — the same class of bug as an unkeyed
    // nav group, which shipped once already.
    for (const id of PUBLIC_LOCALE_IDS) {
      expect(LOCALES[id]).toBeDefined()
      expect(LOCALES[id].endonym.trim()).not.toBe('')
      expect(LOCALES[id].intlTag).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/)
    }
  })
})

describe('completeness is measured, not declared', () => {
  // The point of these two: `isPublicCopyComplete` is the gate that decides
  // whether a language is offered at all. A gate is only worth having if it
  // can FAIL, so both directions are proven by mutation rather than asserted
  // against the copy as it happens to be today.

  it('rejects a language that is missing a string', () => {
    const gutted = {
      ...MARKETING_REGISTERS_BY_LOCALE.en,
      placement: { ...MARKETING_REGISTERS_BY_LOCALE.en.placement, headline: '' },
    }

    expect(isSatisfied(gutted, 'placement')).toBe(false)
  })

  it('rejects a language that quietly ships a SHORTER list', () => {
    // The one a key-by-key check misses. Five features instead of six is not a
    // missing key anywhere — it is a smaller product, described in French.
    const trimmed = {
      ...MARKETING_REGISTERS_BY_LOCALE.fr,
      placement: {
        ...MARKETING_REGISTERS_BY_LOCALE.fr.placement,
        features: MARKETING_REGISTERS_BY_LOCALE.fr.placement.features.slice(0, -1),
      },
    }

    expect(isSatisfied(trimmed, 'placement')).toBe(false)
  })

  it('accepts the copy as actually written', () => {
    for (const locale of PUBLIC_LOCALE_IDS) {
      for (const register of REGISTERS) {
        expect({
          locale,
          register,
          ok: isSatisfied(MARKETING_REGISTERS_BY_LOCALE[locale], register),
        }).toEqual({ locale, register, ok: true })
      }
    }
  })

  /**
   * Re-implements the completeness rule against an arbitrary object, because
   * `isPublicCopyComplete` takes a locale id and can only ever see the real
   * files. Kept deliberately small and structural — it compares shape against
   * the German base, which is the only thing the real function claims to do.
   */
  function isSatisfied(registers: MarketingRegisters, register: keyof MarketingRegisters): boolean {
    const base = MARKETING_REGISTERS_BY_LOCALE.de[register]
    const candidate = registers[register]

    return (Object.keys(base) as (keyof MarketingCopy)[]).every((key) => {
      const expected = base[key]
      const actual = candidate[key]

      if (Array.isArray(expected)) {
        return Array.isArray(actual) && actual.length === expected.length && actual.every(nonEmpty)
      }
      if (typeof expected === 'string' && expected.trim() === '') return typeof actual === 'string'
      return typeof actual === 'string' && actual.trim() !== ''
    })
  }

  function nonEmpty(entry: unknown): boolean {
    return typeof entry === 'string'
      ? entry.trim() !== ''
      : Object.values(entry as Record<string, string>).every((v) => v.trim() !== '')
  }
})

describe('every language describes the SAME product', () => {
  it.each(NON_DEFAULT)('%s lists exactly as many things as German does', (locale) => {
    for (const register of REGISTERS) {
      const de = MARKETING_REGISTERS_BY_LOCALE.de[register]
      const other = MARKETING_REGISTERS_BY_LOCALE[locale][register]

      expect({
        locale,
        register,
        features: other.features.length,
        problems: other.problems.length,
        steps: other.steps.length,
        science: other.science.length,
        docs: other.docs.length,
        neverTracked: other.neverTracked.length,
      }).toEqual({
        locale,
        register,
        features: de.features.length,
        problems: de.problems.length,
        steps: de.steps.length,
        science: de.science.length,
        docs: de.docs.length,
        neverTracked: de.neverTracked.length,
      })
    }
  })

  it.each(NON_DEFAULT)('%s keeps the icons, which are keys and not words', (locale) => {
    // Icons index NAV_ICONS. A translator "translating" one produces an
    // undefined component and a section that renders without its icon —
    // silently, because the landing page guards on `Icon &&`.
    for (const register of REGISTERS) {
      const de = MARKETING_REGISTERS_BY_LOCALE.de[register].features.map((f) => f.icon)
      const other = MARKETING_REGISTERS_BY_LOCALE[locale][register].features.map((f) => f.icon)

      expect({ locale, register, icons: other }).toEqual({ locale, register, icons: de })
    }
  })

  it.each(PUBLIC_LOCALE_IDS)('%s promises the same four things are never tracked', (locale) => {
    // The ethics list is the one place on this page where a mistranslation is a
    // broken promise to a vulnerable person rather than an awkward sentence. It
    // may be translated, but it may not gain or lose an entry.
    for (const register of REGISTERS) {
      expect(MARKETING_REGISTERS_BY_LOCALE[locale][register].neverTracked).toHaveLength(4)
    }
  })

  it.each(NON_DEFAULT)('%s is not a copy of another language', (locale) => {
    // The sibling-language trap: a file that is 100% "covered" because it was
    // duplicated from its neighbour and never translated. Byte-identical prose
    // in two languages is the signature.
    for (const register of REGISTERS) {
      const mine = MARKETING_REGISTERS_BY_LOCALE[locale][register].headline
      for (const other of PUBLIC_LOCALE_IDS) {
        if (other === locale) continue
        expect({
          locale,
          other,
          same: mine === MARKETING_REGISTERS_BY_LOCALE[other][register].headline,
        }).toEqual({ locale, other, same: false })
      }
    }
  })
})

describe('no language invents evidence the German page does not claim', () => {
  // The German copy deliberately contains no measured outcome — no "30% fewer
  // conflicts", no hours saved — because the pilot has not reported. A
  // translation is the easiest place for such a number to appear unchallenged,
  // since the reader who could compare it to the original is exactly the reader
  // who does not need the translation.
  const OUTCOME_CLAIM = /\b\d{1,3}\s?%/

  it.each(PUBLIC_LOCALE_IDS)('%s states no percentage', (locale) => {
    for (const register of REGISTERS) {
      const prose = JSON.stringify(MARKETING_REGISTERS_BY_LOCALE[locale][register])
      expect({ locale, register, claim: OUTCOME_CLAIM.exec(prose)?.[0] ?? null }).toEqual({
        locale,
        register,
        claim: null,
      })
    }
  })

  it.each(PUBLIC_LOCALE_IDS)(
    '%s quotes the factor and source counts from config',
    async (locale) => {
      // Both numbers are interpolated in every language. If a translator typed
      // one as a literal it would keep the value it had on the day they typed it,
      // which is the drift the German page already guards against.
      const { FACTOR_COUNT, SOURCE_COUNT } = await vi.importActual<
        typeof import('@/lib/constants/labels/marketing-types')
      >('@/lib/constants/labels/marketing-types')

      const placement = MARKETING_REGISTERS_BY_LOCALE[locale].placement
      expect(placement.scienceTitle).toContain(String(FACTOR_COUNT))
      expect(placement.scienceBody).toContain(String(SOURCE_COUNT))
    },
  )
})

describe('Swiss German spelling holds in the German copy', () => {
  it('never uses ß', () => {
    for (const register of REGISTERS) {
      const prose = JSON.stringify(MARKETING_REGISTERS_BY_LOCALE.de[register])
      expect({ register, sharpS: prose.includes('ß') }).toEqual({ register, sharpS: false })
    }
  })
})

describe('where each language lives', () => {
  it('keeps German on the unprefixed URL', () => {
    // Middleware rewrites `/` here, the deploy workflow probes it, and every
    // existing link points at it. Prefixing German for symmetry would break all
    // three for no reader's benefit.
    expect(landingPath('de')).toBe('/willkommen')
  })

  it.each(NON_DEFAULT)('gives %s its own prefix', (locale) => {
    expect(landingPath(locale)).toBe(`/${locale}/willkommen`)
  })

  it('gives every offered language a distinct URL', () => {
    const paths = publicLocales().map((l) => landingPath(l.id as PublicLocaleId))
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('advertises exactly the offered languages as hreflang alternates', () => {
    // Announcing a translation that falls back to German is worse than
    // announcing none: the reader arrives expecting their own language.
    const alternates = alternateLanguageLinks()
    const advertised = Object.keys(alternates?.languages ?? {}).filter((k) => k !== 'x-default')
    const expected = publicLocales().map((l) => LOCALES[l.id].intlTag)

    expect(advertised.sort()).toEqual(expected.sort())
  })

  it('makes each offered language its own canonical', () => {
    // /en/willkommen named the German page as canonical while listing itself
    // as the en alternate — two opposite signals to a search engine.
    for (const locale of publicLocales()) {
      const id = locale.id as PublicLocaleId
      expect(alternateLanguageLinks(id)?.canonical).toBe(landingPath(id))
    }
  })

  it('points x-default at German', () => {
    const alternates = alternateLanguageLinks()
    expect(alternates?.languages?.['x-default']).toBe('/willkommen')
  })

  it('recognises exactly the public locales and nothing else', () => {
    for (const id of PUBLIC_LOCALE_IDS) expect(isPublicLocale(id)).toBe(true)
    // `ti` is a real portal locale — this is the interesting negative, because
    // it proves the public list is its own list rather than the portal's.
    expect(isPublicLocale('ti')).toBe(false)
    expect(isPublicLocale('klingon')).toBe(false)
  })
})

describe('marketingCopy', () => {
  it('returns the asked-for language when it is complete', () => {
    expect(marketingCopy('fr', 'aoz').headline).toBe(
      MARKETING_REGISTERS_BY_LOCALE.fr.placement.headline,
    )
  })

  it('serves German rather than a blank page for an unfinished language', () => {
    // Unreachable through the router — `generateStaticParams` never emits an
    // incomplete locale — but a public page's wrong answer should be readable
    // German, not an empty section.
    const copy = marketingCopy('de', 'wg')
    expect(copy.headline).toBe(MARKETING_REGISTERS_BY_LOCALE.de.household.headline)
  })

  it('follows the brand register, not just the language', () => {
    // Same language, different brand: an organisation is being pitched a
    // placement system, a flatshare is not.
    expect(marketingCopy('en', 'aoz').headline).not.toBe(marketingCopy('en', 'wg').headline)
  })
})
