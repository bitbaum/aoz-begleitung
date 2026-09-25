/**
 * Zod validation schemas for all server action inputs
 *
 * SSOT COMPLIANCE: Enum values are DERIVED from config/labels to ensure
 * validation stays in sync with the rest of the application.
 *
 * Type assertions are used to maintain Prisma type compatibility while
 * deriving values from config.
 */

import { z } from 'zod'
import type {
  AgeRange,
  Gender,
  FamilyStatus,
  SleepSchedule,
  SocialStyle,
  ConflictStyle,
  SmokingStatus,
  MobilityNeed,
  RoomSharingStatus,
  SupportLevel,
  LivingSkillsSupport,
  InterpreterNeed,
  RecyclingKnowledge,
  MedicalDocType,
  ResidentStatus,
  HousingStatus,
  SpotType,
  SpotStatus,
  PlacementStatus,
  EndReason,
  IncidentCategory,
  IncidentType,
  IncidentSeverity,
  FollowUpPriority,
  InvolvementRole,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
  CheckInType,
} from '@/lib/db'
import { RESIDENT_FACTORS } from '@/lib/config/resident-factors'
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_TYPE_LABELS,
  INCIDENT_SEVERITY_LABELS,
  FOLLOW_UP_PRIORITY_LABELS,
  INVOLVEMENT_ROLE_LABELS,
  HOUSING_STATUS_LABELS,
  PLACEMENT_STATUS_LABELS,
  END_REASON_LABELS,
  RESIDENT_STATUS_LABELS,
  MAINTENANCE_CATEGORY_LABELS,
  MAINTENANCE_PRIORITY_LABELS,
  MAINTENANCE_STATUS_LABELS,
  CHECK_IN_TYPE_LABELS,
  COMPATIBILITY_GAP_LABELS,
} from '@/lib/constants/labels'
import {
  ACTIVITY_CATEGORY_LABELS,
  ACTIVITY_COST_LABELS,
  ACTIVITY_STATUS_LABELS,
  type ActivityCategory,
  type ActivityCost,
  type ActivityStatus,
} from '@/lib/config/activities'
import {
  SPOT_TYPE_LABELS,
  SPOT_STATUS_LABELS,
  MEDICAL_DOC_TYPE_LABELS,
} from '@/lib/config/placement-spots'
import {
  APPLICATION_STAGE_LABELS,
  OPPORTUNITY_KIND_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  PERMIT_REQUIREMENT_LABELS,
  type ApplicationStageId,
  type OpportunityKindId,
  type OpportunityStatusId,
  permitRequirementIsStated,
  type PermitRequirementId,
} from '@/lib/config/opportunities'
import { CEFR_LEVELS } from '@/lib/config/learning'

// =============================================================================
// HELPER: Derive Zod enum from config/labels with proper typing
// =============================================================================

/**
 * Creates a Zod enum schema from an object's keys, typed as the Prisma enum
 */
function enumFromKeys<T>(obj: Record<string, unknown>): z.ZodType<T> {
  const keys = Object.keys(obj) as [string, ...string[]]
  return z.enum(keys) as unknown as z.ZodType<T>
}

/**
 * Creates a Zod enum schema from a factor's options array, typed as the Prisma enum
 */
function enumFromFactor<T>(factorId: keyof typeof RESIDENT_FACTORS): z.ZodType<T> {
  const factor = RESIDENT_FACTORS[factorId]
  if (!factor || !('options' in factor)) {
    throw new Error(`Factor ${factorId} not found or has no options`)
  }
  const options = factor.options as readonly string[]
  return z.enum(options as [string, ...string[]]) as unknown as z.ZodType<T>
}

// =============================================================================
// IDENTIFIERS
// =============================================================================

/**
 * A row id issued by this database.
 *
 * ## The bug this replaces
 *
 * Every id field validated with `z.string().cuid()`, which is cuid **v1** and
 * requires a leading `c`. Prisma minted cuid v1, so it held. The move to
 * Drizzle switched id generation to `@paralleldrive/cuid2`
 * (`$defaultFn(createId)` in db/schema.ts), whose ids start with any letter —
 * and `.cuid()` rejects 96.5% of them (measured: 70 of 2000).
 *
 * So every form that submits an id stopped working for almost every row
 * created after that migration, and said so as "Etwas ist schiefgelaufen"
 * because the ValidationError never reached the screen. Measured on the live
 * database on 2026-09-04: 122 of 123 housing units, 15 of 20 residents, 11 of
 * 17 placements and every maintenance request were uneditable. The rows that
 * still worked were the Prisma-era ones.
 *
 * ## Why this is now permissive
 *
 * An id is an opaque key. Its shape proves nothing — the row either exists and
 * the viewer may touch it, or it does not, and that is settled by the lookup
 * and the permission check, both of which run anyway. A format assertion here
 * bought no safety and cost most of the database, twice over: once when the
 * generator changed, and again for anyone who changes it next.
 *
 * The bound stays only to keep an absurd payload out of a query parameter.
 */
export const idSchema = z.string().min(1).max(64)

// =============================================================================
// ENUM SCHEMAS (derived from config/labels - SSOT, typed as Prisma enums)
// =============================================================================

// Resident factors - derived from RESIDENT_FACTORS config
export const AgeRangeSchema = enumFromFactor<AgeRange>('ageRange')
export const GenderSchema = enumFromFactor<Gender>('gender')
export const FamilyStatusSchema = enumFromFactor<FamilyStatus>('familyStatus')
export const SleepScheduleSchema = enumFromFactor<SleepSchedule>('sleepSchedule')
export const SocialStyleSchema = enumFromFactor<SocialStyle>('socialStyle')
export const ConflictStyleSchema = enumFromFactor<ConflictStyle>('conflictStyle')
export const SmokingStatusSchema = enumFromFactor<SmokingStatus>('smokingStatus')
export const MobilityNeedSchema = enumFromFactor<MobilityNeed>('mobilityNeeds')
export const RoomSharingStatusSchema = enumFromFactor<RoomSharingStatus>('roomSharingStatus')
export const SupportLevelSchema = enumFromFactor<SupportLevel>('supportLevel')
export const LivingSkillsSupportSchema = enumFromFactor<LivingSkillsSupport>('livingSkillsSupport')
export const InterpreterNeedSchema = enumFromFactor<InterpreterNeed>('interpreterNeed')
export const RecyclingKnowledgeSchema = enumFromFactor<RecyclingKnowledge>('recyclingKnowledge')

// Spot/placement - derived from placement-spots config
export const SpotTypeSchema = enumFromKeys<SpotType>(SPOT_TYPE_LABELS)
export const SpotStatusSchema = enumFromKeys<SpotStatus>(SPOT_STATUS_LABELS)
export const MedicalDocTypeSchema = enumFromKeys<MedicalDocType>(MEDICAL_DOC_TYPE_LABELS)

// Status enums - derived from labels
export const HousingStatusSchema = enumFromKeys<HousingStatus>(HOUSING_STATUS_LABELS)
export const ResidentStatusSchema = enumFromKeys<ResidentStatus>(RESIDENT_STATUS_LABELS)
export const PlacementStatusSchema = enumFromKeys<PlacementStatus>(PLACEMENT_STATUS_LABELS)
export const EndReasonSchema = enumFromKeys<EndReason>(END_REASON_LABELS)

// Incident - derived from labels
export const IncidentCategorySchema = enumFromKeys<IncidentCategory>(INCIDENT_CATEGORY_LABELS)
export const IncidentTypeSchema = enumFromKeys<IncidentType>(INCIDENT_TYPE_LABELS)
export const IncidentSeveritySchema = enumFromKeys<IncidentSeverity>(INCIDENT_SEVERITY_LABELS)
export const FollowUpPrioritySchema = enumFromKeys<FollowUpPriority>(FOLLOW_UP_PRIORITY_LABELS)
export const InvolvementRoleSchema = enumFromKeys<InvolvementRole>(INVOLVEMENT_ROLE_LABELS)

// Maintenance - derived from labels
export const MaintenanceCategorySchema = enumFromKeys<MaintenanceCategory>(
  MAINTENANCE_CATEGORY_LABELS,
)
export const MaintenancePrioritySchema = enumFromKeys<MaintenancePriority>(
  MAINTENANCE_PRIORITY_LABELS,
)
export const MaintenanceStatusSchema = enumFromKeys<MaintenanceStatus>(MAINTENANCE_STATUS_LABELS)

// Check-in - derived from labels
export const CheckInTypeSchema = enumFromKeys<CheckInType>(CHECK_IN_TYPE_LABELS)

// Activities - derived from activity config
export const ActivityCategorySchema = enumFromKeys<ActivityCategory>(ACTIVITY_CATEGORY_LABELS)
export const ActivityCostSchema = enumFromKeys<ActivityCost>(ACTIVITY_COST_LABELS)
export const ActivityStatusSchema = enumFromKeys<ActivityStatus>(ACTIVITY_STATUS_LABELS)

// Compatibility gap - for conflict analysis
export const CompatibilityGapSchema = enumFromKeys<string>(COMPATIBILITY_GAP_LABELS)

// =============================================================================
// COMMON HELPERS
// =============================================================================

// Scale validation (1-5)
const scaleSchema = z.coerce.number().int().min(1).max(5)

// =============================================================================
// RESIDENT SCHEMAS
// =============================================================================

export const ResidentInputSchema = z.object({
  /**
   * Optional, and generated when left blank.
   *
   * It used to be required, with the placeholder "z.B. R-2024-001" — a pattern
   * that matches NO prefix login accepts. Login resolves a resident by exact
   * string against `ALL_RESIDENT_CODE_PREFIXES` (`RES-`, `KL-`), so a code
   * typed to that example produced a client who could never sign in, and
   * nothing in the form said so. Meanwhile `generateResidentCode()` existed and
   * was used by the household flow — the intake form was the one path that
   * asked a human to invent the credential instead.
   *
   * Kept accepting an explicit code, because a real code already printed on
   * paper has to be enterable. Blank now means "mint one", which is the case
   * that should have been the default all along.
   */
  code: z.string().max(50).optional(),
  ageRange: AgeRangeSchema,
  gender: GenderSchema,
  familyStatus: FamilyStatusSchema,
  sleepSchedule: SleepScheduleSchema,
  noiseTolerance: scaleSchema.default(3),
  cleanlinessPractice: scaleSchema.default(3),
  cleanlinessExpectation: scaleSchema.default(3),
  chaosTolerance: scaleSchema.default(3),
  // guestTolerance and conflictStyle were missing here while the form
  // collected them, the database stored them and the matching algorithm
  // weighted them — so zod stripped every answer and every resident was saved
  // with the column default. The damage was invisible because "nobody
  // answered" and "answered 3 / COOPERATIVE" look identical in the data, and
  // it disabled the avoidant-vs-direct conflict check entirely: that clash
  // cannot occur if everyone is COOPERATIVE.
  guestTolerance: scaleSchema.default(3),
  socialStyle: SocialStyleSchema,
  conflictStyle: ConflictStyleSchema.default('COOPERATIVE' as ConflictStyle),
  languages: z.array(z.string()).default([]),
  smokingStatus: SmokingStatusSchema,
  dietaryNeeds: z.array(z.string()).default([]),
  mobilityNeeds: MobilityNeedSchema,
  medicalEquipment: z.coerce.boolean().default(false),
  petTolerance: z.coerce.boolean().default(true),
  sharedBathroom: z.coerce.boolean().default(true),
  sharedKitchen: z.coerce.boolean().default(true),
  privacyNeed: scaleSchema.default(3),
  choresContribution: scaleSchema.default(3),
  recyclingKnowledge: RecyclingKnowledgeSchema.default('NONE' as RecyclingKnowledge),
  roomSharingStatus: RoomSharingStatusSchema.default('CAN_SHARE' as RoomSharingStatus),
  hasNightDisturbances: z.coerce.boolean().default(false),
  needsQuietEnvironment: z.coerce.boolean().default(false),
  hasSleepEquipment: z.coerce.boolean().default(false),
  supportLevel: SupportLevelSchema.default('STANDARD' as SupportLevel),
  livingSkillsSupport: LivingSkillsSupportSchema.default('INDEPENDENT' as LivingSkillsSupport),
  interpreterNeed: InterpreterNeedSchema.default('NONE' as InterpreterNeed),
  hasMedicalDocumentation: z.coerce.boolean().default(false),
  medicalDocType: MedicalDocTypeSchema.optional().nullable(),
  medicalDocDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(new Date(val).getTime()), { message: 'Ungültiges Datum' })
    .transform((val) => (val ? new Date(val) : null)),
  medicalDocNotes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const ResidentUpdateSchema = ResidentInputSchema.extend({
  id: idSchema,
  // code is disabled (read-only) in edit form, so it's not included in FormData
  code: z.string().optional(),
})

// =============================================================================
// HOUSING SCHEMAS
// =============================================================================

export const HousingUnitInputSchema = z.object({
  code: z.string().min(1, 'Code ist erforderlich').max(50),
  address: z.string().min(1, 'Adresse ist erforderlich'),
  totalBeds: z.coerce.number().int().min(1),
  totalRooms: z.coerce.number().int().min(1),
  sharedRooms: z.coerce.number().int().min(0),
  privateRooms: z.coerce.number().int().min(0),
  sharedBathrooms: z.coerce.number().int().min(0),
  privateBathrooms: z.coerce.number().int().min(0),
  sharedKitchen: z.coerce.boolean().default(true),
  privateKitchen: z.coerce.boolean().default(false),
  groundFloor: z.coerce.boolean().default(false),
  wheelchairAccess: z.coerce.boolean().default(false),
  elevator: z.coerce.boolean().default(false),
  smokingAllowed: z.coerce.boolean().default(false),
  petsAllowed: z.coerce.boolean().default(false),
  quietHours: z.string().optional().nullable(),
  nearPublicTransport: z.coerce.boolean().default(true),
  nearHealthServices: z.coerce.boolean().default(false),
  nearSchools: z.coerce.boolean().default(false),
  buildingCode: z.string().max(40).optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const HousingUnitUpdateSchema = HousingUnitInputSchema.extend({
  id: idSchema,
  status: HousingStatusSchema.optional(),
})

// =============================================================================
// SPOT SCHEMAS
// =============================================================================

export const SpotInputSchema = z.object({
  housingUnitId: idSchema,
  code: z.string().min(1, 'Code ist erforderlich'),
  label: z.string().optional().nullable(),
  type: SpotTypeSchema,
  parentSpotId: idSchema.optional().nullable(),
  squareMeters: z.coerce.number().positive().optional().nullable(),
  floor: z.coerce.number().int().optional().nullable(),
  requiresMedicalDocs: z.coerce.boolean().default(false),
  status: SpotStatusSchema.default('AVAILABLE' as SpotStatus),
  notes: z.string().optional().nullable(),
})

export const SpotUpdateSchema = SpotInputSchema.partial().extend({
  id: idSchema,
  housingUnitId: idSchema,
})

export const MultipleSpotInputSchema = z.object({
  housingUnitId: idSchema,
  roomCode: z.string().min(1, 'Zimmer-Code ist erforderlich'),
  roomLabel: z.string().optional().nullable(),
  bedCount: z.coerce.number().int().min(1).max(8).default(2),
  squareMeters: z.coerce.number().positive().optional().nullable(),
  floor: z.coerce.number().int().optional().nullable(),
})

// =============================================================================
// PLACEMENT SCHEMAS
// =============================================================================

export const PlacementInputSchema = z.object({
  residentId: idSchema,
  housingUnitId: idSchema,
  spotId: idSchema.optional(),
  compatibilityScore: z.coerce.number().min(0).max(100).optional(),
  lifestyleScore: z.coerce.number().min(0).max(100).optional(),
  socialScore: z.coerce.number().min(0).max(100).optional(),
  practicalScore: z.coerce.number().min(0).max(100).optional(),
  riskScore: z.coerce.number().min(0).max(100).optional(),
  placementNotes: z.string().optional().nullable(),
})

export const EndPlacementSchema = z.object({
  placementId: idSchema,
  residentId: idSchema,
  endReason: EndReasonSchema,
  notes: z.string().optional().nullable(),
  // Conflict analysis fields (required when endReason is CONFLICT)
  conflictGap: CompatibilityGapSchema.optional().nullable(),
  wasPredictable: z.coerce.boolean().optional().nullable(),
  relatedIncidentId: idSchema.optional().nullable(),
})

export const TransferPlacementSchema = z.object({
  currentPlacementId: idSchema,
  residentId: idSchema,
  targetHousingUnitId: idSchema,
  targetSpotId: idSchema,
  transferReason: EndReasonSchema,
  notes: z.string().optional().nullable(),
})

// =============================================================================
// INCIDENT SCHEMAS
// =============================================================================

export const IncidentInputSchema = z.object({
  housingUnitId: idSchema,
  reportedById: idSchema.optional().nullable(),
  subjectId: idSchema.optional().nullable(),
  category: IncidentCategorySchema,
  type: IncidentTypeSchema,
  severity: IncidentSeveritySchema,
  description: z.string().min(1, 'Beschreibung ist erforderlich'),
  date: z
    .string()
    .refine((val) => !isNaN(new Date(val).getTime()), { message: 'Ungültiges Datum' })
    .transform((val) => new Date(val)),
  mediationMinutes: z.coerce.number().int().min(0).optional().nullable(),
})

export const ResolveIncidentSchema = z.object({
  incidentId: idSchema,
  resolution: z.string().optional().default('Gelöst durch Administrator'),
})

export const UpdateMediationTimeSchema = z.object({
  incidentId: idSchema,
  mediationMinutes: z.coerce.number().int().min(0).max(9999),
})

export const FollowUpInputSchema = z.object({
  incidentId: idSchema,
  action: z.string().min(1, 'Aktion ist erforderlich'),
  notes: z.string().optional().nullable(),
  outcome: z.string().optional().nullable(),
  staffName: z.string().optional().nullable(),
  scheduledNextDate: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || !isNaN(new Date(val).getTime()), { message: 'Ungültiges Datum' })
    .transform((val) => (val ? new Date(val) : null)),
  followUpPriority: FollowUpPrioritySchema.optional().nullable(),
})

// =============================================================================
// MAINTENANCE SCHEMAS
// =============================================================================

export const MaintenanceRequestInputSchema = z.object({
  housingUnitId: idSchema,
  spotId: idSchema.optional().nullable(),
  category: MaintenanceCategorySchema,
  priority: MaintenancePrioritySchema.default('NORMAL' as MaintenancePriority),
  title: z.string().min(1, 'Titel ist erforderlich'),
  description: z.string().min(1, 'Beschreibung ist erforderlich'),
  location: z.string().optional().nullable(),
  reportedById: idSchema.optional().nullable(),
  reporterName: z.string().optional().nullable(),
})

export const MaintenanceStatusUpdateSchema = z.object({
  requestId: idSchema,
  status: MaintenanceStatusSchema,
  assignedTo: z.string().optional().nullable(),
  resolution: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  cost: z.coerce.number().positive().optional().nullable(),
})

export const AssignMaintenanceSchema = z.object({
  requestId: idSchema,
  assignedTo: z.string().min(1, 'Zuweisungsname ist erforderlich'),
})

// =============================================================================
// ACTIVITY SCHEMAS
// =============================================================================

const optionalDateSchema = z
  .string()
  .optional()
  .nullable()
  .refine((val) => !val || !isNaN(new Date(val).getTime()), { message: 'Ungültiges Datum' })
  .transform((val) => (val ? new Date(val) : null))

export const ActivityInputSchema = z.object({
  title: z.string().min(1, 'Titel ist erforderlich').max(160),
  description: z.string().min(1, 'Beschreibung ist erforderlich').max(2000),
  category: ActivityCategorySchema,
  cost: ActivityCostSchema.default('FREE' as ActivityCost),
  costNote: z.string().max(300).optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  website: z.string().url('Bitte eine gültige URL angeben').max(500).optional().nullable(),
  phone: z.string().max(80).optional().nullable(),
  schedule: z.string().max(300).optional().nullable(),
  startsAt: optionalDateSchema,
  endsAt: optionalDateSchema,
  status: ActivityStatusSchema.default('DRAFT' as ActivityStatus),
  highlight: z.coerce.boolean().default(false),
})

export const ActivityUpdateSchema = ActivityInputSchema.extend({
  id: idSchema,
})

// =============================================================================
// OPPORTUNITY SCHEMAS
// =============================================================================

export const OpportunityKindSchema = enumFromKeys<OpportunityKindId>(OPPORTUNITY_KIND_LABELS)
export const OpportunityStatusSchema = enumFromKeys<OpportunityStatusId>(OPPORTUNITY_STATUS_LABELS)
export const PermitRequirementSchema = enumFromKeys<PermitRequirementId>(PERMIT_REQUIREMENT_LABELS)
export const ApplicationStageSchema = enumFromKeys<ApplicationStageId>(APPLICATION_STAGE_LABELS)

// An empty select must mean "no level required", not a validation error. The
// browser submits '' for an unselected option, and z.enum would reject it.
const optionalCefrSchema = z
  .string()
  .optional()
  .nullable()
  .transform((value) => (value ? value : null))
  .refine((value) => value === null || (CEFR_LEVELS as readonly string[]).includes(value), {
    message: 'Ungültiges Sprachniveau',
  })

const optionalPositiveIntSchema = z
  .string()
  .optional()
  .nullable()
  .transform((value) => (value && value.trim() !== '' ? Number(value) : null))
  .refine((value) => value === null || (Number.isInteger(value) && value > 0), {
    message: 'Bitte eine ganze Zahl grösser als 0 angeben',
  })

/**
 * The field shape, before the cross-field rule below wraps it.
 *
 * Exported because `.superRefine` returns a ZodEffects, which has no `.shape` —
 * so anything introspecting the field list (the form-parity test) needs the
 * plain object. Validate with the exported schemas, never with this.
 */
export const OpportunityFieldsSchema = z.object({
  kind: OpportunityKindSchema,
  title: z.string().min(1, 'Titel ist erforderlich').max(160),
  description: z.string().min(1, 'Beschreibung ist erforderlich').max(2000),
  organisation: z.string().min(1, 'Organisation ist erforderlich').max(200),
  location: z.string().max(300).optional().nullable(),
  schedule: z.string().max(300).optional().nullable(),
  hoursPerWeek: optionalPositiveIntSchema,
  seats: optionalPositiveIntSchema,
  germanLevel: optionalCefrSchema,
  permitRequirement: PermitRequirementSchema.default('NONE' as PermitRequirementId),
  requirementNote: z.string().max(500).optional().nullable(),
  contactName: z.string().max(200).optional().nullable(),
  contactEmail: z
    .string()
    .email('Bitte eine gültige E-Mail angeben')
    .max(200)
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  contactPhone: z.string().max(80).optional().nullable(),
  website: z
    .string()
    .url('Bitte eine gültige URL angeben')
    .max(500)
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  status: OpportunityStatusSchema.default('DRAFT' as OpportunityStatusId),
  startsAt: optionalDateSchema,
  endsAt: optionalDateSchema,
})

/**
 * A work listing may not go out claiming that no authorisation is needed.
 *
 * `permitRequirement` defaults to NONE, which a resident reads as "Keine
 * Bewilligung nötig". On unpaid volunteering that is true. On a job it is a
 * legal claim about that person's situation, and this product must never make
 * it BY DEFAULT — the people using it hold permits that constrain work, and a
 * wrong reassurance costs them, not us.
 *
 * Applied at PUBLISH rather than at save, so a coach can draft a listing while
 * they are still finding out. If they never find out, it stays a draft, which
 * is the right outcome: the unknown case belongs with Sozialarbeit before it
 * reaches a resident.
 */
function requireStatedPermitForWork(
  value: { kind: string; status: string; permitRequirement: string },
  ctx: z.RefinementCtx,
): void {
  if (value.status !== 'PUBLISHED') return
  if (permitRequirementIsStated(value.kind, value.permitRequirement)) return

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['permitRequirement'],
    message:
      'Für Arbeitsstellen und Praktika muss der Bewilligungsweg angegeben sein — ' +
      'Meldeverfahren oder Bewilligung erforderlich. Sonst als Entwurf speichern ' +
      'und mit der Sozialarbeit klären.',
  })
}

export const OpportunityInputSchema = OpportunityFieldsSchema.superRefine(
  requireStatedPermitForWork,
)

export const OpportunityUpdateSchema = OpportunityFieldsSchema.extend({
  id: idSchema,
}).superRefine(requireStatedPermitForWork)

export const ApplicationCreateSchema = z.object({
  opportunityId: idSchema,
  residentId: idSchema,
  note: z.string().max(500).optional().nullable(),
})

export const ApplicationStageChangeSchema = z.object({
  applicationId: idSchema,
  stage: ApplicationStageSchema,
  // Captured at the moment an engagement ENDS, because that is the only point
  // anyone knows the total. hoursPerWeek is a rate and must never be used here.
  hours: optionalPositiveIntSchema,
})

// =============================================================================
// SATISFACTION CHECK-IN SCHEMAS
// =============================================================================

export const SatisfactionCheckInInputSchema = z.object({
  placementId: idSchema,
  checkInType: CheckInTypeSchema,
  weekNumber: z.coerce.number().int().positive().optional().nullable(),
  overallSatisfaction: scaleSchema,
  roommateRelations: scaleSchema.optional().nullable(),
  facilitySatisfaction: scaleSchema.optional().nullable(),
  safetyFeeling: scaleSchema.optional().nullable(),
  concerns: z.string().optional().nullable(),
  improvements: z.string().optional().nullable(),
  positives: z.string().optional().nullable(),
  collectedBy: z.string().optional().nullable(),
  isAnonymous: z.coerce.boolean().default(false),
})

// =============================================================================
// PORTAL SCHEMAS (Resident self-service)
// =============================================================================

export const portalLoginSchema = z.object({
  code: z.string().min(1, 'Code ist erforderlich').max(50),
})

export const portalReportSchema = z.object({
  category: IncidentCategorySchema,
  type: IncidentTypeSchema,
  severity: IncidentSeveritySchema,
  description: z.string().min(1, 'Beschreibung ist erforderlich').max(2000),
  location: z.string().max(200).optional(),
  incidentDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(new Date(val).getTime()), { message: 'Ungültiges Datum' }),
  involvedResident: z.union([z.literal('external'), z.literal('anonymous'), idSchema]).optional(),
  requestMediation: z.coerce.boolean().default(false),
})

export const portalPreferencesSchema = z.object({
  sleepSchedule: SleepScheduleSchema,
  noiseTolerance: scaleSchema,
  cleanlinessPractice: scaleSchema,
  // Neutral by default: a resident who has not yet answered these two should
  // keep a neutral profile, not have their whole preferences form rejected.
  cleanlinessExpectation: scaleSchema.default(3),
  chaosTolerance: scaleSchema.default(3),
  socialStyle: SocialStyleSchema,
  privacyNeed: scaleSchema,
  smokingStatus: SmokingStatusSchema,
  petTolerance: z.coerce.boolean().default(false),
  sharedBathroom: z.coerce.boolean().default(false),
  sharedKitchen: z.coerce.boolean().default(false),
  languages: z.array(z.string()).default([]),
  dietaryNeeds: z.array(z.string()).default([]),
  preferredAgeRange: z.string().max(50).optional(),
  additionalPreferences: z.string().max(1000).optional(),
})

export const portalRegistrationSchema = z.object({
  ageRange: AgeRangeSchema,
  gender: GenderSchema,
  familyStatus: FamilyStatusSchema,
  languages: z.array(z.string()).default([]),
})

export const portalSatisfactionSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  concerns: z.string().max(2000).optional(),
})

// =============================================================================
// HOUSEHOLD TASK SCHEMAS (Portal chore management)
// =============================================================================

import {
  TASK_TYPE_LABELS,
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_LABELS,
} from '@/lib/config/household-tasks'
import type { HouseholdTaskType, HouseholdTaskCategory, HouseholdTaskPriority } from '@/lib/db'

export const HouseholdTaskTypeSchema = enumFromKeys<HouseholdTaskType>(TASK_TYPE_LABELS)
export const HouseholdTaskCategorySchema = enumFromKeys<HouseholdTaskCategory>(TASK_CATEGORY_LABELS)
export const HouseholdTaskPrioritySchema = enumFromKeys<HouseholdTaskPriority>(TASK_PRIORITY_LABELS)

export const portalCreateTaskSchema = z.object({
  title: z.string().min(1, 'Titel ist erforderlich').max(200),
  description: z.string().max(2000).optional(),
  instructions: z.string().max(2000).optional(),
  taskType: HouseholdTaskTypeSchema,
  category: HouseholdTaskCategorySchema,
  priority: HouseholdTaskPrioritySchema.default('NORMAL' as HouseholdTaskPriority),
  scheduleHuman: z.string().max(100).optional(),
  estimatedMinutes: z.coerce.number().int().positive().max(480).optional(),
  // The definition of done, as binary actions. Bounded so one task cannot
  // become an unreadable wall of conditions that nobody ever ticks.
  // Accepts a newline-separated textarea (the create form posts FormData) or a
  // real array (JSON callers), because the shape a transport happens to use is
  // not a second definition of what a checklist is.
  checklist: z
    .preprocess(
      (value) =>
        typeof value === 'string'
          ? value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
          : value,
      z.array(z.string().min(1).max(120)).max(20),
    )
    .optional(),
})

export const portalCompleteTaskSchema = z.object({
  notes: z.string().max(500).optional(),
  durationMinutes: z.coerce.number().int().positive().max(480).optional(),
  // Which checklist items were ticked. Validated against the task's own
  // checklist server-side, so a client cannot invent items after the fact.
  completedItems: z.array(z.string().min(1).max(120)).max(20).optional(),
})

export const portalAttentionFlagSchema = z.object({
  message: z.string().max(500).optional(),
})

export const portalTaskRequestSchema = z.object({
  requestedResidentId: idSchema.optional(),
  message: z.string().max(500).optional(),
})

export const portalTaskComplaintSchema = z.object({
  description: z.string().min(1, 'Beschreibung ist erforderlich').max(2000),
})

// =============================================================================
// VALIDATION HELPER
// =============================================================================

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; details?: Record<string, string[] | undefined> }

/**
 * Validates FormData against a Zod schema
 * Returns parsed data or throws structured error
 */
export function validateFormData<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
): z.output<T> {
  // Convert FormData to object
  const rawData: Record<string, unknown> = {}

  formData.forEach((value, key) => {
    // Handle arrays (multiple values with same key)
    if (key.endsWith('[]') || rawData[key] !== undefined) {
      const cleanKey = key.replace('[]', '')
      if (!Array.isArray(rawData[cleanKey])) {
        rawData[cleanKey] = rawData[cleanKey] ? [rawData[cleanKey]] : []
      }
      ;(rawData[cleanKey] as unknown[]).push(value)
    } else {
      rawData[key] = value === '' ? undefined : value
    }
  })

  // Coerce single values to arrays for schema fields that expect arrays.
  // FormData sends a single string when only one checkbox is checked,
  // but Zod array fields need an actual array.
  if ('shape' in schema && typeof schema.shape === 'object') {
    const shape = schema.shape as Record<string, z.ZodTypeAny>
    for (const [key, fieldSchema] of Object.entries(shape)) {
      if (rawData[key] !== undefined && !Array.isArray(rawData[key])) {
        // Unwrap ZodDefault, ZodOptional, etc. to find the inner type
        let inner: z.ZodTypeAny = fieldSchema
        while (
          inner instanceof z.ZodDefault ||
          inner instanceof z.ZodOptional ||
          inner instanceof z.ZodNullable
        ) {
          // instanceof narrows to the core `$ZodType`; the runtime value is a
          // classic schema, so restore the classic type for the next check.
          inner = inner.unwrap() as z.ZodTypeAny
        }
        if (inner instanceof z.ZodArray) {
          rawData[key] = [rawData[key]]
        }
      }
    }
  }

  const result = schema.safeParse(rawData)

  if (!result.success) {
    // zod v4 deprecated `.flatten()` and types its fieldErrors as `{}` for
    // generic schemas — group the issues by path ourselves instead.
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of result.error.issues) {
      const field = issue.path.join('.') || '_'
      ;(fieldErrors[field] ??= []).push(issue.message)
    }
    const errorMessage = Object.entries(fieldErrors)
      .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
      .join('; ')
    throw new ValidationError(errorMessage, fieldErrors)
  }

  return result.data
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public fieldErrors: Record<string, string[] | undefined>,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}
