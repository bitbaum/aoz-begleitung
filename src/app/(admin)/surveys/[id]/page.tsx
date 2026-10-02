import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/role-policy'
import { idSchema } from '@/lib/validation/schemas'
import { getSurveyDetail, getSurveyResults } from '@/lib/surveys/staff-data'
import { loadAudienceOptions } from '@/lib/surveys/audience'
import { residentName } from '@/lib/utils/resident-name'
import { formatDate } from '@/lib/utils'
import {
  SURVEY_LABELS as L,
  SURVEY_STATUS_BADGE,
  SURVEY_STATUS_LABELS,
} from '@/lib/constants/labels/surveys'
import { PageHeader, PageShell, SectionHeader } from '@/components/ui/Page'
import { CloseSurveyForm, SendSurveyForm } from '@/components/surveys/SurveyForms'
import { SurveyResultsView } from '@/components/surveys/SurveyResultsView'

export const metadata: Metadata = { title: 'Umfrage' }
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

/**
 * One survey: who it goes to, and what came back — in aggregate, under the k
 * rule. There is deliberately no list of who answered and no single response:
 * neither exists in a form this page could show.
 */
export default async function SurveyDetailPage({ params }: Props) {
  const viewer = await requirePermission('surveys:read')
  const canWrite = hasPermission(viewer, 'surveys:write')

  const { id } = await params
  const parsedId = idSchema.safeParse(id)
  if (!parsedId.success) notFound()
  const survey = await getSurveyDetail(parsedId.data)
  if (!survey) notFound()

  const [results, audience] = await Promise.all([
    getSurveyResults(survey),
    canWrite && survey.status !== 'CLOSED' ? loadAudienceOptions(viewer) : Promise.resolve(null),
  ])

  return (
    <PageShell>
      <PageHeader
        eyebrow={SURVEY_STATUS_LABELS[survey.status]}
        title={survey.title}
        description={survey.intro ?? undefined}
        backHref="/surveys"
        backLabel={L.back}
      />

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card">
          <dt className="eyebrow">{L.status}</dt>
          <dd className="mt-2">
            <span className={SURVEY_STATUS_BADGE[survey.status]}>
              {SURVEY_STATUS_LABELS[survey.status]}
            </span>
          </dd>
        </div>
        <div className="card">
          <dt className="eyebrow">{L.invited}</dt>
          <dd className="metric mt-1">{survey.invited}</dd>
        </div>
        <div className="card">
          <dt className="eyebrow">{L.answered}</dt>
          <dd className="metric mt-1">{survey.answered}</dd>
        </div>
        <div className="card">
          <dt className="eyebrow">{survey.closedAt ? L.closed : L.opened}</dt>
          <dd className="numeric mt-2 text-sm text-ui-text">
            {survey.closedAt
              ? formatDate(survey.closedAt)
              : survey.openedAt
                ? formatDate(survey.openedAt)
                : '—'}
          </dd>
        </div>
      </dl>

      {audience && (
        <section className="space-y-3">
          <SectionHeader title={L.audienceTitle} description={L.audienceDescription} />
          <div className="card">
            <SendSurveyForm
              surveyId={survey.id}
              isDraft={survey.status === 'DRAFT'}
              groups={audience.groups}
              clients={audience.clients.map((client) => ({
                id: client.id,
                name: residentName(client),
              }))}
            />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeader title={L.resultsTitle} description={L.resultsAnonymity} />
        <SurveyResultsView results={results} />
      </section>

      {canWrite && survey.status === 'OPEN' && <CloseSurveyForm surveyId={survey.id} />}
    </PageShell>
  )
}
