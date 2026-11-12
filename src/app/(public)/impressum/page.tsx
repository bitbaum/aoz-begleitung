import type { Metadata } from 'next'
import { LegalPage } from '@/components/marketing/LegalPage'
import { IMPRESSUM_COPY as C } from '@/lib/config/legal'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: C.title,
  description: C.lead,
}

/** Who runs this site. Rendered from config/legal.ts; no account needed. */
export default function ImpressumPage() {
  return <LegalPage eyebrow={C.eyebrow} title={C.title} lead={C.lead} sections={C.sections} />
}
