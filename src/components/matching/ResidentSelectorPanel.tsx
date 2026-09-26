import Link from 'next/link'
import type { Resident } from '@/lib/db'
import type { ResidentWithPlacement } from '@/lib/matching/types'
import {
  AGE_RANGE_LABELS,
  LANGUAGE_LABELS,
  EMPTY_STATE_LABELS,
  MATCHING_LABELS,
  getLabel,
} from '@/lib/constants'
import { DISPLAY_LIMITS } from '@/lib/config/thresholds'
import { residentInitials, residentName } from '@/lib/utils/resident-name'

interface Props {
  filteredUnplacedResidents: Resident[]
  totalUnplaced: number
  placedResidents: ResidentWithPlacement[]
  totalResidentCount: number
  residentQuery: string
  params: { resident?: string; unit?: string; new?: string; q?: string }
}

export function ResidentSelectorPanel({
  filteredUnplacedResidents,
  totalUnplaced,
  placedResidents,
  totalResidentCount,
  residentQuery,
  params,
}: Props) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-ui-text mb-4">
        {MATCHING_LABELS.unplacedResidents} ({filteredUnplacedResidents.length}/{totalUnplaced})
      </h2>

      <form className="mb-3">
        <div className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={params.q || ''}
            placeholder={MATCHING_LABELS.searchPlaceholder}
            className="input flex-1"
          />
          <button type="submit" className="btn-outline text-sm min-h-[44px]">
            {MATCHING_LABELS.search}
          </button>
        </div>
        {params.resident && <input type="hidden" name="resident" value={params.resident} />}
        {params.unit && <input type="hidden" name="unit" value={params.unit} />}
        {params.new && <input type="hidden" name="new" value={params.new} />}
      </form>

      {filteredUnplacedResidents.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-ui-muted">
            {totalResidentCount === 0
              ? EMPTY_STATE_LABELS.noResidentsAtAll
              : residentQuery
                ? MATCHING_LABELS.noResidentsFound
                : EMPTY_STATE_LABELS.allResidentsPlaced}
          </p>
          {totalResidentCount === 0 && (
            <Link href="/residents/new" className="btn-outline mt-4 inline-block">
              {EMPTY_STATE_LABELS.createResident}
            </Link>
          )}
        </div>
      ) : (
        /* Labelled region: the panel shows unplaced *and* placed residents, and
           they mean different things — a screen-reader user (and a test) needs
           to be able to tell which list a resident is in. */
        <section aria-label={MATCHING_LABELS.unplacedResidents} className="space-y-2">
          {filteredUnplacedResidents.map((resident) => (
            <div
              key={resident.id}
              className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border transition-colors ${
                params.resident === resident.id
                  ? 'border-brand-primary bg-brand-primary/5'
                  : 'border-ui-border'
              }`}
            >
              <Link
                href={`/residents/${resident.id}`}
                className="flex min-w-0 items-center gap-3 flex-1 hover:opacity-80"
              >
                <div className="avatar-sm">{residentInitials(resident)}</div>
                <div className="min-w-0">
                  <p className="inline-flex items-center py-2 -my-2 font-medium text-ui-text hover:text-brand-primary">
                    {residentName(resident)}
                  </p>
                  <p className="text-sm text-ui-muted">
                    {getLabel(AGE_RANGE_LABELS, resident.ageRange)} ·{' '}
                    {(resident.languages ?? [])
                      .slice(0, DISPLAY_LIMITS.languagePreview)
                      .map((l) => getLabel(LANGUAGE_LABELS, l))
                      .join(', ')}
                  </p>
                </div>
              </Link>
              {/* A real button: the grey fill it used to have read as disabled. */}
              <Link
                href={`/matching?resident=${resident.id}`}
                className={params.resident === resident.id ? 'btn-secondary' : 'btn-outline'}
              >
                {params.resident === resident.id
                  ? MATCHING_LABELS.selected
                  : MATCHING_LABELS.findUnitAction}
              </Link>
            </div>
          ))}
        </section>
      )}

      {/* Placed residents section */}
      {placedResidents.length > 0 && (
        <div className="mt-6 pt-6 border-t border-ui-border">
          <h3 className="text-md font-semibold text-ui-muted mb-3">
            {MATCHING_LABELS.placedResidents} ({placedResidents.length})
          </h3>
          <p className="text-xs text-ui-muted mb-3">{MATCHING_LABELS.selectForAnalysis}</p>
          <section aria-label={MATCHING_LABELS.placedResidents} className="space-y-2">
            {placedResidents.map((resident) => (
              <div
                key={resident.id}
                className={`flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg border transition-colors ${
                  params.resident === resident.id
                    ? 'border-brand-primary bg-brand-primary/5'
                    : 'border-ui-border'
                }`}
              >
                <Link
                  href={`/residents/${resident.id}`}
                  className="flex items-center gap-2 flex-1 hover:opacity-80"
                >
                  <div className="avatar-sm">{residentInitials(resident)}</div>
                  <div>
                    <p className="text-sm font-medium text-ui-text">{residentName(resident)}</p>
                    <p className="text-xs text-ui-muted">
                      {resident.placements[0]?.housingUnit?.code || MATCHING_LABELS.placed}
                    </p>
                  </div>
                </Link>
                <Link
                  href={`/matching?resident=${resident.id}`}
                  className={params.resident === resident.id ? 'btn-secondary' : 'btn-outline'}
                >
                  {MATCHING_LABELS.compare}
                </Link>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  )
}
