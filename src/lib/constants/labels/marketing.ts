import { BRAND, type BrandId } from '@/lib/config/brand'
import { LOCALES, type Locale } from '@/lib/i18n/locales'
import {
  PUBLIC_LOCALE_IDS,
  PUBLIC_DEFAULT_LOCALE,
  type PublicLocaleId,
} from '@/lib/config/public-locales'
import { marketingDe } from './marketing.de'
import { marketingEn } from './marketing.en'
import { marketingFr } from './marketing.fr'
import type { MarketingCopy, MarketingRegisters } from './marketing-types'

export type { MarketingCopy, MarketingSection, MarketingFeature } from './marketing-types'

/**
 * The public landing page — the only surface that speaks to someone who has
 * never logged in — in every language it is written in.
 *
 * TWO AXES, AND THEY ARE DIFFERENT KINDS OF THING.
 *
 * BRAND is a build-time fact. One deployment is one brand, `NEXT_PUBLIC_BRAND`
 * is inlined at build, and a reader cannot switch it. It selects the REGISTER:
 * `aoz` addresses an organisation deciding whether to place people with
 * software; `wg` runs in a real shared flat where nobody is "placed" by a
 * "system". The same page for both would be wrong for at least one of them.
 *
 * LOCALE is a per-request fact, chosen by the reader from the URL. It selects
 * the LANGUAGE within that register.
 *
 * Conflating them is what makes landing-page i18n rot: a `Record<BrandId,
 * string>` cannot hold three languages, and a `Record<LocaleId, string>` cannot
 * hold two registers, so whichever axis got modelled second ends up hand-copied
 * into the first.
 *
 * WHY THE PUBLIC PAGE DOES NOT USE THE PORTAL'S COOKIE. `src/lib/i18n/` picks
 * the resident portal's language from a cookie, which is right there: the
 * portal is behind a session and already dynamic. The public group is not —
 * `(public)/layout.tsx` touches no cookie and no database on purpose, which is
 * what keeps every page under it statically prerenderable AND makes it
 * structurally incapable of leaking resident data. Reading a cookie here would
 * spend both of those to gain nothing a URL does not already give: `/fr/...`
 * is linkable, shareable and indexable, and a cookie is none of the three.
 * The two mechanisms are different because the two constraints are different.
 */

/** Which register this brand speaks. Build-time, one per deployment. */
const REGISTER_BY_BRAND: Record<BrandId, keyof MarketingRegisters> = {
  aoz: 'placement',
  wg: 'household',
}

/**
 * Which languages this page comes in, and where each lives, are NOT declared
 * here — `config/public-locales.ts` owns them, because middleware needs the
 * same facts and must not import a line of this file's prose to get them.
 * Re-exported so a caller who wants the copy and the list has one import.
 *
 * Listing a language there does not offer it. `publicLocales()` below offers
 * the ones whose copy is actually complete — same rule as the portal's
 * `offeredLocales(isComplete)`, for the same reason: half a page in your
 * language and half in German is worse than all of it in German, because you
 * cannot tell which parts you are missing.
 */
export {
  PUBLIC_LOCALE_IDS,
  PUBLIC_DEFAULT_LOCALE,
  isPublicLocale,
  landingPath,
  type PublicLocaleId,
} from '@/lib/config/public-locales'

const REGISTERS_BY_LOCALE: Record<PublicLocaleId, MarketingRegisters> = {
  de: marketingDe,
  en: marketingEn,
  fr: marketingFr,
}

/**
 * Is this language's landing copy actually finished, for THIS brand?
 *
 * Computed from the copy rather than declared as a boolean, so a half-written
 * language cannot be listed by editing a flag — the list follows the work.
 * Per brand, because a brand ships one register and only that register's
 * completeness can affect what its readers see: an untranslated `household`
 * register must not withhold French from an `aoz` deployment that has it.
 *
 * "Finished" is measured against the German copy, which is the base every
 * other language is translated from: same keys, same list lengths, and no
 * blank strings standing in for a sentence. Comparing list LENGTHS matters as
 * much as keys — a French page with four of the six features is not missing a
 * key anywhere, it is just quietly a smaller product.
 */
export function isPublicCopyComplete(locale: PublicLocaleId, brand: BrandId = BRAND.id): boolean {
  const register = REGISTER_BY_BRAND[brand]
  const base = marketingDe[register]
  const candidate = REGISTERS_BY_LOCALE[locale]?.[register]

  if (!candidate) return false

  return (Object.keys(base) as (keyof MarketingCopy)[]).every((key) => {
    const expected = base[key]
    const actual = candidate[key]

    if (Array.isArray(expected)) {
      // `neverTracked` is string[]; the others are object lists. Both only need
      // the same number of entries, each non-empty — the words are the
      // translator's business, the shape is not.
      return (
        Array.isArray(actual) &&
        actual.length === expected.length &&
        actual.every((entry) =>
          typeof entry === 'string'
            ? entry.trim() !== ''
            : Object.values(entry).every((v) => typeof v === 'string' && v.trim() !== ''),
        )
      )
    }

    // `surfaceStaffNote` is empty on the German page by design — there is
    // nothing to explain when the menu below it is already German. So an empty
    // base string means the key is optional for everyone.
    if (typeof expected === 'string' && expected.trim() === '') return typeof actual === 'string'

    return typeof actual === 'string' && actual.trim() !== ''
  })
}

/**
 * The languages this deployment's landing page may be read in, in the order
 * they are offered. Always at least German, which is complete by definition.
 */
export function publicLocales(brand: BrandId = BRAND.id): Locale[] {
  return PUBLIC_LOCALE_IDS.filter((id) => isPublicCopyComplete(id, brand)).map((id) => LOCALES[id])
}

/** Landing copy for one language, in this deployment's register. */
export function marketingCopy(locale: PublicLocaleId, brand: BrandId = BRAND.id): MarketingCopy {
  const register = REGISTER_BY_BRAND[brand]
  // Falls back to German rather than to a blank page. Unreachable through the
  // router — `generateStaticParams` only emits offered locales — but a fallback
  // that renders readable German is the right failure for a public page.
  return isPublicCopyComplete(locale, brand)
    ? REGISTERS_BY_LOCALE[locale][register]
    : marketingDe[register]
}

/**
 * Landing copy for the brand this deployment runs under, in German.
 *
 * The login/register/reset pages read this. They are NOT in the public route
 * group and are not translated yet, so they get the language the rest of their
 * chrome is in. When they are translated they should call `marketingCopy()`
 * with their own locale instead of widening this const.
 */
export const MARKETING_COPY: MarketingCopy = marketingCopy(PUBLIC_DEFAULT_LOCALE)

/** Exported for the test that checks every brand has its own complete pitch. */
export const MARKETING_COPY_BY_BRAND: Record<BrandId, MarketingCopy> = {
  aoz: marketingDe[REGISTER_BY_BRAND.aoz],
  wg: marketingDe[REGISTER_BY_BRAND.wg],
}

/** Exported for the test that checks every language says the same thing. */
export const MARKETING_REGISTERS_BY_LOCALE = REGISTERS_BY_LOCALE
