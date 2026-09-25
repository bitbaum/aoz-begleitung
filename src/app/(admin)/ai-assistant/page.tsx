import type { Metadata } from 'next'
import { AIChatInterface } from '@/components/ai/AIChatInterface'
import { PageHeader } from '@/components/ui/Page'
import { AiBadge } from '@/components/ai/AiBadge'
import { AI_ASSISTANT_LABELS } from '@/lib/constants'
import { requirePermission } from '@/lib/auth'

export const metadata: Metadata = { title: 'KI-Assistent' }

export default async function AIAssistantPage() {
  await requirePermission('ai:assist')
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <PageHeader
          title="KI-Assistent"
          description={AI_ASSISTANT_LABELS.subtitle}
          actions={<AiBadge />}
        />
      </div>
      <div className="card">
        <AIChatInterface />
      </div>
    </div>
  )
}
