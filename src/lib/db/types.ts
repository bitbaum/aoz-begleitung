/**
 * Derived types + runtime enum objects — the drop-in replacement for what
 * `@prisma/client` used to export.
 *
 * Prisma generated, for every enum, BOTH a type and a same-named runtime
 * object (`StaffRole.ADMIN`). Call sites use the values, so the objects are
 * reproduced here, derived from the pgEnum declarations in schema.ts — one
 * source of truth, two views of it.
 */
import type * as s from './schema'

// ---------------------------------------------------------------------------
// Row types (SELECT shape — what Prisma's model types were)
// ---------------------------------------------------------------------------
export type AlgorithmWeight = typeof s.algorithmWeight.$inferSelect
export type PlacementSpot = typeof s.placementSpot.$inferSelect
export type Placement = typeof s.placement.$inferSelect
export type CompatibilityAssessment = typeof s.compatibilityAssessment.$inferSelect
export type IncidentFollowUp = typeof s.incidentFollowUp.$inferSelect
export type IncidentInvolvement = typeof s.incidentInvolvement.$inferSelect
export type AuditLog = typeof s.auditLog.$inferSelect
export type MaintenanceRequest = typeof s.maintenanceRequest.$inferSelect
export type TaskAttentionFlag = typeof s.taskAttentionFlag.$inferSelect
export type HousingUnit = typeof s.housingUnit.$inferSelect
export type HouseholdTask = typeof s.householdTask.$inferSelect
export type SatisfactionCheckIn = typeof s.satisfactionCheckIn.$inferSelect
export type User = typeof s.user.$inferSelect
export type ClientGroup = typeof s.clientGroup.$inferSelect
export type StaffUnit = typeof s.staffUnit.$inferSelect
export type TaskRequest = typeof s.taskRequest.$inferSelect
export type TransferRequest = typeof s.transferRequest.$inferSelect
export type Resident = typeof s.resident.$inferSelect
export type Activity = typeof s.activity.$inferSelect
export type SystemConfig = typeof s.systemConfig.$inferSelect
export type Incident = typeof s.incident.$inferSelect
export type HouseRule = typeof s.houseRule.$inferSelect
export type Proposal = typeof s.proposal.$inferSelect
export type RuleAcknowledgement = typeof s.ruleAcknowledgement.$inferSelect
export type Vote = typeof s.vote.$inferSelect
export type ConflictAgreement = typeof s.conflictAgreement.$inferSelect
export type AgreementParty = typeof s.agreementParty.$inferSelect
export type ResidentPhoto = typeof s.residentPhoto.$inferSelect
export type Expense = typeof s.expense.$inferSelect
export type ExpenseShare = typeof s.expenseShare.$inferSelect
export type Settlement = typeof s.settlement.$inferSelect
export type Account = typeof s.account.$inferSelect
export type AuthToken = typeof s.authToken.$inferSelect
export type TaskCompletion = typeof s.taskCompletion.$inferSelect
export type LearningRecord = typeof s.learningRecord.$inferSelect
export type MessageThread = typeof s.messageThread.$inferSelect
export type Message = typeof s.message.$inferSelect
export type CareAssignment = typeof s.careAssignment.$inferSelect
export type CareAttribute = typeof s.careAttribute.$inferSelect
export type HouseEvent = typeof s.houseEvent.$inferSelect
export type Appointment = typeof s.appointment.$inferSelect
export type EventRsvp = typeof s.eventRsvp.$inferSelect
export type Opportunity = typeof s.opportunity.$inferSelect
export type OpportunityApplication = typeof s.opportunityApplication.$inferSelect
export type MarketplacePost = typeof s.marketplacePost.$inferSelect
export type Complaint = typeof s.complaint.$inferSelect
export type ResidentDocument = typeof s.residentDocument.$inferSelect
export type ResidentDocumentBlob = typeof s.residentDocumentBlob.$inferSelect

// ---------------------------------------------------------------------------
// Insert shapes (what Prisma's ...CreateInput approximated)
// ---------------------------------------------------------------------------
export type NewAlgorithmWeight = typeof s.algorithmWeight.$inferInsert
export type NewPlacementSpot = typeof s.placementSpot.$inferInsert
export type NewPlacement = typeof s.placement.$inferInsert
export type NewCompatibilityAssessment = typeof s.compatibilityAssessment.$inferInsert
export type NewIncidentFollowUp = typeof s.incidentFollowUp.$inferInsert
export type NewIncidentInvolvement = typeof s.incidentInvolvement.$inferInsert
export type NewAuditLog = typeof s.auditLog.$inferInsert
export type NewMaintenanceRequest = typeof s.maintenanceRequest.$inferInsert
export type NewTaskAttentionFlag = typeof s.taskAttentionFlag.$inferInsert
export type NewHousingUnit = typeof s.housingUnit.$inferInsert
export type NewHouseholdTask = typeof s.householdTask.$inferInsert
export type NewSatisfactionCheckIn = typeof s.satisfactionCheckIn.$inferInsert
export type NewUser = typeof s.user.$inferInsert
export type NewStaffUnit = typeof s.staffUnit.$inferInsert
export type NewTaskRequest = typeof s.taskRequest.$inferInsert
export type NewTransferRequest = typeof s.transferRequest.$inferInsert
export type NewResident = typeof s.resident.$inferInsert
export type NewActivity = typeof s.activity.$inferInsert
export type NewSystemConfig = typeof s.systemConfig.$inferInsert
export type NewIncident = typeof s.incident.$inferInsert
export type NewHouseRule = typeof s.houseRule.$inferInsert
export type NewProposal = typeof s.proposal.$inferInsert
export type NewRuleAcknowledgement = typeof s.ruleAcknowledgement.$inferInsert
export type NewVote = typeof s.vote.$inferInsert
export type NewConflictAgreement = typeof s.conflictAgreement.$inferInsert
export type NewAgreementParty = typeof s.agreementParty.$inferInsert
export type NewResidentPhoto = typeof s.residentPhoto.$inferInsert
export type NewExpense = typeof s.expense.$inferInsert
export type NewExpenseShare = typeof s.expenseShare.$inferInsert
export type NewSettlement = typeof s.settlement.$inferInsert
export type NewAccount = typeof s.account.$inferInsert
export type NewAuthToken = typeof s.authToken.$inferInsert
export type NewTaskCompletion = typeof s.taskCompletion.$inferInsert
export type NewLearningRecord = typeof s.learningRecord.$inferInsert
export type NewMessageThread = typeof s.messageThread.$inferInsert
export type NewMessage = typeof s.message.$inferInsert
export type NewCareAssignment = typeof s.careAssignment.$inferInsert
export type NewCareAttribute = typeof s.careAttribute.$inferInsert
export type NewHouseEvent = typeof s.houseEvent.$inferInsert
export type NewAppointment = typeof s.appointment.$inferInsert
export type NewEventRsvp = typeof s.eventRsvp.$inferInsert
export type NewOpportunity = typeof s.opportunity.$inferInsert
export type NewOpportunityApplication = typeof s.opportunityApplication.$inferInsert
export type NewMarketplacePost = typeof s.marketplacePost.$inferInsert
export type NewComplaint = typeof s.complaint.$inferInsert
export type NewResidentDocument = typeof s.residentDocument.$inferInsert
export type NewResidentDocumentBlob = typeof s.residentDocumentBlob.$inferInsert

// ---------------------------------------------------------------------------
// Enums: value objects + union types, Prisma-style
// ---------------------------------------------------------------------------
export const ActivityCategory = Object.freeze({
  SPORT: 'SPORT',
  LANGUAGE: 'LANGUAGE',
  CULTURE: 'CULTURE',
  COMMUNITY: 'COMMUNITY',
  FAMILY: 'FAMILY',
  SUPPORT: 'SUPPORT',
} as const) satisfies Record<string, (typeof s.activityCategory.enumValues)[number]>
export type ActivityCategory = (typeof ActivityCategory)[keyof typeof ActivityCategory]

export const ActivityCost = Object.freeze({
  FREE: 'FREE',
  REDUCED: 'REDUCED',
  PAID: 'PAID',
} as const) satisfies Record<string, (typeof s.activityCost.enumValues)[number]>
export type ActivityCost = (typeof ActivityCost)[keyof typeof ActivityCost]

export const ActivityStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const) satisfies Record<string, (typeof s.activityStatus.enumValues)[number]>
export type ActivityStatus = (typeof ActivityStatus)[keyof typeof ActivityStatus]

export const AgeRange = Object.freeze({
  YOUNG_ADULT: 'YOUNG_ADULT',
  ADULT: 'ADULT',
  MIDDLE_AGED: 'MIDDLE_AGED',
  SENIOR: 'SENIOR',
} as const) satisfies Record<string, (typeof s.ageRange.enumValues)[number]>
export type AgeRange = (typeof AgeRange)[keyof typeof AgeRange]

export const AgreementStatus = Object.freeze({
  PROPOSED: 'PROPOSED',
  ACCEPTED: 'ACCEPTED',
  HELD: 'HELD',
  BROKEN: 'BROKEN',
  EXPIRED: 'EXPIRED',
} as const) satisfies Record<string, (typeof s.agreementStatus.enumValues)[number]>
export type AgreementStatus = (typeof AgreementStatus)[keyof typeof AgreementStatus]

export const ApplicationStage = Object.freeze({
  INTERESTED: 'INTERESTED',
  APPLIED: 'APPLIED',
  INTERVIEW: 'INTERVIEW',
  ACCEPTED: 'ACCEPTED',
  STARTED: 'STARTED',
  ENDED: 'ENDED',
  DECLINED: 'DECLINED',
} as const) satisfies Record<string, (typeof s.applicationStage.enumValues)[number]>
export type ApplicationStage = (typeof ApplicationStage)[keyof typeof ApplicationStage]

export const AppointmentStatus = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
  REQUESTED: 'REQUESTED',
} as const) satisfies Record<string, (typeof s.appointmentStatus.enumValues)[number]>
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus]

export const AuthTokenPurpose = Object.freeze({
  VERIFY_EMAIL: 'VERIFY_EMAIL',
  RESET_PASSWORD: 'RESET_PASSWORD',
} as const) satisfies Record<string, (typeof s.authTokenPurpose.enumValues)[number]>
export type AuthTokenPurpose = (typeof AuthTokenPurpose)[keyof typeof AuthTokenPurpose]

export const CareRole = Object.freeze({
  HOUSING: 'HOUSING',
  SOCIAL: 'SOCIAL',
  JOB: 'JOB',
  VOLUNTEERING: 'VOLUNTEERING',
} as const) satisfies Record<string, (typeof s.careRole.enumValues)[number]>
export type CareRole = (typeof CareRole)[keyof typeof CareRole]

export const CheckInType = Object.freeze({
  INITIAL: 'INITIAL',
  REGULAR: 'REGULAR',
  AD_HOC: 'AD_HOC',
  EXIT: 'EXIT',
} as const) satisfies Record<string, (typeof s.checkInType.enumValues)[number]>
export type CheckInType = (typeof CheckInType)[keyof typeof CheckInType]

export const ComplaintStatus = Object.freeze({
  OPEN: 'OPEN',
  IN_REVIEW: 'IN_REVIEW',
  ANSWERED: 'ANSWERED',
} as const) satisfies Record<string, (typeof s.complaintStatus.enumValues)[number]>
export type ComplaintStatus = (typeof ComplaintStatus)[keyof typeof ComplaintStatus]

export const ComplaintSubject = Object.freeze({
  STAFF: 'STAFF',
  ACCOMMODATION: 'ACCOMMODATION',
  DECISION: 'DECISION',
  OTHER: 'OTHER',
} as const) satisfies Record<string, (typeof s.complaintSubject.enumValues)[number]>
export type ComplaintSubject = (typeof ComplaintSubject)[keyof typeof ComplaintSubject]

export const ConflictStyle = Object.freeze({
  AVOIDANT: 'AVOIDANT',
  COOPERATIVE: 'COOPERATIVE',
  DIRECT: 'DIRECT',
} as const) satisfies Record<string, (typeof s.conflictStyle.enumValues)[number]>
export type ConflictStyle = (typeof ConflictStyle)[keyof typeof ConflictStyle]

export const DecisionMode = Object.freeze({
  RESIDENT_BINDING: 'RESIDENT_BINDING',
  RESIDENT_ADVISORY: 'RESIDENT_ADVISORY',
  STAFF_ONLY: 'STAFF_ONLY',
} as const) satisfies Record<string, (typeof s.decisionMode.enumValues)[number]>
export type DecisionMode = (typeof DecisionMode)[keyof typeof DecisionMode]

export const EndReason = Object.freeze({
  NATURAL: 'NATURAL',
  CONFLICT: 'CONFLICT',
  REQUEST: 'REQUEST',
  CAPACITY: 'CAPACITY',
  UPGRADE: 'UPGRADE',
  OTHER: 'OTHER',
} as const) satisfies Record<string, (typeof s.endReason.enumValues)[number]>
export type EndReason = (typeof EndReason)[keyof typeof EndReason]

export const EventRsvpStatus = Object.freeze({
  GOING: 'GOING',
  MAYBE: 'MAYBE',
  DECLINED: 'DECLINED',
} as const) satisfies Record<string, (typeof s.eventRsvpStatus.enumValues)[number]>
export type EventRsvpStatus = (typeof EventRsvpStatus)[keyof typeof EventRsvpStatus]

export const FamilyStatus = Object.freeze({
  SINGLE: 'SINGLE',
  COUPLE: 'COUPLE',
  FAMILY_WITH_CHILDREN: 'FAMILY_WITH_CHILDREN',
  SINGLE_PARENT: 'SINGLE_PARENT',
} as const) satisfies Record<string, (typeof s.familyStatus.enumValues)[number]>
export type FamilyStatus = (typeof FamilyStatus)[keyof typeof FamilyStatus]

export const FollowUpPriority = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const) satisfies Record<string, (typeof s.followUpPriority.enumValues)[number]>
export type FollowUpPriority = (typeof FollowUpPriority)[keyof typeof FollowUpPriority]

export const Gender = Object.freeze({
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
  PREFER_NOT_SAY: 'PREFER_NOT_SAY',
} as const) satisfies Record<string, (typeof s.gender.enumValues)[number]>
export type Gender = (typeof Gender)[keyof typeof Gender]

export const HouseEventCategory = Object.freeze({
  HOUSE_MEETING: 'HOUSE_MEETING',
  SOCIAL: 'SOCIAL',
  CULTURE: 'CULTURE',
  SUPPORT: 'SUPPORT',
} as const) satisfies Record<string, (typeof s.houseEventCategory.enumValues)[number]>
export type HouseEventCategory = (typeof HouseEventCategory)[keyof typeof HouseEventCategory]

export const HouseEventStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  CANCELLED: 'CANCELLED',
} as const) satisfies Record<string, (typeof s.houseEventStatus.enumValues)[number]>
export type HouseEventStatus = (typeof HouseEventStatus)[keyof typeof HouseEventStatus]

export const HouseholdTaskCategory = Object.freeze({
  CLEANING: 'CLEANING',
  SHOPPING: 'SHOPPING',
  MAINTENANCE: 'MAINTENANCE',
  COOKING: 'COOKING',
  TRASH: 'TRASH',
  OTHER: 'OTHER',
} as const) satisfies Record<string, (typeof s.householdTaskCategory.enumValues)[number]>
export type HouseholdTaskCategory =
  (typeof HouseholdTaskCategory)[keyof typeof HouseholdTaskCategory]

export const HouseholdTaskPriority = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const) satisfies Record<string, (typeof s.householdTaskPriority.enumValues)[number]>
export type HouseholdTaskPriority =
  (typeof HouseholdTaskPriority)[keyof typeof HouseholdTaskPriority]

export const HouseholdTaskStatus = Object.freeze({
  IDLE: 'IDLE',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
  REQUESTED: 'REQUESTED',
  IN_PROGRESS: 'IN_PROGRESS',
} as const) satisfies Record<string, (typeof s.householdTaskStatus.enumValues)[number]>
export type HouseholdTaskStatus = (typeof HouseholdTaskStatus)[keyof typeof HouseholdTaskStatus]

export const HouseholdTaskType = Object.freeze({
  ONE_TIME: 'ONE_TIME',
  RECURRING_SCHEDULED: 'RECURRING_SCHEDULED',
  RECURRING_AS_NEEDED: 'RECURRING_AS_NEEDED',
} as const) satisfies Record<string, (typeof s.householdTaskType.enumValues)[number]>
export type HouseholdTaskType = (typeof HouseholdTaskType)[keyof typeof HouseholdTaskType]

export const HousingStatus = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  FULL: 'FULL',
  MAINTENANCE: 'MAINTENANCE',
  CLOSED: 'CLOSED',
} as const) satisfies Record<string, (typeof s.housingStatus.enumValues)[number]>
export type HousingStatus = (typeof HousingStatus)[keyof typeof HousingStatus]

export const IncidentCategory = Object.freeze({
  INTERPERSONAL: 'INTERPERSONAL',
  MAINTENANCE: 'MAINTENANCE',
  SAFETY: 'SAFETY',
  WELLBEING: 'WELLBEING',
} as const) satisfies Record<string, (typeof s.incidentCategory.enumValues)[number]>
export type IncidentCategory = (typeof IncidentCategory)[keyof typeof IncidentCategory]

export const IncidentSeverity = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const) satisfies Record<string, (typeof s.incidentSeverity.enumValues)[number]>
export type IncidentSeverity = (typeof IncidentSeverity)[keyof typeof IncidentSeverity]

export const IncidentType = Object.freeze({
  NOISE_COMPLAINT: 'NOISE_COMPLAINT',
  CLEANLINESS_DISPUTE: 'CLEANLINESS_DISPUTE',
  PERSONAL_CONFLICT: 'PERSONAL_CONFLICT',
  CULTURAL_FRICTION: 'CULTURAL_FRICTION',
  SPACE_DISPUTE: 'SPACE_DISPUTE',
  SCHEDULE_CONFLICT: 'SCHEDULE_CONFLICT',
  SAFETY_CONCERN: 'SAFETY_CONCERN',
  PLUMBING: 'PLUMBING',
  ELECTRICAL: 'ELECTRICAL',
  HEATING_COOLING: 'HEATING_COOLING',
  APPLIANCE: 'APPLIANCE',
  STRUCTURAL: 'STRUCTURAL',
  PEST_CONTROL: 'PEST_CONTROL',
  SECURITY_SYSTEM: 'SECURITY_SYSTEM',
  GENERAL_MAINTENANCE: 'GENERAL_MAINTENANCE',
  LOW_SATISFACTION: 'LOW_SATISFACTION',
  OTHER: 'OTHER',
} as const) satisfies Record<string, (typeof s.incidentType.enumValues)[number]>
export type IncidentType = (typeof IncidentType)[keyof typeof IncidentType]

export const InvolvementRole = Object.freeze({
  INVOLVED: 'INVOLVED',
  WITNESS: 'WITNESS',
  MEDIATOR: 'MEDIATOR',
} as const) satisfies Record<string, (typeof s.involvementRole.enumValues)[number]>
export type InvolvementRole = (typeof InvolvementRole)[keyof typeof InvolvementRole]

export const LearningKind = Object.freeze({
  LANGUAGE_TEST: 'LANGUAGE_TEST',
  COURSE: 'COURSE',
  INFORMAL: 'INFORMAL',
  QUALIFICATION: 'QUALIFICATION',
  VOLUNTEERING: 'VOLUNTEERING',
  COMMUNITY_SERVICE: 'COMMUNITY_SERVICE',
  EMPLOYMENT: 'EMPLOYMENT',
  INTERNSHIP: 'INTERNSHIP',
} as const) satisfies Record<string, (typeof s.learningKind.enumValues)[number]>
export type LearningKind = (typeof LearningKind)[keyof typeof LearningKind]

export const LearningStatus = Object.freeze({
  PLANNED: 'PLANNED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED',
} as const) satisfies Record<string, (typeof s.learningStatus.enumValues)[number]>
export type LearningStatus = (typeof LearningStatus)[keyof typeof LearningStatus]

export const LivingSkillsSupport = Object.freeze({
  INDEPENDENT: 'INDEPENDENT',
  SOME_SUPPORT: 'SOME_SUPPORT',
  REGULAR_SUPPORT: 'REGULAR_SUPPORT',
} as const) satisfies Record<string, (typeof s.livingSkillsSupport.enumValues)[number]>
export type LivingSkillsSupport = (typeof LivingSkillsSupport)[keyof typeof LivingSkillsSupport]

export const MaintenanceCategory = Object.freeze({
  PLUMBING: 'PLUMBING',
  ELECTRICAL: 'ELECTRICAL',
  HEATING_COOLING: 'HEATING_COOLING',
  APPLIANCE: 'APPLIANCE',
  STRUCTURAL: 'STRUCTURAL',
  PEST_CONTROL: 'PEST_CONTROL',
  SECURITY: 'SECURITY',
  CLEANING: 'CLEANING',
  EXTERIOR: 'EXTERIOR',
  OTHER: 'OTHER',
} as const) satisfies Record<string, (typeof s.maintenanceCategory.enumValues)[number]>
export type MaintenanceCategory = (typeof MaintenanceCategory)[keyof typeof MaintenanceCategory]

export const MaintenancePriority = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const) satisfies Record<string, (typeof s.maintenancePriority.enumValues)[number]>
export type MaintenancePriority = (typeof MaintenancePriority)[keyof typeof MaintenancePriority]

export const MaintenanceStatus = Object.freeze({
  OPEN: 'OPEN',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const) satisfies Record<string, (typeof s.maintenanceStatus.enumValues)[number]>
export type MaintenanceStatus = (typeof MaintenanceStatus)[keyof typeof MaintenanceStatus]

export const MarketplacePostKind = Object.freeze({
  GIVE_AWAY: 'GIVE_AWAY',
  LEND: 'LEND',
  WANTED: 'WANTED',
  OFFER_HELP: 'OFFER_HELP',
  NEED_HELP: 'NEED_HELP',
} as const) satisfies Record<string, (typeof s.marketplacePostKind.enumValues)[number]>
export type MarketplacePostKind = (typeof MarketplacePostKind)[keyof typeof MarketplacePostKind]

export const MarketplacePostStatus = Object.freeze({
  OPEN: 'OPEN',
  CLAIMED: 'CLAIMED',
  CLOSED: 'CLOSED',
} as const) satisfies Record<string, (typeof s.marketplacePostStatus.enumValues)[number]>
export type MarketplacePostStatus =
  (typeof MarketplacePostStatus)[keyof typeof MarketplacePostStatus]

export const MedicalDocType = Object.freeze({
  PRIVATE_ROOM: 'PRIVATE_ROOM',
  STUDIO: 'STUDIO',
  BOTH: 'BOTH',
} as const) satisfies Record<string, (typeof s.medicalDocType.enumValues)[number]>
export type MedicalDocType = (typeof MedicalDocType)[keyof typeof MedicalDocType]

export const MobilityNeed = Object.freeze({
  NONE: 'NONE',
  GROUND_FLOOR: 'GROUND_FLOOR',
  WHEELCHAIR: 'WHEELCHAIR',
} as const) satisfies Record<string, (typeof s.mobilityNeed.enumValues)[number]>
export type MobilityNeed = (typeof MobilityNeed)[keyof typeof MobilityNeed]

export const OpportunityKind = Object.freeze({
  VOLUNTEERING: 'VOLUNTEERING',
  COMMUNITY_SERVICE: 'COMMUNITY_SERVICE',
  EMPLOYMENT: 'EMPLOYMENT',
  INTERNSHIP: 'INTERNSHIP',
} as const) satisfies Record<string, (typeof s.opportunityKind.enumValues)[number]>
export type OpportunityKind = (typeof OpportunityKind)[keyof typeof OpportunityKind]

export const OpportunityStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const) satisfies Record<string, (typeof s.opportunityStatus.enumValues)[number]>
export type OpportunityStatus = (typeof OpportunityStatus)[keyof typeof OpportunityStatus]

export const PermitRequirement = Object.freeze({
  NONE: 'NONE',
  EMPLOYER_NOTIFIES: 'EMPLOYER_NOTIFIES',
  PERMIT_REQUIRED: 'PERMIT_REQUIRED',
} as const) satisfies Record<string, (typeof s.permitRequirement.enumValues)[number]>
export type PermitRequirement = (typeof PermitRequirement)[keyof typeof PermitRequirement]

export const PlacementStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  TRANSFERRED: 'TRANSFERRED',
} as const) satisfies Record<string, (typeof s.placementStatus.enumValues)[number]>
export type PlacementStatus = (typeof PlacementStatus)[keyof typeof PlacementStatus]

export const ProfileVisibility = Object.freeze({
  PRIVATE: 'PRIVATE',
  ROOMMATES: 'ROOMMATES',
  RESIDENTS: 'RESIDENTS',
} as const) satisfies Record<string, (typeof s.profileVisibility.enumValues)[number]>
export type ProfileVisibility = (typeof ProfileVisibility)[keyof typeof ProfileVisibility]

export const ProposalStatus = Object.freeze({
  DISCUSSION: 'DISCUSSION',
  VOTING: 'VOTING',
  NEEDS_STAFF_CONFIRMATION: 'NEEDS_STAFF_CONFIRMATION',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
  VETOED: 'VETOED',
  EXPIRED: 'EXPIRED',
} as const) satisfies Record<string, (typeof s.proposalStatus.enumValues)[number]>
export type ProposalStatus = (typeof ProposalStatus)[keyof typeof ProposalStatus]

export const ProposalType = Object.freeze({
  ADD_RULE: 'ADD_RULE',
  AMEND_RULE: 'AMEND_RULE',
  REPEAL_RULE: 'REPEAL_RULE',
  HOUSE_DECISION: 'HOUSE_DECISION',
} as const) satisfies Record<string, (typeof s.proposalType.enumValues)[number]>
export type ProposalType = (typeof ProposalType)[keyof typeof ProposalType]

export const RecyclingKnowledge = Object.freeze({
  NONE: 'NONE',
  BASIC: 'BASIC',
  GOOD: 'GOOD',
} as const) satisfies Record<string, (typeof s.recyclingKnowledge.enumValues)[number]>
export type RecyclingKnowledge = (typeof RecyclingKnowledge)[keyof typeof RecyclingKnowledge]

export const ResidentOrStaff = Object.freeze({
  RESIDENT: 'RESIDENT',
  STAFF: 'STAFF',
} as const) satisfies Record<string, (typeof s.residentOrStaff.enumValues)[number]>
export type ResidentOrStaff = (typeof ResidentOrStaff)[keyof typeof ResidentOrStaff]

export const ResidentStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  PLACED: 'PLACED',
  TRANSFERRED: 'TRANSFERRED',
  EXITED: 'EXITED',
} as const) satisfies Record<string, (typeof s.residentStatus.enumValues)[number]>
export type ResidentStatus = (typeof ResidentStatus)[keyof typeof ResidentStatus]

export const ResolutionStage = Object.freeze({
  REPORTED: 'REPORTED',
  SELF_RESOLUTION: 'SELF_RESOLUTION',
  PEER_MEDIATION: 'PEER_MEDIATION',
  STAFF_MEDIATION: 'STAFF_MEDIATION',
  FORMAL_MEASURE: 'FORMAL_MEASURE',
  CLOSED: 'CLOSED',
} as const) satisfies Record<string, (typeof s.resolutionStage.enumValues)[number]>
export type ResolutionStage = (typeof ResolutionStage)[keyof typeof ResolutionStage]

export const RoomSharingStatus = Object.freeze({
  CAN_SHARE: 'CAN_SHARE',
  PREFERS_PRIVATE: 'PREFERS_PRIVATE',
  NEEDS_PRIVATE: 'NEEDS_PRIVATE',
} as const) satisfies Record<string, (typeof s.roomSharingStatus.enumValues)[number]>
export type RoomSharingStatus = (typeof RoomSharingStatus)[keyof typeof RoomSharingStatus]

export const RuleCategory = Object.freeze({
  SAFETY: 'SAFETY',
  RESPECT: 'RESPECT',
  NOISE: 'NOISE',
  CLEANLINESS: 'CLEANLINESS',
  KITCHEN: 'KITCHEN',
  BATHROOM: 'BATHROOM',
  GUESTS: 'GUESTS',
  SHARED_SPACES: 'SHARED_SPACES',
  COSTS: 'COSTS',
  COMMUNICATION: 'COMMUNICATION',
  OTHER: 'OTHER',
} as const) satisfies Record<string, (typeof s.ruleCategory.enumValues)[number]>
export type RuleCategory = (typeof RuleCategory)[keyof typeof RuleCategory]

export const RuleDelegation = Object.freeze({
  FIXED: 'FIXED',
  UNIT_MAY_STRENGTHEN: 'UNIT_MAY_STRENGTHEN',
  UNIT_DECIDES: 'UNIT_DECIDES',
} as const) satisfies Record<string, (typeof s.ruleDelegation.enumValues)[number]>
export type RuleDelegation = (typeof RuleDelegation)[keyof typeof RuleDelegation]

export const RuleScope = Object.freeze({
  ORG: 'ORG',
  UNIT: 'UNIT',
} as const) satisfies Record<string, (typeof s.ruleScope.enumValues)[number]>
export type RuleScope = (typeof RuleScope)[keyof typeof RuleScope]

export const RuleStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUPERSEDED: 'SUPERSEDED',
  ARCHIVED: 'ARCHIVED',
} as const) satisfies Record<string, (typeof s.ruleStatus.enumValues)[number]>
export type RuleStatus = (typeof RuleStatus)[keyof typeof RuleStatus]

export const SleepSchedule = Object.freeze({
  EARLY_BIRD: 'EARLY_BIRD',
  STANDARD: 'STANDARD',
  NIGHT_OWL: 'NIGHT_OWL',
  IRREGULAR: 'IRREGULAR',
} as const) satisfies Record<string, (typeof s.sleepSchedule.enumValues)[number]>
export type SleepSchedule = (typeof SleepSchedule)[keyof typeof SleepSchedule]

export const SmokingStatus = Object.freeze({
  NON_SMOKER: 'NON_SMOKER',
  OUTDOOR_SMOKER: 'OUTDOOR_SMOKER',
  INDOOR_SMOKER: 'INDOOR_SMOKER',
} as const) satisfies Record<string, (typeof s.smokingStatus.enumValues)[number]>
export type SmokingStatus = (typeof SmokingStatus)[keyof typeof SmokingStatus]

export const SocialStyle = Object.freeze({
  INTROVERTED: 'INTROVERTED',
  MODERATE: 'MODERATE',
  EXTROVERTED: 'EXTROVERTED',
} as const) satisfies Record<string, (typeof s.socialStyle.enumValues)[number]>
export type SocialStyle = (typeof SocialStyle)[keyof typeof SocialStyle]

export const SpotStatus = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  OCCUPIED: 'OCCUPIED',
  MAINTENANCE: 'MAINTENANCE',
  CLOSED: 'CLOSED',
} as const) satisfies Record<string, (typeof s.spotStatus.enumValues)[number]>
export type SpotStatus = (typeof SpotStatus)[keyof typeof SpotStatus]

export const SpotType = Object.freeze({
  BED: 'BED',
  PRIVATE_ROOM: 'PRIVATE_ROOM',
  STUDIO: 'STUDIO',
  ROOM: 'ROOM',
} as const) satisfies Record<string, (typeof s.spotType.enumValues)[number]>
export type SpotType = (typeof SpotType)[keyof typeof SpotType]

export const StaffDecision = Object.freeze({
  CONFIRMED: 'CONFIRMED',
  VETOED: 'VETOED',
} as const) satisfies Record<string, (typeof s.staffDecision.enumValues)[number]>
export type StaffDecision = (typeof StaffDecision)[keyof typeof StaffDecision]

export const StaffRole = Object.freeze({
  ADMIN: 'ADMIN',
  BETREUUNG: 'BETREUUNG',
  SOZIALARBEIT: 'SOZIALARBEIT',
  JOBCOACH: 'JOBCOACH',
  FREIWILLIGENARBEIT: 'FREIWILLIGENARBEIT',
} as const) satisfies Record<string, (typeof s.staffRole.enumValues)[number]>
export type StaffRole = (typeof StaffRole)[keyof typeof StaffRole]

export const StaffScope = Object.freeze({
  OWN_DOMAIN: 'OWN_DOMAIN',
  ALL_DOMAINS: 'ALL_DOMAINS',
} as const) satisfies Record<string, (typeof s.staffScope.enumValues)[number]>
export type StaffScope = (typeof StaffScope)[keyof typeof StaffScope]

export const SupportLevel = Object.freeze({
  STANDARD: 'STANDARD',
  ELEVATED: 'ELEVATED',
  INTENSIVE: 'INTENSIVE',
} as const) satisfies Record<string, (typeof s.supportLevel.enumValues)[number]>
export type SupportLevel = (typeof SupportLevel)[keyof typeof SupportLevel]

export const TaskRequestStatus = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  COMPLETED: 'COMPLETED',
} as const) satisfies Record<string, (typeof s.taskRequestStatus.enumValues)[number]>
export type TaskRequestStatus = (typeof TaskRequestStatus)[keyof typeof TaskRequestStatus]

export const TransferRequestStatus = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const) satisfies Record<string, (typeof s.transferRequestStatus.enumValues)[number]>
export type TransferRequestStatus =
  (typeof TransferRequestStatus)[keyof typeof TransferRequestStatus]

export const VoteChoice = Object.freeze({
  YES: 'YES',
  NO: 'NO',
  ABSTAIN: 'ABSTAIN',
  BLOCK: 'BLOCK',
} as const) satisfies Record<string, (typeof s.voteChoice.enumValues)[number]>
export type VoteChoice = (typeof VoteChoice)[keyof typeof VoteChoice]

export const VoteThreshold = Object.freeze({
  CONSENSUS: 'CONSENSUS',
  SUPERMAJORITY: 'SUPERMAJORITY',
  SIMPLE_MAJORITY: 'SIMPLE_MAJORITY',
} as const) satisfies Record<string, (typeof s.voteThreshold.enumValues)[number]>
export type VoteThreshold = (typeof VoteThreshold)[keyof typeof VoteThreshold]
export const SiteAccess = Object.freeze({
  ALL_UNITS: 'ALL_UNITS',
  ASSIGNED_UNITS: 'ASSIGNED_UNITS',
} as const) satisfies Record<string, (typeof s.siteAccess.enumValues)[number]>
export type SiteAccess = (typeof SiteAccess)[keyof typeof SiteAccess]
export const InterpreterNeed = Object.freeze({
  NONE: 'NONE',
  FOR_COMPLEX: 'FOR_COMPLEX',
  ALWAYS: 'ALWAYS',
} as const) satisfies Record<string, (typeof s.interpreterNeed.enumValues)[number]>
export type InterpreterNeed = (typeof InterpreterNeed)[keyof typeof InterpreterNeed]
