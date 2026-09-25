'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LANGUAGE_LABELS, DIET_LABELS } from '@/lib/constants/labels'
import { useT } from '@/lib/i18n/LocaleProvider'
import { buildPreferencesLabels } from '@/lib/i18n/portal-surfaces'
import { RESIDENT_FACTORS } from '@/lib/config/resident-factors'
import type { ScaleFactorDef, EnumFactorDef } from '@/lib/config/types'

interface ResidentData {
  sleepSchedule: string
  noiseTolerance: number
  cleanlinessPractice: number
  cleanlinessExpectation: number
  chaosTolerance: number
  socialStyle: string
  privacyNeed: number
  smokingStatus: string
  petTolerance: boolean
  sharedBathroom: boolean
  sharedKitchen: boolean
  languages: string[]
  dietaryNeeds: string[]
  roommatePreferences: string | null
}

interface Props {
  resident: ResidentData
  languageOptions: string[]
  dietOptions: string[]
}

function RatingScale({
  name,
  defaultValue,
  lowLabel,
  highLabel,
}: {
  name: string
  defaultValue: number
  lowLabel: string
  highLabel: string
}) {
  return (
    <>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((level) => (
          <label key={level} className="flex-1 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={level}
              defaultChecked={defaultValue === level}
              className="sr-only peer"
            />
            <div className="py-3 text-center rounded-lg border-2 border-ui-border peer-checked:border-brand-primary peer-checked:bg-brand-primary peer-checked:text-ui-on-accent transition-colors">
              {level}
            </div>
          </label>
        ))}
      </div>
      <div className="flex justify-between text-xs text-ui-muted mt-1">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </>
  )
}

export function PreferencesForm({ resident, languageOptions, dietOptions }: Props) {
  const t = useT()
  const P = buildPreferencesLabels(t)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const discardPanelRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!showDiscardConfirm) return
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    discardPanelRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setShowDiscardConfirm(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedRef.current?.focus?.()
    }
  }, [showDiscardConfirm])

  const handleCancel = () => {
    if (isDirty) {
      setShowDiscardConfirm(true)
    } else {
      router.push('/portal')
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData(e.currentTarget)
      const response = await fetch('/api/portal/preferences', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || P.errorGeneric)
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : P.errorGeneric)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="card border-status-success/25 bg-status-success/8">
        <div className="text-center py-6">
          <span className="text-5xl mb-4 block">✓</span>
          <h2 className="text-xl font-semibold text-status-success-text mb-2">{P.successTitle}</h2>
          <p className="text-status-success-text">{P.successMessage}</p>
          <Link href="/portal" className="text-brand-primary hover:underline mt-4 inline-block">
            {t('action.back')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Discard confirmation overlay */}
      {showDiscardConfirm && (
        <div className="scrim z-50 flex items-center justify-center p-4">
          <div
            ref={discardPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discard-title"
            tabIndex={-1}
            className="bg-ui-surface rounded-lg w-full max-w-sm p-6 space-y-4 focus:outline-none"
          >
            <h3 id="discard-title" className="font-semibold text-ui-text">
              {P.confirmDiscard}
            </h3>
            <p className="text-sm text-ui-muted">{P.confirmDiscardBody}</p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="btn-outline min-h-[44px]"
              >
                {t('action.cancel')}
              </button>
              <button
                type="button"
                onClick={() => router.push('/portal')}
                className="btn-primary min-h-[44px]"
              >
                {P.confirmDiscardConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 alert-error" role="alert" aria-live="polite">
          {error}
        </div>
      )}

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onChange={() => {
          if (!isDirty) setIsDirty(true)
        }}
        className="space-y-6 pb-24 sm:pb-0"
      >
        <div className="card bg-status-info/8 border-status-info/25">
          <p className="text-sm text-status-info-text">{P.saveTip}</p>
          {isDirty && <p className="text-xs text-status-info-text mt-1">{P.unsavedChanges}</p>}
        </div>

        {/* Lifestyle Section */}
        <div className="card">
          <h2 className="text-lg font-semibold text-ui-text mb-4">{P.sections.lifestyle}</h2>

          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="sleepSchedule">
                {P.fields.sleepSchedule}
              </label>
              <select
                id="sleepSchedule"
                name="sleepSchedule"
                defaultValue={resident.sleepSchedule}
                className="input"
              >
                {(RESIDENT_FACTORS.sleepSchedule as EnumFactorDef).options.map((opt) => (
                  <option key={opt} value={opt}>
                    {(RESIDENT_FACTORS.sleepSchedule as EnumFactorDef).optionLabels[opt]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">{P.fields.noiseTolerance}</label>
              <p className="text-xs text-ui-muted mb-2">{P.hints.noiseTolerance}</p>
              <RatingScale
                name="noiseTolerance"
                defaultValue={resident.noiseTolerance}
                lowLabel={(RESIDENT_FACTORS.noiseTolerance as ScaleFactorDef).lowLabel}
                highLabel={(RESIDENT_FACTORS.noiseTolerance as ScaleFactorDef).highLabel}
              />
            </div>

            {/* Three separate questions: what I do, what I expect of others, and
                how much mess I can live with. Asking only the first cannot tell
                apart a tidy person who leaves others alone from one who will be
                unhappy every week. */}
            <div>
              <label className="label">{P.fields.cleanlinessPractice}</label>
              <p className="text-xs text-ui-muted mb-2">{P.hints.cleanlinessPractice}</p>
              <RatingScale
                name="cleanlinessPractice"
                defaultValue={resident.cleanlinessPractice}
                lowLabel={(RESIDENT_FACTORS.cleanlinessPractice as ScaleFactorDef).lowLabel}
                highLabel={(RESIDENT_FACTORS.cleanlinessPractice as ScaleFactorDef).highLabel}
              />
            </div>

            <div>
              <label className="label">{P.fields.cleanlinessExpectation}</label>
              <p className="text-xs text-ui-muted mb-2">{P.hints.cleanlinessExpectation}</p>
              <RatingScale
                name="cleanlinessExpectation"
                defaultValue={resident.cleanlinessExpectation}
                lowLabel={(RESIDENT_FACTORS.cleanlinessExpectation as ScaleFactorDef).lowLabel}
                highLabel={(RESIDENT_FACTORS.cleanlinessExpectation as ScaleFactorDef).highLabel}
              />
            </div>

            <div>
              <label className="label">{P.fields.chaosTolerance}</label>
              <p className="text-xs text-ui-muted mb-2">{P.hints.chaosTolerance}</p>
              <RatingScale
                name="chaosTolerance"
                defaultValue={resident.chaosTolerance}
                lowLabel={(RESIDENT_FACTORS.chaosTolerance as ScaleFactorDef).lowLabel}
                highLabel={(RESIDENT_FACTORS.chaosTolerance as ScaleFactorDef).highLabel}
              />
            </div>
          </div>
        </div>

        {/* Social Section */}
        <div className="card">
          <h2 className="text-lg font-semibold text-ui-text mb-4">{P.sections.social}</h2>

          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="socialStyle">
                {P.fields.socialStyle}
              </label>
              <select
                id="socialStyle"
                name="socialStyle"
                defaultValue={resident.socialStyle}
                className="input"
              >
                {(RESIDENT_FACTORS.socialStyle as EnumFactorDef).options.map((opt) => (
                  <option key={opt} value={opt}>
                    {(RESIDENT_FACTORS.socialStyle as EnumFactorDef).optionLabels[opt]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">{P.fields.privacyNeed}</label>
              <p className="text-xs text-ui-muted mb-2">{P.hints.privacyNeed}</p>
              <RatingScale
                name="privacyNeed"
                defaultValue={resident.privacyNeed}
                lowLabel={(RESIDENT_FACTORS.privacyNeed as ScaleFactorDef).lowLabel}
                highLabel={(RESIDENT_FACTORS.privacyNeed as ScaleFactorDef).highLabel}
              />
            </div>

            <div>
              <label className="label">{P.fields.languages}</label>
              <p className="text-xs text-ui-muted mb-2">{P.hints.languages}</p>
              <div className="flex flex-wrap gap-2">
                {languageOptions.map((code) => {
                  const lowerCode = code.toLowerCase()
                  return (
                    <label key={code} className="cursor-pointer">
                      <input
                        type="checkbox"
                        name="languages"
                        value={lowerCode}
                        defaultChecked={
                          resident.languages.includes(lowerCode) ||
                          resident.languages.includes(code)
                        }
                        className="sr-only peer"
                      />
                      <div className="px-4 py-2 rounded-sm border-2 border-ui-border peer-checked:border-brand-primary peer-checked:bg-brand-primary peer-checked:text-ui-on-accent transition-colors text-sm">
                        {LANGUAGE_LABELS[code] || LANGUAGE_LABELS[lowerCode] || code}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Practical Section */}
        <div className="card">
          <h2 className="text-lg font-semibold text-ui-text mb-4">{P.sections.practical}</h2>

          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="smokingStatus">
                {P.fields.smoking}
              </label>
              <select
                id="smokingStatus"
                name="smokingStatus"
                defaultValue={resident.smokingStatus}
                className="input"
              >
                {(RESIDENT_FACTORS.smokingStatus as EnumFactorDef).options.map((opt) => (
                  <option key={opt} value={opt}>
                    {(RESIDENT_FACTORS.smokingStatus as EnumFactorDef).optionLabels[opt]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer min-h-[44px] py-2">
                <input
                  type="checkbox"
                  name="petTolerance"
                  defaultChecked={resident.petTolerance}
                  className="w-5 h-5 rounded border-ui-border-strong text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-sm text-ui-muted">{P.fields.petTolerance}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer min-h-[44px] py-2">
                <input
                  type="checkbox"
                  name="sharedBathroom"
                  defaultChecked={resident.sharedBathroom}
                  className="w-5 h-5 rounded border-ui-border-strong text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-sm text-ui-muted">{P.fields.sharedBathroom}</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer min-h-[44px] py-2">
                <input
                  type="checkbox"
                  name="sharedKitchen"
                  defaultChecked={resident.sharedKitchen}
                  className="w-5 h-5 rounded border-ui-border-strong text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-sm text-ui-muted">{P.fields.sharedKitchen}</span>
              </label>
            </div>

            <div>
              <label className="label">{P.fields.diet}</label>
              <div className="flex flex-wrap gap-2">
                {dietOptions.map((opt) => {
                  const lowerOpt = opt.toLowerCase()
                  return (
                    <label key={opt} className="cursor-pointer">
                      <input
                        type="checkbox"
                        name="dietaryNeeds"
                        value={lowerOpt}
                        defaultChecked={
                          resident.dietaryNeeds.includes(lowerOpt) ||
                          resident.dietaryNeeds.includes(opt)
                        }
                        className="sr-only peer"
                      />
                      <div className="px-4 py-2 rounded-sm border-2 border-ui-border peer-checked:border-brand-primary peer-checked:bg-brand-primary peer-checked:text-ui-on-accent transition-colors text-sm">
                        {DIET_LABELS[opt] || DIET_LABELS[lowerOpt] || opt}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Roommate Preferences */}
        <div className="card">
          <h2 className="text-lg font-semibold text-ui-text mb-4">{P.sections.roommatePrefs}</h2>
          <p className="text-sm text-ui-muted mb-4">{P.hints.roommatePrefs}</p>

          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="preferredAgeRange">
                {P.fields.preferredAgeRange}
              </label>
              <select id="preferredAgeRange" name="preferredAgeRange" className="input">
                <option value="">{P.fields.noPref}</option>
                <option value="SIMILAR">{P.fields.similarAge}</option>
                {(RESIDENT_FACTORS.ageRange as EnumFactorDef).options.map((opt) => (
                  <option key={opt} value={opt}>
                    {(RESIDENT_FACTORS.ageRange as EnumFactorDef).optionLabels[opt]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">{P.fields.additionalPrefs}</label>
              <textarea
                name="additionalPreferences"
                className="input"
                rows={3}
                placeholder={P.hints.additionalPrefsPlaceholder}
                maxLength={1000}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="sticky bottom-0 -mx-4 px-4 py-3 pb-safe sm:static sm:mx-0 sm:px-0 sm:py-0 bg-ui-surface/95 backdrop-blur border-t border-ui-border sm:border-0 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 z-20">
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full sm:w-auto min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? P.saving : P.saveButton}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="btn-outline w-full sm:w-auto min-h-[44px]"
          >
            {t('action.cancel')}
          </button>
        </div>
      </form>

      {/* Privacy Notice */}
      <div className="mt-8 p-4 bg-ui-subtle rounded-lg">
        <h3 className="font-medium text-ui-text mb-2">{P.privacyTitle}</h3>
        <p className="text-sm text-ui-muted">{P.privacyMessage}</p>
      </div>
    </>
  )
}
