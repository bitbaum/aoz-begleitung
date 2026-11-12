import Script from 'next/script'
import { PublicFooter, PublicMasthead, PublicShell } from '@/components/marketing/PublicChrome'

/**
 * The route group for pages that are readable without an account.
 *
 * It exists because "public" was previously only a claim: `/algorithm` sits in
 * the `(admin)` group and was listed in PUBLIC_ROUTES, but the admin layout
 * redirects anyone without a staff session, so the middleware boundary and the
 * rendered page disagreed. A public page needs a layout that does not gate,
 * which means its own group — being absent from STAFF_ROUTES is not enough.
 *
 * Nothing here touches cookies or the database. That is load-bearing: it keeps
 * every page below it statically prerenderable, and it means this surface
 * cannot leak resident data even by accident, because it has no way to read
 * any.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicShell>
      <PublicMasthead />

      <main id="public-main" className="bb-frame flex-1 py-8 sm:py-12">
        {children}
      </main>

      <PublicFooter />
      {/* The feedback widget lives HERE and nowhere else: public pages carry
          no personal data, so a third-party script sees nothing it should not.
          Token is a literal so next build cannot tree-shake the Script away. */}
      <Script
        src="https://loki.orangecat.ch/widget.js"
        strategy="afterInteractive"
        data-fc-project="fcw_757c716fede237047d988f8d715a144d"
      />
    </PublicShell>
  )
}
