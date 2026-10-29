import { DateInput } from '@/components/ui/DateInput'
import type { Metadata } from 'next'
import Link from 'next/link'
import { db, housingUnit, resident } from '@/lib/db'
import { ne, inArray, asc } from 'drizzle-orm'
import { createIncident } from '@/lib/actions'
import { requirePermission } from '@/lib/auth'

export const metadata: Metadata = { title: 'Neuer Vorfall' }
import {
  INCIDENT_TYPE_LABELS,
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_CATEGORY_ICONS,
  INCIDENT_SEVERITY_LABELS,
  INCIDENT_TYPES_BY_CATEGORY,
  INCIDENT_PAGE_LABELS,
  UI_LABELS,
} from '@/lib/constants'
import { SubmitButton } from '@/components/ui'
import { PageHeader } from '@/components/ui/Page'
import { getSeverityRadioClass, getSeverityDotClass } from '@/lib/utils'
import { residentName } from '@/lib/utils/resident-name'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{
    unit?: string
    reporter?: string
    subject?: string
    quick?: string
    category?: string
    type?: string
    severity?: string
    description?: string
  }>
}

export default async function NewIncidentPage({ searchParams }: Props) {
  await requirePermission('incidents:write')
  const params = await searchParams

  const [units, residents] = await Promise.all([
    db.query.housingUnit.findMany({
      where: ne(housingUnit.status, 'CLOSED'),
      orderBy: [asc(housingUnit.code)],
    }),
    db.query.resident.findMany({
      where: inArray(resident.status, ['ACTIVE', 'PLACED']),
      orderBy: [asc(resident.code)],
    }),
  ])

  const interpersonalTypes = INCIDENT_TYPES_BY_CATEGORY.INTERPERSONAL
  // Note: Maintenance requests go to /maintenance, not incidents

  const selectedCategory = params.category === 'SAFETY' ? 'SAFETY' : 'INTERPERSONAL'
  const selectedType = params.type || ''
  const selectedSeverity = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(params.severity || '')
    ? (params.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')
    : 'MEDIUM'
  const selectedDescription = params.description || ''

  const queryBase = new URLSearchParams()
  if (params.unit) queryBase.set('unit', params.unit)
  if (params.reporter) queryBase.set('reporter', params.reporter)
  if (params.subject) queryBase.set('subject', params.subject)

  const quickPresetHref = (preset: {
    quick: string
    category: 'INTERPERSONAL' | 'SAFETY'
    type: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    description: string
  }) => {
    const q = new URLSearchParams(queryBase)
    q.set('quick', preset.quick)
    q.set('category', preset.category)
    q.set('type', preset.type)
    q.set('severity', preset.severity)
    q.set('description', preset.description)
    return `/incidents/new?${q.toString()}`
  }

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          title={INCIDENT_PAGE_LABELS.newIncident}
          description={INCIDENT_PAGE_LABELS.newSubtitle}
          backHref="/incidents"
          backLabel={INCIDENT_PAGE_LABELS.backToList.replace(/^← /, '')}
        />
      </div>

      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ui-text">
              {INCIDENT_PAGE_LABELS.quickCapture}
            </h2>
            <p className="text-sm text-ui-muted">{INCIDENT_PAGE_LABELS.quickSubtitle}</p>
          </div>
          {params.quick && (
            <Link
              href={`/incidents/new?${queryBase.toString()}`}
              className="inline-flex items-center min-h-[44px] px-1 text-sm text-ui-muted hover:text-ui-muted"
            >
              {INCIDENT_PAGE_LABELS.resetPreset}
            </Link>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={quickPresetHref({
              quick: 'noise',
              category: 'INTERPERSONAL',
              type: 'NOISE_COMPLAINT',
              severity: 'MEDIUM',
              description: INCIDENT_PAGE_LABELS.presets.noiseDesc,
            })}
            className={`btn-outline min-h-[44px] inline-flex items-center ${params.quick === 'noise' ? 'bg-status-info/15 border-status-info/40 text-status-info-text' : ''}`}
          >
            {INCIDENT_PAGE_LABELS.presets.noiseLabel}
          </Link>
          <Link
            href={quickPresetHref({
              quick: 'aggression',
              category: 'INTERPERSONAL',
              type: 'VERBAL_ARGUMENT',
              severity: 'HIGH',
              description: INCIDENT_PAGE_LABELS.presets.escalationDesc,
            })}
            className={`btn-outline min-h-[44px] inline-flex items-center ${params.quick === 'aggression' ? 'bg-status-info/15 border-status-info/40 text-status-info-text' : ''}`}
          >
            {INCIDENT_PAGE_LABELS.presets.escalationLabel}
          </Link>
          <Link
            href={quickPresetHref({
              quick: 'safety',
              category: 'SAFETY',
              type: 'SAFETY_CONCERN',
              severity: 'HIGH',
              description: INCIDENT_PAGE_LABELS.presets.safetyDesc,
            })}
            className={`btn-outline min-h-[44px] inline-flex items-center ${params.quick === 'safety' ? 'bg-status-info/15 border-status-info/40 text-status-info-text' : ''}`}
          >
            {INCIDENT_PAGE_LABELS.presets.safetyLabel}
          </Link>
        </div>
      </div>

      <form action={createIncident} className="space-y-6">
        {/* Location & Attribution */}
        <div className="card">
          <h2 className="text-lg font-semibold text-ui-text mb-4">
            {INCIDENT_PAGE_LABELS.sectionLocation}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">{INCIDENT_PAGE_LABELS.fieldUnit}</label>
              <select
                name="housingUnitId"
                required
                defaultValue={params.unit || ''}
                className="input"
              >
                <option value="">{UI_LABELS.selectPlaceholder}</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.code} - {unit.address}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{INCIDENT_PAGE_LABELS.fieldReporter}</label>
              <select name="reportedById" defaultValue={params.reporter || ''} className="input">
                <option value="">{INCIDENT_PAGE_LABELS.fieldReporterUnknown}</option>
                {residents.map((resident) => (
                  <option key={resident.id} value={resident.id}>
                    {residentName(resident)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ui-muted mt-1">{INCIDENT_PAGE_LABELS.fieldReporterHint}</p>
            </div>
            <div>
              <label className="label">{INCIDENT_PAGE_LABELS.fieldSubject}</label>
              <select name="subjectId" defaultValue={params.subject || ''} className="input">
                <option value="">{INCIDENT_PAGE_LABELS.fieldSubjectUnknown}</option>
                {residents.map((resident) => (
                  <option key={resident.id} value={resident.id}>
                    {residentName(resident)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ui-muted mt-1">{INCIDENT_PAGE_LABELS.fieldSubjectHint}</p>
            </div>
          </div>
        </div>

        {/* Category & Type */}
        <div className="card">
          <h2 className="text-lg font-semibold text-ui-text mb-4">
            {INCIDENT_PAGE_LABELS.sectionCategory}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">{INCIDENT_PAGE_LABELS.fieldCategory}</label>
              <div className="flex gap-3">
                {/* Only INTERPERSONAL and SAFETY - Maintenance goes to /maintenance */}
                {(['INTERPERSONAL', 'SAFETY'] as const).map((key) => (
                  <label key={key} className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name="category"
                      value={key}
                      required
                      defaultChecked={selectedCategory === key}
                      className="sr-only peer"
                    />
                    <div className="p-4 text-center rounded-lg border-2 border-ui-border peer-checked:border-brand-primary peer-checked:bg-brand-primary/5 transition-colors">
                      <span className="text-2xl">{INCIDENT_CATEGORY_ICONS[key] || '💬'}</span>
                      <p className="font-medium text-ui-text mt-2">
                        {INCIDENT_CATEGORY_LABELS[key]}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-ui-muted mt-2">
                {INCIDENT_PAGE_LABELS.maintenanceHint}{' '}
                <Link
                  href="/maintenance/new"
                  className="inline-flex items-center py-2 -my-2 text-brand-primary hover:underline"
                >
                  {INCIDENT_PAGE_LABELS.maintenanceHintLink}
                </Link>
              </p>
            </div>

            <div>
              <label className="label">{INCIDENT_PAGE_LABELS.fieldType}</label>
              <select name="type" required className="input" defaultValue={selectedType}>
                <option value="">{UI_LABELS.selectPlaceholder}</option>
                <optgroup label={INCIDENT_CATEGORY_LABELS.INTERPERSONAL}>
                  {interpersonalTypes.map((type) => (
                    <option key={type} value={type}>
                      {INCIDENT_TYPE_LABELS[type]}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={INCIDENT_CATEGORY_LABELS.SAFETY}>
                  <option value="SAFETY_CONCERN">{INCIDENT_TYPE_LABELS.SAFETY_CONCERN}</option>
                </optgroup>
                <option value="OTHER">{INCIDENT_TYPE_LABELS.OTHER}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Severity */}
        <div className="card">
          <h2 className="text-lg font-semibold text-ui-text mb-4">
            {INCIDENT_PAGE_LABELS.sectionSeverity}
          </h2>
          <div className="flex gap-3">
            {Object.entries(INCIDENT_SEVERITY_LABELS).map(([key, label]) => (
              <label key={key} className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  name="severity"
                  value={key}
                  required
                  defaultChecked={selectedSeverity === key}
                  className="sr-only peer"
                />
                <div
                  className={`p-4 text-center rounded-lg border-2 border-ui-border transition-colors ${getSeverityRadioClass(key)}`}
                >
                  <div className={`w-4 h-4 rounded-full mx-auto ${getSeverityDotClass(key)}`} />
                  <p className="font-medium text-ui-text mt-2">{label}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="card">
          <h2 className="text-lg font-semibold text-ui-text mb-4">
            {INCIDENT_PAGE_LABELS.sectionDetails}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="label">{INCIDENT_PAGE_LABELS.fieldDate}</label>
              <DateInput
                type="date"
                name="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="input"
              />
            </div>
            <div>
              <label className="label">{INCIDENT_PAGE_LABELS.fieldDescription}</label>
              <textarea
                name="description"
                required
                rows={4}
                placeholder={INCIDENT_PAGE_LABELS.fieldDescriptionPlaceholder}
                defaultValue={selectedDescription}
                className="input"
              />
            </div>
            <div>
              <label className="label">{INCIDENT_PAGE_LABELS.fieldMediationMinutes}</label>
              <input
                type="number"
                inputMode="numeric"
                name="mediationMinutes"
                min="0"
                step="5"
                placeholder="0"
                className="input"
              />
              <p className="text-xs text-ui-muted mt-1">
                {INCIDENT_PAGE_LABELS.fieldMediationMinutesHint}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 -mx-4 px-4 py-3 pb-safe sm:static sm:mx-0 sm:px-0 sm:py-0 bg-ui-surface/95 backdrop-blur border-t border-ui-border sm:border-0 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 z-20">
          <SubmitButton className="btn-primary w-full sm:w-auto min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-wait">
            {INCIDENT_PAGE_LABELS.submit}
          </SubmitButton>
          <Link
            href="/incidents"
            className="btn-outline w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center"
          >
            {UI_LABELS.cancel}
          </Link>
        </div>
      </form>
    </div>
  )
}
