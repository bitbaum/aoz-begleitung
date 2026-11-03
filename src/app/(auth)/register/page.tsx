import { Suspense } from 'react'
import Link from 'next/link'
import { connection } from 'next/server'
import { authLabelsFor } from '@bitbaum/accountkit/auth'
import { AuthShell } from '@/components/auth/AuthShell'
import { ClaimForm } from '@/components/auth/AuthForms'
import { aozMethods } from '@/lib/auth/methods'
import { CLAIM_PROOF, sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { LOGIN_LABELS, REGISTER_LABELS } from '@/lib/constants/labels'
import { LegacyRegister } from './LegacyRegister'

type Props = { searchParams: Promise<{ code?: string }> }

/**
 * Claiming a personal code: AccountKit's ClaimForm (a code, an email, a first
 * password), resolved by AOZ's provisioning. An invitation's `?code=` fills
 * the code in. Without the shared runtime the legacy screen answers.
 */
export default async function RegisterPage({ searchParams }: Props) {
  await connection()
  if (!sharedAuthEnabled()) {
    return (
      <Suspense>
        <LegacyRegister />
      </Suspense>
    )
  }
  const { code } = await searchParams
  return (
    <AuthShell title={REGISTER_LABELS.title} subtitle={REGISTER_LABELS.subtitle}>
      <ClaimForm
        labels={authLabelsFor('de')}
        methods={aozMethods()}
        next="/"
        signInPath="/login"
        signInLink={
          <Link
            href="/login"
            className="inline-flex items-center min-h-[44px] font-medium text-ui-text underline underline-offset-2"
          >
            {REGISTER_LABELS.toLogin}
          </Link>
        }
        proof={{
          kind: 'code',
          label: LOGIN_LABELS.code,
          placeholder: LOGIN_LABELS.codePlaceholder,
          hint: REGISTER_LABELS.codeHint,
          uppercase: true,
          prefix: CLAIM_PROOF.code(''),
          initial: code?.trim().toUpperCase(),
        }}
      />
    </AuthShell>
  )
}
