'use client'

/**
 * AI assistance bar for a form — AOZ's words and design tokens on the shared
 * `AiFormAssistant` from ai-forms.
 *
 * The behaviour (fill, change, undo, suggestions) lives in the package so an
 * improvement there reaches every app that uses it; this file only says it in
 * German and in AOZ's classes. Do not grow logic back in here — fix it in
 * ai-forms instead.
 */

import { AiFormAssistant, type UseAiForm } from '@fleet/ai-forms/react'
import { AI_FORM_LABELS } from '@/lib/constants'

interface AiFormBarProps {
  form: UseAiForm
  fillPlaceholder?: string
  refinePlaceholder?: string
  /**
   * Copy overrides, because the default labels describe an intake interview.
   *
   * The placeholder alone was overridable, so the Einsatzplatz form told a job
   * coach "Aus Gesprächsnotizen ausfüllen — beschreibe das Aufnahmegespräch in
   * eigenen Worten" above a box for pasting a job advertisement, and offered
   * «doch Nichtraucherin» as an example edit. Every word of that is about a
   * person, on a form that describes a workplace.
   */
  fillTitle?: string
  refineTitle?: string
  fillHint?: string
  refineHint?: string
  /** Propose improvements right after a fill. One extra model call per fill. */
  suggestAfterFill?: boolean
}

const CLASS_NAMES = {
  root: 'card border-brand-primary/30',
  header: 'flex flex-wrap items-baseline justify-between gap-2 mb-1',
  title: 'text-lg font-semibold text-ui-text',
  hint: 'text-sm text-ui-muted mb-3',
  textarea: 'input',
  actions: 'mt-3 flex flex-wrap items-center gap-3',
  submit: 'btn-primary min-h-[44px] disabled:opacity-60 disabled:cursor-not-allowed',
  secondary: 'btn-ghost min-h-[44px] px-3 text-sm disabled:opacity-60',
  status: 'text-sm text-ui-muted',
  error: 'alert-error mt-3',
  suggestions: 'mt-4 flex flex-wrap items-center gap-2',
  suggestionsTitle: 'w-full text-sm font-medium text-ui-text',
  suggestion: 'btn-outline min-h-[44px] px-3 text-sm text-left disabled:opacity-60',
}

export function AiFormBar({
  form,
  fillPlaceholder,
  refinePlaceholder,
  fillTitle,
  refineTitle,
  fillHint,
  refineHint,
  suggestAfterFill,
}: AiFormBarProps) {
  return (
    <AiFormAssistant
      form={form}
      suggestAfterFill={suggestAfterFill}
      classNames={CLASS_NAMES}
      labels={{
        fillTitle: fillTitle ?? AI_FORM_LABELS.fillTitle,
        refineTitle: refineTitle ?? AI_FORM_LABELS.refineTitle,
        fillHint: fillHint ?? AI_FORM_LABELS.fillHint,
        refineHint: refineHint ?? AI_FORM_LABELS.refineHint,
        fillPlaceholder: fillPlaceholder ?? AI_FORM_LABELS.fillPlaceholder,
        refinePlaceholder: refinePlaceholder ?? AI_FORM_LABELS.refinePlaceholder,
        fillSubmit: AI_FORM_LABELS.fillSubmit,
        refineSubmit: AI_FORM_LABELS.refineSubmit,
        working: AI_FORM_LABELS.working,
        undo: AI_FORM_LABELS.undo,
        changed: (count) =>
          count === 1 ? AI_FORM_LABELS.changedOne : AI_FORM_LABELS.changedMany(count),
        suggest: AI_FORM_LABELS.suggest,
        suggesting: AI_FORM_LABELS.suggesting,
        suggestionsTitle: AI_FORM_LABELS.suggestionsTitle,
      }}
    />
  )
}
