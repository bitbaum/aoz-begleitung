import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPortalResident } from '@/lib/portal-auth'
import { getRequestTranslator } from '@/lib/i18n/request'
import { idSchema } from '@/lib/validation/schemas'
import { getSurveyForClient } from '@/lib/surveys/invitations'
import { surveyTextsForClient } from '@/lib/surveys/display'
import { choicesOf, fieldName, localize } from '@/lib/surveys/questions'
import { SurveyForm, type RenderedQuestion } from '@/components/portal/SurveyForm'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getRequestTranslator()
  return { title: t('survey.cardTitle') }
}

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

/**
 * Answering an anonymous survey.
 *
 * Only an invited client who has not answered sees the questions. Anyone else
 * — not invited, already answered, survey closed — gets one neutral sentence,
 * and a client who was not invited is not told the survey exists.
 *
 * Questions are resolved into the reader's language HERE, so the client
 * component receives plain strings and never imports a label map.
 */
export default async function PortalSurveyPage({ params }: Props) {
  const me = await getPortalResident()
  if (!me) redirect('/login')

  const { t, locale } = await getRequestTranslator()
  const { id } = await params
  const surveyId = idSchema.safeParse(id)
  const found = surveyId.success ? await getSurveyForClient(surveyId.data, me.id) : null

  if (!found || found.state !== 'open') {
    const message =
      found?.state === 'answered'
        ? t('survey.error.alreadyAnswered')
        : found?.state === 'closed'
          ? t('survey.unavailable')
          : t('survey.error.notInvited')
    return (
      <div className="max-w-2xl space-y-4">
        <p className="alert-info">{message}</p>
        <Link href="/portal" className="btn-outline w-full sm:w-auto">
          {t('survey.backHome')}
        </Link>
      </div>
    )
  }

  const { survey } = found
  const texts = surveyTextsForClient(survey, locale)
  const questions: RenderedQuestion[] = survey.questions.map((question) => ({
    id: question.id,
    name: fieldName(question.id),
    type: question.type,
    prompt: localize(question.prompt, locale),
    choices: choicesOf(question).map((choice) => ({
      id: choice.id,
      label: localize(choice.label, locale),
    })),
    otherLabel:
      question.type === 'multi' && question.other ? localize(question.other.label, locale) : null,
  }))

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ui-text" lang={texts.title.lang}>
          {texts.title.text}
        </h1>
        {texts.intro && (
          <p className="text-ui-muted mt-2" lang={texts.intro.lang}>
            {texts.intro.text}
          </p>
        )}
      </div>

      {/* The promise before the first question, not after the last. */}
      <div className="alert-info space-y-1">
        <p className="font-medium">{t('survey.anonymous')}</p>
        <p className="text-sm">{t('survey.anonymousDetail')}</p>
      </div>

      <SurveyForm
        surveyId={survey.id}
        questions={questions}
        labels={{
          textHint: t('survey.textHint'),
          otherPlaceholder: t('survey.otherPlaceholder'),
          submit: t('survey.submit'),
          sending: t('survey.sending'),
          thanksTitle: t('survey.thanksTitle'),
          thanksBody: t('survey.thanksBody'),
          backHome: t('survey.backHome'),
          errors: {
            empty: t('survey.error.empty'),
            alreadyAnswered: t('survey.error.alreadyAnswered'),
            closed: t('survey.error.closed'),
            notInvited: t('survey.error.notInvited'),
            invalid: t('survey.error.invalid'),
            failed: t('survey.error.failed'),
            signedOut: t('survey.error.signedOut'),
          },
        }}
      />
    </div>
  )
}
