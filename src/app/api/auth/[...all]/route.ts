/**
 * AccountKit's endpoints (sign-in, claim, recovery, verification, sessions).
 * Answers only with AUTH_RUNTIME=accountkit; until then this path does not
 * exist and the legacy routes beside it are the only auth surface.
 */
import { NextResponse } from 'next/server'
import { sharedAuth, sharedAuthEnabled } from '@/lib/auth/shared/runtime'

const notFound = () => NextResponse.json({ success: false }, { status: 404 })

export async function GET(request: Request) {
  return sharedAuthEnabled() ? sharedAuth.GET(request) : notFound()
}

export async function POST(request: Request) {
  return sharedAuthEnabled() ? sharedAuth.POST(request) : notFound()
}
