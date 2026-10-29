import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/ui/Page'
import { StaffReplyThread } from '@/components/messaging/StaffReplyThread'
import {
  getOrCreateThread,
  loadThreadMessages,
  markThreadRead,
  findMessageResident,
} from '@/lib/messaging/queries'
import { requirePermission } from '@/lib/auth'
import { residentName } from '@/lib/utils/resident-name'
import { MESSAGES_LABELS } from '@/lib/constants/labels'

export const metadata: Metadata = { title: MESSAGES_LABELS.threadTitle }

export const dynamic = 'force-dynamic'

export default async function StaffThreadPage({
  params,
}: {
  params: Promise<{ residentId: string }>
}) {
  const { residentId } = await params
  // The inbox is gated; the thread it links to must be too, or the
  // boundary is a link you can simply not click.
  const staff = await requirePermission('messages:read')

  const resident = await findMessageResident(residentId, staff)
  if (!resident) notFound()

  const thread = await getOrCreateThread(residentId)
  // Opening the conversation is reading it, so the inbox count reflects what
  // is actually outstanding rather than what has merely never been clicked.
  await markThreadRead(thread.id, { kind: 'staff', userId: staff.id })
  const messages = await loadThreadMessages(thread.id)

  return (
    <div className="space-y-6">
      <PageHeader
        title={residentName(resident)}
        description={MESSAGES_LABELS.languageHint}
        backHref="/messages"
      />
      <StaffReplyThread residentId={residentId} threadId={thread.id} initialMessages={messages} />
    </div>
  )
}
