'use client'
/**
 * The browser client for AccountKit's screens (SignInForm, the recovery form,
 * AccountPanel). The code login and the claim keep AOZ's own screens, which
 * reach AccountKit through src/lib/auth/shared/bridge.ts.
 */
import { createAuthClient } from 'better-auth/react'
import { authClientPlugins } from '@bitbaum/accountkit/auth/client'

export const authClient = createAuthClient({ plugins: authClientPlugins() })
