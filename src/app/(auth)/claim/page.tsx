import Link from 'next/link'
import { connection } from 'next/server'
import { authLabelsFor } from '@bitbaum/accountkit/auth'
import { ClaimForm } from '@/components/auth/AuthForms'
import { aozMethods } from '@/lib/auth/methods'
import { CLAIM_PROOF, sharedAuthEnabled } from '@/lib/auth/shared/runtime'
import { REGISTER_LABELS } from '@/lib/constants/labels'
import { ClaimScreen } from './ClaimScreen'

type Props = { searchParams: Promise<{ token?: string }> }

/**
 * /claim?token=…: a colleague takes over the account provisioned for them.
 * The link is checked and greets them by name; with the shared runtime the
 * form is AccountKit's ClaimForm for this link (AOZ's provisioning takes the
 * link once).
 */
export default async function ClaimPage({ searchParams }: Props) {
  await connection()
  const { token } = await searchParams
  const accountkit =
    sharedAuthEnabled() && token ? (
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
        proof={{ kind: 'given', credential: CLAIM_PROOF.link(token) }}
      />
    ) : undefined
  return <ClaimScreen accountkit={accountkit} />
}
