import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/marketing/LegalPage'
import {
  LEGAL_LABELS,
  PRIVACY_COPY as C,
  PROCESSORS,
  PROCESSORS_SECTION_ID,
} from '@/lib/config/legal'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: C.title,
  description: C.lead,
}

/**
 * What this site does with personal data. Rendered from config/legal.ts; the
 * AI providers in the list come from the same config as /ki-datenschutz.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow={C.eyebrow}
      title={C.title}
      lead={C.lead}
      sections={C.sections}
      slots={{
        [PROCESSORS_SECTION_ID]: (
          <>
            <ul className="mt-3 space-y-2 text-ui-text">
              {PROCESSORS.map((processor) => (
                <li key={processor.name}>
                  <strong>
                    {processor.name} ({processor.country})
                  </strong>{' '}
                  — {processor.role}
                </li>
              ))}
            </ul>
            <p className="mt-3">
              <Link href={LEGAL_LABELS.aiHref} className="underline">
                {LEGAL_LABELS.aiLink}
              </Link>
            </p>
          </>
        ),
      }}
    />
  )
}
