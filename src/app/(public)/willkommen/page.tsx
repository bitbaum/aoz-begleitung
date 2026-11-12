import type { Metadata } from 'next'
import { BRAND } from '@/lib/config/brand'
import { Landing } from '@/components/marketing/Landing'
import { PUBLIC_DEFAULT_LOCALE } from '@/lib/constants/labels/marketing'
import { alternateLanguageLinks } from '@/lib/config/public-routes'

/**
 * The landing page in German — the language the product is written in.
 *
 * It keeps the UNPREFIXED url. Middleware rewrites `/` here for anonymous
 * visitors, so this is the address on the business card, in every existing
 * link, and in the deploy workflow's own "Verify public URL" step. Moving
 * German to `/de/willkommen` for symmetry would buy nothing and break all
 * three. The other languages are prefixed; @see `[lang]/willkommen/page.tsx`.
 *
 * Prerendered: reads brand config, the navigation and the blog folder, never a
 * session or the database.
 */
export const dynamic = 'force-static'

export const metadata: Metadata = {
  // `absolute` because this title already NAMES the product, and the root
  // layout's template appends the product name to everything else. Without it
  // the landing page's tab reads "AOZ — Integrationsplattform | AOZ": the
  // brand twice, in the one place a first-time visitor looks.
  title: { absolute: `${BRAND.productName} — ${BRAND.tagline}` },
  description: BRAND.metaDescription,
  alternates: alternateLanguageLinks(),
  openGraph: {
    title: `${BRAND.productName} — ${BRAND.tagline}`,
    description: BRAND.metaDescription,
    url: '/willkommen',
    locale: 'de_CH',
  },
}

export default function LandingPage() {
  return <Landing locale={PUBLIC_DEFAULT_LOCALE} />
}
