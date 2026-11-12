import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/config/brand'

/**
 * The install manifest, generated from the brand SSOT.
 *
 * It was a static `public/manifest.json` that still said "AOZ
 * Wohnraumverwaltung" — a name the product stopped using long before — while
 * every page said something else. Generated here, a rebrand reaches the home
 * screen the same way it reaches the tab title and the social card.
 *
 * Served at `/manifest.webmanifest` and linked from every page by Next.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.productName,
    short_name: BRAND.shortName,
    description: BRAND.metaDescription,
    start_url: '/',
    display: 'standalone',
    // Same values the static file carried; a browser reads these before any
    // stylesheet exists, so they cannot be CSS tokens.
    background_color: '#f8f9fa',
    theme_color: '#E8513D',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }
}
