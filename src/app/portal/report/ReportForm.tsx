'use client'

import { DateInput } from '@/components/ui/DateInput'
import { useMemo, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useT, useLocale } from '@/lib/i18n/LocaleProvider'
import { buildReportFormLabels } from '@/lib/i18n/report-form'
import { residentName, type NamedResident } from '@/lib/utils/resident-name'
import { RESIDENT_REPORTS_ANCHOR } from '@/lib/reports/resident-reports'

interface Props {
  roommates: (NamedResident & { id: string })[]
}

type Category = 'MAINTENANCE' | 'INTERPERSONAL'

export function ReportForm({ roommates }: Props) {
  const t = useT()
  const locale = useLocale()
  const R = useMemo(() => buildReportFormLabels(t), [t])

  const [category, setCategory] = useState<Category | null>(null)
  const [formKey, setFormKey] = useState(0)
  const formRef = useRef<HTMLDivElement>(null)
  const prevCategoryRef = useRef<Category | null>(null)

  useEffect(() => {
    if (category !== null && prevCategoryRef.current === null) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    }
    prevCategoryRef.current = category
  }, [category])

  const [defaults, setDefaults] = useState<{
    type?: string
    severity?: string
    description?: string
    location?: string
  }>({})
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyTemplate = (template: {
    key: string
    category: Category
    type: string
    severity: string
    description: string
    location?: string
  }) => {
    setCategory(template.category)
    setDefaults({
      type: template.type,
      severity: template.severity,
      description: template.description,
      location: template.location,
    })
    setActiveTemplate(template.key)
    setError(null)
    setFormKey((k) => k + 1)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData(e.currentTarget)
      const response = await fetch('/api/portal/report', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || R.errorGeneric)
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : R.errorGeneric)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <div className="card border-status-success/25 bg-status-success/8">
          <div className="text-center py-6">
            <span className="text-5xl mb-4 block">✓</span>
            <h2 className="text-xl font-semibold text-status-success-text mb-2">
              {R.successTitle}
            </h2>
            <p className="text-status-success-text">{R.successMessage}</p>
          </div>
        </div>

        <div className="card border-status-info/25 bg-status-info/8">
          <h3 className="font-semibold text-status-info-text mb-2">{R.nextStepsTitle}</h3>
          <ol className="text-sm text-status-info-text space-y-1 list-decimal ps-5">
            {R.nextSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <p className="text-xs text-status-info-text mt-3">{R.successTip}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/portal/reports" className="btn-secondary">
            {R.viewYours}
          </Link>
          <Link href="/portal" className="btn-outline">
            {R.backToOverview}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="font-semibold text-ui-text">{R.quickTitle}</h3>
            <p className="text-sm text-ui-muted">{R.quickSubtitle}</p>
          </div>
          {activeTemplate && (
            <button
              type="button"
              onClick={() => {
                setActiveTemplate(null)
                setDefaults({})
                setFormKey((k) => k + 1)
              }}
              className="text-sm text-ui-muted hover:text-ui-muted min-h-[44px]"
            >
              {R.resetTemplate}
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {R.templates.map((template) => (
            <button
              key={template.key}
              type="button"
              onClick={() =>
                applyTemplate({
                  key: template.key,
                  category: template.category,
                  type: template.type,
                  severity: template.severity,
                  location: 'location' in template ? template.location : undefined,
                  description: template.description,
                })
              }
              className={`btn-outline min-h-[44px] ${
                activeTemplate === template.key
                  ? 'bg-status-info/15 border-status-info/40 text-status-info-text'
                  : ''
              }`}
            >
              {template.icon ? `${template.icon} ` : ''}
              {template.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 p-3 rounded-lg border border-ui-border bg-ui-subtle">
        <h3 className="text-sm font-semibold text-ui-text mb-1">{R.transparency.title}</h3>
        <p className="text-xs text-ui-muted">
          {R.transparency.before} <strong>{R.transparency.open}</strong> {R.transparency.middle}{' '}
          <strong>{R.transparency.resolved}</strong> {R.transparency.after}
        </p>
        <Link
          href={`/portal#${RESIDENT_REPORTS_ANCHOR}`}
          className="inline-flex items-center min-h-[44px] text-xs text-brand-primary hover:underline"
        >
          {R.transparency.seeMine}
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button
          type="button"
          onClick={() => {
            setCategory('MAINTENANCE')
            setActiveTemplate(null)
            setDefaults({})
            setFormKey((k) => k + 1)
            setError(null)
          }}
          className={`card-hover flex items-center gap-4 text-start transition-all ${
            category === 'MAINTENANCE' ? 'ring-2 ring-brand-primary' : ''
          }`}
        >
          <span className="text-4xl">🔧</span>
          <div>
            <h3 className="font-semibold text-ui-text">{R.categoryMaintenance}</h3>
            <p className="text-sm text-ui-muted">{R.categoryMaintenanceDesc}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            setCategory('INTERPERSONAL')
            setActiveTemplate(null)
            setDefaults({})
            setFormKey((k) => k + 1)
            setError(null)
          }}
          className={`card-hover flex items-center gap-4 text-start transition-all ${
            category === 'INTERPERSONAL' ? 'ring-2 ring-brand-primary' : ''
          }`}
        >
          <span className="text-4xl">💬</span>
          <div>
            <h3 className="font-semibold text-ui-text">{R.categoryConflict}</h3>
            <p className="text-sm text-ui-muted">{R.categoryConflictDesc}</p>
          </div>
        </button>
      </div>

      {category && (
        <div ref={formRef} className="card">
          <h2 className="text-lg font-semibold text-ui-text mb-4">
            {category === 'MAINTENANCE' ? R.titleMaintenance : R.titleConflict}
          </h2>
          {category === 'INTERPERSONAL' && (
            <p className="text-sm text-ui-muted mb-4">{R.conflictSubtitle}</p>
          )}

          {error && (
            <div className="mb-4 alert-error" role="alert" aria-live="polite">
              {error}
            </div>
          )}

          <form key={formKey} onSubmit={handleSubmit} className="space-y-4">
            <input type="hidden" name="category" value={category} />

            <div>
              <label className="label">
                {category === 'MAINTENANCE' ? R.typeLabel : R.conflictTypeLabel}
              </label>
              <select name="type" className="input" required defaultValue={defaults.type || ''}>
                <option value="">{R.selectPlaceholder}</option>
                {(category === 'MAINTENANCE' ? R.maintenanceTypes : R.conflictTypes).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {category === 'MAINTENANCE' && (
              <div>
                <label className="label">{R.locationLabel}</label>
                <select
                  name="location"
                  className="input"
                  defaultValue={defaults.location || R.locations[0]?.value}
                >
                  {R.locations.map((loc) => (
                    <option key={loc.value} value={loc.value}>
                      {loc.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {category === 'INTERPERSONAL' && roommates.length > 0 && (
              <div>
                <label className="label">{R.involvedLabel}</label>
                <select name="involvedResident" className="input">
                  <option value="">{R.involvedPlaceholder}</option>
                  {roommates.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      {residentName(rm)}
                    </option>
                  ))}
                  <option value="external">{R.involvedExternal}</option>
                </select>
                <p className="text-xs text-ui-muted mt-1">{R.confidentialNote}</p>
              </div>
            )}

            <div>
              <label className="label">
                {category === 'MAINTENANCE' ? R.descriptionLabel : R.conflictDescriptionLabel}
              </label>
              <textarea
                name="description"
                className="input"
                defaultValue={defaults.description || ''}
                rows={4}
                placeholder={
                  category === 'MAINTENANCE'
                    ? R.descriptionPlaceholder
                    : R.conflictDescriptionPlaceholder
                }
                required
                maxLength={2000}
              />
            </div>

            {category === 'INTERPERSONAL' && (
              <div>
                <label className="label">{R.dateLabel}</label>
                <DateInput
                  locale={locale.intlTag}
                  type="date"
                  name="incidentDate"
                  className="input"
                  defaultValue={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}

            <div>
              <label className="label">
                {category === 'MAINTENANCE' ? R.severityLabel : R.conflictSeverityLabel}
              </label>
              <div
                className={`grid gap-2 sm:gap-3 ${
                  category === 'MAINTENANCE'
                    ? 'grid-cols-2 sm:grid-cols-4'
                    : 'grid-cols-2 sm:grid-cols-4'
                }`}
              >
                {R.severityOptions[category].map((sev) => (
                  <label key={sev.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="severity"
                      value={sev.value}
                      defaultChecked={
                        defaults.severity ? sev.value === defaults.severity : sev.value === 'MEDIUM'
                      }
                      className="sr-only peer"
                    />
                    <div className="py-3 px-2 text-center rounded-lg border-2 border-ui-border peer-checked:border-brand-primary peer-checked:bg-status-info/8 transition-colors min-h-[70px] flex flex-col items-center justify-center">
                      {'icon' in sev && <span className="text-xl block mb-1">{sev.icon}</span>}
                      <span
                        className={`block ${'desc' in sev ? 'text-sm font-medium' : 'text-xs'}`}
                      >
                        {sev.label}
                      </span>
                      {'desc' in sev && <span className="text-xs text-ui-muted">{sev.desc}</span>}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {category === 'INTERPERSONAL' && (
              <div>
                <label className="flex items-start gap-2 cursor-pointer min-h-[44px] py-2">
                  <input
                    type="checkbox"
                    name="requestMediation"
                    className="w-5 h-5 mt-0.5 rounded border-ui-border-strong text-brand-primary focus:ring-brand-primary"
                  />
                  <span className="text-sm text-ui-muted">{R.mediationLabel}</span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? R.submitting
                : category === 'MAINTENANCE'
                  ? R.submitMaintenance
                  : R.submitConflict}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
