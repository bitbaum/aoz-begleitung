'use client'

/**
 * The questions of one anonymous survey, answered once.
 *
 * Copy arrives translated from the server; this component imports no label
 * map. One column, every choice a full-width row of at least 44px, logical
 * spacing only — it is read on a phone, often in Arabic.
 *
 * The `<form>` lives here, inside the component that holds the values, and the
 * action RETURNS its refusal: a rejected submit (nothing answered, a network
 * hiccup) leaves every answer where the person put it.
 */

import { useActionState } from 'react'
import Link from 'next/link'
import {
  submitSurveyResponse,
  type SurveySubmitError,
  type SurveySubmitState,
} from '@/lib/actions/survey-responses'

export interface RenderedQuestion {
  id: string
  name: string
  type: 'single' | 'multi' | 'scale' | 'text'
  prompt: string
  choices: { id: string; label: string }[]
  otherLabel: string | null
}

export interface SurveyFormLabels {
  textHint: string
  otherPlaceholder: string
  submit: string
  sending: string
  thanksTitle: string
  thanksBody: string
  backHome: string
  errors: Record<SurveySubmitError, string>
}

const CHOICE_ROW =
  'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-ui-border px-3 py-2 text-ui-text hover:border-ui-border-strong has-[:checked]:border-ui-text has-[:checked]:bg-ui-subtle'

export function SurveyForm({
  surveyId,
  questions,
  labels,
}: {
  surveyId: string
  questions: RenderedQuestion[]
  labels: SurveyFormLabels
}) {
  const [state, formAction, pending] = useActionState<SurveySubmitState, FormData>(
    submitSurveyResponse,
    {},
  )

  if (state.ok) {
    return (
      <div className="alert-success space-y-3" role="status">
        <p className="font-semibold">{labels.thanksTitle}</p>
        <p>{labels.thanksBody}</p>
        <Link href="/portal" className="btn-outline w-full sm:w-auto">
          {labels.backHome}
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="surveyId" value={surveyId} />
      <ol className="space-y-6">
        {questions.map((question, index) => (
          <li key={question.id}>
            <fieldset className="card space-y-3">
              <legend className="sr-only">{question.prompt}</legend>
              <p className="font-medium text-ui-text" aria-hidden>
                <span className="numeric text-ui-muted me-2">{index + 1}.</span>
                {question.prompt}
              </p>

              {question.type === 'text' ? (
                <>
                  <textarea
                    name={question.name}
                    aria-label={question.prompt}
                    className="input min-h-[120px]"
                    maxLength={2000}
                  />
                  <p className="text-xs text-ui-muted">{labels.textHint}</p>
                </>
              ) : (
                <div className="space-y-2">
                  {question.choices.map((choice) => (
                    <label key={choice.id} className={CHOICE_ROW}>
                      <input
                        type={question.type === 'multi' ? 'checkbox' : 'radio'}
                        name={question.name}
                        value={choice.id}
                        className="h-5 w-5 shrink-0"
                      />
                      <span>{choice.label}</span>
                    </label>
                  ))}
                  {question.otherLabel && (
                    <label className="block pt-1">
                      <span className="label">{question.otherLabel}</span>
                      <input
                        type="text"
                        name={`${question.name}:other`}
                        className="input"
                        maxLength={2000}
                        placeholder={labels.otherPlaceholder}
                        autoComplete="off"
                      />
                    </label>
                  )}
                </div>
              )}
            </fieldset>
          </li>
        ))}
      </ol>

      {state.error && (
        <p className="alert-error" role="alert">
          {labels.errors[state.error]}
        </p>
      )}

      <button type="submit" className="btn-secondary w-full sm:w-auto" disabled={pending}>
        {pending ? labels.sending : labels.submit}
      </button>
    </form>
  )
}
