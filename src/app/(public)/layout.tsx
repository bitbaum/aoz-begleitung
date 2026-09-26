import Script from 'next/script'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { PublicLanguageSwitcher } from '@/components/marketing/PublicLanguageSwitcher'
import { BLOG_LABELS } from '@/lib/constants/labels'
import { AI_DISCLOSURE_HREF } from '@/lib/config/ai-disclosure'

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
    <div className="min-h-screen flex flex-col bg-ui-canvas">
      <a href="#public-main" className="skip-link">
        Zum Inhalt springen
      </a>

      <header className="chrome-bar sticky top-0">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 h-14">
            <div className="flex items-center gap-3">
              <Logo href="/" size="md" />
              <nav className="hidden md:flex items-center gap-1 text-sm">
                <Link href="/blog" className="btn-ghost text-sm">
                  Blog
                </Link>
                <Link href="/roadmap" className="btn-ghost text-sm">
                  Roadmap
                </Link>
                <Link href="/changelog" className="btn-ghost text-sm">
                  Changelog
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-1">
              {/*
                Renders itself only on pages that HAVE other languages — see the
                component. It is a client component, but it reads the pathname
                and nothing else: no cookie, no session, so the promise above
                about this layout staying prerenderable still holds.
              */}
              <PublicLanguageSwitcher />
              <ThemeToggle />
              <Link href="/login" className="btn-ghost text-sm">
                {BLOG_LABELS.toApp}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main id="public-main" className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {children}
      </main>

      <footer className="border-t border-ui-border mt-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="eyebrow">{BLOG_LABELS.title}</p>
            <div className="flex flex-wrap gap-4 text-sm text-ui-muted">
              <Link href="/blog" className="hover:text-ui-text">
                Blog
              </Link>
              <Link href="/roadmap" className="hover:text-ui-text">
                Roadmap
              </Link>
              <Link href="/changelog" className="hover:text-ui-text">
                Changelog
              </Link>
              <Link href={AI_DISCLOSURE_HREF} className="hover:text-ui-text">
                KI und Datenschutz
              </Link>
            </div>
          </div>
        </div>
      </footer>
      {/* The feedback widget lives HERE and nowhere else: public pages carry
          no personal data, so a third-party script sees nothing it should not.
          Token is a literal so next build cannot tree-shake the Script away. */}
      <Script
        src="https://loki.orangecat.ch/widget.js"
        strategy="afterInteractive"
        data-fc-project="fcw_757c716fede237047d988f8d715a144d"
      />
    </div>
  )
}
