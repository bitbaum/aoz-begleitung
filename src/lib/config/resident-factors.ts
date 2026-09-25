/**
 * Resident Factor Configuration
 *
 * SINGLE SOURCE OF TRUTH for all resident factors.
 *
 * To add a new factor:
 * 1. Add to RESIDENT_FACTORS below
 * 2. Add corresponding field to Prisma schema (if not using JSON storage)
 * 3. Run prisma migrate
 *
 * Everything else (forms, labels, compatibility) auto-generates from this config.
 */

import type { CompatibilityFactorDef, DimensionConfig, FormSectionConfig } from './types'
import { BRAND } from './brand'

// =============================================================================
// DIMENSIONS (for compatibility scoring)
// =============================================================================

export const RESIDENT_DIMENSIONS: DimensionConfig[] = [
  {
    id: 'lifestyle',
    label: 'Lebensstil',
    weight: 0.35,
    description: 'Tagesablauf, Lärm, Sauberkeit, Besucher',
  },
  {
    id: 'social',
    label: 'Soziales',
    weight: 0.25,
    description: 'Kommunikation, Privatsphäre, Interaktion, Konfliktlösung',
  },
  {
    id: 'practical',
    label: 'Praktisches',
    weight: 0.2,
    description: 'Rauchen, Ernährung, Ausstattung',
  },
  {
    id: 'requirements',
    label: 'Anforderungen',
    weight: 0.2,
    description: 'Harte Anforderungen die erfüllt sein müssen',
  },
]

// =============================================================================
// FORM SECTIONS (for UI organization)
// =============================================================================

export const RESIDENT_FORM_SECTIONS: FormSectionConfig[] = [
  { id: 'basic', label: 'Grunddaten', order: 1 },
  { id: 'lifestyle', label: 'Lebensstil', order: 2 },
  { id: 'social', label: 'Soziales', order: 3 },
  { id: 'practical', label: 'Praktisches', order: 4 },
  {
    id: 'household',
    label: 'Haushalt',
    description: 'Gemeinschaftliche Aufgaben und Abfall',
    order: 5,
  },
  { id: 'health', label: 'Unterstützungsbedarf', order: 6 },
  { id: 'preferences', label: 'Präferenzen', order: 7 },
  { id: 'notes', label: 'Notizen', order: 8 },
]

// =============================================================================
// RESIDENT FACTORS
// =============================================================================

export const RESIDENT_FACTORS: Record<string, CompatibilityFactorDef> = {
  // ---------------------------------------------------------------------------
  // BASIC INFO (no compatibility impact, just identification)
  // ---------------------------------------------------------------------------
  code: {
    id: 'code',
    type: 'text',
    label: 'Code / Referenz',
    /**
     * Optional, generated when blank.
     *
     * The placeholder used to read "z.B. R-2024-001", a pattern matching NO
     * prefix that login accepts — so a code typed to the example produced a
     * client who could never sign in, silently. It is now derived from the
     * brand, because the prefix is what login actually resolves against and a
     * literal here would be a second copy of it.
     */
    description: 'Anonyme Referenznummer — leer lassen, um einen Code zu erzeugen.',
    placeholder: `z.B. ${BRAND.residentCodePrefix}A1B2C3 (oder leer lassen)`,
    required: false,
    intake: 'essential',
    formSection: 'basic',
    formOrder: 1,
    dimension: 'requirements',
    weight: 0,
    rule: 'NONE',
  },

  ageRange: {
    id: 'ageRange',
    type: 'enum',
    label: 'Altersgruppe',
    required: true,
    intake: 'essential',
    formSection: 'basic',
    formOrder: 2,
    options: ['YOUNG_ADULT', 'ADULT', 'MIDDLE_AGED', 'SENIOR'] as const,
    optionLabels: {
      YOUNG_ADULT: '18-25 Jahre',
      ADULT: '26-40 Jahre',
      MIDDLE_AGED: '41-55 Jahre',
      SENIOR: '56+ Jahre',
    },
    dimension: 'social',
    weight: 0.1,
    rule: 'SAME_IS_BETTER',
  },

  gender: {
    id: 'gender',
    type: 'enum',
    label: 'Geschlecht',
    required: true,
    intake: 'essential',
    formSection: 'basic',
    formOrder: 3,
    options: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_SAY'] as const,
    optionLabels: {
      MALE: 'Männlich',
      FEMALE: 'Weiblich',
      OTHER: 'Andere',
      PREFER_NOT_SAY: 'Keine Angabe',
    },
    dimension: 'social',
    weight: 0.15,
    rule: 'SAME_IS_BETTER',
  },

  familyStatus: {
    id: 'familyStatus',
    type: 'enum',
    label: 'Familienstatus',
    required: true,
    intake: 'essential',
    formSection: 'basic',
    formOrder: 4,
    options: ['SINGLE', 'COUPLE', 'FAMILY_WITH_CHILDREN', 'SINGLE_PARENT'] as const,
    optionLabels: {
      SINGLE: 'Alleinstehend',
      COUPLE: 'Paar',
      FAMILY_WITH_CHILDREN: 'Familie mit Kindern',
      SINGLE_PARENT: 'Alleinerziehend',
    },
    dimension: 'lifestyle',
    weight: 0.15,
    rule: 'SAME_IS_BETTER',
  },

  // ---------------------------------------------------------------------------
  // LIFESTYLE FACTORS
  // ---------------------------------------------------------------------------
  sleepSchedule: {
    id: 'sleepSchedule',
    type: 'enum',
    label: 'Schlafrhythmus',
    description: 'Wann schläft und wacht die Person normalerweise?',
    required: true,
    intake: 'essential',
    formSection: 'lifestyle',
    formOrder: 1,
    options: ['EARLY_BIRD', 'STANDARD', 'NIGHT_OWL', 'IRREGULAR'] as const,
    optionLabels: {
      EARLY_BIRD: 'Frühaufsteher (vor 22:00 schlafen)',
      STANDARD: 'Normal (22:00-24:00 schlafen)',
      NIGHT_OWL: 'Nachtmensch (nach 24:00 schlafen)',
      IRREGULAR: 'Unregelmässig (Schichtarbeit)',
    },
    dimension: 'lifestyle',
    weight: 0.35,
    rule: 'SAME_IS_BETTER',
  },

  noiseTolerance: {
    id: 'noiseTolerance',
    type: 'scale',
    label: 'Lärmtoleranz',
    description: 'Wie empfindlich gegenüber Geräuschen?',
    intake: 'essential',
    formSection: 'lifestyle',
    formOrder: 2,
    min: 1,
    max: 5,
    default: 3,
    lowLabel: 'Sehr empfindlich',
    highLabel: 'Sehr tolerant',
    dimension: 'lifestyle',
    weight: 0.25,
    rule: 'SIMILAR_IS_BETTER',
  },

  // Cleanliness is three questions, not one. Asking only "how important is
  // tidiness to you" cannot tell apart the tidy person who leaves others alone
  // from the one who will file a complaint every week — and that difference,
  // not the tidiness itself, is what decides whether a household works.
  cleanlinessPractice: {
    id: 'cleanlinessPractice',
    type: 'scale',
    label: 'Eigene Ordnung',
    description: 'Wie ordentlich hältst du deinen eigenen Bereich?',
    intake: 'essential',
    formSection: 'lifestyle',
    formOrder: 3,
    min: 1,
    max: 5,
    default: 3,
    lowLabel: 'Eher unordentlich',
    highLabel: 'Sehr ordentlich',
    dimension: 'lifestyle',
    weight: 0.15,
    rule: 'SIMILAR_IS_BETTER',
  },

  cleanlinessExpectation: {
    id: 'cleanlinessExpectation',
    type: 'scale',
    label: 'Erwartung an andere',
    description: 'Wie ordentlich sollten die anderen im Haushalt sein?',
    intake: 'essential',
    formSection: 'lifestyle',
    formOrder: 4,
    min: 1,
    max: 5,
    default: 3,
    lowLabel: 'Ist mir egal',
    highLabel: 'Sehr ordentlich',
    dimension: 'lifestyle',
    weight: 0.1,
    rule: 'SIMILAR_IS_BETTER',
  },

  chaosTolerance: {
    id: 'chaosTolerance',
    type: 'scale',
    label: 'Toleranz für Unordnung',
    description: 'Wie gut kannst du mit Unordnung und Chaos leben?',
    intake: 'essential',
    formSection: 'lifestyle',
    formOrder: 5,
    min: 1,
    max: 5,
    default: 3,
    lowLabel: 'Stört mich sehr',
    highLabel: 'Stört mich nicht',
    dimension: 'lifestyle',
    weight: 0.05,
    rule: 'SIMILAR_IS_BETTER',
  },

  guestTolerance: {
    id: 'guestTolerance',
    type: 'scale',
    label: 'Besuchertoleranz',
    description: 'Wie stehen Sie zu Besuchern in der Wohnung?',
    formSection: 'lifestyle',
    formOrder: 6,
    min: 1,
    max: 5,
    default: 3,
    lowLabel: 'Lieber keine Besucher',
    highLabel: 'Besucher willkommen',
    dimension: 'lifestyle',
    weight: 0.1,
    rule: 'SIMILAR_IS_BETTER',
  },

  // ---------------------------------------------------------------------------
  // SOCIAL FACTORS
  // ---------------------------------------------------------------------------
  socialStyle: {
    id: 'socialStyle',
    type: 'enum',
    label: 'Soziale Präferenz',
    description: 'Wie viel Kontakt mit Mitbewohnern gewünscht?',
    required: true,
    /**
     * `intake: 'essential'` is what puts a field on the form a human fills.
     *
     * This was missing, and `ResidentInputSchema` requires `socialStyle` with
     * NO default — so the intake form rendered no control for it and every
     * submission died on the server. Observed on production 2026-09-05:
     * "Etwas ist schiefgelaufen", the route unmounted, all fields lost. The
     * client intake form — the primary way to add a person to this product —
     * could not be completed by anyone.
     *
     * The alternative fix was a schema default, as its three neighbours have.
     * Rejected: this factor carries weight 0.25 in the social dimension, so a
     * default would silently assign every new client the same social
     * preference and quietly corrupt matching. That is the same damage the
     * `guestTolerance` comment above describes — "nobody answered" and
     * "answered MODERATE" look identical in the data.
     */
    intake: 'essential',
    formSection: 'social',
    formOrder: 1,
    options: ['INTROVERTED', 'MODERATE', 'EXTROVERTED'] as const,
    optionLabels: {
      INTROVERTED: 'Introvertiert (bevorzugt Ruhe)',
      MODERATE: 'Ausgeglichen',
      EXTROVERTED: 'Extrovertiert (mag Gesellschaft)',
    },
    dimension: 'social',
    weight: 0.25,
    rule: 'SIMILAR_IS_BETTER',
  },

  privacyNeed: {
    id: 'privacyNeed',
    type: 'scale',
    label: 'Privatsphäre',
    description: 'Wie viel Rückzugsort wird benötigt?',
    formSection: 'social',
    formOrder: 2,
    min: 1,
    max: 5,
    default: 3,
    lowLabel: 'Offen',
    highLabel: 'Viel Privatsphäre',
    dimension: 'social',
    weight: 0.3,
    rule: 'SIMILAR_IS_BETTER',
  },

  languages: {
    id: 'languages',
    type: 'multi',
    label: 'Sprachen',
    description: 'Welche Sprachen werden gesprochen?',
    intake: 'essential',
    formSection: 'social',
    formOrder: 3,
    options: ['DE', 'EN', 'FR', 'AR', 'FA', 'TR', 'TI', 'UK', 'RU', 'PS', 'OTHER'] as const,
    optionLabels: {
      DE: 'Deutsch',
      EN: 'Englisch',
      FR: 'Französisch',
      AR: 'Arabisch',
      FA: 'Farsi',
      TR: 'Türkisch',
      TI: 'Tigrinya',
      UK: 'Ukrainisch',
      RU: 'Russisch',
      PS: 'Paschtu',
      OTHER: 'Andere',
    },
    dimension: 'social',
    weight: 0.35,
    rule: 'OVERLAP_IS_BETTER',
  },

  culturalRegion: {
    id: 'culturalRegion',
    type: 'text',
    label: 'Kulturelle Region',
    description:
      'Optional, nur grobe Region, nie ein Herkunftsland. Wird nicht bewertet — nur Kontext für die Betreuung. Lieber leer lassen als raten.',
    placeholder: 'z.B. Naher Osten, Ostafrika, Balkan',
    intake: 'detail',
    formSection: 'social',
    formOrder: 4,
    dimension: 'social',
    weight: 0.1,
    rule: 'NONE', // Used for context, not scoring
  },

  conflictStyle: {
    id: 'conflictStyle',
    type: 'enum',
    label: 'Umgang mit Meinungsverschiedenheiten',
    description: 'Wie geht die Person mit Konflikten um?',
    required: true,
    formSection: 'social',
    formOrder: 5,
    options: ['AVOIDANT', 'COOPERATIVE', 'DIRECT'] as const,
    optionLabels: {
      AVOIDANT: 'Vermeidend (meidet Konfrontation)',
      COOPERATIVE: 'Kooperativ (sucht Kompromiss)',
      DIRECT: 'Direkt (spricht Probleme offen an)',
    },
    default: 'COOPERATIVE',
    dimension: 'social',
    weight: 0.1,
    rule: 'SAME_IS_BETTER',
  },

  // ---------------------------------------------------------------------------
  // PRACTICAL FACTORS
  // ---------------------------------------------------------------------------
  smokingStatus: {
    id: 'smokingStatus',
    type: 'enum',
    label: 'Rauchen',
    required: true,
    intake: 'essential',
    formSection: 'practical',
    formOrder: 1,
    options: ['NON_SMOKER', 'OUTDOOR_SMOKER', 'INDOOR_SMOKER'] as const,
    optionLabels: {
      NON_SMOKER: 'Nichtraucher',
      OUTDOOR_SMOKER: 'Raucht nur draussen',
      INDOOR_SMOKER: 'Raucht auch drinnen',
    },
    dimension: 'practical',
    weight: 0.45,
    rule: 'MUST_ALLOW',
    housingField: 'smokingAllowed',
  },

  dietaryNeeds: {
    id: 'dietaryNeeds',
    type: 'multi',
    label: 'Ernährung',
    description: 'Besondere Ernährungsbedürfnisse',
    formSection: 'practical',
    formOrder: 2,
    options: ['HALAL', 'KOSHER', 'VEGETARIAN', 'VEGAN', 'NONE'] as const,
    optionLabels: {
      HALAL: 'Halal',
      KOSHER: 'Koscher',
      VEGETARIAN: 'Vegetarisch',
      VEGAN: 'Vegan',
      NONE: 'Keine besonderen',
    },
    dimension: 'practical',
    weight: 0.05,
    rule: 'OVERLAP_IS_BETTER',
  },

  mobilityNeeds: {
    id: 'mobilityNeeds',
    type: 'enum',
    label: 'Mobilitätsbedarf',
    required: true,
    intake: 'essential',
    formSection: 'practical',
    formOrder: 3,
    options: ['NONE', 'GROUND_FLOOR', 'WHEELCHAIR'] as const,
    optionLabels: {
      NONE: 'Keine Einschränkung',
      GROUND_FLOOR: 'Erdgeschoss benötigt',
      WHEELCHAIR: 'Rollstuhlgerecht benötigt',
    },
    dimension: 'requirements',
    weight: 1.0, // Hard requirement
    rule: 'MUST_HAVE',
    housingField: 'wheelchairAccess', // or groundFloor
  },

  medicalEquipment: {
    id: 'medicalEquipment',
    type: 'boolean',
    label: 'Medizinische Geräte',
    description: 'Benötigt Platz/Strom für medizinische Geräte',
    formSection: 'practical',
    formOrder: 4,
    default: false,
    trueLabel: 'Ja',
    falseLabel: 'Nein',
    dimension: 'practical',
    weight: 0.1,
    rule: 'NONE',
  },

  // ---------------------------------------------------------------------------
  // HOUSEHOLD (Chores, recycling - conflict prevention)
  // ---------------------------------------------------------------------------
  choresContribution: {
    id: 'choresContribution',
    type: 'scale',
    label: 'Beitrag zu Haushaltsaufgaben',
    description: 'Wie aktiv beteiligt sich die Person an gemeinsamen Aufgaben (Müll, Putzen)?',
    formSection: 'household',
    formOrder: 1,
    min: 1,
    max: 5,
    default: 3,
    lowLabel: 'Wenig aktiv',
    highLabel: 'Sehr aktiv',
    dimension: 'practical',
    weight: 0.15,
    rule: 'SIMILAR_IS_BETTER', // Match people with similar contribution levels
  },

  recyclingKnowledge: {
    id: 'recyclingKnowledge',
    type: 'enum',
    label: 'Recycling-Erfahrung',
    description: 'Kenntnis der Schweizer Recycling-Regeln (Glas, Papier, PET, Alu, etc.)',
    required: true,
    formSection: 'household',
    formOrder: 2,
    options: ['NONE', 'BASIC', 'GOOD'] as const,
    optionLabels: {
      NONE: 'Keine Erfahrung',
      BASIC: 'Grundkenntnisse',
      GOOD: 'Gute Kenntnisse',
    },
    default: 'NONE',
    dimension: 'practical',
    weight: 0.1,
    rule: 'SIMILAR_IS_BETTER', // Similar levels reduce friction
  },

  // ---------------------------------------------------------------------------
  // HEALTH / SUPPORT NEEDS (Functional, not diagnostic)
  // ---------------------------------------------------------------------------
  roomSharingStatus: {
    id: 'roomSharingStatus',
    type: 'enum',
    label: 'Zimmerteilung',
    description: 'Kann die Person ein Zimmer mit anderen teilen?',
    required: true,
    formSection: 'health',
    formOrder: 1,
    options: ['CAN_SHARE', 'PREFERS_PRIVATE', 'NEEDS_PRIVATE'] as const,
    optionLabels: {
      CAN_SHARE: 'Kann Zimmer teilen',
      PREFERS_PRIVATE: 'Bevorzugt Einzelzimmer',
      NEEDS_PRIVATE: 'Benötigt Einzelzimmer',
    },
    default: 'CAN_SHARE',
    dimension: 'requirements',
    weight: 1.0, // Hard requirement when NEEDS_PRIVATE
    rule: 'MUST_HAVE',
    housingField: 'privateRooms',
  },

  hasNightDisturbances: {
    id: 'hasNightDisturbances',
    type: 'boolean',
    label: 'Nächtliche Unruhe',
    description: 'Alpträume, Schlafwandeln, lautes Schlafen',
    formSection: 'health',
    formOrder: 2,
    default: false,
    trueLabel: 'Ja',
    falseLabel: 'Nein',
    dimension: 'lifestyle',
    weight: 0.2,
    rule: 'SAME_IS_BETTER', // Match with others who have it or are tolerant
  },

  needsQuietEnvironment: {
    id: 'needsQuietEnvironment',
    type: 'boolean',
    label: 'Ruhige Umgebung nötig',
    description: 'Benötigt besonders ruhige Wohnumgebung',
    formSection: 'health',
    formOrder: 3,
    default: false,
    trueLabel: 'Ja',
    falseLabel: 'Nein',
    dimension: 'lifestyle',
    weight: 0.15,
    rule: 'MUST_HAVE',
    housingField: 'quietHours', // Prefer units with quiet hours
  },

  hasSleepEquipment: {
    id: 'hasSleepEquipment',
    type: 'boolean',
    label: 'Schlafgeräte',
    description: 'CPAP oder andere Geräte die Geräusche machen',
    formSection: 'health',
    formOrder: 4,
    default: false,
    trueLabel: 'Ja',
    falseLabel: 'Nein',
    dimension: 'lifestyle',
    weight: 0.1,
    rule: 'NONE', // Informational, affects roommate selection
  },

  supportLevel: {
    id: 'supportLevel',
    type: 'enum',
    label: 'Betreuungsstufe',
    description: 'Wie viel Unterstützung wird benötigt?',
    formSection: 'health',
    formOrder: 5,
    options: ['STANDARD', 'ELEVATED', 'INTENSIVE'] as const,
    optionLabels: {
      STANDARD: 'Standard',
      ELEVATED: 'Erhöht (regelmässige Check-ins)',
      INTENSIVE: 'Intensiv (enge Betreuung)',
    },
    default: 'STANDARD',
    dimension: 'requirements',
    weight: 0,
    rule: 'NONE', // For caseworker info, not compatibility
  },

  interpreterNeed: {
    id: 'interpreterNeed',
    type: 'enum',
    label: 'Dolmetschung',
    description: 'Braucht diese Person eine Dolmetschung im Gespräch?',
    formSection: 'health',
    formOrder: 7,
    options: ['NONE', 'FOR_COMPLEX', 'ALWAYS'] as const,
    optionLabels: {
      NONE: 'Keine Dolmetschung nötig',
      FOR_COMPLEX: 'Bei komplexen Gesprächen',
      ALWAYS: 'Immer',
    },
    default: 'NONE',
    dimension: 'requirements',
    // Zero weight. Needing an interpreter says nothing about who someone can
    // live with — scoring it would turn a communication need into a placement
    // penalty, which is the opposite of what it is for.
    weight: 0,
    rule: 'NONE',
  },

  livingSkillsSupport: {
    id: 'livingSkillsSupport',
    type: 'enum',
    label: 'Wohnfähigkeit',
    description: 'Wie viel Unterstützung braucht diese Person im Haushalt?',
    formSection: 'health',
    formOrder: 6,
    options: ['INDEPENDENT', 'SOME_SUPPORT', 'REGULAR_SUPPORT'] as const,
    optionLabels: {
      INDEPENDENT: 'Selbstständig',
      SOME_SUPPORT: 'Punktuelle Unterstützung (Post, Termine, Ämtli)',
      REGULAR_SUPPORT: 'Regelmässige Begleitung im Alltag',
    },
    default: 'INDEPENDENT',
    dimension: 'requirements',
    // Zero weight, like `supportLevel`. This describes what the household needs
    // from the Betreuung, not how two people get along — scoring someone down
    // as a roommate for needing help with their post would be exactly the
    // wrong use of it.
    weight: 0,
    rule: 'NONE',
  },

  // ---------------------------------------------------------------------------
  // PREFERENCES
  // ---------------------------------------------------------------------------
  petTolerance: {
    id: 'petTolerance',
    type: 'boolean',
    label: 'Haustiere OK',
    description: 'Kann mit Haustieren leben',
    formSection: 'preferences',
    formOrder: 1,
    default: true,
    trueLabel: 'Ja',
    falseLabel: 'Nein',
    dimension: 'practical',
    weight: 0.1,
    rule: 'MUST_ALLOW',
    housingField: 'petsAllowed',
  },

  sharedBathroom: {
    id: 'sharedBathroom',
    type: 'boolean',
    label: 'Geteiltes Bad OK',
    description: 'Kann Badezimmer teilen',
    formSection: 'preferences',
    formOrder: 2,
    default: true,
    trueLabel: 'Ja',
    falseLabel: 'Nein',
    dimension: 'practical',
    weight: 0.1,
    rule: 'MUST_HAVE',
    housingField: 'privateBathrooms',
  },

  sharedKitchen: {
    id: 'sharedKitchen',
    type: 'boolean',
    label: 'Geteilte Küche OK',
    description: 'Kann Küche teilen',
    formSection: 'preferences',
    formOrder: 3,
    default: true,
    trueLabel: 'Ja',
    falseLabel: 'Nein',
    dimension: 'practical',
    weight: 0.1,
    rule: 'MUST_HAVE',
    housingField: 'privateKitchen',
  },

  // ---------------------------------------------------------------------------
  // NOTES
  // ---------------------------------------------------------------------------
  notes: {
    id: 'notes',
    type: 'text',
    label: 'Notizen',
    description: 'Zusätzliche Informationen für Fallarbeiter',
    placeholder: 'Zusätzliche Informationen für die Platzierung...',
    formSection: 'notes',
    formOrder: 1,
    dimension: 'requirements',
    weight: 0,
    rule: 'NONE',
  },
}

/**
 * How many factors actually move a compatibility score — the ONE number every
 * surface quotes (landing page, /algorithm, the offer).
 *
 * A factor counts only if it has a weight AND a scoring rule. It used to be
 * `weight > 0` alone, defined twice, which counted factors that are captured
 * but never scored (`rule: 'NONE'`) — so the public page claimed more matching
 * factors than the algorithm uses, and the offer quoted a third number.
 */
export const SCORED_FACTOR_COUNT = Object.values(RESIDENT_FACTORS).filter(
  (factor) => factor.weight > 0 && factor.rule !== 'NONE',
).length

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Get factors for a specific form section */
export function getFactorsBySection(sectionId: string): CompatibilityFactorDef[] {
  return Object.values(RESIDENT_FACTORS)
    .filter((f) => f.formSection === sectionId)
    .sort((a, b) => a.formOrder - b.formOrder)
}

/** Short-intake fields — enough to place someone today. */
export function isEssentialFactor(factor: CompatibilityFactorDef): boolean {
  return factor.intake === 'essential'
}

/** Get label for a specific value */
export function getFactorValueLabel(factorId: string, value: string | string[]): string {
  const factor = RESIDENT_FACTORS[factorId]
  if (!factor) return String(value)

  if (factor.type === 'enum') {
    return factor.optionLabels[value as string] || String(value)
  }
  if (factor.type === 'multi' && Array.isArray(value)) {
    return value.map((v) => factor.optionLabels[v] || v).join(', ')
  }
  if (factor.type === 'boolean') {
    return value ? factor.trueLabel || 'Ja' : factor.falseLabel || 'Nein'
  }
  return String(value)
}
