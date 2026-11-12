/**
 * Shared chrome for the account pages (login, register, forgot/reset
 * password): logo header, theme toggle, the card, and the success state.
 * SSOT — the four pages differ only in their form.
 *
 * Two things this shell exists to prevent, both of which it used to cause:
 *
 * 1. A DEAD END. The logo was inert and there was no link off the page, so
 *    anyone who arrived at /login — including everyone bounced here by an
 *    expired session — could not reach the product's own homepage again
 *    without editing the URL bar. The logo is now the way back.
 * 2. A PAGE THAT EXPLAINS NOTHING. A lone form on an empty canvas asks a
 *    stranger to identify themselves before telling them what this is. The
 *    aside answers that, and it reads from MARKETING_COPY rather than
 *    restating the pitch, so the login page can never contradict the landing
 *    page it sits behind.
 */

import { IMPRESSUM_HREF, LEGAL_LABELS, PRIVACY_HREF } from '@/lib/config/legal'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { APP_LABELS, LOGIN_LABELS, MARKETING_COPY } from '@/lib/constants/labels'
import { BRAND } from '@/lib/config/brand'

interface AuthShellProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  /** Rendered below the card (secondary actions, demo doors). */
  footer?: React.ReactNode
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    // Mobile-first: one column, form first. The aside is supporting context,
    // so on a phone it follows the card instead of pushing it below the fold.
    <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center gap-8 lg:gap-12">
      <div className="fixed right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <section className="order-2 lg:order-1 min-w-0">
        <Link
          href="/"
          className="inline-flex items-center gap-2 min-h-[44px] text-sm text-ui-muted hover:text-ui-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {LOGIN_LABELS.backToHome}
        </Link>

        <h2 className="mt-4 text-2xl sm:text-3xl font-semibold tracking-heading text-ui-text text-balance">
          {MARKETING_COPY.headline}
        </h2>
        <p className="mt-3 text-ui-muted max-w-prose">{MARKETING_COPY.subline}</p>

        {/*
          TITLES ONLY, AND ALL OF THEM.

          This list used to render `features.slice(0, 4)` WITH each feature's
          body — roughly two hundred words of dense German beside a login form,
          which nobody reads and which buries the form it is meant to support.

          The slice made it worse than merely long: features 5 and 6 are the two
          that are not about housing ("Antworten, die ankommen",
          "Nachvollziehbar für alle"), so the cut-off silently rendered the
          product as more room-focused than it is. A fixed slice over a list that
          grows drops whatever was added last, without failing.

          Titles carry the breadth in a glance; the landing page is one click
          away for anyone who wants the bodies.
        */}
        <ul className="mt-6 flex flex-wrap gap-x-2 gap-y-2">
          {MARKETING_COPY.features.map((feature) => (
            <li key={feature.title} className="chip-neutral">
              {feature.title}
            </li>
          ))}
        </ul>
      </section>

      <div className="order-1 lg:order-2 w-full max-w-md mx-auto lg:mx-0">
        <div className="text-center mb-6">
          {/* Named for the product, not "Zurück zur Startseite": the back link
              above already carries that name, and two links with the same
              accessible name pointing at the same place is a screen-reader
              stutter with nothing to choose between them. */}
          <Link
            href="/"
            aria-label={BRAND.productName}
            className="inline-flex flex-col items-center gap-2 transition-opacity hover:opacity-70"
          >
            <Logo size="xl" />
            <span className="text-ui-muted">{APP_LABELS.tagline}</span>
          </Link>
        </div>

        <div className="card p-6 sm:p-8">
          <h1 className="text-lg font-semibold text-ui-text mb-1 text-center">{title}</h1>
          {subtitle ? <p className="text-sm text-ui-muted mb-1 text-center">{subtitle}</p> : null}
          <p className="text-xs text-ui-muted mb-6 text-center">{LOGIN_LABELS.audienceHint}</p>
          {children}
        </div>

        {footer}

        {/* Whoever is about to type an e-mail address and a password here can
            read who runs the site and what happens to their data first. */}
        <nav
          aria-label={LEGAL_LABELS.navLabel}
          className="mt-6 flex justify-center gap-4 text-xs text-ui-muted"
        >
          <Link
            href={PRIVACY_HREF}
            className="hover:text-ui-text underline-offset-2 hover:underline"
          >
            {LEGAL_LABELS.privacy}
          </Link>
          <Link
            href={IMPRESSUM_HREF}
            className="hover:text-ui-text underline-offset-2 hover:underline"
          >
            {LEGAL_LABELS.impressum}
          </Link>
        </nav>
      </div>
    </div>
  )
}

interface AuthSuccessProps {
  message: string
  detail?: string
}

/** Green checkmark confirmation, shared by login/register/reset outcomes. */
export function AuthSuccess({ message, detail }: AuthSuccessProps) {
  return (
    <div className="text-center py-4" role="status" aria-live="polite">
      <div className="w-12 h-12 mx-auto mb-3 rounded-md bg-status-success/15 ring-1 ring-status-success/25 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-status-success-text"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <p className="text-status-success-text font-medium">{message}</p>
      {detail ? <p className="text-sm text-ui-muted mt-2">{detail}</p> : null}
    </div>
  )
}
