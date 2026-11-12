/**
 * Guards for the AI form registry.
 *
 * The registry is derived from RESIDENT_FACTORS, so most drift is impossible
 * by construction. What is still possible — and what these tests pin — is:
 *
 *  1. The option values the model is offered drifting from the ones
 *     ResidentInputSchema accepts. That failure looks like a form that fills
 *     itself in beautifully and then refuses to save.
 *  2. A field reaching the model that should never have. This form describes
 *     an asylum seeker, so "the model may write it" is a decision that
 *     deserves a test, not a comment.
 *  3. Config defaults leaking into stored values, which would silently record
 *     answers nobody gave and turn every instruction into a refine.
 */

import { redactExcluded, runFormAssist } from '@fleet/ai-forms'
import {
  RESIDENT_INTAKE_FIELDS,
  RESIDENT_INTAKE_FORM,
  residentIntakeInitialValues,
  AI_EXCLUDED_FACTOR_IDS,
  AI_HEALTH_SECTION_ID,
} from '../ai-forms'
import { factorDisplayValue } from '../factor-fields'
import { RESIDENT_FACTORS, getFactorsBySection } from '../resident-factors'
import { ResidentInputSchema } from '@/lib/validation/schemas'

const field = (name: string) => {
  const spec = RESIDENT_INTAKE_FIELDS.find((f) => f.name === name)
  if (!spec) throw new Error(`No field "${name}" in the resident intake registry`)
  return spec
}

const writable = RESIDENT_INTAKE_FIELDS.filter((f) => !f.aiExcluded).map((f) => f.name)

/** Stands in for the model, returning exactly what a test wants it to say. */
const modelReturning =
  (values: Record<string, unknown>, message = '') =>
  async () =>
    JSON.stringify({ values, message })

describe('resident intake registry — derived from RESIDENT_FACTORS', () => {
  it('exposes every configured factor', () => {
    expect(RESIDENT_INTAKE_FIELDS.map((f) => f.name).sort()).toEqual(
      Object.keys(RESIDENT_FACTORS).sort(),
    )
  })

  it('offers exactly the options each factor defines', () => {
    for (const factor of Object.values(RESIDENT_FACTORS)) {
      if (factor.type !== 'enum' && factor.type !== 'multi') continue
      expect(field(factor.id).options?.map((o) => o.value)).toEqual([...factor.options])
    }
  })

  it('bounds every scale by the factor it came from', () => {
    for (const factor of Object.values(RESIDENT_FACTORS)) {
      if (factor.type !== 'scale') continue
      const spec = field(factor.id)
      expect([spec.min, spec.max]).toEqual([factor.min, factor.max])
    }
  })

  it('tells the model which way each scale runs', () => {
    // "1 to 5" alone leaves the model even odds of inverting a scale, and an
    // inverted Lärmtoleranz is a placement decision made backwards.
    for (const factor of Object.values(RESIDENT_FACTORS)) {
      if (factor.type !== 'scale') continue
      const hint = field(factor.id).hint ?? ''
      expect(hint).toContain(factor.lowLabel)
      expect(hint).toContain(factor.highLabel)
    }
  })
})

describe('resident intake registry — what the model may write', () => {
  it('has a validator for every factor the form collects', () => {
    // Regression guard. guestTolerance and conflictStyle were rendered in the
    // form, stored in Prisma and weighted by the matching algorithm, but were
    // absent from ResidentInputSchema — so zod stripped every answer and each
    // resident was written with the column default. Nothing surfaced it,
    // because a dropped answer and a real answer of "3"/"COOPERATIVE" are
    // indistinguishable once saved. Adding a factor without a validator now
    // fails here instead of quietly discarding what staff typed.
    const shape = ResidentInputSchema.shape as Record<string, unknown>
    const unvalidated = Object.keys(RESIDENT_FACTORS).filter((id) => !(id in shape))
    expect(unvalidated).toEqual([])
  })

  it('offers only values ResidentInputSchema accepts', () => {
    // The registry and the validator are different files, and a form that
    // fills in an unacceptable value is worse than one that fills in nothing.
    const shape = ResidentInputSchema.shape as Record<
      string,
      { safeParse: (v: unknown) => { success: boolean } }
    >

    for (const spec of RESIDENT_INTAKE_FIELDS) {
      const validator = shape[spec.name]
      if (!validator) continue // reported by the test above
      if (spec.type === 'select') {
        for (const option of spec.options ?? []) {
          expect({
            field: spec.name,
            value: option.value,
            ok: validator.safeParse(option.value).success,
          }).toEqual({ field: spec.name, value: option.value, ok: true })
        }
      }
      if (spec.type === 'multiselect') {
        const all = (spec.options ?? []).map((o) => o.value)
        expect(validator.safeParse(all).success).toBe(true)
      }
    }
  })

  it('never lets the model invent a resident code', () => {
    // `code` is an AOZ-issued reference, not a fact about the person. A
    // plausible invented one either collides with a real resident or creates
    // an untraceable record.
    expect(AI_EXCLUDED_FACTOR_IDS.has('code')).toBe(true)
    expect(field('code').aiExcluded).toBe(true)
    expect(writable).not.toContain('code')
  })

  it('never shows the model a health or support factor, nor lets it write one', () => {
    // /ki-datenschutz promises that the form assistant never sends medical
    // information. The edit form sends every non-excluded stored value as
    // "current values", so an assistable health field is a broken promise.
    const health = [
      ...getFactorsBySection(AI_HEALTH_SECTION_ID).map((factor) => factor.id),
      'medicalEquipment',
      'mobilityNeeds',
    ]
    expect(health).toEqual(
      expect.arrayContaining(['hasSleepEquipment', 'hasNightDisturbances', 'roomSharingStatus']),
    )
    for (const name of health) {
      expect({ name, excluded: field(name).aiExcluded }).toEqual({ name, excluded: true })
      expect(writable).not.toContain(name)
    }
  })

  it('does not send stored health values as current values', () => {
    const values = { medicalEquipment: true, hasSleepEquipment: true, noiseTolerance: 3 }
    const sent = redactExcluded(values, RESIDENT_INTAKE_FIELDS)
    expect(sent).not.toHaveProperty('medicalEquipment')
    expect(sent).not.toHaveProperty('hasSleepEquipment')
    expect(sent).toHaveProperty('noiseTolerance', 3)
  })

  it('keeps medical documentation entirely out of the registry', () => {
    // These are collected by a separate, deliberately uncontrolled section, so
    // the model is never shown them and cannot write them.
    for (const name of [
      'hasMedicalDocumentation',
      'medicalDocType',
      'medicalDocDate',
      'medicalDocNotes',
    ]) {
      expect(RESIDENT_INTAKE_FIELDS.find((f) => f.name === name)).toBeUndefined()
    }
  })
})

describe('starting values — a default is not an answer', () => {
  it('starts every factor unanswered', () => {
    const initial = residentIntakeInitialValues()
    for (const id of Object.keys(RESIDENT_FACTORS)) {
      expect({ id, value: initial[id] }).toEqual({ id, value: null })
    }
  })

  it('still shows the configured default for an unanswered field', () => {
    // petTolerance defaults to true: staff must see "Ja" pre-ticked, without
    // the form recording a consent nobody gave.
    expect(factorDisplayValue(RESIDENT_FACTORS.petTolerance, null)).toBe(true)
    expect(factorDisplayValue(RESIDENT_FACTORS.noiseTolerance, null)).toBe(3)
    expect(factorDisplayValue(RESIDENT_FACTORS.roomSharingStatus, null)).toBe('CAN_SHARE')
  })

  it('does not mistake an explicit "no" for an unanswered question', () => {
    // The whole reason unanswered is null: `false` is a real answer and must
    // survive rather than fall back to the default of true.
    expect(factorDisplayValue(RESIDENT_FACTORS.petTolerance, false)).toBe(false)
  })

  it('carries saved values through for the edit form', () => {
    const initial = residentIntakeInitialValues({ code: 'R-2024-001', noiseTolerance: 5 })
    expect(initial.code).toBe('R-2024-001')
    expect(initial.noiseTolerance).toBe(5)
    expect(initial.privacyNeed).toBeNull()
  })

  it('refuses to carry anything that is not a declared factor', () => {
    // Load-bearing for privacy, not tidiness. The assistant sends the whole
    // value bag to the model as "current values in the form", and the package
    // can only redact fields it knows about. An undeclared key sails past that
    // filter into the prompt — and the edit page passes the resident's medical
    // documentation in alongside the factors.
    const initial = residentIntakeInitialValues({
      code: 'R-2024-001',
      hasMedicalDocumentation: true,
      medicalDocType: 'PRIVATE_ROOM',
      medicalDocDate: '2026-01-01',
      medicalDocNotes: 'Ref 12345, ausgestellt von der Klinik',
    })

    expect(Object.keys(initial).sort()).toEqual(Object.keys(RESIDENT_FACTORS).sort())
    for (const leaked of [
      'hasMedicalDocumentation',
      'medicalDocType',
      'medicalDocDate',
      'medicalDocNotes',
    ]) {
      expect(initial).not.toHaveProperty(leaked)
    }
  })
})

describe('assist behaviour on this form', () => {
  const intake = {
    target: RESIDENT_INTAKE_FORM,
    request: {
      intent: 'fill' as const,
      instruction:
        'Frau, 34, alleinstehend. Spricht Arabisch und etwas Deutsch. Steht früh auf, raucht nur draussen.',
      values: residentIntakeInitialValues(),
    },
  }

  it("lands the model's answers in the form", async () => {
    const result = await runFormAssist({
      ...intake,
      complete: modelReturning({
        gender: 'FEMALE',
        ageRange: 'ADULT',
        familyStatus: 'SINGLE',
        languages: ['AR', 'DE'],
        sleepSchedule: 'EARLY_BIRD',
        smokingStatus: 'OUTDOOR_SMOKER',
      }),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.values.gender).toBe('FEMALE')
    expect(result.values.languages).toEqual(['AR', 'DE'])
    expect(result.values.smokingStatus).toBe('OUTDOOR_SMOKER')
    // Nothing was said about noise, so nothing was recorded about noise — and
    // the field still shows its configured default rather than an answer.
    expect(result.values.noiseTolerance ?? null).toBeNull()
    expect(factorDisplayValue(RESIDENT_FACTORS.noiseTolerance, result.values.noiseTolerance)).toBe(
      3,
    )
  })

  it('drops a value the factor does not offer', async () => {
    const result = await runFormAssist({
      ...intake,
      complete: modelReturning({ gender: 'FEMALE', smokingStatus: 'SOMETIMES' }),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.values.smokingStatus ?? null).toBeNull()
    expect(result.changed).not.toContain('smokingStatus')
  })

  it('protects what the caseworker already typed', async () => {
    const result = await runFormAssist({
      ...intake,
      request: {
        ...intake.request,
        values: { ...residentIntakeInitialValues(), sleepSchedule: 'NIGHT_OWL' },
      },
      complete: modelReturning({ sleepSchedule: 'EARLY_BIRD', gender: 'FEMALE' }),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.values.sleepSchedule).toBe('NIGHT_OWL')
    expect(result.values.gender).toBe('FEMALE')
  })

  it('lets a correction win when the intent is to change something', async () => {
    const result = await runFormAssist({
      target: RESIDENT_INTAKE_FORM,
      request: {
        intent: 'refine',
        instruction: 'sie ist doch Nichtraucherin',
        values: { ...residentIntakeInitialValues(), smokingStatus: 'OUTDOOR_SMOKER' },
      },
      complete: modelReturning({ smokingStatus: 'NON_SMOKER' }),
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.values.smokingStatus).toBe('NON_SMOKER')
    expect(result.changed).toEqual(['smokingStatus'])
  })

  it('reports honestly when the model writes nothing usable', async () => {
    const result = await runFormAssist({ ...intake, complete: modelReturning({}) })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/nothing could be filled in/i)
  })
})
