/**
 * Governance validation schemas — SSOT for shape and types.
 *
 * Types are derived from the schemas, never declared separately.
 */
import { BRAND } from '@/lib/config/brand'

import { z } from 'zod'

const RULE_CATEGORIES = [
  'SAFETY',
  'RESPECT',
  'NOISE',
  'CLEANLINESS',
  'KITCHEN',
  'BATHROOM',
  'GUESTS',
  'SHARED_SPACES',
  'COSTS',
  'COMMUNICATION',
  'OTHER',
] as const

const RULE_DELEGATIONS = ['FIXED', 'UNIT_MAY_STRENGTHEN', 'UNIT_DECIDES'] as const

// =============================================================================
// RULES
// =============================================================================

export const orgRuleSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'Nur Kleinbuchstaben, Zahlen und Unterstriche'),
  category: z.enum(RULE_CATEGORIES),
  title: z.string().min(3, 'Titel ist zu kurz').max(120),
  body: z.string().min(10, 'Bitte die Regel ausformulieren').max(2000),
  delegation: z.enum(RULE_DELEGATIONS),
})

export const updateOrgRuleSchema = orgRuleSchema.omit({ key: true }).extend({
  ruleId: z.string().min(1),
})

export const unitRuleSchema = z.object({
  housingUnitId: z.string().min(1),
  parentRuleId: z.string().min(1, `Eine Hausregel gehört immer zu einer ${BRAND.orgName}-Regel`),
  title: z.string().min(3, 'Titel ist zu kurz').max(120),
  body: z.string().min(10, 'Bitte die Regel ausformulieren').max(2000),
})

export const acknowledgeRuleSchema = z.object({
  ruleId: z.string().min(1),
})

export const acknowledgeAllSchema = z.object({
  ruleIds: z.array(z.string().min(1)).min(1).max(100),
})

// =============================================================================
// PROPOSALS & VOTES
// =============================================================================

export const createProposalSchema = z
  .object({
    type: z.enum(['ADD_RULE', 'AMEND_RULE', 'REPEAL_RULE', 'HOUSE_DECISION']),
    title: z.string().min(3, 'Titel ist zu kurz').max(120),
    body: z.string().min(10, 'Bitte beschreiben Sie Ihren Vorschlag').max(2000),
    category: z.enum(RULE_CATEGORIES),
    /** Required for ADD_RULE — the AOZ topic the house rule would live under. */
    parentOrgRuleId: z.string().min(1).optional(),
    /** Required for AMEND_RULE / REPEAL_RULE. */
    targetRuleId: z.string().min(1).optional(),
  })
  .refine((data) => data.type !== 'ADD_RULE' || !!data.parentOrgRuleId, {
    message: `Bitte wählen Sie das ${BRAND.orgName}-Thema, zu dem die Hausregel gehört`,
    path: ['parentOrgRuleId'],
  })
  .refine((data) => !['AMEND_RULE', 'REPEAL_RULE'].includes(data.type) || !!data.targetRuleId, {
    message: 'Bitte wählen Sie die Hausregel, die geändert werden soll',
    path: ['targetRuleId'],
  })

export const castVoteSchema = z
  .object({
    proposalId: z.string().min(1),
    choice: z.enum(['YES', 'NO', 'ABSTAIN', 'BLOCK']),
    reason: z.string().max(1000).optional(),
  })
  .refine((data) => data.choice !== 'BLOCK' || (data.reason?.trim().length ?? 0) >= 5, {
    // A veto that says nothing cannot be mediated, only resented.
    message: 'Bitte begründen Sie Ihr Veto in einem Satz',
    path: ['reason'],
  })

export const staffConfirmProposalSchema = z.object({
  proposalId: z.string().min(1),
  decision: z.enum(['CONFIRMED', 'VETOED']),
  staffNotes: z.string().max(1000).optional(),
})

// =============================================================================
// CONFLICT RESOLUTION
// =============================================================================

export const advanceStageSchema = z.object({
  incidentId: z.string().min(1),
  stage: z.enum([
    'REPORTED',
    'SELF_RESOLUTION',
    'PEER_MEDIATION',
    'STAFF_MEDIATION',
    'FORMAL_MEASURE',
    'CLOSED',
  ]),
  note: z.string().max(1000).optional(),
})

export const createAgreementSchema = z.object({
  incidentId: z.string().min(1),
  terms: z
    .string()
    .min(15, 'Bitte konkret festhalten, wer was tut — sonst lässt es sich später nicht überprüfen')
    .max(2000),
  // Two people cannot agree with themselves; an agreement needs both sides.
  residentIds: z
    .array(z.string().min(1))
    .min(2, 'Eine Abmachung braucht mindestens zwei Beteiligte'),
  reviewDate: z.coerce.date(),
  mediatorName: z.string().max(120).optional(),
})

export const reviewAgreementSchema = z.object({
  agreementId: z.string().min(1),
  status: z.enum(['HELD', 'BROKEN']),
  outcomeNotes: z.string().max(1000).optional(),
})

export const respondToAgreementSchema = z.object({
  agreementId: z.string().min(1),
  accept: z.boolean(),
})

// =============================================================================
// DERIVED TYPES
// =============================================================================

export type OrgRuleInput = z.infer<typeof orgRuleSchema>
export type UpdateOrgRuleInput = z.infer<typeof updateOrgRuleSchema>
export type UnitRuleInput = z.infer<typeof unitRuleSchema>
export type CreateProposalInput = z.infer<typeof createProposalSchema>
export type CastVoteInput = z.infer<typeof castVoteSchema>
export type StaffConfirmProposalInput = z.infer<typeof staffConfirmProposalSchema>
export type AdvanceStageInput = z.infer<typeof advanceStageSchema>
export type CreateAgreementInput = z.infer<typeof createAgreementSchema>
export type ReviewAgreementInput = z.infer<typeof reviewAgreementSchema>
export type RespondToAgreementInput = z.infer<typeof respondToAgreementSchema>
