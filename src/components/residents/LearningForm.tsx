'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CEFR_LEVELS,
  LEARNING_CATEGORIES,
  LEARNING_KINDS,
  LEARNING_LANGUAGE_OPTIONS,
  LEARNING_STATUSES,
  kindTracksHours,
  type LearningFormCopy,
  type LearningRecordProblem,
} from '@/lib/config/learning'
import { showToast } from '@/components/ui/Toast'

/** The values an existing record opens the form with. */
export interface LearningFormInitial {
  id: string
  kind: string
  title: string
  status: string
  languageCode: string | null
  cefrLevel: string | null
  provider: string | null
  category: string | null
  hours: number | null
  startedAt: Date | string | null
  completedAt: Date | string | null
  notes: string | null
}

type ActionResult = { success: boolean; error?: string; problem?: LearningRecordProblem }

interface Props {
  action: (formData: FormData) => Promise<ActionResult>
  /** Every word the form renders — German for staff, translated in the portal. */
  copy: LearningFormCopy
  residentId?: string
  submitLabel?: string
  audience?: 'resident' | 'staff'
  /** Shown after a successful save. */
  successMessage?: string
  /** Editing an existing record instead of creating one. */
  initial?: LearningFormInitial
  /** Called after a successful save (closes an inline editor). */
  onDone?: () => void
  /** Renders a cancel button (inline editor). */
  onCancel?: () => void
}

/** The kinds a client is offered as one-tap shortcuts, most common first. */
const QUICK_KINDS = ['COURSE', 'LANGUAGE_TEST', 'VOLUNTEERING', 'QUALIFICATION'] as const

function dateInputValue(value: Date | string | null | undefined): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

export function LearningForm({
  action,
  copy,
  residentId,
  submitLabel,
  audience = 'staff',
  successMessage,
  initial,
  onDone,
  onCancel,
}: Props) {
  const router = useRouter()
  const [kind, setKind] = useState(initial?.kind ?? 'COURSE')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isLanguageTest = kind === 'LANGUAGE_TEST'
  const showHours = kindTracksHours(kind)
  const residentMode = audience === 'resident'
  const idPrefix = initial ? `learning-${initial.id}` : 'learning'

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    try {
      const result = await action(formData)
      if (!result.success) {
        // The reason in the reader's language when the server named one; the
        // server's own sentence is German and only right for staff.
        setError(
          (result.problem && copy.problems[result.problem]) ||
            (residentMode ? copy.saveError : result.error) ||
            copy.saveError,
        )
        return
      }
      if (successMessage) showToast('success', successMessage)
      router.refresh()
      onDone?.()
    } catch {
      setError(copy.saveError)
    } finally {
      setPending(false)
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {residentId && <input type="hidden" name="residentId" value={residentId} />}
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}

      {residentMode && !initial && (
        <div className="rounded-lg border border-ui-border bg-ui-subtle p-3">
          <p className="text-sm text-ui-text mb-2">{copy.evidenceHelp}</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_KINDS.map((quick) => (
              <button
                key={quick}
                type="button"
                aria-pressed={kind === quick}
                className={`min-h-[44px] rounded-lg border px-4 text-sm ${
                  kind === quick
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border-ui-border text-ui-text hover:border-brand-primary/30'
                }`}
                onClick={() => setKind(quick)}
              >
                {copy.kindLabels[quick]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-kind`} className="label">
            {copy.kind}
          </label>
          <select
            id={`${idPrefix}-kind`}
            name="kind"
            className="input"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {LEARNING_KINDS.map((value) => (
              <option key={value} value={value}>
                {copy.kindLabels[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-status`} className="label">
            {copy.status}
          </label>
          <select
            id={`${idPrefix}-status`}
            name="status"
            className="input"
            defaultValue={initial?.status ?? 'IN_PROGRESS'}
          >
            {LEARNING_STATUSES.map((value) => (
              <option key={value} value={value}>
                {copy.statusLabels[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-title`} className="label">
          {copy.titleField}
        </label>
        <input
          id={`${idPrefix}-title`}
          name="title"
          required
          minLength={2}
          className="input"
          placeholder={copy.titlePlaceholder}
          defaultValue={initial?.title ?? ''}
        />
      </div>

      {/* Both open BLANK and both are required. A preselected «A1» saved
          «DE A1» on every test whether or not anyone chose it.
          @see learningRecordProblem in lib/config/learning.ts */}
      {isLanguageTest && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${idPrefix}-language`} className="label">
              {copy.language}
            </label>
            <select
              id={`${idPrefix}-language`}
              name="languageCode"
              className="input"
              required
              defaultValue={initial?.languageCode ?? ''}
            >
              <option value="" disabled>
                {copy.chooseLanguage}
              </option>
              {LEARNING_LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {copy.languageLabels[lang.code] ?? lang.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${idPrefix}-cefr`} className="label">
              {copy.cefr}
            </label>
            <select
              id={`${idPrefix}-cefr`}
              name="cefrLevel"
              className="input"
              required
              defaultValue={initial?.cefrLevel ?? ''}
            >
              <option value="" disabled>
                {copy.chooseLevel}
              </option>
              {CEFR_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-provider`} className="label">
            {copy.provider}
          </label>
          <input
            id={`${idPrefix}-provider`}
            name="provider"
            className="input"
            placeholder={copy.providerPlaceholder}
            defaultValue={initial?.provider ?? ''}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-category`} className="label">
            {copy.category}
          </label>
          <select
            id={`${idPrefix}-category`}
            name="category"
            className="input"
            defaultValue={initial ? (initial.category ?? '') : 'language'}
          >
            {initial && !initial.category ? <option value="">—</option> : null}
            {LEARNING_CATEGORIES.map((id) => (
              <option key={id} value={id}>
                {copy.categoryLabels[id]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showHours && (
        <div>
          <label htmlFor={`${idPrefix}-hours`} className="label">
            {copy.hours}
          </label>
          <input
            id={`${idPrefix}-hours`}
            name="hours"
            type="number"
            min={0}
            step={1}
            className="input"
            defaultValue={initial?.hours ?? ''}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${idPrefix}-startedAt`} className="label">
            {copy.startedAt}
          </label>
          <input
            id={`${idPrefix}-startedAt`}
            name="startedAt"
            type="date"
            className="input"
            defaultValue={dateInputValue(initial?.startedAt)}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-completedAt`} className="label">
            {copy.completedAt}
          </label>
          <input
            id={`${idPrefix}-completedAt`}
            name="completedAt"
            type="date"
            className="input"
            defaultValue={dateInputValue(initial?.completedAt)}
          />
        </div>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-notes`} className="label">
          {copy.notes}
        </label>
        <textarea
          id={`${idPrefix}-notes`}
          name="notes"
          rows={2}
          className="input"
          defaultValue={initial?.notes ?? ''}
        />
        <p className="text-xs text-ui-muted mt-1">{copy.notesHint}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary min-h-[44px]" disabled={pending}>
          {pending ? copy.saving : submitLabel || copy.save}
        </button>
        {onCancel ? (
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={pending}>
            {copy.cancel}
          </button>
        ) : null}
      </div>
    </form>
  )
}
