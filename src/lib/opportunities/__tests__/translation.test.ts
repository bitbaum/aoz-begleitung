import {
  TRANSLATABLE_FIELDS,
  hashSource,
  localesNeedingTranslation,
  readableListing,
  sourceHashOf,
  usableTranslation,
  type ListingTranslations,
  type TranslatableListing,
} from '../translation'
import { PERMIT_REQUIREMENT_LABELS } from '@/lib/config/opportunities'

const german: TranslatableListing = {
  title: 'Mittagstisch im Quartiertreff',
  description: 'Mithilfe beim Kochen und Servieren, jeweils dienstags und donnerstags.',
  requirementNote: 'Bitte pünktlich sein.',
  schedule: 'dienstags und donnerstags, 11–14 Uhr',
}

const arabic = (hash: string): ListingTranslations => ({
  ar: {
    title: 'مائدة الغداء في مركز الحي',
    description: 'المساعدة في الطبخ والتقديم، أيام الثلاثاء والخميس.',
    requirementNote: 'يرجى الحضور في الوقت المحدد.',
    schedule: 'الثلاثاء والخميس، 11–14',
    sourceHash: hash,
  },
})

describe('a translation that outlived its source is not shown', () => {
  /**
   * The failure this rule exists to prevent has no symptom. A coach edits the
   * German to say Wednesdays; the Arabic still says Tuesdays; both look
   * perfectly fine, and the resident turns up on the wrong day. There is no
   * error, no warning, and no way for the reader to tell.
   *
   * So the stored translation carries a hash of the German it was made from,
   * and a mismatch means the German is shown instead. German is at least true.
   */
  it('is used while it still matches', () => {
    const stored = arabic(sourceHashOf(german))
    expect(usableTranslation(german, stored, 'ar')?.title).toBe('مائدة الغداء في مركز الحي')
  })

  it('is dropped the moment the German changes', () => {
    const stored = arabic(sourceHashOf(german))
    const edited = { ...german, description: 'Neu: jeweils mittwochs.' }

    expect(usableTranslation(edited, stored, 'ar')).toBeNull()
    expect(readableListing(edited, stored, 'ar')).toMatchObject({
      description: 'Neu: jeweils mittwochs.',
      machineTranslated: false,
    })
  })

  it('is invalidated by a change to ANY translatable field, not just its own', () => {
    // Per-field hashes would allow a fresh title above a stale description —
    // the mixed state is worse than either, because nothing on screen says
    // which half is old.
    for (const field of TRANSLATABLE_FIELDS) {
      const edited = { ...german, [field]: 'etwas ganz anderes' }
      expect({
        field,
        usable: usableTranslation(edited, arabic(sourceHashOf(german)), 'ar'),
      }).toEqual({ field, usable: null })
    }
  })

  it('distinguishes an empty note from a note with text', () => {
    // '' and null and 'x' must not collide, or clearing a requirement note
    // would leave the old one standing in every other language.
    expect(sourceHashOf(german)).not.toBe(sourceHashOf({ ...german, requirementNote: null }))
  })
})

describe('what a reader gets', () => {
  it('German readers get the German, never a round trip through a model', () => {
    expect(readableListing(german, arabic(sourceHashOf(german)), 'de')).toMatchObject({
      title: german.title,
      machineTranslated: false,
    })
  })

  it('a locale with no translation yet falls back rather than blanking', () => {
    expect(readableListing(german, arabic(sourceHashOf(german)), 'fr')).toMatchObject({
      title: german.title,
      machineTranslated: false,
    })
  })

  it('says so when the text is machine-translated', () => {
    // The flag is returned rather than left for the caller to work out. A
    // caller that has to compare strings to know is a caller that will one day
    // render a machine translation as if a person had written it.
    expect(readableListing(german, arabic(sourceHashOf(german)), 'ar').machineTranslated).toBe(true)
  })

  it('handles a listing with no translations at all', () => {
    expect(readableListing(german, null, 'ar')).toMatchObject({ machineTranslated: false })
  })
})

describe('what is translated, and what must never be', () => {
  it('covers exactly the strings a coach writes — «Zeiten» included', () => {
    expect([...TRANSLATABLE_FIELDS]).toEqual([
      'title',
      'description',
      'requirementNote',
      'schedule',
    ])
  })

  it('shows the translated schedule, and drops it with the rest when the German changes', () => {
    // «Zeiten» was the one coach-written line still German on an Arabic card.
    const stored = arabic(sourceHashOf(german))
    expect(readableListing(german, stored, 'ar').schedule).toBe('الثلاثاء والخميس، 11–14')

    const moved = { ...german, schedule: 'mittwochs, 11–14 Uhr' }
    expect(readableListing(moved, stored, 'ar')).toMatchObject({
      schedule: 'mittwochs, 11–14 Uhr',
      machineTranslated: false,
    })
  })

  it('never includes the permit sentence', () => {
    /**
     * `PERMIT_REQUIREMENT_LABELS` is a statement about what the PLACE
     * requires, read by people whose permits constrain work. It is
     * hand-translated per locale in the dictionaries. "Keine Bewilligung
     * nötig" mistranslated is not a typo — it is a wrong answer to the exact
     * question `permitRequirementIsStated` exists to stop anyone guessing at.
     */
    const fields: readonly string[] = TRANSLATABLE_FIELDS
    expect(fields).not.toContain('permitRequirement')
    expect(Object.keys(PERMIT_REQUIREMENT_LABELS).some((key) => fields.includes(key))).toBe(false)
  })

  it('never includes structured facts — those are formatted per locale already', () => {
    const fields: readonly string[] = TRANSLATABLE_FIELDS
    for (const structured of ['hoursPerWeek', 'seats', 'startsAt', 'endsAt', 'germanLevel']) {
      expect(fields).not.toContain(structured)
    }
  })

  it('never includes the organisation — a name is not translated', () => {
    const fields: readonly string[] = TRANSLATABLE_FIELDS
    expect(fields).not.toContain('organisation')
    expect(fields).not.toContain('location')
  })
})

describe('deciding what still needs doing', () => {
  it('asks only for what is missing or stale', () => {
    const stored = arabic(sourceHashOf(german))
    expect(localesNeedingTranslation(german, stored, ['de', 'ar', 'fr', 'uk'])).toEqual([
      'fr',
      'uk',
    ])
  })

  it('never asks for German', () => {
    expect(localesNeedingTranslation(german, null, ['de'])).toEqual([])
  })

  it('asks again once the source changed', () => {
    const stored = arabic(sourceHashOf(german))
    const edited = { ...german, title: 'Anderer Titel' }
    expect(localesNeedingTranslation(edited, stored, ['ar'])).toEqual(['ar'])
  })
})

describe('the hash itself', () => {
  it('is stable across calls', () => {
    expect(hashSource('Mittagstisch')).toBe(hashSource('Mittagstisch'))
  })

  it('separates texts that differ only in one character', () => {
    expect(hashSource('dienstags')).not.toBe(hashSource('mittwochs'))
    expect(hashSource('8 Stunden')).not.toBe(hashSource('9 Stunden'))
  })

  it('handles non-Latin text without throwing', () => {
    expect(hashSource('ትግርኛ العربية Українська')).toMatch(/^[0-9a-f]{8}$/)
  })
})
