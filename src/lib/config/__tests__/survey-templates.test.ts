/**
 * Every template is valid and speaks every language the portal offers.
 *
 * The second half is the one that rots: the day a sixth dictionary is
 * finished, `availableLocales()` grows, and a resident reading the portal in
 * that language would get a survey in German. This fails first.
 */

import { availableLocales } from '@/lib/i18n'
import { SURVEY_LOCALES, choicesOf, surveyQuestionsSchema } from '@/lib/surveys/questions'
import { SURVEY_MIN_RESPONSES, SURVEY_TEMPLATES, surveyTemplate } from '../survey-templates'

describe('survey templates', () => {
  it('exist', () => {
    expect(SURVEY_TEMPLATES.length).toBeGreaterThan(0)
  })

  it('cover every language the portal offers', () => {
    const offered = availableLocales().map((locale) => locale.id)
    const missing = offered.filter((id) => !(SURVEY_LOCALES as readonly string[]).includes(id))
    expect({ missing }).toEqual({ missing: [] })
  })

  it.each(SURVEY_TEMPLATES.map((template) => [template.id, template]))(
    '%s validates against the question schema',
    (_id, template) => {
      const parsed = surveyQuestionsSchema.safeParse(template.questions)
      expect(parsed.success ? 'valid' : parsed.error.issues).toBe('valid')
    },
  )

  it.each(SURVEY_TEMPLATES.map((template) => [template.id, template]))(
    '%s has every text in every survey language',
    (_id, template) => {
      const texts = [
        template.title,
        template.intro,
        ...template.questions.flatMap((question) => [
          question.prompt,
          ...choicesOf(question).map((choice) => choice.label),
          ...(question.type === 'multi' && question.other ? [question.other.label] : []),
        ]),
      ]
      const holes: string[] = []
      texts.forEach((text, index) => {
        for (const locale of SURVEY_LOCALES) {
          if (!text[locale] || text[locale].trim() === '') holes.push(`${index}:${locale}`)
        }
      })
      expect(holes).toEqual([])
    },
  )

  it('ships "Leben in der Wohnung" with the 21 Wohnen+ questions, in order', () => {
    const template = surveyTemplate('leben-in-der-wohnung')
    expect(template?.questions.map((question) => [question.id, question.type])).toEqual([
      ['ageGroup', 'single'],
      ['household', 'single'],
      ['duration', 'single'],
      ['wellbeing', 'scale'],
      ['noise', 'scale'],
      ['safetyNeighbourhood', 'scale'],
      ['safetyFlat', 'scale'],
      ['missing', 'multi'],
      ['cooking', 'single'],
      ['everydayProblems', 'scale'],
      ['biggestProblems', 'text'],
      ['money', 'scale'],
      ['moneyWishes', 'text'],
      ['socialContact', 'single'],
      ['loneliness', 'scale'],
      ['health', 'scale'],
      ['healthSupport', 'multi'],
      ['aozSatisfaction', 'scale'],
      ['aozHelpGood', 'multi'],
      ['aozMissing', 'text'],
      ['anythingElse', 'text'],
    ])
  })

  it('keeps k at or above its floor by default', () => {
    expect(SURVEY_MIN_RESPONSES.default).toBeGreaterThanOrEqual(SURVEY_MIN_RESPONSES.min)
    expect(SURVEY_MIN_RESPONSES.min).toBeGreaterThanOrEqual(3)
  })
})
