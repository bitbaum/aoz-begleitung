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
import { formatDate } from '@/lib/utils'
import { residentName } from '@/lib/utils/resident-name'
import { ROLE_LABELS } from '@/lib/constants/labels'
import { LearningRecordActions } from '@/components/residents/LearningRecordActions'
import { deleteLearningRecord, updateLearningRecord } from '@/lib/actions/learning'

type ResidentSummary = {
  id: string
  code: string
  displayName: string | null
  supportLevel: string | null
  placements: { housingUnit: { code: string } }[]
}

export type LearningBoardRecord = LearningRecord & {
  resident: ResidentSummary
  recordedByUser?: { role: string } | null
  fromApplication?: { id: string } | null
}

interface IntegrationBoardProps {
  records: LearningBoardRecord[]
  emptyLabel: string
  emptyAction?: React.ReactNode
  /** Staff who may write learning get edit and delete on every card. */
  canWrite?: boolean
}

function statusBadge(status: string): string {
  if (status === 'COMPLETED') return 'badge badge-active'
  if (status === 'IN_PROGRESS') return 'badge badge-pending'
  if (status === 'PLANNED') return 'badge'
  return 'badge badge-inactive'
}

export function IntegrationBoard({
  records,
  emptyLabel,
  emptyAction,
  canWrite = false,
}: IntegrationBoardProps) {
  if (records.length === 0) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ui-muted">{emptyLabel}</p>
        {emptyAction ? <div className="mt-4 flex justify-center">{emptyAction}</div> : null}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {records.map((record) => {
        const unitCode = record.resident.placements[0]?.housingUnit.code
        return (
          <article
            key={record.id}
            className="card flex flex-col gap-3 border border-ui-border hover:border-brand-primary/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-xs ${statusBadge(record.status)}`}>
                    {LEARNING_STATUS_LABELS[record.status as LearningStatusId]}
                  </span>
                  <span className="chip chip-neutral text-xs">
                    {LEARNING_KIND_LABELS[record.kind as LearningKindId]}
                  </span>
                  <span className="chip chip-neutral text-xs">
                    {learningAttribution(record, record.recordedByUser, ROLE_LABELS)}
                  </span>
                </div>
                <h3 className="font-semibold text-ui-text truncate">{record.title}</h3>
                <p className="text-sm text-ui-muted mt-1">
                  <Link
                    href={`/residents/${record.resident.id}`}
                    className="font-medium hover:underline text-ui-text"
                  >
                    {residentName(record.resident)}
                  </Link>
                  {/* resident-code-intentional — staff often identify dossiers by login code */}
                  <span className="ml-2 font-mono text-xs">{record.resident.code}</span>
                  {unitCode ? ` · ${unitCode}` : ` · ${LEARNING_LABELS.unitUnknown}`}
                </p>
              </div>
              <Link
                href={`/residents/${record.resident.id}`}
                className="btn-outline text-sm min-h-[44px] inline-flex items-center shrink-0"
              >
                {LEARNING_LABELS.openResident}
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {record.provider && (
                <div>
                  <p className="text-xs text-ui-muted">{LEARNING_LABELS.provider}</p>
                  <p className="text-ui-text">{record.provider}</p>
                </div>
              )}
              {record.category && (
                <div>
                  <p className="text-xs text-ui-muted">{LEARNING_LABELS.category}</p>
                  <p className="text-ui-text">
                    {LEARNING_CATEGORY_LABELS[record.category as LearningCategoryId] ||
                      record.category}
                  </p>
                </div>
              )}
              {record.cefrLevel && (
                <div>
                  <p className="text-xs text-ui-muted">{LEARNING_LABELS.cefr}</p>
                  <p className="text-ui-text">
                    {record.languageCode || '—'} {record.cefrLevel}
                  </p>
                </div>
              )}
              {record.hours != null && (
                <div>
                  <p className="text-xs text-ui-muted">{LEARNING_LABELS.hours}</p>
                  <p className="text-ui-text">{record.hours}</p>
                </div>
              )}
              {record.startedAt && (
                <div>
                  <p className="text-xs text-ui-muted">{LEARNING_LABELS.startedAt}</p>
                  <p className="text-ui-text">{formatDate(record.startedAt)}</p>
                </div>
              )}
              {record.completedAt && (
                <div>
                  <p className="text-xs text-ui-muted">{LEARNING_LABELS.completedAt}</p>
                  <p className="text-ui-text">{formatDate(record.completedAt)}</p>
                </div>
              )}
            </div>

            {record.notes && (
              <div className="rounded-lg bg-ui-subtle p-3">
                <p className="text-xs text-ui-muted mb-1">{LEARNING_LABELS.notes}</p>
                <p className="text-sm text-ui-text whitespace-pre-wrap">{record.notes}</p>
              </div>
            )}

            {record.fromApplication ? (
              <p className="text-xs text-ui-muted">{LEARNING_LABELS.generatedFromOpportunity}</p>
            ) : null}

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
          </article>
        )
      })}
    </div>
  )
}
