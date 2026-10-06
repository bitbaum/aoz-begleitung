import Link from 'next/link'
import type { LearningRecord } from '@/lib/db'
import {
  LEARNING_CATEGORY_LABELS,
  LEARNING_KIND_LABELS,
  LEARNING_LABELS,
  LEARNING_STATUS_LABELS,
  STAFF_LEARNING_ACTION_COPY,
  STAFF_LEARNING_FORM_COPY,
  learningAttribution,
  type LearningCategoryId,
  type LearningKindId,
  type LearningStatusId,
} from '@/lib/config/learning'
import { ROLE_LABELS } from '@/lib/constants/labels'
import { LearningForm } from './LearningForm'
import { LearningRecordActions } from './LearningRecordActions'
import {
  createLearningRecordForResident,
  deleteLearningRecord,
  updateLearningRecord,
} from '@/lib/actions/learning'
import { formatDate } from '@/lib/utils'

export type DossierLearningRecord = LearningRecord & {
  recordedByUser?: { role: string } | null
  fromApplication?: { id: string } | null
}

interface Props {
  residentId: string
  records: DossierLearningRecord[]
  canWrite: boolean
}

export function LearningRecordsCard({ residentId, records, canWrite }: Props) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-ui-text">{LEARNING_LABELS.boardTitle}</h2>
        <Link
          href="/learning"
          className="text-sm text-brand-primary hover:underline min-h-[44px] inline-flex items-center"
        >
          {LEARNING_LABELS.subtitle.split('—')[0]}
        </Link>
      </div>

      {records.length === 0 ? (
        <p className="text-sm text-ui-muted mb-4">{LEARNING_LABELS.empty}</p>
      ) : (
        <ul className="space-y-3 mb-6">
          {records.map((record) => (
            <li key={record.id} className="border border-ui-border rounded-lg p-3">
              <p className="font-medium text-ui-text">{record.title}</p>
              <p className="text-sm text-ui-muted">
                {LEARNING_KIND_LABELS[record.kind as LearningKindId]}
                {record.cefrLevel ? ` · ${record.languageCode || ''} ${record.cefrLevel}` : ''}
                {record.category
                  ? ` · ${LEARNING_CATEGORY_LABELS[record.category as LearningCategoryId] || record.category}`
                  : ''}
                {' · '}
                {LEARNING_STATUS_LABELS[record.status as LearningStatusId]}
              </p>
              {record.completedAt && (
                <p className="text-xs text-ui-muted mt-1">
                  {LEARNING_LABELS.completedAt}: {formatDate(record.completedAt)}
                </p>
              )}
              {record.hours != null && (
                <p className="text-xs text-ui-muted mt-1">
                  {LEARNING_LABELS.hours}: {record.hours}
                </p>
              )}
              <p className="text-xs text-ui-muted mt-1">
                {learningAttribution(record, record.recordedByUser, ROLE_LABELS)}
                {record.fromApplication ? ` · ${LEARNING_LABELS.generatedFromOpportunity}` : ''}
              </p>
              {canWrite ? (
                <LearningRecordActions
                  record={record}
                  formCopy={STAFF_LEARNING_FORM_COPY}
                  copy={STAFF_LEARNING_ACTION_COPY}
                  audience="staff"
                  updateAction={updateLearningRecord}
                  deleteAction={deleteLearningRecord}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <details className="group">
          <summary className="min-h-[44px] cursor-pointer text-sm font-medium text-brand-primary list-none">
            {LEARNING_LABELS.add}
          </summary>
          <div className="mt-4">
            <LearningForm
              action={createLearningRecordForResident}
              copy={STAFF_LEARNING_FORM_COPY}
              residentId={residentId}
              audience="staff"
              successMessage={LEARNING_LABELS.updated}
            />
          </div>
        </details>
      )}
    </div>
  )
}
