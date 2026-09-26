'use client'

import Link from 'next/link'
import { Home, Languages, TriangleAlert } from 'lucide-react'
import {
  AGE_RANGE_LABELS,
  GENDER_LABELS_SHORT,
  RESIDENT_STATUS_LABELS,
  RESIDENT_LIST_LABELS,
  LANGUAGE_LABELS,
  getLabel,
} from '@/lib/constants'
import { getStatusBadgeClass, formatDate } from '@/lib/utils'
import { ResidentCardActions } from '@/components/residents/ResidentCardActions'
import { EmptyState, ListShell } from '@/components/ui/Page'
import { residentInitials, residentName } from '@/lib/utils/resident-name'

export interface ResidentListItem {
  id: string
  code: string
  displayName: string | null
  /**
   * REQUIRED, for the same reason `displayName` is: a missing field means the
   * query never asked, and the fallback would then quietly present a seeded
   * profile as a client. Marking it optional would let any list forget to
   * select it and still compile.
   */
  isPlaceholder: boolean
  ageRange: string
  gender: string
  status: string
  languages: string[]
  createdAt: Date | string
  placements: {
    housingUnit: {
      code: string
    }
  }[]
  incidentCount: number
}

export function ResidentsList({
  residents,
  canWrite = true,
}: {
  residents: ResidentListItem[]
  canWrite?: boolean
}) {
  if (residents.length === 0) {
    return (
      <EmptyState
        title={RESIDENT_LIST_LABELS.emptyDefault}
        description="Neue Klient*innen werden über den Erfassungsprozess angelegt und erscheinen danach hier."
      />
    )
  }

  return (
    <ListShell>
      <div className="divide-y divide-ui-border">
        {residents.map((resident) => (
          <ResidentRow key={resident.id} resident={resident} canWrite={canWrite} />
        ))}
      </div>
    </ListShell>
  )
}

function ResidentRow({ resident, canWrite }: { resident: ResidentListItem; canWrite: boolean }) {
  const currentPlacement = resident.placements[0]
  const languages = resident.languages
    .slice(0, 3)
    .map((lang) => getLabel(LANGUAGE_LABELS, lang, lang))
    .join(', ')

  return (
    <div className="group grid gap-3 px-4 py-4 transition-colors hover:bg-ui-subtle/70 md:grid-cols-[minmax(220px,1.2fr)_minmax(180px,1fr)_minmax(160px,0.8fr)_auto] md:items-center">
      <Link href={`/residents/${resident.id}`} className="min-w-0">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ui-border bg-ui-subtle font-mono text-xs font-semibold text-ui-text">
            {residentInitials(resident)}
          </span>
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-semibold text-ui-text group-hover:text-brand-primary">
                {residentName(resident)}
              </span>
              {/*
                A seeded profile waiting to be claimed must never be mistaken
                for someone who needs support. Without this, "Amir" reads
                exactly like a real client on the same screen, and a Betreuerin could
                open a case, record a check-in, or chase a person who does not
                exist yet.
              */}
              {resident.isPlaceholder && (
                <span className="chip-neutral shrink-0">{RESIDENT_LIST_LABELS.placeholder}</span>
              )}
            </span>
            <span className="block truncate text-sm text-ui-muted">
              {getLabel(AGE_RANGE_LABELS, resident.ageRange)} ·{' '}
              {getLabel(GENDER_LABELS_SHORT, resident.gender)}
            </span>
          </span>
        </div>
      </Link>

      <div className="min-w-0 text-sm">
        {currentPlacement ? (
          <span className="inline-flex items-center gap-2 text-ui-muted">
            <Home className="h-4 w-4" />
            {currentPlacement.housingUnit.code}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 text-status-warning-text">
            <TriangleAlert className="h-4 w-4" />
            {RESIDENT_LIST_LABELS.notPlaced}
          </span>
        )}
      </div>

      <div className="min-w-0 text-sm text-ui-muted">
        {languages ? (
          <span className="inline-flex max-w-full items-center gap-2">
            <Languages className="h-4 w-4 shrink-0" />
            <span className="truncate">{languages}</span>
          </span>
        ) : (
          <span>Erfasst: {formatDate(resident.createdAt)}</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 md:justify-end">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge ${getStatusBadgeClass(resident.status)}`}>
            {getLabel(RESIDENT_STATUS_LABELS, resident.status)}
          </span>
          {resident.incidentCount > 0 ? (
            <span className="text-xs text-status-warning-text">
              {resident.incidentCount} {RESIDENT_LIST_LABELS.recentIncidentsSuffix}
            </span>
          ) : null}
        </div>
        <ResidentCardActions
          residentId={resident.id}
          status={resident.status}
          canWrite={canWrite}
        />
      </div>
    </div>
  )
}
