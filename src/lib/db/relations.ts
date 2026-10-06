/**
 * Drizzle relations — field names mirror the old Prisma schema's relation
 * fields exactly (`photo`, `messagesWritten`, `expensesPaid`, …) so every
 * former `include:` reads the same as its `with:` replacement. Where Prisma
 * named a relation (`@relation("ExpensePayer")`) the same string is used as
 * drizzle's `relationName`, pinned on both sides.
 */
import { relations } from 'drizzle-orm/relations'
import {
  account,
  activity,
  agreementParty,
  appointment,
  auditLog,
  authToken,
  careAssignment,
  careAttribute,
  compatibilityAssessment,
  clientHealthContact,
  clientInsurance,
  clientPermit,
  complaint,
  conflictAgreement,
  eventRsvp,
  expense,
  expenseShare,
  houseEvent,
  householdTask,
  houseRule,
  housingUnit,
  incident,
  incidentFollowUp,
  incidentInvolvement,
  learningRecord,
  maintenanceRequest,
  marketplacePost,
  message,
  messageThread,
  opportunity,
  opportunityApplication,
  placement,
  placementSpot,
  proposal,
  resident,
  residentDocument,
  residentDocumentBlob,
  residentPhoto,
  ruleAcknowledgement,
  satisfactionCheckIn,
  settlement,
  staffUnit,
  taskAttentionFlag,
  taskCompletion,
  taskRequest,
  transferRequest,
  user,
  vote,
} from './schema'

export const residentRelations = relations(resident, ({ one, many }) => ({
  photo: one(residentPhoto),
  documents: many(residentDocument),
  complaints: many(complaint),
  messageThread: one(messageThread),
  messagesWritten: many(message, { relationName: 'MessageAuthor' }),
  account: one(account),
  placements: many(placement),
  assessments: many(compatibilityAssessment, { relationName: 'ResidentAssessments' }),
  comparedWith: many(compatibilityAssessment, { relationName: 'ComparedResidentAssessments' }),
  incidentsReported: many(incident, { relationName: 'IncidentReporter' }),
  incidentsAsSubject: many(incident, { relationName: 'IncidentSubject' }),
  incidentInvolvements: many(incidentInvolvement),
  maintenanceRequests: many(maintenanceRequest),
  createdTasks: many(householdTask, { relationName: 'TaskCreator' }),
  taskCompletions: many(taskCompletion),
  taskAttentionFlags: many(taskAttentionFlag),
  taskRequestsMade: many(taskRequest, { relationName: 'TaskRequestsMade' }),
  taskRequestsReceived: many(taskRequest, { relationName: 'TaskRequestsReceived' }),
  transferRequests: many(transferRequest),
  ruleAcknowledgements: many(ruleAcknowledgement),
  proposalsMade: many(proposal, { relationName: 'ProposalAuthor' }),
  votes: many(vote),
  agreementParties: many(agreementParty),
  expensesPaid: many(expense, { relationName: 'ExpensePayer' }),
  expensesCreated: many(expense, { relationName: 'ExpenseCreator' }),
  expenseShares: many(expenseShare),
  settlementsPaid: many(settlement, { relationName: 'SettlementFrom' }),
  settlementsRecvd: many(settlement, { relationName: 'SettlementTo' }),
  learningRecords: many(learningRecord),
  careAssignments: many(careAssignment),
  appointments: many(appointment),
  careAttributes: many(careAttribute),
  opportunityApplications: many(opportunityApplication),
  marketplacePostsCreated: many(marketplacePost, { relationName: 'MarketplacePostedBy' }),
  marketplacePostsClaimed: many(marketplacePost, { relationName: 'MarketplacePostClaimedBy' }),
  houseEventsCreated: many(houseEvent, { relationName: 'HouseEventCreatedByResident' }),
  eventRsvps: many(eventRsvp),
}))

export const residentPhotoRelations = relations(residentPhoto, ({ one }) => ({
  resident: one(resident, {
    fields: [residentPhoto.residentId],
    references: [resident.id],
  }),
}))

export const residentDocumentRelations = relations(residentDocument, ({ one }) => ({
  resident: one(resident, {
    fields: [residentDocument.residentId],
    references: [resident.id],
  }),
  uploadedBy: one(user, {
    fields: [residentDocument.uploadedByUserId],
    references: [user.id],
    relationName: 'DocumentUploadedBy',
  }),
  blob: one(residentDocumentBlob),
}))

export const residentDocumentBlobRelations = relations(residentDocumentBlob, ({ one }) => ({
  document: one(residentDocument, {
    fields: [residentDocumentBlob.documentId],
    references: [residentDocument.id],
  }),
}))

export const complaintRelations = relations(complaint, ({ one }) => ({
  resident: one(resident, {
    fields: [complaint.residentId],
    references: [resident.id],
  }),
  respondedBy: one(user, {
    fields: [complaint.respondedByUserId],
    references: [user.id],
    relationName: 'ComplaintRespondedBy',
  }),
}))

export const messageThreadRelations = relations(messageThread, ({ one, many }) => ({
  resident: one(resident, {
    fields: [messageThread.residentId],
    references: [resident.id],
  }),
  messages: many(message),
}))

export const messageRelations = relations(message, ({ one }) => ({
  thread: one(messageThread, {
    fields: [message.threadId],
    references: [messageThread.id],
  }),
  authorResident: one(resident, {
    fields: [message.authorResidentId],
    references: [resident.id],
    relationName: 'MessageAuthor',
  }),
  authorUser: one(user, {
    fields: [message.authorUserId],
    references: [user.id],
    relationName: 'MessageAuthor',
  }),
}))

export const housingUnitRelations = relations(housingUnit, ({ many }) => ({
  spots: many(placementSpot),
  placements: many(placement),
  incidents: many(incident),
  maintenanceRequests: many(maintenanceRequest),
  householdTasks: many(householdTask),
  transferRequests: many(transferRequest),
  marketplacePosts: many(marketplacePost),
  houseEvents: many(houseEvent),
  houseRules: many(houseRule),
  proposals: many(proposal),
  expenses: many(expense),
  settlements: many(settlement),
  staffAccess: many(staffUnit),
}))

export const expenseRelations = relations(expense, ({ one, many }) => ({
  housingUnit: one(housingUnit, {
    fields: [expense.housingUnitId],
    references: [housingUnit.id],
  }),
  paidBy: one(resident, {
    fields: [expense.paidById],
    references: [resident.id],
    relationName: 'ExpensePayer',
  }),
  createdBy: one(resident, {
    fields: [expense.createdById],
    references: [resident.id],
    relationName: 'ExpenseCreator',
  }),
  shares: many(expenseShare),
}))

export const expenseShareRelations = relations(expenseShare, ({ one }) => ({
  expense: one(expense, {
    fields: [expenseShare.expenseId],
    references: [expense.id],
  }),
  resident: one(resident, {
    fields: [expenseShare.residentId],
    references: [resident.id],
  }),
}))

export const settlementRelations = relations(settlement, ({ one }) => ({
  housingUnit: one(housingUnit, {
    fields: [settlement.housingUnitId],
    references: [housingUnit.id],
  }),
  from: one(resident, {
    fields: [settlement.fromId],
    references: [resident.id],
    relationName: 'SettlementFrom',
  }),
  to: one(resident, {
    fields: [settlement.toId],
    references: [resident.id],
    relationName: 'SettlementTo',
  }),
}))

export const placementSpotRelations = relations(placementSpot, ({ one, many }) => ({
  housingUnit: one(housingUnit, {
    fields: [placementSpot.housingUnitId],
    references: [housingUnit.id],
  }),
  parentSpot: one(placementSpot, {
    fields: [placementSpot.parentSpotId],
    references: [placementSpot.id],
    relationName: 'SpotHierarchy',
  }),
  childSpots: many(placementSpot, { relationName: 'SpotHierarchy' }),
  placements: many(placement),
  maintenanceRequests: many(maintenanceRequest),
}))

export const placementRelations = relations(placement, ({ one, many }) => ({
  resident: one(resident, {
    fields: [placement.residentId],
    references: [resident.id],
  }),
  housingUnit: one(housingUnit, {
    fields: [placement.housingUnitId],
    references: [housingUnit.id],
  }),
  spot: one(placementSpot, {
    fields: [placement.spotId],
    references: [placementSpot.id],
  }),
  relatedIncident: one(incident, {
    fields: [placement.relatedIncidentId],
    references: [incident.id],
    relationName: 'PlacementConflictIncident',
  }),
  incidents: many(incident, { relationName: 'IncidentPlacement' }),
  checkIns: many(satisfactionCheckIn),
  transferRequests: many(transferRequest, { relationName: 'TransferFromPlacement' }),
}))

export const compatibilityAssessmentRelations = relations(compatibilityAssessment, ({ one }) => ({
  resident: one(resident, {
    fields: [compatibilityAssessment.residentId],
    references: [resident.id],
    relationName: 'ResidentAssessments',
  }),
  comparedWith: one(resident, {
    fields: [compatibilityAssessment.comparedWithId],
    references: [resident.id],
    relationName: 'ComparedResidentAssessments',
  }),
}))

export const incidentRelations = relations(incident, ({ one, many }) => ({
  housingUnit: one(housingUnit, {
    fields: [incident.housingUnitId],
    references: [housingUnit.id],
  }),
  placement: one(placement, {
    fields: [incident.placementId],
    references: [placement.id],
    relationName: 'IncidentPlacement',
  }),
  reportedBy: one(resident, {
    fields: [incident.reportedById],
    references: [resident.id],
    relationName: 'IncidentReporter',
  }),
  subject: one(resident, {
    fields: [incident.subjectId],
    references: [resident.id],
    relationName: 'IncidentSubject',
  }),
  involvedResidents: many(incidentInvolvement),
  followUps: many(incidentFollowUp),
  agreements: many(conflictAgreement),
  conflictPlacements: many(placement, { relationName: 'PlacementConflictIncident' }),
}))

export const incidentFollowUpRelations = relations(incidentFollowUp, ({ one }) => ({
  incident: one(incident, {
    fields: [incidentFollowUp.incidentId],
    references: [incident.id],
  }),
}))

export const incidentInvolvementRelations = relations(incidentInvolvement, ({ one }) => ({
  incident: one(incident, {
    fields: [incidentInvolvement.incidentId],
    references: [incident.id],
  }),
  resident: one(resident, {
    fields: [incidentInvolvement.residentId],
    references: [resident.id],
  }),
}))

export const satisfactionCheckInRelations = relations(satisfactionCheckIn, ({ one }) => ({
  placement: one(placement, {
    fields: [satisfactionCheckIn.placementId],
    references: [placement.id],
  }),
  collectedByUser: one(user, {
    fields: [satisfactionCheckIn.collectedByUserId],
    references: [user.id],
    relationName: 'CheckInCollectedBy',
  }),
  appointment: one(appointment, {
    fields: [satisfactionCheckIn.appointmentId],
    references: [appointment.id],
  }),
}))

export const userRelations = relations(user, ({ one, many }) => ({
  messagesWritten: many(message, { relationName: 'MessageAuthor' }),
  auditLogs: many(auditLog),
  activitiesCreated: many(activity, { relationName: 'ActivityCreatedBy' }),
  activitiesUpdated: many(activity, { relationName: 'ActivityUpdatedBy' }),
  careAssignments: many(careAssignment),
  appointments: many(appointment),
  careAttributesUpdated: many(careAttribute),
  houseEventsCreated: many(houseEvent, { relationName: 'HouseEventCreatedByStaff' }),
  opportunitiesCreated: many(opportunity, { relationName: 'OpportunityCreatedBy' }),
  opportunitiesUpdated: many(opportunity, { relationName: 'OpportunityUpdatedBy' }),
  applicationsSupported: many(opportunityApplication, { relationName: 'ApplicationSupportedBy' }),
  checkInsCollected: many(satisfactionCheckIn, { relationName: 'CheckInCollectedBy' }),
  documentsUploaded: many(residentDocument, { relationName: 'DocumentUploadedBy' }),
  complaintsAnswered: many(complaint, { relationName: 'ComplaintRespondedBy' }),
  learningRecordsEntered: many(learningRecord, { relationName: 'LearningRecordedBy' }),
  account: one(account),
  unitAccess: many(staffUnit),
}))

export const accountRelations = relations(account, ({ one, many }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
  resident: one(resident, {
    fields: [account.residentId],
    references: [resident.id],
  }),
  authTokens: many(authToken),
}))

export const authTokenRelations = relations(authToken, ({ one }) => ({
  account: one(account, {
    fields: [authToken.accountId],
    references: [account.id],
  }),
}))

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(user, {
    fields: [auditLog.userId],
    references: [user.id],
  }),
}))

export const activityRelations = relations(activity, ({ one }) => ({
  createdBy: one(user, {
    fields: [activity.createdByUserId],
    references: [user.id],
    relationName: 'ActivityCreatedBy',
  }),
  updatedBy: one(user, {
    fields: [activity.updatedByUserId],
    references: [user.id],
    relationName: 'ActivityUpdatedBy',
  }),
}))

export const houseEventRelations = relations(houseEvent, ({ one, many }) => ({
  housingUnit: one(housingUnit, {
    fields: [houseEvent.housingUnitId],
    references: [housingUnit.id],
  }),
  createdByStaff: one(user, {
    fields: [houseEvent.createdByStaffId],
    references: [user.id],
    relationName: 'HouseEventCreatedByStaff',
  }),
  createdByResident: one(resident, {
    fields: [houseEvent.createdByResidentId],
    references: [resident.id],
    relationName: 'HouseEventCreatedByResident',
  }),
  rsvps: many(eventRsvp),
}))

export const eventRsvpRelations = relations(eventRsvp, ({ one }) => ({
  event: one(houseEvent, {
    fields: [eventRsvp.eventId],
    references: [houseEvent.id],
  }),
  resident: one(resident, {
    fields: [eventRsvp.residentId],
    references: [resident.id],
  }),
}))

export const maintenanceRequestRelations = relations(maintenanceRequest, ({ one }) => ({
  housingUnit: one(housingUnit, {
    fields: [maintenanceRequest.housingUnitId],
    references: [housingUnit.id],
  }),
  spot: one(placementSpot, {
    fields: [maintenanceRequest.spotId],
    references: [placementSpot.id],
  }),
  reportedBy: one(resident, {
    fields: [maintenanceRequest.reportedById],
    references: [resident.id],
  }),
}))

export const householdTaskRelations = relations(householdTask, ({ one, many }) => ({
  housingUnit: one(housingUnit, {
    fields: [householdTask.housingUnitId],
    references: [housingUnit.id],
  }),
  createdByResident: one(resident, {
    fields: [householdTask.createdByResidentId],
    references: [resident.id],
    relationName: 'TaskCreator',
  }),
  completions: many(taskCompletion),
  attentionFlags: many(taskAttentionFlag),
  requests: many(taskRequest),
}))

export const taskCompletionRelations = relations(taskCompletion, ({ one, many }) => ({
  task: one(householdTask, {
    fields: [taskCompletion.taskId],
    references: [householdTask.id],
  }),
  completedBy: one(resident, {
    fields: [taskCompletion.completedById],
    references: [resident.id],
  }),
  resolvedFlags: many(taskAttentionFlag, { relationName: 'FlagResolvedByCompletion' }),
  fulfilledRequests: many(taskRequest, { relationName: 'RequestFulfilledByCompletion' }),
}))

export const taskAttentionFlagRelations = relations(taskAttentionFlag, ({ one }) => ({
  task: one(householdTask, {
    fields: [taskAttentionFlag.taskId],
    references: [householdTask.id],
  }),
  flaggedBy: one(resident, {
    fields: [taskAttentionFlag.flaggedById],
    references: [resident.id],
  }),
  resolvedByCompletion: one(taskCompletion, {
    fields: [taskAttentionFlag.resolvedByCompletionId],
    references: [taskCompletion.id],
    relationName: 'FlagResolvedByCompletion',
  }),
}))

export const taskRequestRelations = relations(taskRequest, ({ one }) => ({
  task: one(householdTask, {
    fields: [taskRequest.taskId],
    references: [householdTask.id],
  }),
  requestedBy: one(resident, {
    fields: [taskRequest.requestedById],
    references: [resident.id],
    relationName: 'TaskRequestsMade',
  }),
  requestedResident: one(resident, {
    fields: [taskRequest.requestedResidentId],
    references: [resident.id],
    relationName: 'TaskRequestsReceived',
  }),
  completion: one(taskCompletion, {
    fields: [taskRequest.completionId],
    references: [taskCompletion.id],
    relationName: 'RequestFulfilledByCompletion',
  }),
}))

export const marketplacePostRelations = relations(marketplacePost, ({ one }) => ({
  housingUnit: one(housingUnit, {
    fields: [marketplacePost.housingUnitId],
    references: [housingUnit.id],
  }),
  postedBy: one(resident, {
    fields: [marketplacePost.postedById],
    references: [resident.id],
    relationName: 'MarketplacePostedBy',
  }),
  claimedBy: one(resident, {
    fields: [marketplacePost.claimedById],
    references: [resident.id],
    relationName: 'MarketplacePostClaimedBy',
  }),
}))

export const transferRequestRelations = relations(transferRequest, ({ one }) => ({
  resident: one(resident, {
    fields: [transferRequest.residentId],
    references: [resident.id],
  }),
  currentPlacement: one(placement, {
    fields: [transferRequest.currentPlacementId],
    references: [placement.id],
    relationName: 'TransferFromPlacement',
  }),
  targetUnit: one(housingUnit, {
    fields: [transferRequest.targetUnitId],
    references: [housingUnit.id],
  }),
}))

export const houseRuleRelations = relations(houseRule, ({ one, many }) => ({
  housingUnit: one(housingUnit, {
    fields: [houseRule.housingUnitId],
    references: [housingUnit.id],
  }),
  parentRule: one(houseRule, {
    fields: [houseRule.parentRuleId],
    references: [houseRule.id],
    relationName: 'RuleSpecialisation',
  }),
  childRules: many(houseRule, { relationName: 'RuleSpecialisation' }),
  adoptedByProposal: one(proposal, {
    fields: [houseRule.adoptedByProposalId],
    references: [proposal.id],
    relationName: 'ProposalAdoptedRule',
  }),
  acknowledgements: many(ruleAcknowledgement),
  targetedBy: many(proposal, { relationName: 'ProposalTargetRule' }),
  topicProposals: many(proposal, { relationName: 'ProposalTopicRule' }),
}))

export const ruleAcknowledgementRelations = relations(ruleAcknowledgement, ({ one }) => ({
  rule: one(houseRule, {
    fields: [ruleAcknowledgement.ruleId],
    references: [houseRule.id],
  }),
  resident: one(resident, {
    fields: [ruleAcknowledgement.residentId],
    references: [resident.id],
  }),
}))

export const proposalRelations = relations(proposal, ({ one, many }) => ({
  housingUnit: one(housingUnit, {
    fields: [proposal.housingUnitId],
    references: [housingUnit.id],
  }),
  targetRule: one(houseRule, {
    fields: [proposal.targetRuleId],
    references: [houseRule.id],
    relationName: 'ProposalTargetRule',
  }),
  parentOrgRule: one(houseRule, {
    fields: [proposal.parentOrgRuleId],
    references: [houseRule.id],
    relationName: 'ProposalTopicRule',
  }),
  proposedByResident: one(resident, {
    fields: [proposal.proposedByResidentId],
    references: [resident.id],
    relationName: 'ProposalAuthor',
  }),
  votes: many(vote),
  adoptedRules: many(houseRule, { relationName: 'ProposalAdoptedRule' }),
  agreement: one(conflictAgreement),
}))

export const voteRelations = relations(vote, ({ one }) => ({
  proposal: one(proposal, {
    fields: [vote.proposalId],
    references: [proposal.id],
  }),
  resident: one(resident, {
    fields: [vote.residentId],
    references: [resident.id],
  }),
}))

export const conflictAgreementRelations = relations(conflictAgreement, ({ one, many }) => ({
  incident: one(incident, {
    fields: [conflictAgreement.incidentId],
    references: [incident.id],
  }),
  parties: many(agreementParty),
  ruleProposal: one(proposal, {
    fields: [conflictAgreement.ruleProposalId],
    references: [proposal.id],
  }),
}))

export const agreementPartyRelations = relations(agreementParty, ({ one }) => ({
  agreement: one(conflictAgreement, {
    fields: [agreementParty.agreementId],
    references: [conflictAgreement.id],
  }),
  resident: one(resident, {
    fields: [agreementParty.residentId],
    references: [resident.id],
  }),
}))

export const learningRecordRelations = relations(learningRecord, ({ one }) => ({
  resident: one(resident, {
    fields: [learningRecord.residentId],
    references: [resident.id],
  }),
  recordedByUser: one(user, {
    fields: [learningRecord.recordedByUserId],
    references: [user.id],
    relationName: 'LearningRecordedBy',
  }),
  fromApplication: one(opportunityApplication),
}))

export const careAssignmentRelations = relations(careAssignment, ({ one }) => ({
  resident: one(resident, {
    fields: [careAssignment.residentId],
    references: [resident.id],
  }),
  staff: one(user, {
    fields: [careAssignment.staffId],
    references: [user.id],
  }),
}))

export const appointmentRelations = relations(appointment, ({ one }) => ({
  resident: one(resident, {
    fields: [appointment.residentId],
    references: [resident.id],
  }),
  staff: one(user, {
    fields: [appointment.staffId],
    references: [user.id],
  }),
  checkIn: one(satisfactionCheckIn),
}))

export const careAttributeRelations = relations(careAttribute, ({ one }) => ({
  resident: one(resident, {
    fields: [careAttribute.residentId],
    references: [resident.id],
  }),
  updatedBy: one(user, {
    fields: [careAttribute.updatedById],
    references: [user.id],
  }),
}))

export const opportunityRelations = relations(opportunity, ({ one, many }) => ({
  createdBy: one(user, {
    fields: [opportunity.createdByUserId],
    references: [user.id],
    relationName: 'OpportunityCreatedBy',
  }),
  updatedBy: one(user, {
    fields: [opportunity.updatedByUserId],
    references: [user.id],
    relationName: 'OpportunityUpdatedBy',
  }),
  applications: many(opportunityApplication),
}))

export const opportunityApplicationRelations = relations(opportunityApplication, ({ one }) => ({
  resident: one(resident, {
    fields: [opportunityApplication.residentId],
    references: [resident.id],
  }),
  opportunity: one(opportunity, {
    fields: [opportunityApplication.opportunityId],
    references: [opportunity.id],
  }),
  supportedBy: one(user, {
    fields: [opportunityApplication.supportedByUserId],
    references: [user.id],
    relationName: 'ApplicationSupportedBy',
  }),
  learningRecord: one(learningRecord, {
    fields: [opportunityApplication.learningRecordId],
    references: [learningRecord.id],
  }),
}))

export const staffUnitRelations = relations(staffUnit, ({ one }) => ({
  staff: one(user, {
    fields: [staffUnit.staffId],
    references: [user.id],
  }),
  housingUnit: one(housingUnit, {
    fields: [staffUnit.housingUnitId],
    references: [housingUnit.id],
  }),
}))

// Client-managed admin facts. `reviewedBy` is the staff member who recorded
// having SEEN the entry — never a claim that they verified it.
export const clientInsuranceRelations = relations(clientInsurance, ({ one }) => ({
  resident: one(resident, {
    fields: [clientInsurance.residentId],
    references: [resident.id],
  }),
  reviewer: one(user, {
    fields: [clientInsurance.reviewedBy],
    references: [user.id],
  }),
}))

export const clientHealthContactRelations = relations(clientHealthContact, ({ one }) => ({
  resident: one(resident, {
    fields: [clientHealthContact.residentId],
    references: [resident.id],
  }),
  reviewer: one(user, {
    fields: [clientHealthContact.reviewedBy],
    references: [user.id],
  }),
}))

export const clientPermitRelations = relations(clientPermit, ({ one }) => ({
  resident: one(resident, {
    fields: [clientPermit.residentId],
    references: [resident.id],
  }),
  reviewer: one(user, {
    fields: [clientPermit.reviewedBy],
    references: [user.id],
  }),
}))
