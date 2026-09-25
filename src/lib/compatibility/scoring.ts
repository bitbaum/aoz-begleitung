/**
 * Core compatibility scoring algorithm
 *
 * Calculates how well two residents would live together
 * based on lifestyle, social, and practical factors.
 *
 * v2.0: Research-justified weight adjustments + new factors
 * See algorithm-docs.ts for evidence mapping.
 */

import type {
  ResidentProfile,
  CompatibilityScore,
  CompatibilityWeights,
  DimensionResult,
  FactorResult,
  ConflictStyle,
} from './types'
import { scoreCleanlinessPair } from './cleanliness'
import {
  LIFESTYLE_SCALES,
  SOCIAL_SCALES,
  PRACTICAL_SCALES,
  DIMENSION_WEIGHTS,
  OVERALL_DIMENSION_WEIGHTS,
} from '@/lib/config/scoring-scales'

const DEFAULT_WEIGHTS: CompatibilityWeights = OVERALL_DIMENSION_WEIGHTS

/**
 * Calculate overall compatibility between two residents
 */
export function calculateCompatibility(
  resident1: ResidentProfile,
  resident2: ResidentProfile,
  weights: CompatibilityWeights = DEFAULT_WEIGHTS,
): CompatibilityScore {
  const lifestyle = calculateLifestyleCompatibility(resident1, resident2)
  const social = calculateSocialCompatibility(resident1, resident2)
  const practical = calculatePracticalCompatibility(resident1, resident2)
  const risk = calculateRiskFactors(resident1, resident2)

  // Weighted average (risk is inverted - lower risk = higher compatibility)
  const overall = Math.round(
    (lifestyle.score * weights.lifestyle +
      social.score * weights.social +
      practical.score * weights.practical +
      (100 - risk.score) * weights.risk) /
      (weights.lifestyle + weights.social + weights.practical + weights.risk),
  )

  const { strengths, concerns, recommendations, predictions } = generateInsights(
    resident1,
    resident2,
    { lifestyle, social, practical, risk },
  )

  return {
    overall,
    lifestyle: lifestyle.score,
    social: social.score,
    practical: practical.score,
    risk: risk.score,
    strengths,
    concerns,
    recommendations,
    predictions,
  }
}

/**
 * Lifestyle compatibility: sleep, noise, cleanliness, guest tolerance
 */
function calculateLifestyleCompatibility(
  r1: ResidentProfile,
  r2: ResidentProfile,
): DimensionResult {
  const factors: FactorResult[] = []

  // Sleep schedule compatibility
  const sleepScore = calculateSleepCompatibility(r1.sleepSchedule, r2.sleepSchedule)
  factors.push({
    name: 'sleep_schedule',
    score: sleepScore,
    weight: DIMENSION_WEIGHTS.lifestyle.sleepSchedule,
    note: sleepScore < 50 ? 'Unterschiedliche Schlafzeiten' : undefined,
  })

  // Noise tolerance (closer values = better)
  const noiseDiff = Math.abs(r1.noiseTolerance - r2.noiseTolerance)
  const noiseScore = 100 - noiseDiff * LIFESTYLE_SCALES.noiseTolerance
  factors.push({
    name: 'noise_tolerance',
    score: noiseScore,
    weight: DIMENSION_WEIGHTS.lifestyle.noiseTolerance,
    note: noiseDiff > 2 ? 'Unterschiedliche Lärmtoleranz' : undefined,
  })

  // Cleanliness — directional, not an absolute difference. What matters is
  // whether each person's expectation of the other is met, softened by how much
  // disorder they can live with. See lib/compatibility/cleanliness.ts.
  const cleanliness = scoreCleanlinessPair(r1, r2)
  factors.push({
    name: 'cleanliness',
    score: cleanliness.score,
    weight: DIMENSION_WEIGHTS.lifestyle.cleanliness,
    note: cleanliness.note,
  })

  // Guest tolerance (closer values = better)
  const guestDiff = Math.abs(r1.guestTolerance - r2.guestTolerance)
  const guestScore = 100 - guestDiff * LIFESTYLE_SCALES.guestTolerance
  factors.push({
    name: 'guest_tolerance',
    score: guestScore,
    weight: DIMENSION_WEIGHTS.lifestyle.guestTolerance,
    note: guestDiff > 2 ? 'Unterschiedliche Besuchertoleranz' : undefined,
  })

  return {
    score: weightedAverage(factors),
    factors,
  }
}

/**
 * Social compatibility: communication style, language, privacy, conflict resolution
 */
function calculateSocialCompatibility(r1: ResidentProfile, r2: ResidentProfile): DimensionResult {
  const factors: FactorResult[] = []

  // Social style compatibility
  const socialStyleScore = calculateSocialStyleCompatibility(r1.socialStyle, r2.socialStyle)
  factors.push({
    name: 'social_style',
    score: socialStyleScore,
    weight: DIMENSION_WEIGHTS.social.socialStyle,
  })

  // Language overlap (enhanced with lingua franca support)
  const sharedLanguages = r1.languages.filter((l) => r2.languages.includes(l))
  const languageScore = calculateLanguageScore(r1.languages, r2.languages, sharedLanguages)
  factors.push({
    name: 'language',
    score: languageScore,
    weight: DIMENSION_WEIGHTS.social.language,
    note:
      languageScore < 50
        ? 'Kommunikation könnte schwierig sein'
        : languageScore === 100
          ? `Gemeinsame Sprache: ${sharedLanguages.join(', ')}`
          : undefined,
  })

  // Privacy needs compatibility
  const privacyDiff = Math.abs(r1.privacyNeed - r2.privacyNeed)
  const privacyScore = 100 - privacyDiff * SOCIAL_SCALES.privacyNeed
  factors.push({
    name: 'privacy_needs',
    score: privacyScore,
    weight: DIMENSION_WEIGHTS.social.privacyNeed,
  })

  // Conflict resolution style compatibility
  const conflictScore = calculateConflictStyleCompatibility(r1.conflictStyle, r2.conflictStyle)
  factors.push({
    name: 'conflict_style',
    score: conflictScore,
    weight: DIMENSION_WEIGHTS.social.conflictStyle,
    note: conflictScore < 60 ? 'Unvereinbare Konfliktlösungsstile' : undefined,
  })

  return {
    score: weightedAverage(factors),
    factors,
  }
}

/**
 * Practical compatibility: smoking, diet, shared spaces
 */
function calculatePracticalCompatibility(
  r1: ResidentProfile,
  r2: ResidentProfile,
): DimensionResult {
  const factors: FactorResult[] = []

  // Smoking compatibility
  const smokingScore = calculateSmokingCompatibility(r1.smokingStatus, r2.smokingStatus)
  factors.push({
    name: 'smoking',
    score: smokingScore,
    weight: DIMENSION_WEIGHTS.practical.smoking,
    note: smokingScore < 50 ? 'Raucher/Nichtraucher Konflikt möglich' : undefined,
  })

  // Shared space preferences
  const sharedSpaceScore = calculateSharedSpaceCompatibility(r1, r2)
  factors.push({
    name: 'shared_spaces',
    score: sharedSpaceScore,
    weight: DIMENSION_WEIGHTS.practical.sharedSpaces,
  })

  // Pet tolerance
  const petScore = r1.petTolerance === r2.petTolerance ? 100 : 60
  factors.push({
    name: 'pets',
    score: petScore,
    weight: DIMENSION_WEIGHTS.practical.pets,
  })

  // Chores contribution compatibility (similar levels = less conflict)
  const choresDiff = Math.abs(r1.choresContribution - r2.choresContribution)
  const choresScore = 100 - choresDiff * PRACTICAL_SCALES.choresContribution
  factors.push({
    name: 'chores',
    score: choresScore,
    weight: DIMENSION_WEIGHTS.practical.chores,
    note: choresDiff >= 2 ? 'Unterschiedliche Beiträge zu Haushaltsaufgaben' : undefined,
  })

  return {
    score: weightedAverage(factors),
    factors,
  }
}

/**
 * Risk factors: things that could cause conflict
 */
function calculateRiskFactors(r1: ResidentProfile, r2: ResidentProfile): DimensionResult {
  const factors: FactorResult[] = []
  let totalRisk = 0

  // Age gap risk (very different ages can create friction)
  const ageGapRisk = calculateAgeGapRisk(r1.ageRange, r2.ageRange)
  if (ageGapRisk > 0) {
    factors.push({ name: 'age_gap', score: ageGapRisk, weight: 1 })
    totalRisk += ageGapRisk * 0.15
  }

  // No shared language is a significant risk
  const sharedLanguages = r1.languages.filter((l) => r2.languages.includes(l))
  if (sharedLanguages.length === 0) {
    factors.push({ name: 'communication_barrier', score: 40, weight: 1 })
    totalRisk += 40 * 0.25
  }

  // Smoking mismatch risk
  if (
    (r1.smokingStatus === 'INDOOR_SMOKER' && r2.smokingStatus === 'NON_SMOKER') ||
    (r2.smokingStatus === 'INDOOR_SMOKER' && r1.smokingStatus === 'NON_SMOKER')
  ) {
    factors.push({ name: 'smoking_conflict', score: 50, weight: 1 })
    totalRisk += 50 * 0.2
  }

  // Sleep schedule conflict risk
  if (
    (r1.sleepSchedule === 'EARLY_BIRD' && r2.sleepSchedule === 'NIGHT_OWL') ||
    (r2.sleepSchedule === 'EARLY_BIRD' && r1.sleepSchedule === 'NIGHT_OWL')
  ) {
    factors.push({ name: 'sleep_conflict', score: 35, weight: 1 })
    totalRisk += 35 * 0.2
  }

  // Extreme cleanliness difference
  if (Math.abs(r1.cleanlinessPractice - r2.cleanlinessPractice) >= 3) {
    factors.push({ name: 'cleanliness_conflict', score: 30, weight: 1 })
    totalRisk += 30 * 0.2
  }

  // Room sharing incompatibility (hard requirement)
  if (r1.roomSharingStatus === 'NEEDS_PRIVATE' || r2.roomSharingStatus === 'NEEDS_PRIVATE') {
    factors.push({ name: 'room_sharing_required', score: 80, weight: 1 })
    totalRisk += 80 * 0.3 // High weight - this is a hard requirement
  }

  // Night disturbances risk (affects roommates)
  if (r1.hasNightDisturbances || r2.hasNightDisturbances) {
    // Risk is higher if one has disturbances and other needs quiet
    const disturbanceRisk =
      (r1.hasNightDisturbances && r2.needsQuietEnvironment) ||
      (r2.hasNightDisturbances && r1.needsQuietEnvironment)
        ? 60
        : 25
    factors.push({ name: 'night_disturbance', score: disturbanceRisk, weight: 1 })
    totalRisk += disturbanceRisk * 0.15
  }

  // Sleep equipment noise risk
  if (
    (r1.hasSleepEquipment || r2.hasSleepEquipment) &&
    (r1.noiseTolerance <= 2 || r2.noiseTolerance <= 2)
  ) {
    factors.push({ name: 'equipment_noise', score: 30, weight: 1 })
    totalRisk += 30 * 0.1
  }

  // Quiet environment needs conflict with noisy roommate
  if (
    (r1.needsQuietEnvironment && r2.noiseTolerance >= 4) ||
    (r2.needsQuietEnvironment && r1.noiseTolerance >= 4)
  ) {
    factors.push({ name: 'quiet_vs_noisy', score: 40, weight: 1 })
    totalRisk += 40 * 0.15
  }

  // Chores contribution gap risk (potential for resentment)
  const choresDiff = Math.abs(r1.choresContribution - r2.choresContribution)
  if (choresDiff >= 3) {
    factors.push({ name: 'chores_imbalance', score: 35, weight: 1 })
    totalRisk += 35 * 0.15
  }

  // Recycling knowledge gap (can cause friction)
  const recyclingOrder = ['NONE', 'BASIC', 'GOOD']
  const recyclingGap = Math.abs(
    recyclingOrder.indexOf(r1.recyclingKnowledge) - recyclingOrder.indexOf(r2.recyclingKnowledge),
  )
  if (recyclingGap >= 2) {
    factors.push({ name: 'recycling_gap', score: 25, weight: 1 })
    totalRisk += 25 * 0.1
  }

  // Guest tolerance mismatch risk
  const guestDiff = Math.abs(r1.guestTolerance - r2.guestTolerance)
  if (guestDiff >= 3) {
    factors.push({ name: 'guest_conflict', score: 30, weight: 1 })
    totalRisk += 30 * 0.15
  }

  // Conflict style mismatch risk (avoidant + direct = worst combo)
  if (
    (r1.conflictStyle === 'AVOIDANT' && r2.conflictStyle === 'DIRECT') ||
    (r2.conflictStyle === 'AVOIDANT' && r1.conflictStyle === 'DIRECT')
  ) {
    factors.push({ name: 'conflict_style_mismatch', score: 25, weight: 1 })
    totalRisk += 25 * 0.1
  }

  return {
    score: Math.min(100, Math.round(totalRisk)),
    factors,
  }
}

// ============================================================================
// Helper functions
// ============================================================================

function calculateSleepCompatibility(s1: string, s2: string): number {
  if (s1 === s2) return 100
  if (s1 === 'IRREGULAR' || s2 === 'IRREGULAR') return 70
  if ((s1 === 'EARLY_BIRD' && s2 === 'NIGHT_OWL') || (s1 === 'NIGHT_OWL' && s2 === 'EARLY_BIRD')) {
    return 30
  }
  return 70 // Adjacent schedules
}

function calculateSocialStyleCompatibility(s1: string, s2: string): number {
  if (s1 === s2) return 100
  if (s1 === 'MODERATE' || s2 === 'MODERATE') return 80
  // Introverted + Extroverted can work but needs care
  return 60
}

/**
 * Conflict style compatibility
 * Based on IJIP Big Five research: agreeableness → constructive tactics
 */
function calculateConflictStyleCompatibility(s1: ConflictStyle, s2: ConflictStyle): number {
  if (s1 === s2) return 100
  // Cooperative bridges all styles (high agreeableness)
  if (s1 === 'COOPERATIVE' || s2 === 'COOPERATIVE') return 85
  // Avoidant + Direct is worst mismatch — one avoids, other confronts
  return 50
}

function calculateSmokingCompatibility(s1: string, s2: string): number {
  if (s1 === s2) return 100
  if (s1 === 'NON_SMOKER' && s2 === 'OUTDOOR_SMOKER') return 80
  if (s2 === 'NON_SMOKER' && s1 === 'OUTDOOR_SMOKER') return 80
  if (s1 === 'INDOOR_SMOKER' || s2 === 'INDOOR_SMOKER') {
    if (s1 === 'NON_SMOKER' || s2 === 'NON_SMOKER') return 20
    return 60
  }
  return 70
}

function calculateSharedSpaceCompatibility(r1: ResidentProfile, r2: ResidentProfile): number {
  let score = 100

  // Both need to accept shared spaces
  if (!r1.sharedBathroom && r2.sharedBathroom) score -= 20
  if (!r2.sharedBathroom && r1.sharedBathroom) score -= 20
  if (!r1.sharedKitchen && r2.sharedKitchen) score -= 15
  if (!r2.sharedKitchen && r1.sharedKitchen) score -= 15

  return Math.max(0, score)
}

function calculateAgeGapRisk(a1: string, a2: string): number {
  const ageOrder = ['YOUNG_ADULT', 'ADULT', 'MIDDLE_AGED', 'SENIOR']
  const idx1 = ageOrder.indexOf(a1)
  const idx2 = ageOrder.indexOf(a2)
  const gap = Math.abs(idx1 - idx2)

  if (gap === 0) return 0
  if (gap === 1) return 10
  if (gap === 2) return 25
  return 40 // Maximum gap (young adult + senior)
}

// Language codes/names that indicate German
const GERMAN_VARIANTS = ['de', 'german', 'deutsch']
// Language codes/names that indicate English
const ENGLISH_VARIANTS = ['en', 'english']
// Language codes/names that indicate French/Italian
const FRENCH_VARIANTS = ['fr', 'french']
const ITALIAN_VARIANTS = ['it', 'italian']

function isGermanOrEnglish(lang: string): boolean {
  const l = lang.toLowerCase()
  return GERMAN_VARIANTS.includes(l) || ENGLISH_VARIANTS.includes(l)
}

function isGerman(lang: string): boolean {
  return GERMAN_VARIANTS.includes(lang.toLowerCase())
}

function isEnglish(lang: string): boolean {
  return ENGLISH_VARIANTS.includes(lang.toLowerCase())
}

function isFrenchOrItalian(lang: string): boolean {
  const l = lang.toLowerCase()
  return FRENCH_VARIANTS.includes(l) || ITALIAN_VARIANTS.includes(l)
}

/**
 * Enhanced language compatibility scoring
 * Considers: native language match, lingua franca (German/English), multiple shared languages
 * Handles both config codes (DE, EN) and legacy labels (German, English)
 */
function calculateLanguageScore(
  langs1: string[],
  langs2: string[],
  sharedLanguages: string[],
): number {
  // Perfect match - share native or multiple languages
  if (sharedLanguages.length >= 2) return 100
  if (sharedLanguages.length === 1) {
    const shared = sharedLanguages[0]
    // Native language match or strong lingua franca
    if (isGerman(shared)) return 100
    if (isEnglish(shared)) return 95
    if (isFrenchOrItalian(shared)) return 90
    return 100 // Any shared native language
  }

  // No direct overlap - check for potential communication via lingua franca
  const hasGermanOrEnglish1 = langs1.some(isGermanOrEnglish)
  const hasGermanOrEnglish2 = langs2.some(isGermanOrEnglish)

  // Both speak German or English (even if different levels)
  if (hasGermanOrEnglish1 && hasGermanOrEnglish2) return 75

  // One speaks German/English, other doesn't
  if (hasGermanOrEnglish1 || hasGermanOrEnglish2) return 50

  // No common language and no lingua franca - very difficult
  return 25
}

function weightedAverage(factors: FactorResult[]): number {
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0)
  const weightedSum = factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  return Math.round(weightedSum / totalWeight)
}

/**
 * Generate human-readable insights from scores
 */
function generateInsights(
  r1: ResidentProfile,
  r2: ResidentProfile,
  dimensions: {
    lifestyle: DimensionResult
    social: DimensionResult
    practical: DimensionResult
    risk: DimensionResult
  },
): { strengths: string[]; concerns: string[]; recommendations: string[]; predictions: string[] } {
  const strengths: string[] = []
  const concerns: string[] = []
  const recommendations: string[] = []

  // Analyze lifestyle
  if (dimensions.lifestyle.score >= 80) {
    strengths.push('Ähnlicher Lebensstil und Tagesrhythmus')
  }

  // Analyze social
  const sharedLanguages = r1.languages.filter((l) => r2.languages.includes(l))
  if (sharedLanguages.length > 0) {
    strengths.push(`Gemeinsame Sprache: ${sharedLanguages.join(', ')}`)
  } else {
    concerns.push('Keine gemeinsame Sprache - Kommunikation schwierig')
    recommendations.push('Bildmaterial für Hausregeln bereitstellen')
  }

  // Analyze practical
  if (dimensions.practical.score < 50) {
    const smokingFactor = dimensions.practical.factors.find((f) => f.name === 'smoking')
    if (smokingFactor && smokingFactor.score < 50) {
      concerns.push('Raucher/Nichtraucher Konfliktpotential')
      recommendations.push('Klare Raucherzonen definieren')
    }
  }

  // Analyze risk
  if (dimensions.risk.score > 40) {
    recommendations.push('Regelmässige Check-ins in den ersten Wochen')
  }

  // Sleep schedule
  if (
    (r1.sleepSchedule === 'EARLY_BIRD' && r2.sleepSchedule === 'NIGHT_OWL') ||
    (r1.sleepSchedule === 'NIGHT_OWL' && r2.sleepSchedule === 'EARLY_BIRD')
  ) {
    concerns.push('Sehr unterschiedliche Schlafzeiten')
    recommendations.push('Räume möglichst weit voneinander platzieren')
  }

  // Positive factors
  if (r1.socialStyle === r2.socialStyle) {
    strengths.push('Ähnliche soziale Bedürfnisse')
  }

  // Conflict style insights
  if (r1.conflictStyle === r2.conflictStyle) {
    strengths.push('Ähnlicher Konfliktlösungsstil')
  } else if (
    (r1.conflictStyle === 'AVOIDANT' && r2.conflictStyle === 'DIRECT') ||
    (r2.conflictStyle === 'AVOIDANT' && r1.conflictStyle === 'DIRECT')
  ) {
    concerns.push('Gegensätzliche Konfliktlösungsstile (vermeidend/direkt)')
    recommendations.push('Mediation bei Konflikten frühzeitig anbieten')
  }

  // Guest tolerance insights
  const guestDiff = Math.abs(r1.guestTolerance - r2.guestTolerance)
  if (guestDiff >= 3) {
    concerns.push('Sehr unterschiedliche Besuchertoleranz')
    recommendations.push('Klare Besucherregeln vereinbaren')
  }

  // Health/Support factors
  if (r1.roomSharingStatus === 'NEEDS_PRIVATE' || r2.roomSharingStatus === 'NEEDS_PRIVATE') {
    concerns.push('Einer/beide benötigen Einzelzimmer')
    recommendations.push('Nur in Einheit mit verfügbarem Einzelzimmer platzieren')
  }

  if (
    (r1.hasNightDisturbances && r2.needsQuietEnvironment) ||
    (r2.hasNightDisturbances && r1.needsQuietEnvironment)
  ) {
    concerns.push('Nächtliche Unruhe trifft auf Ruhebedürfnis')
    recommendations.push('Nicht im selben Zimmer platzieren')
  }

  if (r1.needsQuietEnvironment && r2.needsQuietEnvironment) {
    strengths.push('Beide bevorzugen ruhige Umgebung')
  }

  if (r1.supportLevel === 'INTENSIVE' || r2.supportLevel === 'INTENSIVE') {
    recommendations.push('Intensive Betreuung einplanen')
  }

  // Chores insights
  const choresDiff = Math.abs(r1.choresContribution - r2.choresContribution)
  if (choresDiff >= 3) {
    concerns.push('Grosse Unterschiede bei Haushaltsaufgaben')
    recommendations.push('Klare Aufgabenverteilung schriftlich festhalten')
  } else if (r1.choresContribution >= 4 && r2.choresContribution >= 4) {
    strengths.push('Beide engagiert bei Haushaltsaufgaben')
  }

  // Recycling insights
  if (r1.recyclingKnowledge === 'NONE' || r2.recyclingKnowledge === 'NONE') {
    recommendations.push('Recycling-Schulung für Personen ohne Erfahrung einplanen')
  }
  if (
    (r1.recyclingKnowledge === 'GOOD' && r2.recyclingKnowledge === 'NONE') ||
    (r2.recyclingKnowledge === 'GOOD' && r1.recyclingKnowledge === 'NONE')
  ) {
    concerns.push('Recycling-Kenntnisse sehr unterschiedlich')
  }

  // Add conflict predictions based on detected issues
  const predictions: string[] = []

  // Cleanliness conflict prediction
  const cleanDiff = Math.abs(r1.cleanlinessPractice - r2.cleanlinessPractice)
  if (cleanDiff >= 3) {
    predictions.push('Hohe Wahrscheinlichkeit Sauberkeitskonflikt in Wochen 2-4')
  } else if (cleanDiff >= 2) {
    predictions.push('Mittlere Wahrscheinlichkeit Sauberkeitskonflikt in Wochen 3-6')
  }

  // Noise conflict prediction
  const noiseDiff = Math.abs(r1.noiseTolerance - r2.noiseTolerance)
  if (noiseDiff >= 3) {
    predictions.push('Hohe Wahrscheinlichkeit Lärmkonflikt in Wochen 1-3')
  }

  // Sleep schedule conflict prediction
  if (
    (r1.sleepSchedule === 'EARLY_BIRD' && r2.sleepSchedule === 'NIGHT_OWL') ||
    (r1.sleepSchedule === 'NIGHT_OWL' && r2.sleepSchedule === 'EARLY_BIRD')
  ) {
    predictions.push('Hohe Wahrscheinlichkeit Schlafstörungs-Beschwerden in Wochen 2-4')
  }

  // Chores conflict prediction
  if (choresDiff >= 3) {
    predictions.push('Mittlere Wahrscheinlichkeit Hausarbeitskonflikt in Wochen 4-8')
  }

  // Guest conflict prediction
  if (guestDiff >= 3) {
    predictions.push('Mittlere Wahrscheinlichkeit Besucherkonflikt in Wochen 2-6')
  }

  // Add temporal recommendations
  if (predictions.length > 0) {
    recommendations.push('Check-in in Woche 3 empfohlen (kritische Phase)')
  }

  if (dimensions.risk.score > 60) {
    recommendations.push('Wöchentliche Check-ins für ersten Monat')
  }

  return { strengths, concerns, recommendations, predictions }
}

// Re-export from shared utils for backwards compatibility
export { getScoreLabel, getScoreBadgeClass as getScoreClass } from '@/lib/utils/formatting'
