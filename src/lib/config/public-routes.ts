import type { Metadata } from 'next'
import { publicLocales } from '@/lib/constants/labels/marketing'
import {
  PUBLIC_DEFAULT_LOCALE,
  landingPath,
  type PublicLocaleId,
} from '@/lib/config/public-locales'
import { LOCALES } from '@/lib/i18n/locales'

/**
 * Page metadata that depends on WHICH languages are finished.
 *
 * `landingPath` itself lives in `public-locales.ts` with the locale list, so
 * middleware can read it without importing any landing copy. This file adds the
 * one thing that genuinely needs the copy: whether a translation is complete
 * enough to advertise.
 */

/**
 * `hreflang` alternates for the landing page.
 *
 * Built from `publicLocales()` rather than from the full list, so a language
 * whose copy is not finished is never advertised to a search engine as an
 * available translation. Announcing a page that falls back to German is worse
 * than announcing nothing: the reader arrives expecting their language.
 *
 * `x-default` points at German — it is the language the product is written in
 * and the safe answer for a reader whose own language is not offered.
 */
export function alternateLanguageLinks(
  /**
   * The language of the page asking. Each translation is its own canonical:
   * the English page used to name the German one as canonical while listing
   * itself as the `en` alternate, which tells a search engine two opposite
   * things and drops the translation from results (found 2026-11-12).
   */
  locale: PublicLocaleId = PUBLIC_DEFAULT_LOCALE,
): Metadata['alternates'] {
  const languages: Record<string, string> = {}

  for (const locale of publicLocales()) {
    // The BCP-47 tag, not the bare id: `de-CH` and `fr-CH` say Switzerland,
    // which is the difference between this page and a German page for Germany.
    languages[LOCALES[locale.id].intlTag] = landingPath(locale.id as PublicLocaleId)
  }

  languages['x-default'] = landingPath(PUBLIC_DEFAULT_LOCALE)

  return { canonical: landingPath(locale), languages }
}
