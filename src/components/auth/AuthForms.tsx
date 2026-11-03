'use client'

import {
  AccountPanel as SharedAccountPanel,
  ClaimForm as SharedClaimForm,
  PasswordRecoveryForm,
  SignInForm as SharedSignInForm,
  type AuthClasses,
  type ClaimProof,
  type CodeDoor,
} from '@bitbaum/accountkit/auth/react'
// Types only: the runtime half of this entry point pulls in node:crypto.
import type { AuthLabels, SignInMethods } from '@bitbaum/accountkit/auth'
import type { ComponentProps, ReactNode } from 'react'
import { authClient } from '@/lib/auth/client'

/** AccountKit's shared forms in AOZ's component classes (src/app/globals.css). */
export const AUTH_CLASSES: Partial<AuthClasses> = {
  stack: 'flex flex-col gap-4',
  field: 'flex flex-col gap-1.5',
  label: 'label',
  input: 'input',
  inputWrap: 'relative flex items-center',
  reveal: 'btn-icon absolute right-0',
  hint: 'text-xs text-ui-muted',
  notice: 'alert-info',
  error: 'alert-error',
  button: 'btn-primary w-full',
  buttonQuiet: 'btn-outline w-full',
  link: 'inline-flex items-center min-h-[44px] font-medium text-ui-text underline underline-offset-2',
  divider: 'eyebrow text-center',
  check: 'flex items-center gap-2 min-h-[44px] text-sm text-ui-text',
  section: 'card flex flex-col gap-4',
  sectionTitle: 'text-base font-semibold text-ui-text',
}

type Common = {
  labels: AuthLabels
  methods: SignInMethods
  /** Where to land after signing in. */
  next: string
  /** The sign-in page: where a failed round trip returns. */
  signInPath: string
}

export function SignInForm(
  props: Common & { initialError: boolean; signUpLink: ReactNode; codeDoor?: CodeDoor },
) {
  return <SharedSignInForm {...props} client={authClient} classes={AUTH_CLASSES} />
}

/** Claiming a code or a claim link: an email and a first password (AccountKit's ClaimForm). */
export function ClaimForm(
  props: Omit<Common, 'methods'> & {
    methods: SignInMethods
    signInLink: ReactNode
    proof: ClaimProof
  },
) {
  return <SharedClaimForm {...props} client={authClient} classes={AUTH_CLASSES} />
}

export function RecoveryForm(
  props: Pick<
    ComponentProps<typeof PasswordRecoveryForm>,
    'methods' | 'next' | 'onBack' | 'labels' | 'signInPath'
  >,
) {
  return <PasswordRecoveryForm {...props} client={authClient} classes={AUTH_CLASSES} />
}

export function AccountPanel(
  props: Pick<
    ComponentProps<typeof SharedAccountPanel>,
    | 'user'
    | 'linked'
    | 'methods'
    | 'accountPath'
    | 'homePath'
    | 'labels'
    | 'deletion'
    | 'ownProfile'
  >,
) {
  return <SharedAccountPanel {...props} client={authClient} classes={AUTH_CLASSES} />
}
