'use client'

import { useState } from 'react'
import { SATISFACTION_EMOJIS, SATISFACTION_LABELS, SATISFACTION_SURVEY_LABELS } from '@/lib/constants'
import { useT } from '@/lib/i18n/LocaleProvider'
import { daysBetween } from '@/lib/utils'

interface SatisfactionRatingProps {
  currentRating?: number | null
  lastCheckInDate?: Date | null
}

export function SatisfactionRating({ currentRating, lastCheckInDate }: SatisfactionRatingProps) {
  const t = useT()
  const [rating, setRating] = useState<number | null>(null)
  const [concerns, setConcerns] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedWithConcerns, setSubmittedWithConcerns] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConcernsField, setShowConcernsField] = useState(false)
  const [forceShowForm, setForceShowForm] = useState(false)

  // Determine if we should prompt (no check-in in the last 7 days)
  const daysSinceLastCheckIn = lastCheckInDate
    ? daysBetween(lastCheckInDate)
    : null
  const shouldPrompt = daysSinceLastCheckIn === null || daysSinceLastCheckIn >= 7

  const handleRatingSelect = (newRating: number) => {
    setRating(newRating)
    // Show concerns field for low ratings, hide for good ones
    setShowConcernsField(newRating <= 2)
  }

  const submitCheckIn = async (finalRating: number, finalConcerns: string) => {
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/portal/satisfaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: finalRating,
          concerns: finalConcerns.trim() || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      setSubmittedWithConcerns(!!finalConcerns.trim())
      setSubmitted(true)
      setShowConcernsField(false)
      setConcerns('')
    } catch {
      setError(SATISFACTION_SURVEY_LABELS.saveFailed)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitWithConcerns = () => {
    if (rating) {
      submitCheckIn(rating, concerns)
    }
  }

  // Show thank you message if just submitted
  if (submitted) {
    return (
      <div className="card bg-status-success/10 border-status-success/25">
        <div className="text-center py-6">
          <span className="text-5xl mb-4 block">✓</span>
          <h2 className="text-xl font-semibold text-status-success-text mb-2">
            {t('satisfaction.thankYouTitle')}
          </h2>
          <p className="text-status-success-text">
            {t('satisfaction.thankYouMessage')}
          </p>
          {rating && rating <= 2 && submittedWithConcerns && (
            <p className="text-sm text-status-success mt-3">
              {t('satisfaction.concernsForwarded')}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Show subtle indicator if recently checked in
  if (!shouldPrompt && !rating && !forceShowForm) {
    // Format days display — "Heute" instead of "vor 0 Tagen"
    const daysDisplay = daysSinceLastCheckIn === 0
      ? t('satisfaction.today')
      : `vor ${daysSinceLastCheckIn} ${daysSinceLastCheckIn === 1 ? SATISFACTION_SURVEY_LABELS.day : SATISFACTION_SURVEY_LABELS.days}`

    return (
      <div className="card bg-ui-subtle">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ui-muted">{t('satisfaction.lastFeedback')}</p>
            <div className="flex items-center gap-2 mt-1">
              {currentRating && (
                <span className="text-2xl">{SATISFACTION_EMOJIS[currentRating - 1]}</span>
              )}
              <span className="text-ui-muted">
                {daysDisplay}
              </span>
            </div>
          </div>
          <button
            onClick={() => setForceShowForm(true)}
            className="text-sm text-brand-primary hover:underline min-h-[44px] flex items-center"
          >
            {t('satisfaction.newFeedback')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card border-brand-primary/20 bg-ui-surface">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-ui-text mb-2">
          {t('satisfaction.title')}
        </h2>
        <p className="text-ui-muted">
          {t('satisfaction.subtitle')}
        </p>
      </div>

      {error && (
        <div className="mb-4 alert-error text-center" role="alert" aria-live="polite">
          {error}
        </div>
      )}

      {/* Emoji Buttons */}
      <div className="flex justify-center gap-3 sm:gap-4 mb-4">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            onClick={() => handleRatingSelect(value)}
            disabled={isSubmitting}
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg transition-all text-2xl sm:text-3xl flex items-center justify-center ${
              rating === value
                ? 'bg-brand-primary text-ui-on-accent ring-2 ring-brand-primary ring-offset-2 scale-110'
                : 'bg-ui-surface hover:bg-brand-primary/10 hover:scale-105'
            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={SATISFACTION_LABELS[value - 1]}
            aria-label={SATISFACTION_LABELS[value - 1]}
          >
            {SATISFACTION_EMOJIS[value - 1]}
          </button>
        ))}
      </div>

      {/* Labels under buttons */}
      <div className="flex justify-center gap-3 sm:gap-4 mb-4">
        <span className="text-xs text-ui-muted w-14 sm:w-16 text-center">{SATISFACTION_SURVEY_LABELS.ratings.bad}</span>
        <span className="text-xs text-ui-muted w-14 sm:w-16 text-center"></span>
        <span className="text-xs text-ui-muted w-14 sm:w-16 text-center">{SATISFACTION_SURVEY_LABELS.ratings.okay}</span>
        <span className="text-xs text-ui-muted w-14 sm:w-16 text-center"></span>
        <span className="text-xs text-ui-muted w-14 sm:w-16 text-center">{SATISFACTION_SURVEY_LABELS.ratings.great}</span>
      </div>

      {/* Concerns field for low ratings */}
      {showConcernsField && rating && rating <= 2 && (
        <div className="mt-6 p-4 bg-ui-surface rounded-lg border border-status-warning/30">
          <label htmlFor="satisfaction-concerns" className="block text-sm font-medium text-ui-muted mb-2">
            {SATISFACTION_SURVEY_LABELS.commentPrompt} <span className="text-ui-muted">{SATISFACTION_SURVEY_LABELS.optional}</span>
          </label>
          <textarea
            id="satisfaction-concerns"
            value={concerns}
            onChange={(e) => setConcerns(e.target.value)}
            placeholder={SATISFACTION_SURVEY_LABELS.commentPlaceholder}
            className="w-full p-3 border border-ui-border rounded-lg text-sm resize-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary"
            rows={3}
            disabled={isSubmitting}
            maxLength={2000}
          />
          <div className="flex gap-3 mt-3">
            <button
              onClick={handleSubmitWithConcerns}
              disabled={isSubmitting}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? SATISFACTION_SURVEY_LABELS.submitting : SATISFACTION_SURVEY_LABELS.submit}
            </button>
            <button
              onClick={() => submitCheckIn(rating, '')}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-ui-muted hover:text-ui-text min-h-[44px]"
            >
              {SATISFACTION_SURVEY_LABELS.submitWithoutComment}
            </button>
          </div>
        </div>
      )}

      {/* Submit button for good ratings (3-5) */}
      {rating && rating >= 3 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => submitCheckIn(rating, '')}
            disabled={isSubmitting}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? SATISFACTION_SURVEY_LABELS.submitting : SATISFACTION_SURVEY_LABELS.submitFeedback}
          </button>
        </div>
      )}

      <p className="text-xs text-ui-muted mt-4 text-center">
        {t('satisfaction.privacyNote')}
      </p>
    </div>
  )
}
