/**
 * The staff desks — what each role's working day IS. SSOT.
 *
 * `role-policy.ts` answers "MAY they?" and stays the only place a permission
 * is granted. This file answers "what is their work, in what order?", keyed by
 * the same `StaffRole`, and is read by everything that used to ask
 * `role === '…'` on its own:
 *
 *   dashboard sections and their order  → config/dashboard.ts, ActionDashboard
 *   which queue claims the hero first    → PrimaryActionHero
 *   the dossier tab a person opens on    → config/dossier.ts
 *   the integration board a role works   → config/integration-boards.ts
 *   which caseload queue is fetched      → (admin)/page.tsx
 *   the quiet-day button                 → config/dashboard.ts (fallbackCta)
 *   the one line shown under the role    → UserMenu, settings
 *
 * A desk only ORDERS and SELECTS what the role's permissions already allow —
 * every section is still gated by its permission in DASHBOARD_SECTIONS, so a
 * desk can never show something the role may not see.
 *
 * ALL_DOMAINS (and system administration, which implies it) works every seat:
 * such a viewer gets their own desk FIRST and then every other section they
 * may see, so oversight never hides a queue. @see dashboardSections()
 *
 * Adding a role is a compile error here until it has a desk.
 */

import type { StaffPermission, StaffRole } from '@/lib/auth/role-policy'
import type { DashboardCtaLabelKey, DashboardSection, HeroSource } from './dashboard'
import type { DossierTab } from './dossier'
import type { IntegrationBoardId } from './integration-boards'

export interface StaffDesk {
  /** One German line naming the work. Shown under the role in the UI. */
  description: string
  /** Dashboard sections, most important first. Order is rendering order. */
  sections: readonly DashboardSection[]
  /** Which queue claims the "Als Nächstes" hero, in priority order. */
  hero: readonly HeroSource[]
  /** The dossier section a person's page opens on for this role. */
  dossierTab: DossierTab
  /**
   * Which half of the integration domain this role works. Also decides the
   * caseload queue the dashboard builds: `job` → the Jobcoach queue,
   * `volunteering` → the Freiwilligenarbeit queue, `overview` → none.
   */
  integrationBoard: IntegrationBoardId
  /** The button on a day with nothing urgent. Falls back if not permitted. */
  quietDay: { permission: StaffPermission; href: string; labelKey: DashboardCtaLabelKey }
  /** Whether client cards lead with the check-in status. Betreuung's signal. */
  checkInChip: boolean
}

const BETREUUNG: StaffDesk = {
  description: 'Alltag begleiten: Check-ins, Wohlbefinden, Konflikte, Hausregeln, Nachrichten.',
  sections: [
    'criticalIncidents',
    'checkIns',
    'incidents',
    'proposals',
    'messages',
    'approvals',
    // Read-only for Betreuung: who asked about a place, so it can be raised
    // at the kitchen table. Answering stays with the integration roles.
    'applications',
    'learning',
  ],
  hero: [
    'criticalIncidents',
    'checkInsVeryOverdue',
    'proposals',
    'conflictUnits',
    'checkIns',
    'followUps',
    'messages',
    'approvals',
    'conflictUnitsMonitor',
    // Only ever fires for a viewer who may answer (ALL_DOMAINS); the hero is
    // handed claimable requests only.
    'applications',
  ],
  dossierTab: 'overview',
  integrationBoard: 'overview',
  quietDay: {
    permission: 'residents:write',
    href: '/residents/new',
    labelKey: 'actionCreateResident',
  },
  checkInChip: true,
}

export const STAFF_DESKS: Record<StaffRole, StaffDesk> = {
  // Retired role, kept so live rows resolve. Works like Betreuung; what made it
  // special lives in scope and isSystemAdmin.
  ADMIN: BETREUUNG,
  BETREUUNG,
  SOZIALARBEIT: {
    description: 'Fallführung: Unterlagen, Fristen (Versicherung, Bewilligung), Ämter, Dokumente.',
    sections: ['renewals', 'approvals', 'messages', 'criticalIncidents', 'incidents'],
    // A critical incident still comes first: this role works the ladder.
    hero: [
      'criticalIncidents',
      'renewals',
      'approvals',
      'messages',
      'followUps',
      'conflictUnits',
      'conflictUnitsMonitor',
    ],
    dossierTab: 'documents',
    integrationBoard: 'overview',
    quietDay: {
      permission: 'residents:write',
      href: '/residents/new',
      labelKey: 'actionCreateResident',
    },
    checkInChip: true,
  },
  JOBCOACH: {
    description: 'Arbeit & Ausbildung: Stellen, Bewerbungen, Kurse, Bewilligungen.',
    sections: ['caseload', 'applications', 'approvals', 'learning'],
    hero: ['jobQueue', 'applications', 'approvals'],
    dossierTab: 'integration',
    integrationBoard: 'job',
    // "Lernen & Beruf" names the Jobcoach's domain — learning AND work.
    quietDay: { permission: 'learning:write', href: '/learning', labelKey: 'actionOpenLearning' },
    checkInChip: false,
  },
  FREIWILLIGENARBEIT: {
    description: 'Freiwilligenarbeit & Gemeinschaft: Einsätze, Anfragen, Anlässe.',
    sections: ['caseload', 'applications', 'events', 'learning'],
    hero: ['volunteeringQueue', 'applications'],
    dossierTab: 'integration',
    integrationBoard: 'volunteering',
    quietDay: {
      permission: 'opportunities:read',
      href: '/opportunities?board=volunteering',
      labelKey: 'actionOpenVolunteering',
    },
    checkInChip: false,
  },
  LIEGENSCHAFTEN: {
    description: 'Wohnungen, Zimmer, Platzierungen, Wartung, neue Mieter*innen aufnehmen.',
    // No check-ins: those are Betreuung's conversations, not the building's.
    sections: ['matching', 'occupancy', 'transferRequests', 'maintenance', 'criticalIncidents'],
    // A critical incident is READ-only here (the banner still shows it); the
    // hero names what this role can act on first.
    hero: ['matching', 'transferRequests', 'maintenance', 'criticalIncidents'],
    dossierTab: 'housing',
    integrationBoard: 'overview',
    quietDay: { permission: 'housing:read', href: '/housing', labelKey: 'actionOpenHousing' },
    checkInChip: false,
  },
}

export function deskFor(role: StaffRole): StaffDesk {
  return STAFF_DESKS[role]
}

/** The caseload queue a role's dashboard builds, derived from its board. */
export function caseloadQueueFor(role: StaffRole): 'job' | 'volunteering' | null {
  const board = deskFor(role).integrationBoard
  return board === 'overview' ? null : board
}
