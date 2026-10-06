import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireResidentCookie } from '@/lib/portal-auth'
import { PageHeader, EmptyState } from '@/components/ui/Page'
import { LearningForm } from '@/components/residents/LearningForm'
import { LearningRecordActions } from '@/components/residents/LearningRecordActions'
import {
  createOwnLearningRecord,
  deleteOwnLearningRecord,
  listResidentLearningEvidence,
  updateOwnLearningRecord,
} from '@/lib/actions/learning'
import { getRequestTranslator } from '@/lib/i18n/request'
import { listActivities } from '@/lib/data/activities'
import { isAchievementRecord, mayChangeLearningRecord } from '@/lib/config/learning'
import { activityCostLabel } from '@/lib/i18n/activity-labels'
import {
  learningActionCopy,
  learningAttributionForClient,
  learningFormCopy,
  learningKindLabel,
  learningStatusLabel,
} from '@/lib/i18n/learning-labels'
import type { Translator } from '@/lib/i18n'
import type { LearningRecord } from '@/lib/db'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestTranslator()
  return { title: t('nav.learning') }
}
export const dynamic = 'force-dynamic'

type PortalLearningRecord = LearningRecord & { recordedByUser?: { role: string } | null }

export default async function PortalLearningPage() {
  await requireResidentCookie('/portal')
  const { t, locale } = await getRequestTranslator()
  const [resident, languageOffers] = await Promise.all([
    listResidentLearningEvidence(),
    listActivities({
      publishedOnly: true,
      category: 'LANGUAGE',
      activeOn: new Date(),
      take: 8,
    }),
  ])
  if (!resident) redirect('/portal')

  const records = resident.learningRecords as PortalLearningRecord[]
  const formCopy = learningFormCopy(t, locale)
  const actionCopy = learningActionCopy(t)

  // Four disjoint lists: a record appears exactly once, so editing it in one
  // place cannot leave a stale twin further down the page.
  const achievements = records.filter(isAchievementRecord)
  const rest = records.filter((record) => !isAchievementRecord(record))
  const inProgress = rest.filter((record) => record.status === 'IN_PROGRESS')
  const settled = rest.filter((record) => record.status !== 'IN_PROGRESS')
  const fromTeam = settled.filter((record) => record.recordedBy === 'STAFF')
  const fromYou = settled.filter((record) => record.recordedBy === 'RESIDENT')

  const item = (record: PortalLearningRecord) => (
    <RecordItem
      key={record.id}
      record={record}
      residentId={resident.id}
      t={t}
      formCopy={formCopy}
      actionCopy={actionCopy}
    />
  )

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          title={t('learning.title')}
          description={t('learning.subtitle')}
          backHref="/portal"
          backLabel={t('nav.overview')}
        />
      </div>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-ui-text mb-3">{t('learning.achievements')}</h2>
        {achievements.length === 0 ? (
          <EmptyState
            title={t('learning.achievementsEmpty')}
            action={
              <Link
                href="#learning-evidence"
                className="btn-outline min-h-[44px] inline-flex items-center"
              >
                {t('learning.add')}
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">{achievements.map(item)}</ul>
        )}
      </section>

      {inProgress.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-ui-text mb-3">{t('learning.inProgress')}</h2>
          <ul className="space-y-3">{inProgress.map(item)}</ul>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-ui-text mb-3">{t('learning.fromTeam')}</h2>
        {fromTeam.length === 0 ? (
          <p className="text-sm text-ui-muted">{t('learning.fromTeamEmpty')}</p>
        ) : (
          <ul className="space-y-3">{fromTeam.map(item)}</ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-ui-text mb-3">{t('learning.fromYou')}</h2>
        {fromYou.length === 0 ? (
          <p className="text-sm text-ui-muted">{t('learning.fromYouEmpty')}</p>
        ) : (
          <ul className="space-y-3">{fromYou.map(item)}</ul>
        )}
      </section>

      <section className="mb-8">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold text-ui-text">{t('learning.offers')}</h2>
          <Link
            href="/portal/activities"
            className="text-sm text-brand-primary hover:underline min-h-[44px] inline-flex items-center"
          >
            {t('nav.activities')}
          </Link>
        </div>
        {languageOffers.length === 0 ? (
          <EmptyState
            title={t('learning.offersEmpty')}
            action={
              <Link
                href="/portal/activities"
                className="btn-outline min-h-[44px] inline-flex items-center"
              >
                {t('nav.activities')}
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {languageOffers.map((offer) => (
              <li key={offer.id} className="card">
                <p className="font-medium text-ui-text">{offer.title}</p>
                <p className="text-sm text-ui-muted mt-1">{offer.description}</p>
                <p className="text-xs text-ui-muted mt-2">
                  {activityCostLabel(t, offer.cost)}
                  {offer.schedule ? ` · ${offer.schedule}` : ''}
                  {offer.location ? ` · ${offer.location}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="card" id="learning-evidence">
        <h2 className="text-lg font-semibold text-ui-text mb-1">{t('learning.evidenceTitle')}</h2>
        <p className="text-sm text-ui-muted mb-4">{t('learning.evidenceSubtitle')}</p>
        <LearningForm
          action={createOwnLearningRecord}
          copy={formCopy}
          audience="resident"
          successMessage={t('learning.evidenceSaved')}
        />
      </div>
    </div>
  )
}

function RecordItem({
  record,
  residentId,
  t,
  formCopy,
  actionCopy,
}: {
  record: PortalLearningRecord
  residentId: string
  t: Translator
  formCopy: ReturnType<typeof learningFormCopy>
  actionCopy: ReturnType<typeof learningActionCopy>
}) {
  // Only what the client entered themselves; the server asks the same question.
  const mayChange = mayChangeLearningRecord({ kind: 'resident', residentId }, record)

  return (
    <li className="card">
      <p className="font-medium text-ui-text">{record.title}</p>
      <p className="text-sm text-ui-muted">
        {learningKindLabel(t, record.kind)}
        {record.cefrLevel ? ` · ${record.languageCode || ''} ${record.cefrLevel}` : ''}
        {' · '}
        {learningStatusLabel(t, record.status)}
        {record.hours != null ? ` · ${record.hours} ${t('learning.hours')}` : ''}
        {record.provider ? ` · ${record.provider}` : ''}
      </p>
      <p className="text-xs text-ui-muted mt-1">
        {learningAttributionForClient(t, record, record.recordedByUser)}
      </p>
      {mayChange ? (
        <LearningRecordActions
          record={record}
          formCopy={formCopy}
          copy={actionCopy}
          audience="resident"
          updateAction={updateOwnLearningRecord}
          deleteAction={deleteOwnLearningRecord}
        />
      ) : null}
    </li>
  )
}
