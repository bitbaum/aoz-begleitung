import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { LOGIN_COPY, marketingCopy } from '@/lib/constants/labels'
import {
  PUBLIC_DEFAULT_LOCALE,
  PREFIXED_LOCALE_IDS,
  isPublicLocale,
  type PublicLocaleId,
} from '@/lib/config/public-locales'
import { LoginScreen, type LoginSearchParams } from '../../login/LoginScreen'

type Props = {
  params: Promise<{ lang: string }>
  searchParams: Promise<LoginSearchParams>
}

/** A language this route serves: a public one, and not German (`/login`). */
function servedLocale(lang: string): PublicLocaleId | null {
  if (!isPublicLocale(lang) || lang === PUBLIC_DEFAULT_LOCALE) return null
  return PREFIXED_LOCALE_IDS.includes(lang) ? lang : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = servedLocale((await params).lang)
  if (!locale) return {}
  return {
    title: LOGIN_COPY[locale].title,
    description: marketingCopy(locale).subline,
  }
}

/**
 * Sign-in in the other public languages: `/en/login`, `/fr/login`.
 *
 * Every link on `/en/willkommen` that says "sign in" leads here. These URLs
 * answered 404, so an English reader who followed the landing page in English
 * met either a dead end or a German form. Same screen as `/login`, with its
 * own words; an unknown prefix (`/xx/login`) stays a 404.
 */
export default async function LocalisedLoginPage({ params, searchParams }: Props) {
  const locale = servedLocale((await params).lang)
  if (!locale) notFound()
  await connection()
  return <LoginScreen locale={locale} searchParams={await searchParams} />
}
