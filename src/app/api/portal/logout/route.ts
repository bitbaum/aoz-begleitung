import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { RESIDENT_COOKIE } from '@/lib/portal-auth'
import { sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { endSharedSession } from '@/lib/auth/shared/session'

export async function POST() {
  if (sharedAuthEnabled()) await endSharedSession()
  const cookieStore = await cookies()
  cookieStore.delete(RESIDENT_COOKIE)
  redirect('/portal')
}
