import type { Metadata, Viewport } from 'next'
import { APP_LABELS } from '@/lib/constants/labels'
import { ToastContainer } from '@/components/ui/Toast'
import './globals.css'
// Inter for text; JetBrains Mono for numeric and code-like data (occupancy
// counts, compatibility scores, login codes, dates), set with tabular figures so
// digits keep a constant width and columns stay aligned (`.numeric` in
// globals.css). Both ship in @bitbaum/design-tokens: no build fetches fonts.
import { mono, sans } from './fonts'
import { BRAND } from '@/lib/config/brand'
import { publicSiteUrl } from '@/lib/config/app-url'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

/**
 * Where this app actually serves. Load-bearing for the social preview: Next
 * resolves the generated og:image against `metadataBase`, and without it the
 * tag is emitted as http://localhost:3000/opengraph-image — present, plausible,
 * and unfetchable by every scraper. Falls back to the real host, not localhost.
 *
 * The host stays `aoz-wohnen` regardless of brand: it is an address, not
 * branding (see lib/config/brand.ts).
 */
const SITE_URL = publicSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: `%s | ${APP_LABELS.name}`,
    default: APP_LABELS.metaTitle,
  },
  description: APP_LABELS.metaDescription,
  icons: {
    icon: '/favicon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    title: APP_LABELS.metaTitle,
    description: APP_LABELS.metaDescription,
    url: SITE_URL,
    siteName: APP_LABELS.name,
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeScript = `
    (() => {
      try {
        const mode = window.localStorage.getItem('aoz-theme');
        if (mode === 'light' || mode === 'dark') {
          document.documentElement.dataset.theme = mode;
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      } catch {}
    })();
  `

  return (
    <html lang="de" className={`${sans.variable} ${mono.variable}`} data-brand={BRAND.id}>
      <head>
        <script id="theme-init" dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-ui-canvas text-ui-text font-sans">
        {children}
        <ToastContainer />
        {/* The feedback widget is NOT here. It loads only on the public
            marketing pages — (public)/layout.tsx. The root layout wraps the
            portal and the staff screens too, and a third-party script on the
            pages that show residents' data is a data flow nobody consented to.
            Pinned by src/app/__tests__/no-third-party-script-on-private-pages.test.ts */}
      </body>
    </html>
  )
}
