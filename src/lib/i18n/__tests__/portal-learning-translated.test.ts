import { availableLocales, createTranslator } from '@/lib/i18n'
import {
  learningAttributionForClient,
  learningFormCopy,
  languageNames,
} from '@/lib/i18n/learning-labels'
import { STAFF_LEARNING_FORM_COPY } from '@/lib/config/learning'
import { visiblePortalNavItems } from '@/lib/config/navigation'

/**
 * `/portal/learning` was half German in English and Arabic: kinds
 * («Sprachtest», «Arbeitsstelle»), the attribution lines and the whole
 * «Nachweis erfassen» form, options included.
 */
describe('the portal learning form speaks the reader’s language', () => {
  const nonGerman = availableLocales()
    .map((locale) => locale.id)
    .filter((id) => id !== 'de')

  it('has offered locales to check', () => {
    expect(nonGerman.length).toBeGreaterThan(0)
  })

  it.each(nonGerman)('%s: no form word falls back to the German staff copy', (locale) => {
    const copy = learningFormCopy(createTranslator(locale), locale)
    const leaked = [
      ...Object.entries(copy.kindLabels).filter(
        ([id, label]) =>
          label === STAFF_LEARNING_FORM_COPY.kindLabels[id as keyof typeof copy.kindLabels],
      ),
      ...Object.entries(copy.statusLabels).filter(
        ([id, label]) =>
          label === STAFF_LEARNING_FORM_COPY.statusLabels[id as keyof typeof copy.statusLabels],
      ),
      ...(copy.chooseLevel === STAFF_LEARNING_FORM_COPY.chooseLevel ? [['chooseLevel']] : []),
      ...(copy.save === STAFF_LEARNING_FORM_COPY.save ? [['save']] : []),
    ]
    // «Integration» and «Kurs» may legitimately coincide in some language;
    // kinds and statuses must not all be the German words.
    expect(leaked.length).toBeLessThan(2)
  })

  it('names languages in the reader’s language', () => {
    expect(languageNames('en').DE).toBe('German')
    expect(languageNames('de').DE).toBe('Deutsch')
  })

  it('credits the role, translated, never «die Betreuung» for a Jobcoach entry', () => {
    const t = createTranslator('en')
    expect(learningAttributionForClient(t, { recordedBy: 'STAFF' }, { role: 'JOBCOACH' })).toBe(
      `${t('learning.enteredByRole')} ${t('care.job')}`,
    )
    expect(learningAttributionForClient(t, { recordedBy: 'STAFF' }, null)).toBe(
      t('learning.enteredByTeam'),
    )
  })
})

describe('«Wohnungen» is not offered to a client it would bounce', () => {
  it('hides the housing browser once the client holds a place', () => {
    const hrefs = visiblePortalNavItems({ placed: true }).map((item) => item.href)
    expect(hrefs).not.toContain('/portal/housing')
  })

  it('still offers it to someone without a place', () => {
    expect(visiblePortalNavItems({ placed: false }).map((item) => item.href)).toContain(
      '/portal/housing',
    )
  })
})
