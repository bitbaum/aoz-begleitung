/**
 * What the assistant may write into an opportunity, held to what the form
 * submits and what the schema keeps.
 *
 * Three lists have to agree — the AI registry, the `name=` attributes, and
 * `OpportunityFieldsSchema` — and every way they can disagree is silent:
 *
 *  - a registry field the schema drops is filled by the model, shown to the
 *    coach, and thrown away on save (zod strips unknown keys);
 *  - a registry field the form does not render is written into a store that
 *    nothing displays, so the coach never sees what was inferred;
 *  - a form field missing from the registry simply never gets assistance, and
 *    nothing anywhere says so.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AI_FORMS,
  OPPORTUNITY_AI_EXCLUDED,
  OPPORTUNITY_FIELDS,
  OPPORTUNITY_FORM,
} from '@/lib/config/ai-forms'
import { OpportunityFieldsSchema } from '@/lib/validation'

const COMPONENT = join(process.cwd(), 'src/components/opportunities/OpportunityFormFields.tsx')
const source = readFileSync(COMPONENT, 'utf8')

function renderedNames(): string[] {
  return [...source.matchAll(/\bname="([^"]+)"/g)].map((m) => m[1]).filter((n) => n !== 'id')
}

describe('the assistant writes only real fields', () => {
  it.each(OPPORTUNITY_FIELDS.map((f) => f.name))('«%s» is a key the schema keeps', (name) => {
    expect(Object.keys(OpportunityFieldsSchema.shape)).toContain(name)
  })

  it.each(OPPORTUNITY_FIELDS.map((f) => f.name))('«%s» is a control the coach can see', (name) => {
    expect(renderedNames()).toContain(name)
  })

  it('covers every field the form submits, so none is silently unassisted', () => {
    const registry = OPPORTUNITY_FIELDS.map((f) => f.name)
    expect(renderedNames().filter((name) => !registry.includes(name))).toEqual([])
  })

  it('offers select options wherever it constrains a value', () => {
    // A select without options lets the model return free text into an enum
    // column. Excluded fields need none — the model never sees them.
    for (const field of OPPORTUNITY_FIELDS) {
      if (field.type !== 'select' || field.aiExcluded) continue
      expect({ name: field.name, hasOptions: (field.options?.length ?? 0) > 0 }).toEqual({
        name: field.name,
        hasOptions: true,
      })
    }
  })
})

describe('the two fields a model must never write', () => {
  /**
   * `permitRequirement` defaults to NONE, which renders to a resident as
   * "Keine Bewilligung nötig" — a legal claim about that person's situation.
   * `permitRequirementIsStated` refuses to publish work without a stated
   * route precisely so that nobody guesses it. A model inferring one from a
   * job ad would hand the coach a confident sentence to review instead of an
   * empty field to fill, and an empty field is the thing that asks a human to
   * go and find out.
   *
   * `status` decides whether residents see this at all. Publishing is a
   * decision, not a value inferable from the prose of an advertisement.
   */
  it.each(OPPORTUNITY_AI_EXCLUDED)('%s is marked aiExcluded', (name) => {
    const field = OPPORTUNITY_FIELDS.find((f) => f.name === name)
    expect({ name, excluded: field?.aiExcluded }).toEqual({ name, excluded: true })
  })

  it('excludes nothing else — every other field is assistable', () => {
    const excluded = OPPORTUNITY_FIELDS.filter((f) => f.aiExcluded).map((f) => f.name)
    expect(excluded.sort()).toEqual([...OPPORTUNITY_AI_EXCLUDED].sort())
  })

  it('tells the model in words as well, not only by omission', () => {
    // Belt and braces: the field is withheld from the prompt, AND the prompt
    // says not to answer the question. A future refactor that reinstated the
    // field would still meet an instruction against filling it.
    const said = OPPORTUNITY_FORM.instructions?.some((line) =>
      line.toLowerCase().includes('bewilligungsweg'),
    )
    expect(said).toBe(true)
  })

  it('never asks the model for anything about the person', () => {
    const prompt = [
      ...(OPPORTUNITY_FORM.instructions ?? []),
      ...OPPORTUNITY_FIELDS.map((f) => `${f.label} ${f.hint ?? ''}`),
    ]
      .join(' ')
      .toLowerCase()

    for (const forbidden of [
      'aufenthaltsstatus erfassen',
      'nationalität',
      'religion',
      'diagnose',
    ]) {
      expect(prompt).not.toContain(forbidden)
    }
  })
})

/**
 * What a real ad did to the form (2026-10-01, «Fachleiter*in Velowerkstatt»):
 * «Einwandfreie Deutschkenntnisse» became C2, «Pensum 80–100%» and the salary
 * were lost, and the contact came back as "Florian Jenzer; Michelle Straub"
 * with one person's phone and the other's email. Each rule below is said to the
 * model in its instructions AND on the field it governs, because a field hint
 * travels with the field into every prompt the package builds.
 */
describe('the rules a real job ad broke', () => {
  const instructions = (OPPORTUNITY_FORM.instructions ?? []).join('\n')
  const hintOf = (name: string) => OPPORTUNITY_FIELDS.find((f) => f.name === name)?.hint ?? ''

  it('sets a German level only when a CEFR level is named, else keeps the wording', () => {
    for (const text of [instructions, hintOf('germanLevel')]) {
      expect(text).toMatch(/A1/)
      expect(text).toMatch(/C2/)
      expect(text).toMatch(/leer/i)
      expect(text).toMatch(/Hinweis zu den Voraussetzungen/)
    }
    expect(instructions).toMatch(/nie ein Niveau/i)
  })

  it('never converts a percentage Pensum into hours', () => {
    expect(instructions).toMatch(/Pensum/)
    expect(hintOf('hoursPerWeek')).toMatch(/Prozent/)
    expect(hintOf('hoursPerWeek')).toMatch(/nicht umrechnen/)
    expect(hintOf('schedule')).toMatch(/Pensum/)
  })

  it('puts pay into the description for work only — there is no price field', () => {
    expect(instructions).toMatch(/Lohn: …/)
    expect(instructions).toMatch(/EMPLOYMENT, INTERNSHIP/)
    expect(instructions).toMatch(/kein Preis- oder Lohnfeld/)
    // The marketplace rule: no money field, on any form, ever.
    const names = OPPORTUNITY_FIELDS.map((f) => f.name.toLowerCase())
    for (const forbidden of ['price', 'salary', 'wage', 'lohn', 'preis']) {
      expect(names.some((name) => name.includes(forbidden))).toBe(false)
    }
    expect(
      Object.keys(OpportunityFieldsSchema.shape).some((key) => /price|salary|lohn/i.test(key)),
    ).toBe(false)
  })

  it('takes exactly one contact person whose details belong together', () => {
    expect(instructions).toMatch(/Genau EINE Ansprechperson/)
    expect(instructions).toMatch(/Verbinde nie zwei Namen/)
    expect(hintOf('contactName')).toMatch(/EINE Person/)
    expect(hintOf('contactEmail')).toMatch(/Ansprechperson/)
    expect(hintOf('contactPhone')).toMatch(/Ansprechperson/)
  })
})

describe('the form is actually reachable by the assistant', () => {
  it('is registered, so the API route can resolve it by key', () => {
    // The client sends a target key and never a field list. A form absent from
    // AI_FORMS renders an assist bar whose every request is rejected.
    expect(AI_FORMS.map((form) => form.key)).toContain('opportunity')
  })

  it('the component asks for that same key', () => {
    expect(source).toContain('OPPORTUNITY_FORM.key')
  })
})
