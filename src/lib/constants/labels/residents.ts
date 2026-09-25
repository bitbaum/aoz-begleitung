/**
 * Resident-related labels: factor labels, status, health/support, languages, diet, satisfaction
 */

import { getLabelsFromFactor } from './helpers'

// Full labels derived from config
export const GENDER_LABELS: Record<string, string> = getLabelsFromFactor('gender')
export const FAMILY_STATUS_LABELS: Record<string, string> = getLabelsFromFactor('familyStatus')
export const SMOKING_STATUS_LABELS: Record<string, string> = getLabelsFromFactor('smokingStatus')

// Short display variants (for compact UI like tables, badges)
export const AGE_RANGE_LABELS: Record<string, string> = {
  YOUNG_ADULT: '18-25',
  ADULT: '26-40',
  MIDDLE_AGED: '41-55',
  SENIOR: '56+',
}

export const GENDER_LABELS_SHORT: Record<string, string> = {
  MALE: 'M',
  FEMALE: 'W',
  OTHER: 'A',
  PREFER_NOT_SAY: '-',
}

export const SLEEP_SCHEDULE_LABELS: Record<string, string> = {
  EARLY_BIRD: 'Frühaufsteher',
  STANDARD: 'Normal',
  NIGHT_OWL: 'Nachteule',
  IRREGULAR: 'Unregelmässig',
}

export const SLEEP_SCHEDULE_LABELS_SHORT: Record<string, string> = {
  EARLY_BIRD: 'Früh',
  STANDARD: 'Normal',
  NIGHT_OWL: 'Nachteule',
  IRREGULAR: 'Unregelm.',
}

export const SOCIAL_STYLE_LABELS: Record<string, string> = {
  INTROVERTED: 'Ruhig',
  MODERATE: 'Ausgeglichen',
  EXTROVERTED: 'Gesellig',
}

export const SOCIAL_STYLE_LABELS_SHORT: Record<string, string> = {
  INTROVERTED: 'Ruhig',
  MODERATE: 'Ausgegl.',
  EXTROVERTED: 'Gesellig',
}

export const SMOKING_STATUS_LABELS_SHORT: Record<string, string> = {
  NON_SMOKER: 'Nichtr.',
  OUTDOOR_SMOKER: 'Draussen',
  INDOOR_SMOKER: 'Drinnen',
}

export const MOBILITY_NEED_LABELS: Record<string, string> = {
  NONE: 'Keine',
  GROUND_FLOOR: 'Erdgeschoss',
  WHEELCHAIR: 'Rollstuhlgerecht',
}

export const RESIDENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktiv',
  PLACED: 'Platziert',
  TRANSFERRED: 'Umgezogen',
  EXITED: 'Archiviert',
}

// Health / Support labels (derived from config SSOT)
export const ROOM_SHARING_STATUS_LABELS: Record<string, string> =
  getLabelsFromFactor('roomSharingStatus')
export const RECYCLING_KNOWLEDGE_LABELS: Record<string, string> =
  getLabelsFromFactor('recyclingKnowledge')

export const SUPPORT_LEVEL_LABELS: Record<string, string> = {
  STANDARD: 'Standard',
  ELEVATED: 'Erhöht',
  INTENSIVE: 'Intensiv',
}

export const TRANSFER_REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Offen',
  APPROVED: 'Genehmigt',
  DENIED: 'Abgelehnt',
  COMPLETED: 'Abgeschlossen',
  CANCELLED: 'Storniert',
}

export const CHECK_IN_TYPE_LABELS: Record<string, string> = {
  INITIAL: 'Erstgespräch',
  REGULAR: 'Regelmässig',
  AD_HOC: 'Zwischendurch',
  EXIT: 'Abschluss',
}

// Language labels (includes uppercase from config and lowercase ISO-639-1 codes for all stored variants)
export const LANGUAGE_LABELS: Record<string, string> = {
  ...getLabelsFromFactor('languages'),
  // Lowercase ISO-639-1 codes (from portal self-entry and CSV import)
  de: 'Deutsch',
  en: 'Englisch',
  fr: 'Französisch',
  ar: 'Arabisch',
  fa: 'Farsi',
  tr: 'Türkisch',
  ti: 'Tigrinya',
  uk: 'Ukrainisch',
  ru: 'Russisch',
  ps: 'Paschtu',
  es: 'Spanisch',
  so: 'Somali',
  am: 'Amharisch',
  sw: 'Swahili',
  it: 'Italienisch',
  pt: 'Portugiesisch',
  sq: 'Albanisch',
  sr: 'Serbisch',
  hr: 'Kroatisch',
  bs: 'Bosnisch',
  ku: 'Kurdisch',
  ha: 'Hausa',
  om: 'Oromo',
  rw: 'Kinyarwanda',
  // Uppercase variants for the above additions
  ES: 'Spanisch',
  SO: 'Somali',
  AM: 'Amharisch',
  SW: 'Swahili',
  IT: 'Italienisch',
  PT: 'Portugiesisch',
  SQ: 'Albanisch',
  SR: 'Serbisch',
  HR: 'Kroatisch',
  BS: 'Bosnisch',
  KU: 'Kurdisch',
  HA: 'Hausa',
  OM: 'Oromo',
  RW: 'Kinyarwanda',
  // English full-name aliases (from older import paths)
  German: 'Deutsch',
  English: 'Englisch',
  French: 'Französisch',
  Arabic: 'Arabisch',
  Spanish: 'Spanisch',
  Turkish: 'Türkisch',
  Russian: 'Russisch',
  Ukrainian: 'Ukrainisch',
  Italian: 'Italienisch',
  Somali: 'Somali',
  Amharic: 'Amharisch',
  Swahili: 'Swahili',
  Albanian: 'Albanisch',
}

// Diet labels (includes uppercase from config and lowercase aliases)
export const DIET_LABELS: Record<string, string> = {
  ...getLabelsFromFactor('dietaryNeeds'),
  vegetarian: 'Vegetarisch',
  vegan: 'Vegan',
  none: 'Keine besonderen',
}

export const RESIDENT_STAT_LABELS = {
  unplaced: 'Unplatziert',
} as const

export const CLIENT_BOARD_LABELS = {
  /**
   * German plurals are not suffixes.
   *
   * The board built this one by appending: `Vorfall` + (n !== 1 ? 'fälle' :
   * '') — which reads correctly at n = 1 and says "3 VorfallFÄLLE" at every
   * other number. The umlaut is the giveaway: the plural of `Vorfall` changes
   * the stem to `Vorfäll-`, so no suffix bolted onto the singular can ever
   * produce it. That is true of a large share of German nouns, which is why
   * the whole idiom is banned by `german-plurals.test.ts` rather than fixed
   * here one noun at a time.
   *
   * `(30T)` is the window the count covers, kept because the number is
   * meaningless without it.
   */
  incidentCount: (n: number) => (n === 1 ? '1 Vorfall (30T)' : `${n} Vorfälle (30T)`),
} as const

// Satisfaction
export const SATISFACTION_EMOJIS = ['😞', '😕', '😐', '🙂', '😊']

export const SATISFACTION_LABELS = [
  'Sehr unzufrieden',
  'Unzufrieden',
  'Neutral',
  'Zufrieden',
  'Sehr zufrieden',
]
