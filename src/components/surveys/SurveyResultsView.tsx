import type { QuestionResult, SurveyResults } from '@/lib/surveys/results'
import { SURVEY_LABELS as L } from '@/lib/constants/labels/surveys'

/**
 * Aggregated results. Renders exactly what `summarizeSurvey` returns and
 * nothing more — below k that is a single sentence.
 */
export function SurveyResultsView({ results }: { results: SurveyResults }) {
  if (results.kind === 'still-open') {
    return <p className="alert-info">{L.stillOpen(results.responses)}</p>
  }
  if (results.kind === 'too-few') {
    return <p className="alert-info">{L.tooFew(results.responses, results.minResponses)}</p>
  }

  return (
    <div className="space-y-4">
      <p className="numeric text-sm text-ui-muted">{L.responsesCount(results.responses)}</p>
      <ol className="space-y-4">
        {results.questions.map((question, index) => (
          <li key={question.id} className="card space-y-3">
            <div>
              <p className="font-medium text-ui-text">
                <span className="numeric text-ui-muted me-2">{index + 1}.</span>
                {question.prompt}
              </p>
              <p className="numeric text-xs text-ui-muted mt-1">
                {L.answeredOf(question.answered, results.responses)}
              </p>
            </div>
            <QuestionBody question={question} />
          </li>
        ))}
      </ol>
    </div>
  )
}

function FreeText({ texts }: { texts: string[] }) {
  if (texts.length === 0) return <p className="text-sm text-ui-muted">{L.noText}</p>
  return (
    <>
      <p className="text-xs text-ui-muted">{L.freeTextHint}</p>
      <ul className="space-y-2">
        {texts.map((text, i) => (
          // Index keys are fine: the list is sorted text and never reorders.
          <li
            key={i}
            className="rounded-lg border border-ui-border bg-ui-subtle p-3 text-sm whitespace-pre-wrap"
          >
            {/* Shown as written — answers may be in any language. */}
            <span dir="auto">{text}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function QuestionBody({ question }: { question: QuestionResult }) {
  if (question.type === 'text') return <FreeText texts={question.texts} />

  const total = Math.max(question.answered, 1)
  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {question.choices.map((choice) => {
          const share = Math.round((choice.count / total) * 100)
          return (
            <li key={choice.id} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ui-text">{choice.label}</span>
                <span className="numeric text-ui-muted shrink-0">
                  {choice.count} · {share}%
                </span>
              </div>
              <div className="meter" aria-hidden>
                <div className="meter-fill bg-brand-secondary" style={{ width: `${share}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
      {question.type === 'multi' && question.other.length > 0 && (
        <div className="space-y-2">
          <p className="eyebrow">{L.otherAnswers}</p>
          <FreeText texts={question.other} />
        </div>
      )}
    </div>
  )
}
