import type { Metadata } from 'next'
import { APP_LABELS, CLAIM_LABELS } from '@/lib/constants/labels'

export const metadata: Metadata = {
  title: CLAIM_LABELS.title,
  description: APP_LABELS.metaDescription,
}

export default function ClaimLayout({ children }: { children: React.ReactNode }) {
  return children
}
