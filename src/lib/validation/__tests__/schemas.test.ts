import {
  ResidentInputSchema,
  ResidentUpdateSchema,
  HousingUnitInputSchema,
  HousingUnitUpdateSchema,
  PlacementInputSchema,
  EndPlacementSchema,
  TransferPlacementSchema,
  IncidentInputSchema,
  ResolveIncidentSchema,
  FollowUpInputSchema,
  MaintenanceRequestInputSchema,
  SatisfactionCheckInInputSchema,
  SpotInputSchema,
  MultipleSpotInputSchema,
  portalLoginSchema,
  portalReportSchema,
  portalPreferencesSchema,
  portalRegistrationSchema,
  portalSatisfactionSchema,
  validateFormData,
  ValidationError,
} from '../schemas'

// =============================================================================
// Helpers
// =============================================================================

function makeFormData(data: Record<string, string | string[]>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      value.forEach((v) => fd.append(`${key}[]`, v))
    } else {
      fd.append(key, value)
    }
  }
  return fd
}

const VALID_CUID = 'clx1234567890abcdefghijk'

// =============================================================================
// ResidentInputSchema
// =============================================================================

describe('ResidentInputSchema', () => {
  const validInput = {
    code: 'RES-001',
    ageRange: 'ADULT',
    gender: 'MALE',
    familyStatus: 'SINGLE',
    sleepSchedule: 'STANDARD',
    noiseTolerance: 3,
    cleanlinessPractice: 3,
    socialStyle: 'MODERATE',
    languages: ['German'],
    smokingStatus: 'NON_SMOKER',
    dietaryNeeds: [],
    mobilityNeeds: 'NONE',
  }

  it('accepts valid input with defaults', () => {
    const result = ResidentInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.code).toBe('RES-001')
      expect(result.data.petTolerance).toBe(true) // default
      expect(result.data.sharedBathroom).toBe(true) // default
      expect(result.data.supportLevel).toBe('STANDARD') // default
      expect(result.data.recyclingKnowledge).toBe('NONE') // default
      expect(result.data.roomSharingStatus).toBe('CAN_SHARE') // default
    }
  })

  /**
   * The code is deliberately OPTIONAL now, and these two cases inverted with
   * that change rather than regressing.
   *
   * It was required, with the placeholder "z.B. R-2024-001" — a pattern
   * matching no prefix login accepts, so a code typed to the example created a
   * client who could never sign in and nothing said so. Blank now means
   * "generate one" (`createResident` calls `generateResidentCode()`), which is
   * the case that should have been the default: the credential is the product's
   * to mint, not a human's to invent.
   */
  it('accepts a missing code — the action generates one', () => {
    const { code, ...noCode } = validInput
    const result = ResidentInputSchema.safeParse(noCode)
    expect(result.success).toBe(true)
  })

  it('accepts an empty code, for the same reason', () => {
    const result = ResidentInputSchema.safeParse({ ...validInput, code: '' })
    expect(result.success).toBe(true)
  })

  it('still accepts an explicit code, so a paper code can be entered', () => {
    const result = ResidentInputSchema.safeParse({ ...validInput, code: 'KL-A1B2C3' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid enum values', () => {
    const result = ResidentInputSchema.safeParse({
      ...validInput,
      ageRange: 'INVALID_VALUE',
    })
    expect(result.success).toBe(false)
  })

  it('rejects scale values below 1', () => {
    const result = ResidentInputSchema.safeParse({
      ...validInput,
      noiseTolerance: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects scale values above 5', () => {
    const result = ResidentInputSchema.safeParse({
      ...validInput,
      cleanlinessPractice: 6,
    })
    expect(result.success).toBe(false)
  })

  it('coerces string numbers to numbers', () => {
    const result = ResidentInputSchema.safeParse({
      ...validInput,
      noiseTolerance: '4',
      cleanlinessPractice: '2',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.noiseTolerance).toBe(4)
      expect(result.data.cleanlinessPractice).toBe(2)
    }
  })

  it('coerces boolean values', () => {
    const result = ResidentInputSchema.safeParse({
      ...validInput,
      medicalEquipment: true,
      petTolerance: false,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.medicalEquipment).toBe(true)
      expect(result.data.petTolerance).toBe(false)
    }
  })

  it('accepts all valid age ranges', () => {
    for (const age of ['YOUNG_ADULT', 'ADULT', 'MIDDLE_AGED', 'SENIOR']) {
      const result = ResidentInputSchema.safeParse({ ...validInput, ageRange: age })
      expect(result.success).toBe(true)
    }
  })

  it('accepts all valid sleep schedules', () => {
    for (const s of ['EARLY_BIRD', 'STANDARD', 'NIGHT_OWL', 'IRREGULAR']) {
      const result = ResidentInputSchema.safeParse({ ...validInput, sleepSchedule: s })
      expect(result.success).toBe(true)
    }
  })

  it('accepts all valid smoking statuses', () => {
    for (const s of ['NON_SMOKER', 'OUTDOOR_SMOKER', 'INDOOR_SMOKER']) {
      const result = ResidentInputSchema.safeParse({ ...validInput, smokingStatus: s })
      expect(result.success).toBe(true)
    }
  })

  it('accepts optional nullable fields', () => {
    const result = ResidentInputSchema.safeParse({
      ...validInput,
      culturalRegion: null,
      notes: null,
      medicalDocType: null,
    })
    expect(result.success).toBe(true)
  })

  it('transforms medicalDocDate string to Date', () => {
    const result = ResidentInputSchema.safeParse({
      ...validInput,
      medicalDocDate: '2024-01-15',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.medicalDocDate).toBeInstanceOf(Date)
    }
  })

  it('rejects invalid medicalDocDate string', () => {
    const result = ResidentInputSchema.safeParse({
      ...validInput,
      medicalDocDate: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })
})

describe('ResidentUpdateSchema', () => {
  it('requires a cuid id field', () => {
    const result = ResidentUpdateSchema.safeParse({
      code: 'RES-001',
      ageRange: 'ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      socialStyle: 'MODERATE',
      smokingStatus: 'NON_SMOKER',
      mobilityNeeds: 'NONE',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid input with id', () => {
    const result = ResidentUpdateSchema.safeParse({
      id: VALID_CUID,
      code: 'RES-001',
      ageRange: 'ADULT',
      gender: 'MALE',
      familyStatus: 'SINGLE',
      sleepSchedule: 'STANDARD',
      socialStyle: 'MODERATE',
      smokingStatus: 'NON_SMOKER',
      mobilityNeeds: 'NONE',
    })
    expect(result.success).toBe(true)
  })
})

// =============================================================================
// HousingUnitInputSchema
// =============================================================================

describe('HousingUnitInputSchema', () => {
  const validHousing = {
    code: 'UNIT-001',
    address: 'Teststrasse 1, 8000 Zürich',
    totalBeds: 4,
    totalRooms: 2,
    sharedRooms: 1,
    privateRooms: 1,
    sharedBathrooms: 1,
    privateBathrooms: 0,
  }

  it('accepts an optional buildingCode', () => {
    const result = HousingUnitInputSchema.safeParse({ ...validHousing, buildingCode: 'HAUS-A' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.buildingCode).toBe('HAUS-A')
  })

  it('accepts valid input with defaults', () => {
    const result = HousingUnitInputSchema.safeParse(validHousing)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sharedKitchen).toBe(true) // default
      expect(result.data.smokingAllowed).toBe(false) // default
      expect(result.data.nearPublicTransport).toBe(true) // default
    }
  })

  it('rejects missing address', () => {
    const { address, ...noAddress } = validHousing
    const result = HousingUnitInputSchema.safeParse(noAddress)
    expect(result.success).toBe(false)
  })

  it('rejects zero totalBeds', () => {
    const result = HousingUnitInputSchema.safeParse({ ...validHousing, totalBeds: 0 })
    expect(result.success).toBe(false)
  })

  it('coerces string numbers', () => {
    const result = HousingUnitInputSchema.safeParse({
      ...validHousing,
      totalBeds: '6',
      totalRooms: '3',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.totalBeds).toBe(6)
      expect(result.data.totalRooms).toBe(3)
    }
  })
})

// =============================================================================
// PlacementInputSchema
// =============================================================================

describe('PlacementInputSchema', () => {
  it('accepts valid placement', () => {
    const result = PlacementInputSchema.safeParse({
      residentId: VALID_CUID,
      housingUnitId: VALID_CUID,
      compatibilityScore: 85,
    })
    expect(result.success).toBe(true)
  })

  it('rejects score above 100', () => {
    const result = PlacementInputSchema.safeParse({
      residentId: VALID_CUID,
      housingUnitId: VALID_CUID,
      compatibilityScore: 101,
    })
    expect(result.success).toBe(false)
  })

  it('rejects score below 0', () => {
    const result = PlacementInputSchema.safeParse({
      residentId: VALID_CUID,
      housingUnitId: VALID_CUID,
      compatibilityScore: -1,
    })
    expect(result.success).toBe(false)
  })

  it('accepts all score fields', () => {
    const result = PlacementInputSchema.safeParse({
      residentId: VALID_CUID,
      housingUnitId: VALID_CUID,
      compatibilityScore: 85,
      lifestyleScore: 90,
      socialScore: 80,
      practicalScore: 75,
      riskScore: 10,
    })
    expect(result.success).toBe(true)
  })
})

// =============================================================================
// EndPlacementSchema
// =============================================================================

describe('EndPlacementSchema', () => {
  it('accepts valid end placement', () => {
    const result = EndPlacementSchema.safeParse({
      placementId: VALID_CUID,
      residentId: VALID_CUID,
      endReason: 'NATURAL',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all valid end reasons', () => {
    for (const reason of ['NATURAL', 'CONFLICT', 'REQUEST', 'CAPACITY', 'UPGRADE', 'OTHER']) {
      const result = EndPlacementSchema.safeParse({
        placementId: VALID_CUID,
        residentId: VALID_CUID,
        endReason: reason,
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts conflict analysis fields', () => {
    const result = EndPlacementSchema.safeParse({
      placementId: VALID_CUID,
      residentId: VALID_CUID,
      endReason: 'CONFLICT',
      conflictGap: 'NOISE',
      wasPredictable: true,
      relatedIncidentId: VALID_CUID,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid end reason', () => {
    const result = EndPlacementSchema.safeParse({
      placementId: VALID_CUID,
      residentId: VALID_CUID,
      endReason: 'INVALID',
    })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// IncidentInputSchema
// =============================================================================

describe('IncidentInputSchema', () => {
  it('accepts valid incident', () => {
    const result = IncidentInputSchema.safeParse({
      housingUnitId: VALID_CUID,
      category: 'INTERPERSONAL',
      type: 'NOISE_COMPLAINT',
      severity: 'MEDIUM',
      description: 'Loud music at night',
      date: '2024-06-15',
    })
    expect(result.success).toBe(true)
  })

  it('transforms date string to Date object', () => {
    const result = IncidentInputSchema.safeParse({
      housingUnitId: VALID_CUID,
      category: 'INTERPERSONAL',
      type: 'NOISE_COMPLAINT',
      severity: 'LOW',
      description: 'Some noise',
      date: '2024-06-15',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.date).toBeInstanceOf(Date)
    }
  })

  it('rejects empty description', () => {
    const result = IncidentInputSchema.safeParse({
      housingUnitId: VALID_CUID,
      category: 'INTERPERSONAL',
      type: 'NOISE_COMPLAINT',
      severity: 'LOW',
      description: '',
      date: '2024-06-15',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all severity levels', () => {
    for (const severity of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) {
      const result = IncidentInputSchema.safeParse({
        housingUnitId: VALID_CUID,
        category: 'INTERPERSONAL',
        type: 'NOISE_COMPLAINT',
        severity,
        description: 'Test',
        date: '2024-06-15',
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid date string', () => {
    const result = IncidentInputSchema.safeParse({
      housingUnitId: VALID_CUID,
      category: 'INTERPERSONAL',
      type: 'NOISE_COMPLAINT',
      severity: 'LOW',
      description: 'Test',
      date: 'not-a-date',
    })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// MaintenanceRequestInputSchema
// =============================================================================

describe('MaintenanceRequestInputSchema', () => {
  it('accepts valid request with defaults', () => {
    const result = MaintenanceRequestInputSchema.safeParse({
      housingUnitId: VALID_CUID,
      category: 'PLUMBING',
      title: 'Leaky faucet',
      description: 'Kitchen faucet is leaking',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe('NORMAL') // default
    }
  })

  it('rejects missing title', () => {
    const result = MaintenanceRequestInputSchema.safeParse({
      housingUnitId: VALID_CUID,
      category: 'PLUMBING',
      title: '',
      description: 'Kitchen faucet is leaking',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all maintenance categories', () => {
    const categories = [
      'PLUMBING',
      'ELECTRICAL',
      'HEATING_COOLING',
      'APPLIANCE',
      'STRUCTURAL',
      'PEST_CONTROL',
      'SECURITY',
      'CLEANING',
      'EXTERIOR',
      'OTHER',
    ]
    for (const category of categories) {
      const result = MaintenanceRequestInputSchema.safeParse({
        housingUnitId: VALID_CUID,
        category,
        title: 'Test',
        description: 'Test description',
      })
      expect(result.success).toBe(true)
    }
  })
})

// =============================================================================
// SatisfactionCheckInInputSchema
// =============================================================================

describe('SatisfactionCheckInInputSchema', () => {
  it('accepts valid check-in', () => {
    const result = SatisfactionCheckInInputSchema.safeParse({
      placementId: VALID_CUID,
      checkInType: 'REGULAR',
      overallSatisfaction: 4,
    })
    expect(result.success).toBe(true)
  })

  it('rejects satisfaction below 1', () => {
    const result = SatisfactionCheckInInputSchema.safeParse({
      placementId: VALID_CUID,
      checkInType: 'REGULAR',
      overallSatisfaction: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects satisfaction above 5', () => {
    const result = SatisfactionCheckInInputSchema.safeParse({
      placementId: VALID_CUID,
      checkInType: 'REGULAR',
      overallSatisfaction: 6,
    })
    expect(result.success).toBe(false)
  })

  it('accepts all check-in types', () => {
    for (const type of ['INITIAL', 'REGULAR', 'AD_HOC', 'EXIT']) {
      const result = SatisfactionCheckInInputSchema.safeParse({
        placementId: VALID_CUID,
        checkInType: type,
        overallSatisfaction: 3,
      })
      expect(result.success).toBe(true)
    }
  })
})

// =============================================================================
// SpotInputSchema
// =============================================================================

describe('SpotInputSchema', () => {
  it('accepts valid spot', () => {
    const result = SpotInputSchema.safeParse({
      housingUnitId: VALID_CUID,
      code: 'BED-1A',
      type: 'BED',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBe('AVAILABLE') // default
    }
  })

  it('rejects empty code', () => {
    const result = SpotInputSchema.safeParse({
      housingUnitId: VALID_CUID,
      code: '',
      type: 'BED',
    })
    expect(result.success).toBe(false)
  })
})

describe('MultipleSpotInputSchema', () => {
  it('accepts valid room with beds', () => {
    const result = MultipleSpotInputSchema.safeParse({
      housingUnitId: VALID_CUID,
      roomCode: 'ROOM-1',
      bedCount: 3,
    })
    expect(result.success).toBe(true)
  })

  it('rejects bedCount above 8', () => {
    const result = MultipleSpotInputSchema.safeParse({
      housingUnitId: VALID_CUID,
      roomCode: 'ROOM-1',
      bedCount: 9,
    })
    expect(result.success).toBe(false)
  })

  it('rejects bedCount of 0', () => {
    const result = MultipleSpotInputSchema.safeParse({
      housingUnitId: VALID_CUID,
      roomCode: 'ROOM-1',
      bedCount: 0,
    })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// Portal schemas
// =============================================================================

describe('portalLoginSchema', () => {
  it('accepts valid code', () => {
    const result = portalLoginSchema.safeParse({ code: 'RES-001' })
    expect(result.success).toBe(true)
  })

  it('rejects empty code', () => {
    const result = portalLoginSchema.safeParse({ code: '' })
    expect(result.success).toBe(false)
  })
})

describe('portalReportSchema', () => {
  it('accepts valid report', () => {
    const result = portalReportSchema.safeParse({
      category: 'INTERPERSONAL',
      type: 'NOISE_COMPLAINT',
      severity: 'MEDIUM',
      description: 'Noise issue',
    })
    expect(result.success).toBe(true)
  })

  it('rejects description over 2000 chars', () => {
    const result = portalReportSchema.safeParse({
      category: 'INTERPERSONAL',
      type: 'NOISE_COMPLAINT',
      severity: 'MEDIUM',
      description: 'x'.repeat(2001),
    })
    expect(result.success).toBe(false)
  })
})

describe('portalPreferencesSchema', () => {
  it('accepts valid preferences', () => {
    const result = portalPreferencesSchema.safeParse({
      sleepSchedule: 'STANDARD',
      noiseTolerance: 3,
      cleanlinessPractice: 4,
      socialStyle: 'MODERATE',
      privacyNeed: 2,
      smokingStatus: 'NON_SMOKER',
    })
    expect(result.success).toBe(true)
  })
})

describe('portalRegistrationSchema', () => {
  it('accepts valid registration', () => {
    const result = portalRegistrationSchema.safeParse({
      ageRange: 'ADULT',
      gender: 'FEMALE',
      familyStatus: 'SINGLE',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.languages).toEqual([]) // default
    }
  })
})

describe('portalSatisfactionSchema', () => {
  it('accepts valid satisfaction', () => {
    const result = portalSatisfactionSchema.safeParse({ rating: 4 })
    expect(result.success).toBe(true)
  })

  it('rejects rating below 1', () => {
    const result = portalSatisfactionSchema.safeParse({ rating: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects rating above 5', () => {
    const result = portalSatisfactionSchema.safeParse({ rating: 6 })
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// validateFormData utility
// =============================================================================

describe('validateFormData', () => {
  it('parses valid FormData', () => {
    const fd = makeFormData({
      code: 'RES-001',
    })
    const result = validateFormData(portalLoginSchema, fd)
    expect(result.code).toBe('RES-001')
  })

  it('converts empty strings to undefined', () => {
    const fd = new FormData()
    fd.append('code', '')
    // portalLoginSchema requires code, so empty → undefined → fail
    expect(() => validateFormData(portalLoginSchema, fd)).toThrow(ValidationError)
  })

  it('handles array fields with [] suffix', () => {
    const fd = new FormData()
    fd.append('ageRange', 'ADULT')
    fd.append('gender', 'MALE')
    fd.append('familyStatus', 'SINGLE')
    fd.append('languages[]', 'German')
    fd.append('languages[]', 'English')

    const result = validateFormData(portalRegistrationSchema, fd)
    expect(result.languages).toEqual(['German', 'English'])
  })

  it('throws ValidationError with field-level errors', () => {
    const fd = makeFormData({
      rating: '0', // below min
    })
    try {
      validateFormData(portalSatisfactionSchema, fd)
      expect.unreachable('Should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)
      expect((err as ValidationError).fieldErrors).toBeDefined()
    }
  })
})

// =============================================================================
// ValidationError class
// =============================================================================

describe('ValidationError', () => {
  it('has correct name and fieldErrors', () => {
    const err = new ValidationError('test error', { field1: ['required'] })
    expect(err.name).toBe('ValidationError')
    expect(err.message).toBe('test error')
    expect(err.fieldErrors).toEqual({ field1: ['required'] })
  })

  it('is an instance of Error', () => {
    const err = new ValidationError('test', {})
    expect(err).toBeInstanceOf(Error)
  })
})
