/**
 * AI Form Registry
 *
 * SINGLE SOURCE OF TRUTH for which forms the assistant may write, and what it
 * is allowed to put in them. The API route resolves a form by key from here —
 * the client names a form, never a field, so a request cannot widen the set of
 * fields the model can touch.
 *
 * The resident intake form is DERIVED from RESIDENT_FACTORS rather than
 * retyped. That matters more here than the usual DRY argument: the options the
 * model is offered must be exactly the options ResidentInputSchema accepts, or
 * the form fills itself in and then refuses to save. Deriving makes that
 * impossible to get wrong, and means a new factor is assistable the moment it
 * is added to the config — no second list to remember.
 *
 * What the model must NOT touch is listed in AI_EXCLUDED_FACTOR_IDS below.
 */

import { type FieldSpec, type FormTarget } from '@fleet/ai-forms'
import { RESIDENT_FACTORS, getFactorsBySection, RESIDENT_FORM_SECTIONS } from './resident-factors'
import { isTextareaFactor } from './factor-fields'
import type { CompatibilityFactorDef } from './types'
import { OPPORTUNITY_AREA_NAME, OPPORTUNITY_KIND_LABELS } from './opportunities'
import { CEFR_LEVELS } from './learning'

/**
 * Factors the assistant may never write.
 *
 * `code` is the resident's anonymous reference number. It is an identifier
 * issued by AOZ, not a fact about the person, so a model inventing a
 * plausible-looking one is strictly worse than leaving it blank — it would
 * either collide with a real resident or create an untraceable record.
 */
export const AI_EXCLUDED_FACTOR_IDS: ReadonlySet<string> = new Set(['code'])

/** Longest free-text the model may write into a notes field. */
const MAX_AI_TEXT = 2000

/**
 * A scale means nothing to the model without its direction: 1–5 on
 * "Lärmtoleranz" runs from "sehr empfindlich" to "sehr tolerant", and a model
 * told only "1 to 5" has even odds of inverting it.
 */
function scaleHint(factor: CompatibilityFactorDef & { type: 'scale' }): string {
  const direction = `${factor.min} = ${factor.lowLabel}, ${factor.max} = ${factor.highLabel}.`
  return factor.description ? `${factor.description} ${direction}` : direction
}

function toOptions(factor: { options: readonly string[]; optionLabels: Record<string, string> }) {
  return factor.options.map((value) => ({ value, label: factor.optionLabels[value] ?? value }))
}

/** Map one AOZ factor definition onto the package's field spec. */
export function factorToFieldSpec(factor: CompatibilityFactorDef): FieldSpec {
  const base = {
    name: factor.id,
    label: factor.label,
    ...(factor.required ? { required: true } : {}),
    ...(AI_EXCLUDED_FACTOR_IDS.has(factor.id) ? { aiExcluded: true } : {}),
  }

  switch (factor.type) {
    case 'enum':
      return {
        ...base,
        type: 'select',
        options: toOptions(factor),
        ...(factor.description ? { hint: factor.description } : {}),
      }
    case 'multi':
      return {
        ...base,
        type: 'multiselect',
        options: toOptions(factor),
        ...(factor.description ? { hint: factor.description } : {}),
      }
    case 'scale':
      return { ...base, type: 'number', min: factor.min, max: factor.max, hint: scaleHint(factor) }
    case 'boolean':
      return {
        ...base,
        type: 'boolean',
        ...(factor.description ? { hint: factor.description } : {}),
      }
    case 'text':
      return {
        ...base,
        type: isTextareaFactor(factor) ? 'textarea' : 'text',
        maxLength: MAX_AI_TEXT,
        ...(factor.description ? { hint: factor.description } : {}),
        ...(factor.placeholder ? { placeholder: factor.placeholder } : {}),
      }
  }
}

/** Every resident factor, in the order the form renders them. */
export const RESIDENT_INTAKE_FIELDS: readonly FieldSpec[] = [...RESIDENT_FORM_SECTIONS]
  .sort((a, b) => a.order - b.order)
  .flatMap((section) => getFactorsBySection(section.id))
  .map(factorToFieldSpec)

/**
 * The form's starting values: every factor `null`, meaning "nobody has
 * answered this yet".
 *
 * Config defaults deliberately do NOT go in the store. Two separate things go
 * wrong if they do, and both are silent:
 *
 *  1. A default is not an answer. `petTolerance`, `sharedBathroom` and
 *     `sharedKitchen` default to `true`, so seeding them would record three
 *     consents the caseworker never gave — and seeding `false` instead would
 *     record three refusals. Neither is what an unanswered question means.
 *  2. The assistant infers fill-vs-refine from whether the form is empty, and
 *     any non-empty value makes every later instruction a refine. Seeding the
 *     scale defaults (all `3`) would mean the very first description could
 *     never fill anything at all.
 *
 * `null` is the only value that reads as empty to the hook and as "unanswered"
 * to us. Defaults are applied at render time by `factorDisplayValue`, so what
 * the user sees is unchanged.
 *
 * On the edit page the resident's stored values are passed as `saved` — those
 * ARE answers, so the form is correctly non-empty and instructions refine it.
 *
 * `saved` is filtered down to declared factors, and that filter is load-bearing
 * for privacy rather than tidiness: the assistant sends the whole value bag to
 * the model as "current values in the form", and the package only redacts
 * fields it knows about and has marked `aiExcluded`. A key that is not a
 * declared field at all — `medicalDocNotes`, say, which the edit page passes in
 * alongside the factors — would sail past that filter straight into the prompt.
 * Keeping the store exactly the size of the field list is what makes "the model
 * never sees medical documentation" true rather than merely intended.
 */
export function residentIntakeInitialValues(
  saved: Record<string, unknown> = {},
): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const factor of Object.values(RESIDENT_FACTORS)) {
    values[factor.id] = factor.id in saved ? saved[factor.id] : null
  }
  return values
}

export const RESIDENT_INTAKE_FORM: FormTarget = {
  key: 'resident-intake',
  name: 'Klient*innen-Aufnahme',
  fields: RESIDENT_INTAKE_FIELDS,
  instructions: [
    'Die Eingabe sind die Notizen einer Fallarbeiterin oder eines Fallarbeiters aus einem Aufnahmegespräch. Übertrage nur, was dort tatsächlich steht.',
    'Lass ein Feld weg, wenn der Text es nicht hergibt. Ein geratener Wert wird zur Grundlage einer Platzierungsentscheidung über eine reale Person — eine Lücke ist immer besser als eine Vermutung.',
    'Schliesse niemals von einem Namen, einer Sprache oder einer Herkunft auf Geschlecht, Alter, Religion oder Ernährung. Diese Felder nur setzen, wenn sie ausdrücklich genannt werden.',
    'Erfasse keine Diagnosen, keinen Aufenthaltsstatus und keine Religion — auch nicht in den Notizen. Nur was für das Zusammenleben im Haushalt gebraucht wird.',
    'Die Notizen sind die sachliche Zusammenfassung für die Fallarbeit, niemals deine eigene Einschätzung der Person.',
    'Der Text kann auf Deutsch, Englisch oder in einer anderen Sprache verfasst sein. Antworte immer mit den vorgegebenen Optionswerten, unabhängig von der Sprache des Textes.',
  ],
}

/* ------------------------------------------------------------------ *
 * Einsatzplätze
 * ------------------------------------------------------------------ */

/**
 * The two fields the assistant may never touch, and why each one.
 *
 * `permitRequirement` is the whole reason `permitRequirementIsStated` exists.
 * Its default, `NONE`, renders to a resident as "Keine Bewilligung nötig" —
 * a legal claim about that person's situation, on a board read by people whose
 * permits constrain work. A coach who does not know the route is required to
 * go and find out; a model that infers one from a job ad would produce a
 * confident answer to exactly the question the gate refuses to guess at, and
 * the coach would then be reviewing a plausible sentence rather than an empty
 * field. An empty field asks to be filled. A wrong one does not.
 *
 * `status` decides whether this is a draft or is live in front of residents.
 * Publishing is a decision a person takes, not a value that can be inferred
 * from the prose of an advertisement.
 */
export const OPPORTUNITY_AI_EXCLUDED = ['permitRequirement', 'status'] as const

/**
 * What the assistant may write into an opportunity, and what it is told.
 *
 * Names must match the `name=` attributes the form submits AND the keys
 * `OpportunityFieldsSchema` keeps — zod strips unknown keys silently, so a
 * drifted name here would be filled by the model, shown to the coach, and
 * dropped on save with no error anywhere. Pinned by
 * `opportunity-ai-fields.test.ts`.
 */
export const OPPORTUNITY_FIELDS: readonly FieldSpec[] = [
  { name: 'title', label: 'Titel', type: 'text', required: true, maxLength: 160 },
  {
    name: 'description',
    label: 'Beschreibung',
    type: 'textarea',
    required: true,
    maxLength: 2000,
    hint: 'Was die Person dort tun wird, in einfachen Sätzen.',
  },
  { name: 'organisation', label: 'Organisation', type: 'text', required: true, maxLength: 200 },
  {
    name: 'kind',
    label: 'Art',
    type: 'select',
    options: Object.entries(OPPORTUNITY_KIND_LABELS).map(([value, label]) => ({ value, label })),
    hint: 'Bezahlte Stelle = EMPLOYMENT. Praktikum = INTERNSHIP. Unbezahlt und offen für alle = VOLUNTEERING oder COMMUNITY_SERVICE.',
  },
  { name: 'location', label: 'Ort', type: 'text', maxLength: 300 },
  {
    name: 'schedule',
    label: 'Zeiten',
    type: 'text',
    maxLength: 300,
    placeholder: 'z.B. Di + Do, 11–14 Uhr',
  },
  { name: 'hoursPerWeek', label: 'Stunden pro Woche', type: 'number', min: 1 },
  {
    name: 'seats',
    label: 'Plätze',
    type: 'number',
    min: 1,
    // A number nobody stated is not "1". Unstated capacity has its own
    // meaning on the board and must not be invented into a bound.
    hint: 'Nur setzen, wenn die Anzahl im Text tatsächlich steht.',
  },
  { name: 'startsAt', label: 'Start', type: 'date' },
  { name: 'endsAt', label: 'Ende', type: 'date' },
  {
    name: 'germanLevel',
    label: 'Deutsch (GER)',
    type: 'select',
    options: CEFR_LEVELS.map((level) => ({ value: level })),
    hint: 'Nur wenn der Text ein Niveau nennt. Leer heisst "kein Niveau vorausgesetzt".',
  },
  {
    name: 'requirementNote',
    label: 'Hinweis zu den Voraussetzungen',
    type: 'text',
    maxLength: 500,
  },
  { name: 'contactName', label: 'Ansprechperson', type: 'text', maxLength: 200 },
  { name: 'contactEmail', label: 'E-Mail', type: 'email', maxLength: 200 },
  { name: 'contactPhone', label: 'Telefon', type: 'text', maxLength: 80 },
  { name: 'website', label: 'Webseite', type: 'url', maxLength: 500 },
  { name: 'permitRequirement', label: 'Bewilligung', type: 'select', aiExcluded: true },
  { name: 'status', label: 'Stand', type: 'select', aiExcluded: true },
]

export const OPPORTUNITY_FORM: FormTarget = {
  key: 'opportunity',
  name: OPPORTUNITY_AREA_NAME,
  fields: OPPORTUNITY_FIELDS,
  instructions: [
    'Die Eingabe ist ein Stelleninserat, eine E-Mail einer Organisation oder eine Notiz aus einem Telefonat. Übertrage nur, was dort tatsächlich steht.',
    'Lass ein FAKTEN-Feld leer (Ort, Zeiten, Stunden, Plätze, Daten, Deutschniveau, Kontakt), wenn der Text es nicht hergibt. Eine Lücke sieht die Fachperson und füllt sie; eine plausible Erfindung liest sie als geprüfte Angabe.',
    'Die Beschreibung ist Fliesstext, keine Faktenangabe: Wird sie verlangt, schreibe sie — zwei bis vier einfache Sätze darüber, was man an diesem Platz tut, gestützt auf Titel, Organisation, Art und die übrigen Angaben. Füge dabei keine Fakten hinzu, die nirgends stehen.',
    'Beschreibe ausschliesslich den PLATZ. Schreibe nichts über die Person, die ihn später einnimmt — keine Herkunft, kein Aufenthaltsstatus, keine Sprache als Anforderung an eine Person.',
    'Zum Bewilligungsweg sagst du nichts. Dieses Feld wird bewusst von einem Menschen ausgefüllt.',
    'Der Text kann in jeder Sprache verfasst sein. Antworte immer auf Deutsch und mit den vorgegebenen Optionswerten.',
  ],
}

export const AI_FORMS: readonly FormTarget[] = [RESIDENT_INTAKE_FORM, OPPORTUNITY_FORM]
