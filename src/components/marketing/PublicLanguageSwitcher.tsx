'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LOCALES } from '@/lib/i18n/locales'
import {
  PUBLIC_DEFAULT_LOCALE,
  publicLocales,
  type PublicLocaleId,
} from '@/lib/constants/labels/marketing'
import { landingPath } from '@/lib/config/public-locales'
import { LANDING_ROUTE } from '@/lib/auth/route-boundaries'

/** One language chip: a full 44x44 tap target at every width. */
const CHIP = 'btn-ghost text-sm min-h-[44px] min-w-[44px] justify-center px-1.5 sm:px-2'

/**
 * The language switcher for the pages you can read without an account.
 *
 * IT ONLY APPEARS WHERE THERE IS SOMETHING TO SWITCH TO. The landing page is
 * translated; the blog, roadmap and changelog are long-form German writing and
 * are not. A switcher rendered on all four would offer a French reader on
 * `/blog` a button that either does nothing or silently moves them to a
 * different page — which is how a language picker stops being trusted. So it
 * renders on the landing page and nowhere else, and the check is on the
 * pathname rather than on a prop nobody would remember to pass.
 *
 * NO COOKIE, NO STATE, NO JAVASCRIPT NEEDED TO WORK. Each language is a plain
 * link to that language's URL. `usePathname` is used only to know which link is
 * the current one — if the client bundle never loads, the links still work,
 * which is the right failure mode for the first page a stranger sees.
 *
 * The endonym is the label: nobody scanning for their own language looks for
 * the word "German". @see i18n/locales.ts, which is where these names live for
 * the portal too — one list of what each language calls itself.
 */
export function PublicLanguageSwitcher() {
  const pathname = usePathname()
  const offered = publicLocales()

  // One language is not a choice. If a brand ships only German, this whole
  // control is noise and the header is better without it.
  if (offered.length < 2) return null

  // A stranger at `/` is shown the default language's landing by a rewrite
  // (proxy.ts, LANDING_ROUTE): the server renders it as that route, the browser
  // still reads `/`. Both must name the same page, or the server's switcher
  // meets a client that renders none and hydration fails (issue 361).
  const page = pathname === '/' ? LANDING_ROUTE : pathname
  const current = offered.find((locale) => landingPath(locale.id as PublicLocaleId) === page)
  if (!current) return null

  return (
    <nav aria-label="Sprache / Language / Langue" className="flex items-center gap-0.5">
      {offered.map((locale) => {
        const isCurrent = locale.id === current.id
        return (
          <Link
            key={locale.id}
            href={landingPath(locale.id as PublicLocaleId)}
            hrefLang={LOCALES[locale.id].intlTag}
            // `aria-current` rather than a visual-only highlight: the current
            // language has to be announced, not just coloured.
            aria-current={isCurrent ? 'page' : undefined}
            // The accessible name is ALWAYS the endonym, whatever the viewport
            // shows. A screen-reader user on a phone should hear "Français",
            // not "F R".
            aria-label={locale.endonym}
            // `min-w-[44px]` because `btn` only guarantees the HEIGHT. A
            // two-letter code with phone padding came out 29-31px wide at
            // 390px (QA, 12 Nov 2026) — three tap targets narrower than a
            // thumb, side by side. Three 44px chips still fit the row.
            className={isCurrent ? `${CHIP} text-ui-text font-semibold` : `${CHIP} text-ui-muted`}
          >
            {/*
              Two-character code on a phone, endonym from `sm:` up.

              Not a style preference — three full endonyms ("Deutsch",
              "English", "Français") are ~109px of text, and the public header
              had about 15px of slack at 390px. Shipping them unconditionally
              pushed the document to 484px in a 390px viewport, i.e. the whole
              page scrolled sideways. Measured on the deployed site, not
              guessed.

              The code is `aria-hidden` because `aria-label` above already
              carries the real name; without that a screen reader would read
              both.
            */}
            <span className="sm:hidden" aria-hidden="true">
              {locale.id.toUpperCase()}
            </span>
            <span className="hidden sm:inline" aria-hidden="true">
              {locale.endonym}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

/** Exported for the test that pins the "German is unprefixed" rule end to end. */
export const PUBLIC_SWITCHER_DEFAULT = PUBLIC_DEFAULT_LOCALE
