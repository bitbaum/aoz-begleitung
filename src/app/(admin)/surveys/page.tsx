import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePermission } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/role-policy'
import { listSurveys } from '@/lib/surveys/staff-data'
import {
  SURVEY_LABELS as L,
  SURVEY_STATUS_BADGE,
  SURVEY_STATUS_LABELS,
} from '@/lib/constants/labels/surveys'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, ListShell, PageHeader, PageShell } from '@/components/ui/Page'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Umfragen' }
export const dynamic = 'force-dynamic'

export default async function SurveysPage() {
  const viewer = await requirePermission('surveys:read')
  const canWrite = hasPermission(viewer, 'surveys:write')
  const surveys = await listSurveys()

  const newButton = canWrite ? (
    <ButtonLink href="/surveys/new" variant="secondary">
      {L.newSurvey}
    </ButtonLink>
  ) : undefined

  return (
    <PageShell>
      <PageHeader title={L.listTitle} description={L.listDescription} actions={newButton} />
      {surveys.length === 0 ? (
        <EmptyState title={L.emptyTitle} description={L.emptyDescription} action={newButton} />
      ) : (
        <ListShell>
          <ul>
            {surveys.map((survey) => (
              <li key={survey.id} className="border-b border-ui-border last:border-b-0">
                <Link
                  href={`/surveys/${survey.id}`}
                  className="flex min-h-[44px] flex-col gap-2 p-4 hover:bg-ui-subtle sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ui-text">{survey.title}</p>
                    <p className="text-xs text-ui-muted mt-1">
                      {L.created} {formatDate(survey.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-sm">
                    <span className={SURVEY_STATUS_BADGE[survey.status]}>
                      {SURVEY_STATUS_LABELS[survey.status]}
                    </span>
                    <span className="numeric text-ui-muted">
                      {L.invited} {survey.invited}
                    </span>
                    <span className="numeric text-ui-muted">
                      {L.answered} {survey.answered}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </ListShell>
      )}
    </PageShell>
  )
}
