import { calculateCompatibility } from '../scoring'
import type { CompatibilityWeights } from '../types'
import {
  makeResident,
  earlyBird,
  nightOwl,
  idealMatchA,
  idealMatchB,
  worstMatchA,
  worstMatchB,
} from './fixtures'

// =============================================================================
// A. Overall scoring
// =============================================================================

describe('calculateCompatibility — overall', () => {
  it('scores two identical residents near 100', () => {
    const a = makeResident()
    const b = makeResident({ id: 'test-2', code: 'RES-002' })
    const result = calculateCompatibility(a, b)
    expect(result.overall).toBeGreaterThanOrEqual(90)
    expect(result.overall).toBeLessThanOrEqual(100)
  })

  it('scores two maximally different residents below 30', () => {
    const result = calculateCompatibility(worstMatchA, worstMatchB)
    expect(result.overall).toBeLessThan(35)
  })

  it('is symmetric: score(A, B) === score(B, A)', () => {
    const ab = calculateCompatibility(earlyBird, nightOwl)
    const ba = calculateCompatibility(nightOwl, earlyBird)
    expect(ab.overall).toBe(ba.overall)
    expect(ab.lifestyle).toBe(ba.lifestyle)
    expect(ab.social).toBe(ba.social)
    expect(ab.practical).toBe(ba.practical)
    expect(ab.risk).toBe(ba.risk)
  })

  it('always returns scores in 0-100 range', () => {
    const pairs = [
      [idealMatchA, idealMatchB],
      [worstMatchA, worstMatchB],
      [earlyBird, nightOwl],
      [makeResident(), makeResident({ id: '2' })],
    ] as const

    for (const [a, b] of pairs) {
      const result = calculateCompatibility(a, b)
      expect(result.overall).toBeGreaterThanOrEqual(0)
      expect(result.overall).toBeLessThanOrEqual(100)
      expect(result.lifestyle).toBeGreaterThanOrEqual(0)
      expect(result.lifestyle).toBeLessThanOrEqual(100)
      expect(result.social).toBeGreaterThanOrEqual(0)
      expect(result.social).toBeLessThanOrEqual(100)
      expect(result.practical).toBeGreaterThanOrEqual(0)
      expect(result.practical).toBeLessThanOrEqual(100)
      expect(result.risk).toBeGreaterThanOrEqual(0)
      expect(result.risk).toBeLessThanOrEqual(100)
    }
  })

  it('ideal match pair scores above 90', () => {
    const result = calculateCompatibility(idealMatchA, idealMatchB)
    expect(result.overall).toBeGreaterThanOrEqual(90)
  })

  it('custom weights change the result', () => {
    const defaultResult = calculateCompatibility(earlyBird, nightOwl)
    const customWeights: CompatibilityWeights = {
      lifestyle: 80,
      social: 5,
      practical: 5,
      risk: 10,
    }
    const customResult = calculateCompatibility(earlyBird, nightOwl, customWeights)
    expect(customResult.overall).not.toBe(defaultResult.overall)
  })
})

// =============================================================================
// B. Lifestyle dimension
// =============================================================================

describe('calculateCompatibility — lifestyle', () => {
  describe('sleep schedule', () => {
    it('same schedule → high lifestyle score', () => {
      const a = makeResident({ sleepSchedule: 'EARLY_BIRD' })
      const b = makeResident({ id: '2', sleepSchedule: 'EARLY_BIRD' })
      const result = calculateCompatibility(a, b)
      // Sleep is 40% of lifestyle, score 100 → contributes 40
      // With noise/clean same → all 100, so lifestyle ~100
      expect(result.lifestyle).toBe(100)
    })

    it('EARLY_BIRD + NIGHT_OWL → sleep factor scores 30', () => {
      const a = makeResident({ sleepSchedule: 'EARLY_BIRD' })
      const b = makeResident({ id: '2', sleepSchedule: 'NIGHT_OWL' })
      const result = calculateCompatibility(a, b)
      // Sleep=30 (w35), noise=100 (w25), clean=100 (w30), guest=100 (w10)
      // (30*35 + 100*25 + 100*30 + 100*10) / 100 = (1050+2500+3000+1000)/100 = 75.5 → 76
      expect(result.lifestyle).toBe(76)
    })

    it('IRREGULAR + anything → sleep factor scores 70', () => {
      const a = makeResident({ sleepSchedule: 'IRREGULAR' })
      const b = makeResident({ id: '2', sleepSchedule: 'EARLY_BIRD' })
      const result = calculateCompatibility(a, b)
      // Sleep=70 (w35), noise=100 (w25), clean=100 (w30), guest=100 (w10)
      // (70*35 + 100*25 + 100*30 + 100*10) / 100 = (2450+2500+3000+1000)/100 = 89.5 → 90
      expect(result.lifestyle).toBe(90)
    })

    it('adjacent schedules (EARLY_BIRD + STANDARD) → sleep factor scores 70', () => {
      const a = makeResident({ sleepSchedule: 'EARLY_BIRD' })
      const b = makeResident({ id: '2', sleepSchedule: 'STANDARD' })
      const result = calculateCompatibility(a, b)
      expect(result.lifestyle).toBe(90)
    })
  })

  describe('noise tolerance', () => {
    it('same tolerance → noise factor 100', () => {
      const a = makeResident({ noiseTolerance: 3 })
      const b = makeResident({ id: '2', noiseTolerance: 3 })
      const result = calculateCompatibility(a, b)
      expect(result.lifestyle).toBe(100)
    })

    it('diff of 2 → noise factor 60', () => {
      const a = makeResident({ noiseTolerance: 1 })
      const b = makeResident({ id: '2', noiseTolerance: 3 })
      const result = calculateCompatibility(a, b)
      // Sleep=100 (w35), noise=60 (w25), clean=100 (w30), guest=100 (w10)
      // (100*35 + 60*25 + 100*30 + 100*10) / 100 = (3500+1500+3000+1000)/100 = 90
      expect(result.lifestyle).toBe(90)
    })

    it('diff of 4 → noise factor 20', () => {
      const a = makeResident({ noiseTolerance: 1 })
      const b = makeResident({ id: '2', noiseTolerance: 5 })
      const result = calculateCompatibility(a, b)
      // Sleep=100 (w35), noise=100-4*20=20 (w25), clean=100 (w30), guest=100 (w10)
      // (100*35 + 20*25 + 100*30 + 100*10) / 100 = (3500+500+3000+1000)/100 = 80
      expect(result.lifestyle).toBe(80)
    })
  })

  describe('cleanliness', () => {
    it('same level → clean factor 100', () => {
      const a = makeResident({ cleanlinessPractice: 4 })
      const b = makeResident({ id: '2', cleanlinessPractice: 4 })
      const result = calculateCompatibility(a, b)
      expect(result.lifestyle).toBe(100)
    })

    it('penalises the person whose expectation is not met, not the raw difference', () => {
      // a keeps little order (1), b keeps a lot (4). Both expect a middling 3.
      // b is let down by a; a is not let down by b — only that direction counts.
      const a = makeResident({ cleanlinessPractice: 1 })
      const b = makeResident({ id: '2', cleanlinessPractice: 4 })
      const result = calculateCompatibility(a, b)

      // clean = 100 - (3-1) * ((6-3)/5) * 25 = 70, weighted at 30 within lifestyle
      // (100*35 + 100*25 + 70*30 + 100*10) / 100 = 91
      expect(result.lifestyle).toBe(91)
    })

    it('sees no conflict between a tidy person who does not mind mess and a messy one', () => {
      // The case the old symmetric model got flatly wrong: a difference of 4
      // with zero friction, because nobody's expectation goes unmet.
      const a = makeResident({
        cleanlinessPractice: 5,
        cleanlinessExpectation: 1,
        chaosTolerance: 5,
      })
      const b = makeResident({
        id: '2',
        cleanlinessPractice: 1,
        cleanlinessExpectation: 1,
        chaosTolerance: 5,
      })
      const result = calculateCompatibility(a, b)

      expect(result.lifestyle).toBe(100)
    })

    it('flags the messy-but-demanding pairing the old model rated as a good match', () => {
      // Identical practice, so the symmetric model scored this a perfect fit.
      // In reality a demands far more than b gives, and cannot tolerate mess.
      const a = makeResident({
        cleanlinessPractice: 2,
        cleanlinessExpectation: 5,
        chaosTolerance: 1,
      })
      const b = makeResident({
        id: '2',
        cleanlinessPractice: 2,
        cleanlinessExpectation: 2,
        chaosTolerance: 4,
      })
      const result = calculateCompatibility(a, b)

      expect(result.lifestyle).toBeLessThan(80)
    })
  })

  describe('guest tolerance', () => {
    it('same tolerance → 100', () => {
      const a = makeResident({ guestTolerance: 3 })
      const b = makeResident({ id: '2', guestTolerance: 3 })
      const result = calculateCompatibility(a, b)
      expect(result.lifestyle).toBe(100)
    })

    it('diff of 2 → guest factor 60', () => {
      const a = makeResident({ guestTolerance: 1 })
      const b = makeResident({ id: '2', guestTolerance: 3 })
      const result = calculateCompatibility(a, b)
      // Sleep=100 (w35), noise=100 (w25), clean=100 (w30), guest=60 (w10)
      // (100*35 + 100*25 + 100*30 + 60*10) / 100 = (3500+2500+3000+600)/100 = 96
      expect(result.lifestyle).toBe(96)
    })

    it('diff of 4 → guest factor 20', () => {
      const a = makeResident({ guestTolerance: 1 })
      const b = makeResident({ id: '2', guestTolerance: 5 })
      const result = calculateCompatibility(a, b)
      // Sleep=100 (w35), noise=100 (w25), clean=100 (w30), guest=20 (w10)
      // (3500+2500+3000+200)/100 = 92
      expect(result.lifestyle).toBe(92)
    })
  })
})

// =============================================================================
// C. Social dimension
// =============================================================================

describe('calculateCompatibility — social', () => {
  describe('language', () => {
    it('2+ shared languages → language score 100', () => {
      const a = makeResident({ languages: ['German', 'English'] })
      const b = makeResident({ id: '2', languages: ['German', 'English', 'French'] })
      const result = calculateCompatibility(a, b)
      // All social factors: socialStyle same(MODERATE)=100, language=100, privacy=100
      expect(result.social).toBe(100)
    })

    it('1 shared language (German) → language score 100', () => {
      const a = makeResident({ languages: ['German'] })
      const b = makeResident({ id: '2', languages: ['German', 'Arabic'] })
      const result = calculateCompatibility(a, b)
      expect(result.social).toBe(100)
    })

    it('1 shared language (English) → language score 95', () => {
      const a = makeResident({ languages: ['English'] })
      const b = makeResident({ id: '2', languages: ['English', 'Arabic'] })
      const result = calculateCompatibility(a, b)
      // socialStyle MODERATE+MODERATE=100 (w25), language=95 (w35), privacy=100 (w30), conflict=85 (w10, both COOPERATIVE but different defaults don't apply — both are COOPERATIVE=same=100)
      // Actually: both default to COOPERATIVE, so conflict=100
      // (100*25 + 95*35 + 100*30 + 100*10) / 100 = (2500+3325+3000+1000)/100 = 98.25 → 98
      expect(result.social).toBe(98)
    })

    it('no shared language → language score 25 (no German/English either)', () => {
      const a = makeResident({ languages: ['Arabic'] })
      const b = makeResident({ id: '2', languages: ['Turkish'] })
      const result = calculateCompatibility(a, b)
      // socialStyle=100 (w25), language=25 (w35), privacy=100 (w30), conflict=100 (w10)
      // (100*25 + 25*35 + 100*30 + 100*10) / 100 = (2500+875+3000+1000)/100 = 73.75 → 74
      expect(result.social).toBe(74)
    })
  })

  describe('social style', () => {
    it('same style → 100', () => {
      const a = makeResident({ socialStyle: 'INTROVERTED' })
      const b = makeResident({ id: '2', socialStyle: 'INTROVERTED' })
      const result = calculateCompatibility(a, b)
      expect(result.social).toBe(100)
    })

    it('INTROVERTED + EXTROVERTED → 60', () => {
      const a = makeResident({ socialStyle: 'INTROVERTED' })
      const b = makeResident({ id: '2', socialStyle: 'EXTROVERTED' })
      const result = calculateCompatibility(a, b)
      // socialStyle=60 (w25), language=100 (w35), privacy=100 (w30), conflict=100 (w10)
      // (60*25 + 100*35 + 100*30 + 100*10) / 100 = (1500+3500+3000+1000)/100 = 90
      expect(result.social).toBe(90)
    })

    it('MODERATE + any → 80', () => {
      const a = makeResident({ socialStyle: 'MODERATE' })
      const b = makeResident({ id: '2', socialStyle: 'EXTROVERTED' })
      const result = calculateCompatibility(a, b)
      // socialStyle=80 (w25), language=100 (w35), privacy=100 (w30), conflict=100 (w10)
      // (80*25 + 100*35 + 100*30 + 100*10) / 100 = (2000+3500+3000+1000)/100 = 95
      expect(result.social).toBe(95)
    })
  })

  describe('privacy', () => {
    it('same privacy → 100', () => {
      const a = makeResident({ privacyNeed: 3 })
      const b = makeResident({ id: '2', privacyNeed: 3 })
      const result = calculateCompatibility(a, b)
      expect(result.social).toBe(100)
    })

    it('privacy diff of 2 → privacy factor = 100 - 2*15 = 70', () => {
      const a = makeResident({ privacyNeed: 1 })
      const b = makeResident({ id: '2', privacyNeed: 3 })
      const result = calculateCompatibility(a, b)
      // socialStyle=100 (w25), language=100 (w35), privacy=70 (w30), conflict=100 (w10)
      // (100*25 + 100*35 + 70*30 + 100*10) / 100 = (2500+3500+2100+1000)/100 = 91
      expect(result.social).toBe(91)
    })
  })

  describe('conflict style', () => {
    it('same style → 100', () => {
      const a = makeResident({ conflictStyle: 'COOPERATIVE' })
      const b = makeResident({ id: '2', conflictStyle: 'COOPERATIVE' })
      const result = calculateCompatibility(a, b)
      expect(result.social).toBe(100)
    })

    it('COOPERATIVE + DIRECT → 85', () => {
      const a = makeResident({ conflictStyle: 'COOPERATIVE' })
      const b = makeResident({ id: '2', conflictStyle: 'DIRECT' })
      const result = calculateCompatibility(a, b)
      // socialStyle=100 (w25), language=100 (w35), privacy=100 (w30), conflict=85 (w10)
      // (100*25 + 100*35 + 100*30 + 85*10) / 100 = (2500+3500+3000+850)/100 = 98.5 → 99
      expect(result.social).toBe(99)
    })

    it('AVOIDANT + DIRECT → 50 (worst mismatch)', () => {
      const a = makeResident({ conflictStyle: 'AVOIDANT' })
      const b = makeResident({ id: '2', conflictStyle: 'DIRECT' })
      const result = calculateCompatibility(a, b)
      // socialStyle=100 (w25), language=100 (w35), privacy=100 (w30), conflict=50 (w10)
      // (2500+3500+3000+500)/100 = 95
      expect(result.social).toBe(95)
    })
  })
})

// =============================================================================
// D. Practical dimension
// =============================================================================

describe('calculateCompatibility — practical', () => {
  describe('smoking', () => {
    it('same status → 100', () => {
      const a = makeResident({ smokingStatus: 'NON_SMOKER' })
      const b = makeResident({ id: '2', smokingStatus: 'NON_SMOKER' })
      const result = calculateCompatibility(a, b)
      expect(result.practical).toBe(100)
    })

    it('NON_SMOKER + INDOOR_SMOKER → smoking factor 20', () => {
      const a = makeResident({ smokingStatus: 'NON_SMOKER' })
      const b = makeResident({ id: '2', smokingStatus: 'INDOOR_SMOKER' })
      const result = calculateCompatibility(a, b)
      // smoking=20 (w45), sharedSpaces=100 (w25), pets=100 (w10), chores=100 (w15)
      // Food practice is no longer a factor, so the total weight is 95:
      // (20*45 + 100*25 + 100*10 + 100*15) / 95 = 5900/95 = 62.1 → 62
      expect(result.practical).toBe(62)
    })

    it('NON_SMOKER + OUTDOOR_SMOKER → smoking factor 80', () => {
      const a = makeResident({ smokingStatus: 'NON_SMOKER' })
      const b = makeResident({ id: '2', smokingStatus: 'OUTDOOR_SMOKER' })
      const result = calculateCompatibility(a, b)
      // (80*45 + 100*25 + 100*10 + 100*5 + 100*15) / 100
      // = (3600 + 2500 + 1000 + 500 + 1500) / 100 = 9100/100 = 91
      expect(result.practical).toBe(91)
    })
  })

  describe('shared spaces', () => {
    it('both agree on shared spaces → 100', () => {
      const a = makeResident({ sharedBathroom: true, sharedKitchen: true })
      const b = makeResident({ id: '2', sharedBathroom: true, sharedKitchen: true })
      const result = calculateCompatibility(a, b)
      expect(result.practical).toBe(100)
    })

    it('bathroom mismatch → shared space factor reduced by 20', () => {
      const a = makeResident({ sharedBathroom: false, sharedKitchen: true })
      const b = makeResident({ id: '2', sharedBathroom: true, sharedKitchen: true })
      const result = calculateCompatibility(a, b)
      // sharedSpace = 100 - 20 = 80
      // smoking=100 (w45), sharedSpaces=80 (w25), pets=100 (w10), diet=100 (w5), chores=100 (w15)
      // (100*45 + 80*25 + 100*10 + 100*5 + 100*15) / 100
      // = (4500 + 2000 + 1000 + 500 + 1500) / 100 = 9500/100 = 95
      expect(result.practical).toBe(95)
    })
  })

  describe('food practice', () => {
    it('never moves a compatibility score — it is a kitchen note, not a match factor', () => {
      // It used to be scored and offered HALAL/KOSHER: religion as an input to
      // who lives with whom. Any value, on either side, now scores the same.
      const plain = calculateCompatibility(
        makeResident({ dietaryNeeds: [] }),
        makeResident({ id: '2', dietaryNeeds: [] }),
      )
      for (const needs of [['SEPARATE_COOKWARE'], ['VEGAN'], ['VEGETARIAN', 'SEPARATE_COOKWARE']]) {
        const result = calculateCompatibility(
          makeResident({ dietaryNeeds: needs }),
          makeResident({ id: '2', dietaryNeeds: [] }),
        )
        expect(result.overall).toBe(plain.overall)
        expect(result.practical).toBe(plain.practical)
      }
    })
  })
})

// =============================================================================
// E. Risk factors
// =============================================================================

describe('calculateCompatibility — risk', () => {
  it('identical residents → risk near 0', () => {
    const a = makeResident()
    const b = makeResident({ id: '2' })
    const result = calculateCompatibility(a, b)
    expect(result.risk).toBeLessThanOrEqual(5)
  })

  it('INDOOR_SMOKER + NON_SMOKER → includes smoking risk', () => {
    const a = makeResident({ smokingStatus: 'INDOOR_SMOKER' })
    const b = makeResident({ id: '2', smokingStatus: 'NON_SMOKER' })
    const result = calculateCompatibility(a, b)
    // smoking_conflict: 50 * 0.2 = 10 added to totalRisk
    expect(result.risk).toBeGreaterThanOrEqual(10)
  })

  it('EARLY_BIRD + NIGHT_OWL → includes sleep risk', () => {
    const a = makeResident({ sleepSchedule: 'EARLY_BIRD' })
    const b = makeResident({ id: '2', sleepSchedule: 'NIGHT_OWL' })
    const result = calculateCompatibility(a, b)
    // sleep_conflict: 35 * 0.2 = 7
    expect(result.risk).toBeGreaterThanOrEqual(7)
  })

  it('no shared language → includes communication risk', () => {
    const a = makeResident({ languages: ['Arabic'] })
    const b = makeResident({ id: '2', languages: ['Turkish'] })
    const result = calculateCompatibility(a, b)
    // communication_barrier: 40 * 0.25 = 10
    expect(result.risk).toBeGreaterThanOrEqual(10)
  })

  it('NEEDS_PRIVATE room sharing → includes room sharing risk', () => {
    const a = makeResident({ roomSharingStatus: 'NEEDS_PRIVATE' })
    const b = makeResident({ id: '2', roomSharingStatus: 'CAN_SHARE' })
    const result = calculateCompatibility(a, b)
    // room_sharing_required: 80 * 0.3 = 24
    expect(result.risk).toBeGreaterThanOrEqual(24)
  })

  it('risk is capped at 100', () => {
    // Combine all possible risk factors
    const result = calculateCompatibility(worstMatchA, worstMatchB)
    expect(result.risk).toBeLessThanOrEqual(100)
  })

  it('night disturbances + quiet needs → high risk', () => {
    const a = makeResident({ hasNightDisturbances: true })
    const b = makeResident({ id: '2', needsQuietEnvironment: true })
    const result = calculateCompatibility(a, b)
    // disturbanceRisk = 60, * 0.15 = 9
    expect(result.risk).toBeGreaterThanOrEqual(9)
  })

  it('night disturbances without quiet need → lower risk', () => {
    const a = makeResident({ hasNightDisturbances: true, needsQuietEnvironment: false })
    const b = makeResident({ id: '2', needsQuietEnvironment: false })
    const result = calculateCompatibility(a, b)
    // disturbanceRisk = 25, * 0.15 = 3.75
    const highRiskResult = calculateCompatibility(
      makeResident({ hasNightDisturbances: true }),
      makeResident({ id: '2', needsQuietEnvironment: true }),
    )
    expect(result.risk).toBeLessThan(highRiskResult.risk)
  })

  it('extreme cleanliness difference (>=3) → cleanliness risk', () => {
    const a = makeResident({ cleanlinessPractice: 1 })
    const b = makeResident({ id: '2', cleanlinessPractice: 4 })
    const result = calculateCompatibility(a, b)
    // cleanliness_conflict: 30 * 0.2 = 6
    expect(result.risk).toBeGreaterThanOrEqual(6)
  })

  it('large chores gap (>=3) → chores risk', () => {
    const a = makeResident({ choresContribution: 1 })
    const b = makeResident({ id: '2', choresContribution: 5 })
    const result = calculateCompatibility(a, b)
    // chores_imbalance: 35 * 0.15 = 5.25
    expect(result.risk).toBeGreaterThanOrEqual(5)
  })

  it('recycling gap (>=2) → recycling risk', () => {
    const a = makeResident({ recyclingKnowledge: 'GOOD' })
    const b = makeResident({ id: '2', recyclingKnowledge: 'NONE' })
    const result = calculateCompatibility(a, b)
    // recycling_gap: 25 * 0.1 = 2.5
    expect(result.risk).toBeGreaterThanOrEqual(2)
  })

  it('large age gap → age risk', () => {
    const a = makeResident({ ageRange: 'YOUNG_ADULT' })
    const b = makeResident({ id: '2', ageRange: 'SENIOR' })
    const result = calculateCompatibility(a, b)
    // ageGapRisk = 40, * 0.15 = 6
    expect(result.risk).toBeGreaterThanOrEqual(6)
  })

  it('guest tolerance diff >=3 → guest conflict risk', () => {
    const a = makeResident({ guestTolerance: 1 })
    const b = makeResident({ id: '2', guestTolerance: 5 })
    const result = calculateCompatibility(a, b)
    // guest_conflict: 30 * 0.15 = 4.5
    expect(result.risk).toBeGreaterThanOrEqual(4)
  })

  it('AVOIDANT + DIRECT → conflict style mismatch risk', () => {
    const a = makeResident({ conflictStyle: 'AVOIDANT' })
    const b = makeResident({ id: '2', conflictStyle: 'DIRECT' })
    const result = calculateCompatibility(a, b)
    // conflict_style_mismatch: 25 * 0.1 = 2.5
    expect(result.risk).toBeGreaterThanOrEqual(2)
  })
})

// =============================================================================
// F. Insights generation
// =============================================================================

describe('calculateCompatibility — insights', () => {
  it('high lifestyle score → generates "Ähnlicher Lebensstil" strength', () => {
    const a = makeResident()
    const b = makeResident({ id: '2' })
    const result = calculateCompatibility(a, b)
    // lifestyle should be 100 (all same) → ≥80 → strength
    expect(result.strengths).toContain('Ähnlicher Lebensstil und Tagesrhythmus')
  })

  it('shared language → generates shared language strength', () => {
    const a = makeResident({ languages: ['German'] })
    const b = makeResident({ id: '2', languages: ['German'] })
    const result = calculateCompatibility(a, b)
    expect(result.strengths).toEqual(
      expect.arrayContaining([expect.stringContaining('Gemeinsame Sprache')]),
    )
  })

  it('no shared language → generates concern and recommendation', () => {
    const a = makeResident({ languages: ['Arabic'] })
    const b = makeResident({ id: '2', languages: ['Turkish'] })
    const result = calculateCompatibility(a, b)
    expect(result.concerns).toContain('Keine gemeinsame Sprache - Kommunikation schwierig')
    expect(result.recommendations).toContain('Bildmaterial für Hausregeln bereitstellen')
  })

  it('EARLY_BIRD + NIGHT_OWL → sleep concern', () => {
    const a = makeResident({ sleepSchedule: 'EARLY_BIRD' })
    const b = makeResident({ id: '2', sleepSchedule: 'NIGHT_OWL' })
    const result = calculateCompatibility(a, b)
    expect(result.concerns).toContain('Sehr unterschiedliche Schlafzeiten')
    expect(result.recommendations).toContain('Räume möglichst weit voneinander platzieren')
  })

  it('same social style → generates social strength', () => {
    const a = makeResident({ socialStyle: 'INTROVERTED' })
    const b = makeResident({ id: '2', socialStyle: 'INTROVERTED' })
    const result = calculateCompatibility(a, b)
    expect(result.strengths).toContain('Ähnliche soziale Bedürfnisse')
  })

  it('NEEDS_PRIVATE → generates room sharing concern', () => {
    const a = makeResident({ roomSharingStatus: 'NEEDS_PRIVATE' })
    const b = makeResident({ id: '2' })
    const result = calculateCompatibility(a, b)
    expect(result.concerns).toContain('Einer/beide benötigen Einzelzimmer')
    expect(result.recommendations).toContain(
      'Nur in Einheit mit verfügbarem Einzelzimmer platzieren',
    )
  })

  it('cleanliness diff ≥ 3 → generates prediction with timeframe', () => {
    const a = makeResident({ cleanlinessPractice: 1 })
    const b = makeResident({ id: '2', cleanlinessPractice: 4 })
    const result = calculateCompatibility(a, b)
    expect(result.predictions).toEqual(
      expect.arrayContaining([expect.stringContaining('Sauberkeitskonflikt')]),
    )
  })

  it('cleanliness diff = 2 → generates medium prediction', () => {
    const a = makeResident({ cleanlinessPractice: 1 })
    const b = makeResident({ id: '2', cleanlinessPractice: 3 })
    const result = calculateCompatibility(a, b)
    expect(result.predictions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Mittlere Wahrscheinlichkeit Sauberkeitskonflikt'),
      ]),
    )
  })

  it('noise diff ≥ 3 → generates noise prediction', () => {
    const a = makeResident({ noiseTolerance: 1 })
    const b = makeResident({ id: '2', noiseTolerance: 4 })
    const result = calculateCompatibility(a, b)
    expect(result.predictions).toEqual(
      expect.arrayContaining([expect.stringContaining('Lärmkonflikt')]),
    )
  })

  it('high risk → recommends regular check-ins', () => {
    const result = calculateCompatibility(worstMatchA, worstMatchB)
    // risk > 40 → "Regelmässige Check-ins in den ersten Wochen"
    expect(result.recommendations).toEqual(
      expect.arrayContaining([expect.stringContaining('Check-in')]),
    )
  })

  it('both engaged in chores → generates chores strength', () => {
    const a = makeResident({ choresContribution: 4 })
    const b = makeResident({ id: '2', choresContribution: 5 })
    const result = calculateCompatibility(a, b)
    expect(result.strengths).toContain('Beide engagiert bei Haushaltsaufgaben')
  })

  it('large chores gap → generates chores concern', () => {
    const a = makeResident({ choresContribution: 1 })
    const b = makeResident({ id: '2', choresContribution: 5 })
    const result = calculateCompatibility(a, b)
    expect(result.concerns).toContain('Grosse Unterschiede bei Haushaltsaufgaben')
    expect(result.recommendations).toContain('Klare Aufgabenverteilung schriftlich festhalten')
  })

  it('recycling knowledge gap → generates recycling concern', () => {
    const a = makeResident({ recyclingKnowledge: 'GOOD' })
    const b = makeResident({ id: '2', recyclingKnowledge: 'NONE' })
    const result = calculateCompatibility(a, b)
    expect(result.concerns).toContain('Recycling-Kenntnisse sehr unterschiedlich')
    expect(result.recommendations).toContain(
      'Recycling-Schulung für Personen ohne Erfahrung einplanen',
    )
  })

  it('intensive support → recommends intensive care', () => {
    const a = makeResident({ supportLevel: 'INTENSIVE' })
    const b = makeResident({ id: '2' })
    const result = calculateCompatibility(a, b)
    expect(result.recommendations).toContain('Intensive Betreuung einplanen')
  })

  it('both need quiet → generates quiet strength', () => {
    const a = makeResident({ needsQuietEnvironment: true })
    const b = makeResident({ id: '2', needsQuietEnvironment: true })
    const result = calculateCompatibility(a, b)
    expect(result.strengths).toContain('Beide bevorzugen ruhige Umgebung')
  })

  it('night disturbances + quiet need → generates disturbance concern', () => {
    const a = makeResident({ hasNightDisturbances: true })
    const b = makeResident({ id: '2', needsQuietEnvironment: true })
    const result = calculateCompatibility(a, b)
    expect(result.concerns).toContain('Nächtliche Unruhe trifft auf Ruhebedürfnis')
    expect(result.recommendations).toContain('Nicht im selben Zimmer platzieren')
  })

  it('same conflict style → generates conflict style strength', () => {
    const a = makeResident({ conflictStyle: 'DIRECT' })
    const b = makeResident({ id: '2', conflictStyle: 'DIRECT' })
    const result = calculateCompatibility(a, b)
    expect(result.strengths).toContain('Ähnlicher Konfliktlösungsstil')
  })

  it('AVOIDANT + DIRECT → generates conflict style concern', () => {
    const a = makeResident({ conflictStyle: 'AVOIDANT' })
    const b = makeResident({ id: '2', conflictStyle: 'DIRECT' })
    const result = calculateCompatibility(a, b)
    expect(result.concerns).toContain('Gegensätzliche Konfliktlösungsstile (vermeidend/direkt)')
    expect(result.recommendations).toContain('Mediation bei Konflikten frühzeitig anbieten')
  })

  it('guest tolerance diff ≥ 3 → generates guest concern', () => {
    const a = makeResident({ guestTolerance: 1 })
    const b = makeResident({ id: '2', guestTolerance: 5 })
    const result = calculateCompatibility(a, b)
    expect(result.concerns).toContain('Sehr unterschiedliche Besuchertoleranz')
    expect(result.recommendations).toContain('Klare Besucherregeln vereinbaren')
  })

  it('guest tolerance diff ≥ 3 → generates guest prediction', () => {
    const a = makeResident({ guestTolerance: 1 })
    const b = makeResident({ id: '2', guestTolerance: 5 })
    const result = calculateCompatibility(a, b)
    expect(result.predictions).toEqual(
      expect.arrayContaining([expect.stringContaining('Besucherkonflikt')]),
    )
  })
})
