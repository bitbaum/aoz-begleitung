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

/**
 * The filter bar on the Klient*innen list. Option labels are NOT here — they
 * are read from the config each filter draws on (factors, statuses, care
 * seats), so a language or age band is named in exactly one place.
 */
export const CLIENT_FILTER_LABELS = {
  barLabel: 'Klient*innen filtern',
  toggle: (n: number) => (n === 0 ? 'Filter' : `Filter (${n})`),
  any: 'Alle',
  apply: 'Anwenden',
  unit: 'Wohnung / Haus',
  language: 'Sprache',
  stand: 'Stand',
  ageRange: 'Altersgruppe',
  seat: 'Zuständig',
  seatMine: 'Meine Klient*innen',
  /** A care seat nobody holds — the gap staff most often go looking for. */
  seatOpen: (role: string) => `Unbesetzt: ${role}`,
  movedIn: 'Eingezogen',
  movedInWithin: (days: number) => `In den letzten ${days} Tagen`,
  awaitingAnswer: 'Offene Anfrage',
  awaitingAnswerHint: 'Nur mit unbeantworteter Anfrage',
} as const

export const CLIENT_GROUP_LABELS = {
  rowLabel: 'Gruppen',
  memberCount: (n: number) => (n === 1 ? '1 Person' : `${n} Personen`),
  save: 'Als Gruppe speichern',
  saveSubmit: 'Gruppe speichern',
  saveHint:
    'Eine Gruppe speichert die Filter, nicht die Personen: wer dazugehört, wird bei jedem Öffnen neu bestimmt.',
  name: 'Name',
  namePlaceholder: 'z.B. Arabisch sprechend in WIT-458',
  description: 'Beschreibung (optional)',
  rename: 'Umbenennen',
  renameSubmit: 'Speichern',
  delete: 'Löschen',
  deleteConfirm: 'Gruppe wirklich löschen? Die Klient*innen selbst bleiben unverändert.',
  cancel: 'Abbrechen',
  invalidFilters:
    'Diese Gruppe enthält Filter, die es nicht mehr gibt. Bitte speichern Sie sie neu.',
  errors: {
    nameRequired: 'Bitte geben Sie der Gruppe einen Namen.',
    nameTooLong: 'Der Name darf höchstens 80 Zeichen lang sein.',
    descriptionTooLong: 'Die Beschreibung darf höchstens 280 Zeichen lang sein.',
    noFilters:
      'Ohne Filter wäre die Gruppe einfach alle Klient*innen. Wählen Sie zuerst mindestens einen Filter.',
    invalidFilters: 'Diese Filter sind ungültig. Bitte laden Sie die Seite neu.',
    notFound: 'Diese Gruppe gibt es nicht mehr.',
    notYours:
      'Nur die Person, die die Gruppe angelegt hat, oder die Systemadministration kann sie ändern.',
    saveFailed: 'Die Gruppe konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.',
  },
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
