import { availableLocales, createTranslator, getDictionary } from '@/lib/i18n'
import { de, type MessageKey } from '@/lib/i18n/dictionaries/de'
import {
  applicationStageLabel,
  opportunityKindLabel,
  permitRequirementLabel,
} from '@/lib/i18n/opportunity-labels'
import {
  APPLICATION_STAGES,
  APPLICATION_STAGE_LABELS,
  OPPORTUNITY_AREA_NAME,
  OPPORTUNITY_KINDS,
  OPPORTUNITY_KIND_LABELS,
  PERMIT_REQUIREMENTS,
  PERMIT_REQUIREMENT_LABELS,
} from '@/lib/config/opportunities'

/**
 * One German wording, translated — not two German wordings.
 *
 * The staff side reads these names from the config; the portal reads them from
 * the dictionaries. That is two places holding the same German string, which is
 * exactly the arrangement that drifts: someone softens "Bewilligung
 * erforderlich" on one side and the two halves of the product then tell a
 * resident and their coach different things about the same listing.
 *
 * So German is pinned to the config, and the translations are pinned to
 * existing. Change the config and this fails until the dictionary follows.
 */

const t = createTranslator('de')

describe('the German portal wording is the config wording', () => {
  it('calls the area what the rest of the product calls it', () => {
    expect(de['nav.opportunities']).toBe(OPPORTUNITY_AREA_NAME)
    expect(de['opportunities.title']).toBe(OPPORTUNITY_AREA_NAME)
  })

  it.each(OPPORTUNITY_KINDS)('names the kind %s the same way', (kind) => {
    expect(opportunityKindLabel(t, kind)).toBe(OPPORTUNITY_KIND_LABELS[kind])
  })

  it.each(PERMIT_REQUIREMENTS)('states the permit rule %s the same way', (permit) => {
    // The one that matters most: this sentence is the whole answer to "is this
    // place open to me at all", and it must not have a softer twin.
    expect(permitRequirementLabel(t, permit)).toBe(PERMIT_REQUIREMENT_LABELS[permit])
  })

  it.each(APPLICATION_STAGES)('names the stage %s the same way', (stage) => {
    expect(applicationStageLabel(t, stage)).toBe(APPLICATION_STAGE_LABELS[stage])
  })
})

describe('every offered language actually carries these strings', () => {
  // A missing key falls back to German and renders perfectly, so asserting
  // that the label is "non-empty" would pass for a dictionary that translates
  // none of this. Presence in the dictionary is the thing to check.
  const KEYS: MessageKey[] = [
    'nav.opportunities',
    'opportunities.title',
    'opportunities.subtitle',
    'opportunities.express',
    'opportunities.withdraw',
    'opportunities.seatsFree',
    'opportunities.seatsFull',
    ...OPPORTUNITY_KINDS.map(
      (kind) =>
        (kind === 'VOLUNTEERING'
          ? 'opportunities.kindVolunteering'
          : 'opportunities.kindCommunity') as MessageKey,
    ),
    'opportunities.permitNone',
    'opportunities.permitNotifies',
    'opportunities.permitRequired',
    // A work listing whose route nobody has settled. Falling back to German
    // here would hide the one warning that stops a resident reading the
    // listing as "no permit needed".
    'opportunities.permitUnstated',
    'opportunities.stageInterested',
    'opportunities.stageApplied',
    'opportunities.stageInterview',
    'opportunities.stageAccepted',
    'opportunities.stageStarted',
    'opportunities.stageEnded',
    'opportunities.stageDeclined',
  ]

  it.each(availableLocales().map((locale) => locale.id))('%s translates them', (id) => {
    const dictionary = getDictionary(id)
    const missing = KEYS.filter((key) => typeof dictionary[key] !== 'string')

    expect({ id, missing }).toEqual({ id, missing: [] })
  })
})
