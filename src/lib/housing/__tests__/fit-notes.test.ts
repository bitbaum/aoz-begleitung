import { householdFitNotes, type FitNoteResident } from '../fit-notes'

const person = (overrides: Partial<FitNoteResident> = {}): FitNoteResident => ({
  sleepSchedule: 'STANDARD',
  smokingStatus: 'NON_SMOKER',
  noiseTolerance: 3,
  privacyNeed: 3,
  cleanlinessPractice: 3,
  cleanlinessExpectation: 3,
  chaosTolerance: 3,
  ...overrides,
})

const NOW = new Date('2026-09-25T12:00:00Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000)
const ids = (notes: ReturnType<typeof householdFitNotes>) => notes.map((note) => note.id)

describe('householdFitNotes', () => {
  it('says nothing about a household that lives in step', () => {
    expect(householdFitNotes([person(), person()], [], NOW)).toEqual([])
  })

  it('never names, identifies or counts a person — a note has no resident in it', () => {
    const notes = householdFitNotes(
      [person({ sleepSchedule: 'EARLY_BIRD' }), person({ sleepSchedule: 'NIGHT_OWL' })],
      [
        { category: 'INTERPERSONAL', type: 'NOISE', date: daysAgo(2) },
        { category: 'INTERPERSONAL', type: 'NOISE', date: daysAgo(5) },
      ],
      NOW,
    )
    for (const note of notes) {
      expect(Object.keys(note).sort()).not.toEqual(expect.arrayContaining(['residentId']))
      expect(JSON.stringify(note)).not.toMatch(/resident|subject|name|code/i)
    }
  })

  it('notes early risers and night owls in one flat', () => {
    const notes = householdFitNotes(
      [person({ sleepSchedule: 'EARLY_BIRD' }), person({ sleepSchedule: 'NIGHT_OWL' })],
      [],
      NOW,
    )
    expect(ids(notes)).toContain('SLEEP_RHYTHMS')
  })

  it('notes smokers and non-smokers sharing a flat', () => {
    const notes = householdFitNotes(
      [person({ smokingStatus: 'OUTDOOR_SMOKER' }), person()],
      [],
      NOW,
    )
    expect(ids(notes)).toEqual(['SMOKING'])
  })

  it('treats cleanliness as a direction: tidy-but-relaxed beside messy is no note', () => {
    // The symmetric-difference model this replaced would have flagged it.
    const relaxed = person({ cleanlinessPractice: 5, cleanlinessExpectation: 2, chaosTolerance: 5 })
    const messy = person({ cleanlinessPractice: 1, cleanlinessExpectation: 1, chaosTolerance: 5 })
    expect(ids(householdFitNotes([relaxed, messy], [], NOW))).not.toContain(
      'CLEANLINESS_EXPECTATIONS',
    )
  })

  it('notes an expectation that clearly goes unmet', () => {
    const demanding = person({
      cleanlinessPractice: 5,
      cleanlinessExpectation: 5,
      chaosTolerance: 1,
    })
    const messy = person({ cleanlinessPractice: 1, cleanlinessExpectation: 1, chaosTolerance: 5 })
    expect(ids(householdFitNotes([demanding, messy], [], NOW))).toContain(
      'CLEANLINESS_EXPECTATIONS',
    )
  })

  it('notes a wide spread in noise tolerance and in privacy', () => {
    const notes = householdFitNotes(
      [
        person({ noiseTolerance: 1, privacyNeed: 5 }),
        person({ noiseTolerance: 4, privacyNeed: 1 }),
      ],
      [],
      NOW,
    )
    expect(ids(notes)).toEqual(expect.arrayContaining(['NOISE', 'PRIVACY']))
  })

  it('makes no preference notes about a single occupant', () => {
    const alone = person({ sleepSchedule: 'NIGHT_OWL', smokingStatus: 'INDOOR_SMOKER' })
    expect(householdFitNotes([alone], [], NOW)).toEqual([])
  })

  it('reports repeated conflicts of one kind in the last 30 days, as a pattern of the flat', () => {
    const notes = householdFitNotes(
      [person(), person()],
      [
        { category: 'INTERPERSONAL', type: 'NOISE', date: daysAgo(1) },
        { category: 'INTERPERSONAL', type: 'NOISE', date: daysAgo(20) },
        { category: 'INTERPERSONAL', type: 'NOISE', date: daysAgo(45) }, // outside the window
        { category: 'MAINTENANCE', type: 'NOISE', date: daysAgo(3) }, // a tap is not a conflict
        { category: 'INTERPERSONAL', type: 'CLEANLINESS', date: daysAgo(4) }, // once is not a pattern
      ],
      NOW,
    )
    expect(notes).toEqual([{ id: 'REPEATED_INCIDENTS', incidentType: 'NOISE', count: 2 }])
  })
})
