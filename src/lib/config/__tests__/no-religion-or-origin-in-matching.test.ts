/**
 * Nothing that decides who lives with whom may encode religion or origin.
 *
 * The public page says this product records no religion. Until 2026-09-25 the
 * matcher SCORED `dietaryNeeds` with HALAL and KOSHER options, captured a
 * "Kulturelle Region", and the portal asked residents for flatmates from the
 * "same region". Each was a proxy — religion or origin by another name — as an
 * input to a placement. Those are gone; this keeps them gone.
 */

import { RESIDENT_FACTORS, SCORED_FACTOR_COUNT } from '../resident-factors'

/** Words that turn a harmless-looking option into a religion or origin proxy. */
const PROXY =
  /halal|kosher|koscher|religi|glaube|faith|ethni|herkunft|origin|region|kultur|cultur|nation/i

const factors = Object.values(RESIDENT_FACTORS)
const scored = factors.filter((factor) => factor.weight > 0 && factor.rule !== 'NONE')

describe('no religion or origin in matching', () => {
  it('there are scored factors to check', () => {
    expect(scored.length).toBe(SCORED_FACTOR_COUNT)
    expect(scored.length).toBeGreaterThan(10)
  })

  it.each(scored.map((factor) => [factor.id, factor] as const))(
    'scored factor %s offers no religion or origin option',
    (_id, factor) => {
      const options =
        'options' in factor && factor.options
          ? [
              ...factor.options,
              ...Object.values(
                (factor as { optionLabels?: Record<string, string> }).optionLabels ?? {},
              ),
            ]
          : []
      expect(options.filter((option) => PROXY.test(option))).toEqual([])
    },
  )

  it('no factor, scored or not, asks about culture, region or origin', () => {
    const asked = factors
      .filter((factor) => PROXY.test(`${factor.id} ${factor.label}`))
      .map((factor) => factor.id)
    expect(asked).toEqual([])
  })

  it('food practice is a kitchen note, never a match factor', () => {
    expect(RESIDENT_FACTORS.dietaryNeeds.rule).toBe('NONE')
    expect(RESIDENT_FACTORS.dietaryNeeds.weight).toBe(0)
  })
})
