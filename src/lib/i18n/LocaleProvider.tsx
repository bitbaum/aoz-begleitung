'use client'

import { createContext, useContext, useEffect, useMemo } from 'react'
import { createTranslator, type MessageKey } from '@/lib/i18n'
import { DEFAULT_LOCALE, LOCALES, type Locale, type LocaleId } from '@/lib/i18n/locales'

/**
 * Carries the reader's language to client components.
 *
 * The locale is resolved ONCE on the server, per request, and handed down. It
 * is deliberately not re-derived in the browser: two places deciding what
 * language a page is in will eventually disagree, and the disagreement shows up
 * as a page that is half German after hydration.
 */

interface LocaleContextValue {
  locale: Locale
  t: (key: MessageKey) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({
  locale,
  children,
}: {
  locale: LocaleId
  children: React.ReactNode
}) {
  const value = useMemo<LocaleContextValue>(
    () => ({ locale: LOCALES[locale], t: createTranslator(locale) }),
    [locale],
  )

  // The ROOT element carries the reader's language and direction while the
  // portal is mounted. The root layout is shared with the prerendered public
  // pages, so it says `lang="de"`; the portal's own wrapper already sets
  // lang/dir for server-rendered text, but everything outside it — the
  // document's language for a screen reader, the scrollbar side, a toast or
  // dialog portalled to <body> — still read German, left to right, inside an
  // Arabic portal. Restored on unmount so leaving the portal leaves no trace.
  useEffect(() => {
    const root = document.documentElement
    const previous = { lang: root.lang, dir: root.dir }
    root.lang = locale
    root.dir = LOCALES[locale].dir
    return () => {
      root.lang = previous.lang
      root.dir = previous.dir
    }
  }, [locale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

/**
 * Falls back to German rather than throwing when no provider is above.
 *
 * A component rendered outside the provider is a wiring mistake, but blowing up
 * the whole tree over it would take down a working page to punish a missing
 * translation. German text and a working page is the better failure.
 */
export function useT(): (key: MessageKey) => string {
  const context = useContext(LocaleContext)
  return context?.t ?? createTranslator(DEFAULT_LOCALE)
}

export function useLocale(): Locale {
  const context = useContext(LocaleContext)
  return context?.locale ?? LOCALES[DEFAULT_LOCALE]
}
