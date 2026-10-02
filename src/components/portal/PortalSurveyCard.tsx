import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import type { MessageKey } from '@/lib/i18n'
import type { DisplayText } from '@/lib/surveys/display'

export interface PortalSurveyCardItem {
  id: string
  title: DisplayText
}

/**
 * An open survey this client was invited to and has not answered.
 *
 * The anonymity promise sits ON the card, in the reader's language, before
 * they decide to open it — whether you dare answer a question about money or
 * loneliness depends on knowing who will read it. Gone once answered.
 */
export function PortalSurveyCard({
  surveys,
  t,
}: {
  surveys: PortalSurveyCardItem[]
  t: (key: MessageKey) => string
}) {
  if (surveys.length === 0) return null
  return (
    <section className="card mb-6 border-brand-secondary/40">
      <div className="flex items-start gap-3">
        <span className="icon-container shrink-0" aria-hidden>
          <ClipboardList className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="eyebrow">{t('survey.cardTitle')}</h2>
          <ul className="mt-2 space-y-3">
            {surveys.map((survey) => (
              <li key={survey.id}>
                <p className="font-semibold text-ui-text" lang={survey.title.lang}>
                  {survey.title.text}
                </p>
                <p className="text-sm text-ui-muted mt-1">{t('survey.anonymous')}</p>
                <Link
                  href={`/portal/surveys/${survey.id}`}
                  className="btn-secondary mt-3 w-full sm:w-auto"
                >
                  {t('survey.cardAction')}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
