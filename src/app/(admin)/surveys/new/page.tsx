import type { Metadata } from 'next'
import { requirePermission } from '@/lib/auth'
import { SURVEY_MIN_RESPONSES, SURVEY_TEMPLATES } from '@/lib/config/survey-templates'
import { SURVEY_LABELS as L } from '@/lib/constants/labels/surveys'
import { PageHeader, PageShell } from '@/components/ui/Page'
import { NewSurveyForm } from '@/components/surveys/SurveyForms'

export const metadata: Metadata = { title: 'Neue Umfrage' }

export default async function NewSurveyPage() {
  await requirePermission('surveys:write')

  return (
    <PageShell>
      <PageHeader
        title={L.newTitle}
        description={L.newDescription}
        backHref="/surveys"
        backLabel={L.back}
      />
      <div className="max-w-2xl">
        <NewSurveyForm
          templates={SURVEY_TEMPLATES.map((template) => ({
            id: template.id,
            title: template.title.de,
            intro: template.intro.de,
            questionCount: template.questions.length,
          }))}
          minResponses={SURVEY_MIN_RESPONSES}
        />
      </div>
    </PageShell>
  )
}
