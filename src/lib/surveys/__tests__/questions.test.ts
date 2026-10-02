/**
 * Question shapes and answer parsing. The answer parser is the gate in front
 * of the one table promised to hold nothing about a person, so it must refuse
 * anything it does not recognise rather than ignore it.
 */

import { BRAND } from '@/lib/config/brand'
import {
  ORG_TOKEN,
  localize,
  answersFromFormData,
  parseAnswers,
  questionSchema,
  surveyQuestionsSchema,
  type LocalizedText,
  type SurveyQuestion,
} from '../questions'

const T = (de: string): LocalizedText => ({ de, en: de, fr: de, uk: de, ru: de, ar: de })
const opt = (id: string) => ({ id, label: T(id) })

const SINGLE: SurveyQuestion = {
  id: 'cooking',
  type: 'single',
  prompt: T('Kochen?'),
  options: [opt('yes'), opt('no')],
}
const SCALE: SurveyQuestion = {
  id: 'noise',
  type: 'scale',
  prompt: T('Lärm?'),
  steps: [opt('never'), opt('sometimes'), opt('often')],
}
const MULTI: SurveyQuestion = {
  id: 'missing',
  type: 'multi',
  prompt: T('Was fehlt?'),
  options: [opt('furniture'), opt('internet')],
  other: { label: T('Sonstiges') },
}
const MULTI_NO_OTHER: SurveyQuestion = {
  id: 'help',
  type: 'multi',
  prompt: T('Hilfe?'),
  options: [opt('doctor'), opt('none')],
}
const TEXT: SurveyQuestion = { id: 'anything', type: 'text', prompt: T('Noch etwas?') }
const QUESTIONS = [SINGLE, SCALE, MULTI, MULTI_NO_OTHER, TEXT]

describe('question validation', () => {
  it.each([
    ['a valid single', SINGLE, true],
    ['a valid scale', SCALE, true],
    ['a valid multi with other', MULTI, true],
    ['a valid text', TEXT, true],
    ['a single with one option', { ...SINGLE, options: [opt('yes')] }, false],
    ['a scale with two steps', { ...SCALE, steps: [opt('a'), opt('b')] }, false],
    ['an unknown type', { ...TEXT, type: 'ranking' }, false],
    ['a prompt missing Arabic', { ...TEXT, prompt: { ...T('x'), ar: undefined } }, false],
    ['a prompt with an empty locale', { ...TEXT, prompt: { ...T('x'), uk: '  ' } }, false],
    ['a prompt with an extra locale', { ...TEXT, prompt: { ...T('x'), xx: 'y' } }, false],
    ['an id that is not a key', { ...TEXT, id: 'Has Space' }, false],
    ['an unknown property', { ...TEXT, residentId: 'r1' }, false],
  ])('%s → %s', (_label, question, valid) => {
    expect(questionSchema.safeParse(question).success).toBe(valid)
  })

  it('refuses duplicate question ids and duplicate option ids', () => {
    expect(surveyQuestionsSchema.safeParse([TEXT, TEXT]).success).toBe(false)
    expect(
      surveyQuestionsSchema.safeParse([{ ...SINGLE, options: [opt('yes'), opt('yes')] }]).success,
    ).toBe(false)
    expect(surveyQuestionsSchema.safeParse(QUESTIONS).success).toBe(true)
  })

  it('refuses an empty survey', () => {
    expect(surveyQuestionsSchema.safeParse([]).success).toBe(false)
  })
})

describe('parseAnswers', () => {
  it.each([
    ['a single choice', { cooking: 'yes' }, { cooking: 'yes' }],
    ['a scale step', { noise: 'often' }, { noise: 'often' }],
    ['text, trimmed', { anything: '  Danke  ' }, { anything: 'Danke' }],
    [
      'multi with other',
      { missing: { selected: ['internet', 'internet'], other: ' Ein Tisch ' } },
      { missing: { selected: ['internet'], other: 'Ein Tisch' } },
    ],
    [
      'multi with only other',
      { missing: { selected: [], other: 'Licht' } },
      { missing: { selected: [], other: 'Licht' } },
    ],
    ['skipped questions are absent', { cooking: 'no', anything: '' }, { cooking: 'no' }],
  ])('accepts %s', (_label, raw, expected) => {
    expect(parseAnswers(QUESTIONS, raw)).toEqual({ ok: true, answers: expected })
  })

  it.each([
    ['an unknown question id — nothing rides along', { cooking: 'yes', residentId: 'r1' }],
    ['an option that does not exist', { cooking: 'maybe' }],
    ['a number for a single', { cooking: 1 }],
    ['an array for a single', { cooking: ['yes'] }],
    ['an unknown multi option', { missing: { selected: ['car'] } }],
    ['an extra key inside a multi answer', { missing: { selected: ['internet'], at: '12:00' } }],
    ['other on a multi without other', { help: { selected: ['doctor'], other: 'x' } }],
    ['text over the limit', { anything: 'x'.repeat(2001) }],
    ['not an object', 'cooking=yes'],
    ['an array', ['yes']],
  ])('refuses %s', (_label, raw) => {
    expect(parseAnswers(QUESTIONS, raw)).toEqual({ ok: false, reason: 'invalid' })
  })

  it('refuses a submission with nothing answered', () => {
    expect(parseAnswers(QUESTIONS, {})).toEqual({ ok: false, reason: 'empty' })
    expect(parseAnswers(QUESTIONS, { anything: '   ', missing: { selected: [] } })).toEqual({
      ok: false,
      reason: 'empty',
    })
  })
})

describe('answersFromFormData', () => {
  it('reads radios, checkboxes, other and text into the parser shape', () => {
    const form = new FormData()
    form.append('surveyId', 'ignored')
    form.append('q:cooking', 'yes')
    form.append('q:missing', 'furniture')
    form.append('q:missing', 'internet')
    form.append('q:missing:other', 'Lampe')
    form.append('q:anything', 'Hallo')
    const raw = answersFromFormData(QUESTIONS, form)
    expect(parseAnswers(QUESTIONS, raw)).toEqual({
      ok: true,
      answers: {
        cooking: 'yes',
        missing: { selected: ['furniture', 'internet'], other: 'Lampe' },
        anything: 'Hallo',
      },
    })
  })

  it('never carries a field that is not a question', () => {
    const form = new FormData()
    form.append('surveyId', 's1')
    form.append('residentId', 'r1')
    form.append('q:cooking', 'no')
    expect(Object.keys(answersFromFormData(QUESTIONS, form))).not.toContain('residentId')
    expect(Object.keys(answersFromFormData(QUESTIONS, form))).not.toContain('surveyId')
  })
})

describe('the organisation name', () => {
  it('is filled from the brand in every language, never shown as a token', () => {
    const text: LocalizedText = { ...T('Hilfe von {org}'), ar: 'مساعدة من {org}' }
    for (const locale of ['de', 'ar', 'fa']) {
      const out = localize(text, locale)
      expect(out).not.toContain(ORG_TOKEN)
      expect(out).toContain(BRAND.orgName)
    }
  })
})
