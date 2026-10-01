/**
 * Dashboard composition — which sections exist, what gates each, and how a
 * viewer's desk orders them.
 *
 * Two layers, never one:
 *  - DASHBOARD_SECTIONS maps each section onto the PERMISSION that makes it
 *    someone's business (role-policy.ts is the permission SSOT);
 *  - the viewer's desk (`config/roles.ts`) SELECTS and ORDERS sections and
 *    hero sources for their role.
 * Consumed by the page (to skip the queries a viewer cannot see), by
 * ActionDashboard (to render in order) and by the nav badge — one mapping,
 * three readers, so they can never disagree.
 */

import {
  hasAllDomainReach,
  hasPermission,
  type StaffCapabilities,
  type StaffPermission,
} from '@/lib/auth/role-policy'
import { deskFor } from '@/lib/config/roles'

/**
 * Every dashboard section and the permission that makes it someone's business.
 *
 * A desk can list a section, but it renders only for a viewer holding the
 * permission. Key order is the order the remaining sections are appended in
 * for a viewer with reach over every domain.
 */
export const DASHBOARD_SECTIONS = {
  /**
   * The critical-incident banner and hero. READ is enough: someone placing a
   * person into a flat must see that a conflict there is critical, even if
   * working it is Betreuung's.
   */
  criticalIncidents: 'incidents:read',
  /**
   * Harmony stat, overdue follow-ups, problem-unit tiles — conflict
   * OPERATIONS, so keyed on `incidents:write`. A coach who may see that their
   * client's household is in trouble is not handed the ladder's work queue.
   */
  incidents: 'incidents:write',
  /** Check-in stat, overdue/due-soon tiles, check-in hero branches. */
  checkIns: 'placements:read',
  /**
   * Proposals awaiting a staff answer — resolved on /rules. Gated on being
   * able to do the work; this queue is where safety and non-discrimination
   * topics land.
   */
  proposals: 'governance:confirm',
  /** Klient*innen waiting for an answer to a message. Same gate as the inbox. */
  messages: 'messages:read',
  /** Client-entered facts awaiting a first look — resolved on /approvals. */
  approvals: 'clientFacts:read',
  /** Insurances and permits running out, for the viewer's own clients. */
  renewals: 'clientFacts:read',
  /**
   * Residents who pressed «Ich habe Interesse» and nobody has answered.
   *
   * READ opens the list (Betreuung sees who asked); only `opportunities:write`
   * gets the «Übernehmen» button and counts it as a task, because a request
   * shown to someone who cannot answer it is a list to watch, not work.
   * @see lib/inbox/waiting.ts
   */
  applications: 'opportunities:read',
  /** The specialist's own caseload signals (Jobcoach / Freiwilligenarbeit). */
  caseload: 'learning:write',
  /** Unplaced-residents tile + hero branch — they link into /matching. */
  matching: 'placements:write',
  /** Free-beds stat. */
  occupancy: 'housing:read',
  /** Pending transfer-request queue — resolved on /transfer-requests. */
  transferRequests: 'placements:write',
  /** Open maintenance: the stat, and the list Liegenschaften works through. */
  maintenance: 'maintenance:read',
  /** Learning pulse — in-progress records and recent completions. */
  learning: 'learning:read',
  /** Upcoming published events. */
  events: 'events:read',
  /**
   * Team health — staff accounts, and how many have never signed in. Gated
   * on `users:manage`: it reports on the thing only an administrator can act
   * on.
   */
  team: 'users:manage',
} as const satisfies Record<string, StaffPermission>

export type DashboardSection = keyof typeof DASHBOARD_SECTIONS

const ALL_SECTIONS = Object.keys(DASHBOARD_SECTIONS) as DashboardSection[]

/**
 * Sections that produce OPEN TASKS. Each must be able to claim the hero —
 * otherwise the header says "3 Aufgaben" while the hero says "Alles
 * erledigt!", a contradiction this dashboard has shipped three times (the
 * last one: Freiwilligenarbeit's volunteering queue was never handed to the
 * hero at all). Pinned by roles.test.ts.
 */
export const WORK_SECTIONS: readonly DashboardSection[] = [
  'criticalIncidents',
  'incidents',
  'checkIns',
  'proposals',
  'messages',
  'approvals',
  'renewals',
  'applications',
  'caseload',
  'matching',
  'transferRequests',
  'maintenance',
]

/**
 * What can claim the "Als Nächstes" hero, and the section whose data each
 * reads. Two sections have more than one source because urgency differs
 * within them (a check-in six weeks late is not one due this week).
 *
 * Key order is the tail appended after a desk's own hero list for a viewer
 * with reach over every domain: safety first, then the order the single
 * global list used to have.
 */
export const HERO_SOURCES = {
  criticalIncidents: 'criticalIncidents',
  checkInsVeryOverdue: 'checkIns',
  proposals: 'proposals',
  matching: 'matching',
  conflictUnits: 'incidents',
  checkIns: 'checkIns',
  conflictUnitsMonitor: 'incidents',
  jobQueue: 'caseload',
  volunteeringQueue: 'caseload',
  applications: 'applications',
  messages: 'messages',
  followUps: 'incidents',
  renewals: 'renewals',
  approvals: 'approvals',
  transferRequests: 'transferRequests',
  maintenance: 'maintenance',
} as const satisfies Record<string, DashboardSection>

export type HeroSource = keyof typeof HERO_SOURCES

const ALL_HERO_SOURCES = Object.keys(HERO_SOURCES) as HeroSource[]

/** Own desk first, then — for all-domain reach — everything else, once. */
function withTail<T>(own: readonly T[], all: readonly T[], reachAll: boolean): T[] {
  return reachAll ? [...own, ...all.filter((item) => !own.includes(item))] : [...own]
}

/** The sections this viewer sees, in the order they render. */
export function dashboardSections(viewer: StaffCapabilities): DashboardSection[] {
  return withTail(deskFor(viewer.role).sections, ALL_SECTIONS, hasAllDomainReach(viewer)).filter(
    (section) => hasPermission(viewer, DASHBOARD_SECTIONS[section]),
  )
}

export function sectionVisible(viewer: StaffCapabilities, section: DashboardSection): boolean {
  return dashboardSections(viewer).includes(section)
}

/** This viewer's hero priority list — only sources whose section shows. */
export function heroOrder(viewer: StaffCapabilities): HeroSource[] {
  const visible = dashboardSections(viewer)
  return withTail(deskFor(viewer.role).hero, ALL_HERO_SOURCES, hasAllDomainReach(viewer)).filter(
    (source) => visible.includes(HERO_SOURCES[source]),
  )
}

/** Every label a quiet-day button may carry. Narrow on purpose: the call
 *  sites index DASHBOARD_LABELS with it, so `string` would break them. */
export type DashboardCtaLabelKey =
  | 'actionCreateResident'
  | 'actionOpenLearning'
  | 'actionViewStats'
  | 'actionOpenJobBoard'
  | 'actionOpenVolunteering'
  | 'actionOpenHousing'

/**
 * The generic ladder, used only when the desk's own quiet-day button is not
 * permitted (the expired-session stand-in). Analytics is readable by every
 * staff role and therefore the guaranteed last resort.
 */
export const DASHBOARD_FALLBACK_CTAS: readonly {
  permission: StaffPermission
  href: string
  labelKey: DashboardCtaLabelKey
}[] = [
  { permission: 'residents:write', href: '/residents/new', labelKey: 'actionCreateResident' },
  { permission: 'learning:write', href: '/learning', labelKey: 'actionOpenLearning' },
  { permission: 'dashboard:read', href: '/analytics', labelKey: 'actionViewStats' },
]

/**
 * All-clear CTA: the role's own home from its desk, when it may open it;
 * otherwise the first generic action it may perform.
 */
export function fallbackCta(viewer: StaffCapabilities): {
  href: string
  labelKey: DashboardCtaLabelKey
} {
  const { quietDay } = deskFor(viewer.role)
  if (hasPermission(viewer, quietDay.permission)) {
    return { href: quietDay.href, labelKey: quietDay.labelKey }
  }
  // dashboard:read is in every role, so the find can never miss.
  return DASHBOARD_FALLBACK_CTAS.find((cta) => hasPermission(viewer, cta.permission))!
}

/**
 * Whether this workspace has nothing YET, nothing RIGHT NOW, or work waiting.
 *
 * The dashboard used to collapse the first two. On a database with no people
 * in it every queue is empty, so every check passed and the page reported
 * "Alles erledigt!" and "Alles unter Kontrolle!" — twice, with the same
 * button under each. Nothing was under control; there was simply nothing.
 * That is the single most misleading screen a new AOZ team could be handed,
 * because it says the setup they have not started is finished.
 *
 * Emptiness is measured in PEOPLE, not units: this product exists to support
 * residents, and a workspace with buildings and nobody in them has not begun.
 *
 * A fourth case exists one level in, and it is the same mistake at the scale
 * of one person rather than one database. A specialist works the clients
 * assigned to their seat. Before anyone has been assigned, their queues are
 * empty for a reason that has nothing to do with the work being done — yet
 * `residentCount` counts everyone in the product, so they land in `quiet` and
 * are told, with a party emoji, that everything is under control.
 *
 * Observed in production on 2026-08-31, the day the real AOZ team was
 * created: the Jobcoach and the Freiwilligenarbeit coordinator both saw
 * "🎉 Alles unter Kontrolle! Keine dringenden Aufgaben" on their first ever
 * login, with nobody assigned to either of them. That is the first thing the
 * two specialists AOZ actually employs were told by this product.
 *
 * `residentCount` stays global on purpose — a Jobcoach must not be told the
 * workspace is empty while 19 people sit in it, which is why it was made
 * global in the first place. So this is a separate axis, not a redefinition.
 */
export type WorkspaceState = 'empty' | 'unassigned' | 'quiet' | 'busy'

export function workspaceState({
  residentCount,
  openTaskCount,
  assignedResidentCount = null,
}: {
  residentCount: number
  openTaskCount: number
  /**
   * How many clients sit in THIS viewer's care seat, or null when the question
   * does not apply — someone with oversight over every domain has no single
   * seat to be empty, and the operator account is not waiting to be assigned.
   */
  assignedResidentCount?: number | null
}): WorkspaceState {
  if (residentCount === 0) return 'empty'
  if (openTaskCount > 0) return 'busy'
  // Only when there is genuinely nothing to do: real work outranks the
  // onboarding notice, otherwise a specialist who has been given a task but
  // no formal assignment would be told to go and get assigned instead of
  // seeing the task.
  if (assignedResidentCount === 0) return 'unassigned'
  return 'quiet'
}

/**
 * The first real setup step, for a workspace that has no data yet.
 *
 * Returns null when this role cannot set anything up — a Jobcoach may neither
 * create housing nor create residents, and offering them a button that ends
 * at /kein-zugriff repeats the mistake PR #88 fixed. They get the explanation
 * without the dead end. @see app/(admin)/kein-zugriff/page.tsx
 */
export interface SetupStep {
  href: string
  labelKey: 'setupCreateHousing' | 'setupCreateResident'
}

export function setupCta(
  viewer: StaffCapabilities,
  { housingUnitCount }: { housingUnitCount: number },
): SetupStep | null {
  // Housing first, but only while there is none: residents are placed INTO
  // units, so an instance with no unit cannot complete an intake.
  if (housingUnitCount === 0 && hasPermission(viewer, 'housing:write')) {
    return { href: '/housing/new', labelKey: 'setupCreateHousing' }
  }
  if (hasPermission(viewer, 'residents:write')) {
    return { href: '/residents/new', labelKey: 'setupCreateResident' }
  }
  return null
}
