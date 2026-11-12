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
 *    aside answers that, and it reads from the landing copy rather than
 *    restating the pitch, so the login page can never contradict the landing
 *    page it sits behind.
 */

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { LegalLinks } from '@/components/marketing/LegalLinks'
import { APP_LABELS, LOGIN_COPY, PUBLIC_CHROME, marketingCopy } from '@/lib/constants/labels'
import { BRAND } from '@/lib/config/brand'
import {
  PUBLIC_DEFAULT_LOCALE,
  landingPath,
  type PublicLocaleId,
} from '@/lib/config/public-locales'

interface AuthShellProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  /** Rendered below the card (secondary actions, demo doors). */
  footer?: React.ReactNode
  /**
   * The language of the page around the form. German unless the route says
   * otherwise (`/en/login`, `/fr/login`): the pitch beside the form, the way
   * back and the legal links all follow it.
   */
  locale?: PublicLocaleId
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  locale = PUBLIC_DEFAULT_LOCALE,
}: AuthShellProps) {
  const pitch = marketingCopy(locale)
  // German goes to `/`, which already shows a stranger the German landing; the
  // other languages go to their own landing rather than back to German.
  const home = locale === PUBLIC_DEFAULT_LOCALE ? '/' : landingPath(locale)
  return (
    // Mobile-first: one column, form first. The aside is supporting context,
    // so on a phone it follows the card instead of pushing it below the fold.
    <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,26rem)] lg:items-center gap-8 lg:gap-12">
      <div className="fixed right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <section className="order-2 lg:order-1 min-w-0">
        <Link
          href={home}
          className="inline-flex items-center gap-2 min-h-[44px] text-sm text-ui-muted hover:text-ui-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {PUBLIC_CHROME[locale].backToHome}
        </Link>

        <h2 className="mt-4 text-2xl sm:text-3xl font-semibold tracking-heading text-ui-text text-balance">
          {pitch.headline}
        </h2>
        <p className="mt-3 text-ui-muted max-w-prose">{pitch.subline}</p>

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
          {pitch.features.map((feature) => (
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
            href={home}
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
          <p className="text-xs text-ui-muted mb-6 text-center">
            {LOGIN_COPY[locale].audienceHint}
          </p>
          {children}
        </div>

        {footer}

        <LegalLinks locale={locale} className="mt-6" />
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
