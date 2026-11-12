import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BRAND } from '@/lib/config/brand'
import { Landing } from '@/components/marketing/Landing'
import {
  PUBLIC_DEFAULT_LOCALE,
  isPublicLocale,
  landingPath,
  marketingCopy,
  publicLocales,
  type PublicLocaleId,
} from '@/lib/constants/labels/marketing'
import { alternateLanguageLinks } from '@/lib/config/public-routes'
import { PREFIXED_LOCALE_IDS } from '@/lib/config/public-locales'
import { LOCALES } from '@/lib/i18n/locales'

/**
 * The landing page in every language that is not German.
 *
 * German keeps the unprefixed `/willkommen`; @see that file for why. This route
 * covers the rest, and `generateStaticParams` is what decides which "the rest"
 * means: it emits only the locales `publicLocales()` offers, which is only the
 * locales whose copy is actually COMPLETE for this brand. A half-translated
 * language therefore has no page at all rather than a page that silently falls
 * back to German paragraphs — the reader can tell the difference between "not
 * offered" and "offered and broken", and only one of those is honest.
 *
 * `dynamicParams = false` is the other half of that promise. Without it Next
 * renders any `/xx/willkommen` on demand, so a language nobody has written
 * would answer 200 with the German fallback at a French-looking URL.
 */
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  // Two filters, and they answer different questions. `PREFIXED_LOCALE_IDS` is
  // WHICH URLS THIS ROUTE OWNS (everything but German, which is unprefixed) —
  // shared with the middleware allow-list so the two cannot disagree.
  // `publicLocales()` is WHICH OF THOSE HAVE FINISHED COPY. Collapsing them
  // into one list would mean either building a German page at a URL that
  // should not exist, or letting an unfinished language decide route
  // ownership.
  const offered = new Set(publicLocales().map((locale) => locale.id))

  return PREFIXED_LOCALE_IDS.filter((id) => offered.has(id)).map((id) => ({ lang: id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const { lang } = await params
  if (!isPublicLocale(lang)) return {}

  const copy = marketingCopy(lang)

  return {
    // Same `absolute` reasoning as the German page: the title already names the
    // product, and the root template would otherwise append it a second time.
    title: { absolute: `${BRAND.productName} — ${BRAND.tagline}` },
    // The brand's own meta description is German. The headline is the one
    // sentence of this page that IS translated and does the same job, so a
    // French result in a search engine reads as French.
    description: copy.subline,
    alternates: alternateLanguageLinks(lang),
    // The root layout's openGraph names the site root in German. A shared
    // English or French link should show this page, in its language.
    openGraph: {
      title: `${BRAND.productName} — ${BRAND.tagline}`,
      description: copy.subline,
      url: landingPath(lang),
      locale: LOCALES[lang].intlTag.replace('-', '_'),
    },
  }
}

export default async function LocalisedLandingPage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params

  // Unreachable while `dynamicParams` is false, and kept anyway: it is what
  // makes the narrowing from `string` to `PublicLocaleId` a check rather than
  // a cast, so this page cannot be handed a language it has no copy for.
  if (!isPublicLocale(lang) || lang === PUBLIC_DEFAULT_LOCALE) notFound()

  return <Landing locale={lang as PublicLocaleId} />
}
