/**
 * The title and intro a CLIENT sees, in their language where that is possible.
 *
 * Staff may edit a survey's title and intro, in German. The template carries
 * hand-translated versions of its own wording. So: while the staff text is
 * still the template's German, the client gets the template's translation;
 * once staff have written their own words, the client gets those words —
 * marked German (`lang="de"`), so a screen reader and an RTL layout treat
 * them as what they are rather than as broken Arabic.
 *
 * Never machine-translated on the way: staff wording is rendered as written.
 */

import { SURVEY_LOCALES, localize, type LocalizedText } from './questions'
import { surveyTemplate } from '@/lib/config/survey-templates'

export interface DisplayText {
  text: string
  /** 'de' when the text is staff-written German shown inside another locale. */
  lang: string
}

export function textForClient(
  staffText: string | null,
  templateText: LocalizedText | undefined,
  locale: string,
): DisplayText | null {
  const own = staffText?.trim() ?? ''
  // Blank means staff removed it — show nothing rather than resurrect it.
  if (own === '') return null
  if (templateText && own === templateText.de.trim()) {
    const spoken = (SURVEY_LOCALES as readonly string[]).includes(locale) ? locale : 'de'
    return { text: localize(templateText, locale), lang: spoken }
  }
  return { text: own, lang: 'de' }
}

export function surveyTextsForClient(
  survey: { templateId: string; title: string; intro: string | null },
  locale: string,
): { title: DisplayText; intro: DisplayText | null } {
  const template = surveyTemplate(survey.templateId)
  return {
    title: textForClient(survey.title, template?.title, locale) ?? {
      text: survey.title,
      lang: 'de',
    },
    intro: textForClient(survey.intro, template?.intro, locale),
  }
}
