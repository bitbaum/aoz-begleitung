import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader, EmptyState, ListShell } from '@/components/ui/Page'
import { requirePermission } from '@/lib/auth'
import { staffInbox } from '@/lib/messaging/queries'
import { residentName } from '@/lib/utils/resident-name'
import { formatDateTime } from '@/lib/utils/formatting'
import { MESSAGES_LABELS } from '@/lib/constants/labels'

export const metadata: Metadata = { title: MESSAGES_LABELS.inboxTitle }

export const dynamic = 'force-dynamic'

/**
 * Every resident conversation, the ones waiting longest first.
 *
 * Sorted by how long somebody has been waiting rather than by recent activity:
 * a question from four days ago matters more than one from an hour ago, and
 * "newest first" buries precisely the person nobody has got back to.
 */
export default async function StaffMessagesPage() {
  // A resident writes to "die Betreuung" about their housing, and every thread
  // here is that conversation. This page had no permission check at all — the
  // only `(admin)` list page without one — so a Jobcoach or the Freiwilligen-
  // arbeit coordinator could read all of it. The session guard in `proxy.ts`
  // proves somebody is staff; it cannot say which staff, and this is precisely
  // a surface where that difference is the whole point.
  const staff = await requirePermission('messages:read')

  const threads = await staffInbox(staff)
  const waiting = threads.filter((thread) => thread.unreadCount > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title={MESSAGES_LABELS.inboxTitle}
        description={
          waiting.length > 0
            ? `${waiting.length} ${MESSAGES_LABELS.waitingSuffix}`
            : MESSAGES_LABELS.allAnswered
        }
      />

      {threads.length === 0 ? (
        <EmptyState title={MESSAGES_LABELS.empty} />
      ) : (
        <ListShell>
          <div className="divide-y divide-ui-border">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                href={`/messages/${thread.resident.id}`}
                className="flex items-start justify-between gap-4 p-4 hover:bg-ui-subtle transition-colors min-h-[44px]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ui-text">
                      {residentName(thread.resident)}
                    </span>
                    {thread.unreadCount > 0 && (
                      <span className="chip-warning">{thread.unreadCount}</span>
                    )}
                  </div>
                  <p className="text-sm text-ui-muted mt-1 line-clamp-1">
                    {thread.lastMessagePreview}
                  </p>
                </div>

                <span className="numeric text-sm text-ui-muted shrink-0">
                  {formatDateTime(thread.waitingSince ?? thread.lastMessageAt)}
                </span>
              </Link>
            ))}
          </div>
        </ListShell>
      )}
    </div>
  )
}
