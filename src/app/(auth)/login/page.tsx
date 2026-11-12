import { connection } from 'next/server'
import { PUBLIC_DEFAULT_LOCALE } from '@/lib/config/public-locales'
import { LoginScreen, type LoginSearchParams } from './LoginScreen'

type Props = {
  searchParams: Promise<LoginSearchParams>
}

/**
 * Sign-in in German, at the address every invitation, claim link and
 * expired-session redirect uses. The other languages live at `/<lang>/login`;
 * @see `[lang]/login/page.tsx`. Both render the same `LoginScreen`.
 */
export default async function LoginPage({ searchParams }: Props) {
  // Which methods are offered is the box's env, read per request.
  await connection()
  return <LoginScreen locale={PUBLIC_DEFAULT_LOCALE} searchParams={await searchParams} />
}
