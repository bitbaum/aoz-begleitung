/**
 * Housing Factor Configuration
 *
 * SINGLE SOURCE OF TRUTH for all housing unit factors.
 *
 * To add a new factor:
 * 1. Add to HOUSING_FACTORS below
 * 2. Add corresponding column in src/lib/db/schema.ts (if not using JSON storage)
 * 3. Run npm run db:generate + db:migrate
 *
 * Everything else (forms, labels, matching) auto-generates from this config.
 */

import type { HousingFactorDef, FormSectionConfig } from './types'

// =============================================================================
// FORM SECTIONS
// =============================================================================

export const HOUSING_FORM_SECTIONS: FormSectionConfig[] = [
  { id: 'basic', label: 'Grunddaten', order: 1 },
  { id: 'capacity', label: 'Kapazität', order: 2 },
  { id: 'facilities', label: 'Ausstattung', order: 3 },
  { id: 'accessibility', label: 'Barrierefreiheit', order: 4 },
  { id: 'rules', label: 'Hausregeln', order: 5 },
  { id: 'location', label: 'Lage', order: 6 },
  { id: 'notes', label: 'Notizen', order: 7 },
]

// =============================================================================
// HOUSING FACTORS
// =============================================================================

export const HOUSING_FACTORS: Record<string, HousingFactorDef> = {
  // ---------------------------------------------------------------------------
  // BASIC INFO
  // ---------------------------------------------------------------------------
  code: {
    id: 'code',
    type: 'text',
    label: 'Code / Referenz',
    placeholder: 'z.B. U-2024-001',
    required: true,
    formSection: 'basic',
    formOrder: 1,
    category: 'capacity',
  },

  address: {
    id: 'address',
    type: 'text',
    label: 'Adresse',
    placeholder: 'Strasse und Hausnummer, PLZ Ort',
    required: true,
    formSection: 'basic',
    formOrder: 2,
    category: 'capacity',
  },

  buildingCode: {
    id: 'buildingCode',
    type: 'text',
    label: 'Gebäudecode',
    placeholder: 'z.B. HAUS-A — optional, zum Gruppieren',
    required: false,
    formSection: 'basic',
    formOrder: 3,
    category: 'capacity',
  },

  // ---------------------------------------------------------------------------
  // CAPACITY
  // ---------------------------------------------------------------------------
  totalBeds: {
    id: 'totalBeds',
    type: 'scale',
    label: 'Betten gesamt',
    required: true,
    formSection: 'capacity',
    formOrder: 1,
    min: 1,
    max: 20,
    default: 4,
    lowLabel: '',
    highLabel: '',
    category: 'capacity',
  },

  totalRooms: {
    id: 'totalRooms',
    type: 'scale',
    label: 'Zimmer gesamt',
    required: true,
    formSection: 'capacity',
    formOrder: 2,
    min: 1,
    max: 10,
    default: 2,
    lowLabel: '',
    highLabel: '',
    category: 'capacity',
  },

  sharedRooms: {
    id: 'sharedRooms',
    type: 'scale',
    label: 'Mehrbettzimmer',
    formSection: 'capacity',
    formOrder: 3,
    min: 0,
    max: 10,
    default: 1,
    lowLabel: '',
    highLabel: '',
    category: 'capacity',
  },

  privateRooms: {
    id: 'privateRooms',
    type: 'scale',
    label: 'Einzelzimmer',
    description: 'Für Klient*innen, die Einzelzimmer benötigen',
    formSection: 'capacity',
    formOrder: 4,
    min: 0,
    max: 10,
    default: 1,
    lowLabel: '',
    highLabel: '',
    category: 'capacity',
  },

  // ---------------------------------------------------------------------------
  // FACILITIES
  // ---------------------------------------------------------------------------
  sharedBathrooms: {
    id: 'sharedBathrooms',
    type: 'scale',
    label: 'Geteilte Bäder',
    formSection: 'facilities',
    formOrder: 1,
    min: 0,
    max: 5,
    default: 1,
    lowLabel: '',
    highLabel: '',
    category: 'facilities',
  },

  privateBathrooms: {
    id: 'privateBathrooms',
    type: 'scale',
    label: 'Private Bäder',
    description: 'Für Klient*innen, die geteiltes Bad nicht können',
    formSection: 'facilities',
    formOrder: 2,
    min: 0,
    max: 5,
    default: 0,
    lowLabel: '',
    highLabel: '',
    category: 'facilities',
  },

  sharedKitchen: {
    id: 'sharedKitchen',
    type: 'boolean',
    label: 'Geteilte Küche',
    formSection: 'facilities',
    formOrder: 3,
    default: true,
    trueLabel: 'Vorhanden',
    falseLabel: 'Nicht vorhanden',
    category: 'facilities',
  },

  privateKitchen: {
    id: 'privateKitchen',
    type: 'boolean',
    label: 'Private Küche',
    description: 'Für Klient*innen mit speziellen Ernährungsbedürfnissen',
    formSection: 'facilities',
    formOrder: 4,
    default: false,
    trueLabel: 'Vorhanden',
    falseLabel: 'Nicht vorhanden',
    category: 'facilities',
  },

  // ---------------------------------------------------------------------------
  // ACCESSIBILITY
  // ---------------------------------------------------------------------------
  groundFloor: {
    id: 'groundFloor',
    type: 'boolean',
    label: 'Erdgeschoss',
    description: 'Für Klient*innen, die keine Treppen steigen können',
    formSection: 'accessibility',
    formOrder: 1,
    default: false,
    category: 'accessibility',
  },

  elevator: {
    id: 'elevator',
    type: 'boolean',
    label: 'Lift vorhanden',
    formSection: 'accessibility',
    formOrder: 2,
    default: false,
    category: 'accessibility',
  },

  wheelchairAccess: {
    id: 'wheelchairAccess',
    type: 'boolean',
    label: 'Rollstuhlgerecht',
    description: 'Volle Barrierefreiheit',
    formSection: 'accessibility',
    formOrder: 3,
    default: false,
    category: 'accessibility',
  },

  // ---------------------------------------------------------------------------
  // RULES
  // ---------------------------------------------------------------------------
  smokingAllowed: {
    id: 'smokingAllowed',
    type: 'boolean',
    label: 'Rauchen erlaubt',
    formSection: 'rules',
    formOrder: 1,
    default: false,
    category: 'rules',
  },

  petsAllowed: {
    id: 'petsAllowed',
    type: 'boolean',
    label: 'Haustiere erlaubt',
    formSection: 'rules',
    formOrder: 2,
    default: false,
    category: 'rules',
  },

  quietHours: {
    id: 'quietHours',
    type: 'text',
    label: 'Ruhezeiten',
    placeholder: 'z.B. 22:00-07:00',
    formSection: 'rules',
    formOrder: 3,
    category: 'rules',
  },

  // ---------------------------------------------------------------------------
  // LOCATION
  // ---------------------------------------------------------------------------
  nearPublicTransport: {
    id: 'nearPublicTransport',
    type: 'boolean',
    label: 'ÖV in der Nähe',
    formSection: 'location',
    formOrder: 1,
    default: true,
    category: 'location',
  },

  nearHealthServices: {
    id: 'nearHealthServices',
    type: 'boolean',
    label: 'Gesundheitsdienste in der Nähe',
    description: 'Wichtig für Klient*innen mit Unterstützungsbedarf',
    formSection: 'location',
    formOrder: 2,
    default: false,
    category: 'location',
  },

  nearSchools: {
    id: 'nearSchools',
    type: 'boolean',
    label: 'Schulen in der Nähe',
    description: 'Wichtig für Familien mit Kindern',
    formSection: 'location',
    formOrder: 3,
    default: false,
    category: 'location',
  },

  // ---------------------------------------------------------------------------
  // NOTES
  // ---------------------------------------------------------------------------
  notes: {
    id: 'notes',
    type: 'text',
    label: 'Notizen',
    placeholder: 'Zusätzliche Informationen zur Unterkunft...',
    formSection: 'notes',
    formOrder: 1,
    category: 'capacity',
  },
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Get factors for a specific form section */
export function getHousingFactorsBySection(sectionId: string): HousingFactorDef[] {
  return Object.values(HOUSING_FACTORS)
    .filter((f) => f.formSection === sectionId)
    .sort((a, b) => a.formOrder - b.formOrder)
}

/** Get factors for a specific category */
export function getHousingFactorsByCategory(category: string): HousingFactorDef[] {
  return Object.values(HOUSING_FACTORS).filter((f) => f.category === category)
}
