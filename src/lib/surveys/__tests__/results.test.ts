/**
 * The k rule and the free-text order. Below k nothing at all comes back; at
 * and above k, counts and free text — the text in an order that says nothing
 * about who wrote it or when.
 */

import type { LocalizedText, SurveyQuestion } from '../questions'
import { effectiveMinResponses, orderFreeText, summarizeSurvey } from '../results'

const T = (de: string): LocalizedText => ({ de, en: de, fr: de, uk: de, ru: de, ar: de })
const QUESTIONS: SurveyQuestion[] = [
  {
    id: 'lonely',
    type: 'scale',
    prompt: T('Einsam?'),
    steps: [
      { id: 'never', label: T('Nie') },
      { id: 'sometimes', label: T('Manchmal') },
      { id: 'often', label: T('Oft') },
    ],
  },
  {
    id: 'missing',
    type: 'multi',
    prompt: T('Was fehlt?'),
    options: [
      { id: 'internet', label: T('Internet') },
      { id: 'furniture', label: T('Möbel') },
    ],
    other: { label: T('Sonstiges') },
  },
  { id: 'anything', type: 'text', prompt: T('Noch etwas?') },
]

const answer = (lonely: string, text?: string) => ({ lonely, ...(text ? { anything: text } : {}) })

describe('the k rule', () => {
  it.each([
    [0, 5, 'too-few'],
    [4, 5, 'too-few'],
    [5, 5, 'ready'],
    [6, 5, 'ready'],
    [2, 3, 'too-few'],
    [3, 3, 'ready'],
  ])('%i responses with k=%i → %s', (n, k, kind) => {
    const answers = Array.from({ length: n }, (_, i) => answer('often', `text ${i}`))
    expect(summarizeSurvey(QUESTIONS, answers, k, 'CLOSED').kind).toBe(kind)
  })

  it('below k returns ONLY the count and k — no aggregates, no free text', () => {
    const answers = [answer('often', 'Ich bin sehr allein'), answer('never')]
    const result = summarizeSurvey(QUESTIONS, answers, 5, 'CLOSED')
    expect(result).toEqual({ kind: 'too-few', responses: 2, minResponses: 5 })
    expect(JSON.stringify(result)).not.toContain('allein')
    expect(JSON.stringify(result)).not.toContain('often')
  })

  it('never lets a stored k below the floor switch the rule off', () => {
    expect(effectiveMinResponses(1)).toBe(3)
    expect(effectiveMinResponses(0)).toBe(3)
    expect(effectiveMinResponses(-4)).toBe(3)
    expect(effectiveMinResponses(7)).toBe(7)
    expect(summarizeSurvey(QUESTIONS, [answer('often')], 1, 'CLOSED').kind).toBe('too-few')
  })
})

describe('aggregates', () => {
  it('counts choices per question and how many answered it', () => {
    const answers = [
      { lonely: 'often', missing: { selected: ['internet'] } },
      { lonely: 'often', missing: { selected: ['internet', 'furniture'], other: 'Lampe' } },
      { lonely: 'never' },
      { lonely: 'sometimes', anything: 'Danke' },
      { missing: { selected: [], other: 'Bett' } },
    ]
    const result = summarizeSurvey(QUESTIONS, answers, 5, 'CLOSED')
    if (result.kind !== 'ready') throw new Error('expected results')
    const [lonely, missing, anything] = result.questions
    expect(lonely).toMatchObject({
      answered: 4,
      choices: [
        { id: 'never', count: 1 },
        { id: 'sometimes', count: 1 },
        { id: 'often', count: 2 },
      ],
    })
    expect(missing).toMatchObject({
      answered: 3,
      choices: [
        { id: 'internet', count: 2 },
        { id: 'furniture', count: 1 },
      ],
      other: ['Bett', 'Lampe'],
    })
    expect(anything).toMatchObject({ answered: 1, texts: ['Danke'] })
  })

  it('ignores values that no longer match the question rather than counting them', () => {
    const answers = Array.from({ length: 5 }, () => ({ lonely: 'removed-step' }))
    const result = summarizeSurvey(QUESTIONS, answers, 5, 'CLOSED')
    if (result.kind !== 'ready') throw new Error('expected results')
    expect(result.questions[0].answered).toBe(0)
  })
})

describe('free text carries no order', () => {
  it('is alphabetical, whatever order the responses arrived in', () => {
    const arrival = [
      'Zimmer ist kalt',
      'alles gut',
      'Mehr Ruhe',
      'Ärger mit Nachbarn',
      'brauche WLAN',
    ]
    const answers = arrival.map((text) => answer('never', text))
    const result = summarizeSurvey(QUESTIONS, answers, 5, 'CLOSED')
    if (result.kind !== 'ready') throw new Error('expected results')
    const texts = result.questions[2].type === 'text' ? result.questions[2].texts : []
    expect(texts).toEqual([
      'alles gut',
      'Ärger mit Nachbarn',
      'brauche WLAN',
      'Mehr Ruhe',
      'Zimmer ist kalt',
    ])
    expect(texts).not.toEqual(arrival)
    // The same set in reverse arrival order gives the same list.
    const reversed = summarizeSurvey(QUESTIONS, [...answers].reverse(), 5, 'CLOSED')
    expect(reversed).toEqual(result)
  })

  it('orderFreeText does not mutate its input', () => {
    const input = ['b', 'a']
    expect(orderFreeText(input)).toEqual(['a', 'b'])
    expect(input).toEqual(['b', 'a'])
  })
})

describe('results wait for the close', () => {
  it('shows only the count while a survey is open, however many have answered', () => {
    // Open results could be diffed answer by answer: show none until CLOSED.
    const many = Array.from({ length: 12 }, () => answer('often'))
    for (const status of ['DRAFT', 'OPEN'] as const) {
      expect(summarizeSurvey(QUESTIONS, many, 5, status)).toEqual({
        kind: 'still-open',
        responses: 12,
      })
    }
    expect(summarizeSurvey(QUESTIONS, many, 5, 'CLOSED').kind).toBe('ready')
  })
})
