import { signInMethods, type SignInMethods } from '@bitbaum/accountkit/auth'
import { sharedAuthMailer } from './shared/runtime'

/**
 * Which sign-in methods this deployment offers, from its env: password,
 * passkeys and a second factor always; the email link and recovery when
 * account mail works; OrangeCat with ORANGECAT_OAUTH_*; the shared bitbaum
 * sign-in with SIGNIN_* once Morulia publishes a provider. A method whose env
 * is missing is hidden. Read per request: it is runtime env.
 */
export function aozMethods(env: NodeJS.ProcessEnv = process.env): SignInMethods {
  return signInMethods(env, sharedAuthMailer.configured, { emailConfirmation: 'before-sign-in' })
}
