/**
 * Dashboard composition — SSOT for which role sees which dashboard surface.
 *
 * The dashboard used to hardcode the housing/placement widgets for everyone:
 * a Jobcoach or Freiwilligenarbeit coordinator logged in and saw "freie
 * Betten" and a matching CTA — none of it their work — and nothing from the
 * pillars that ARE their work (learning, events). The permission model in
 * role-policy.ts already IS the definition of "what is this person's daily
 * work"; this file only maps each dashboard section onto the permission that
 * makes the section that role's business. Consumed by the page (to skip the
 * queries a role cannot see) and by ActionDashboard (to gate rendering) —
 * one mapping, two readers, so they can never disagree.
 */

import {
  hasPermission,
  type StaffCapabilities,
  type StaffPermission,
  type StaffRole,
} from '@/lib/auth/role-policy'
import { defaultIntegrationBoardForRole } from '@/lib/config/integration-boards'

export const DASHBOARD_SECTIONS = {
  /** Free-beds stat. */
  occupancy: 'housing:read',
  /** Check-in stat, overdue/due-soon tiles, check-in hero branches. */
  checkIns: 'placements:read',
  /**
   * Harmony stat, critical-incident banner, problem-unit tiles.
   *
   * Keyed on `incidents:WRITE`, not read. Everything in this section is
   * housing-conflict OPERATIONS — a harmony score for the house, tiles that
   * name problem UNITS — and belongs to whoever works the ladder, not to
   * everyone permitted to see that a conflict exists.
   *
   * The distinction only started to matter when JOBCOACH and
   * FREIWILLIGENARBEIT were given read-only sight of incidents, so a coach is
   * not the last to know their client's household is in trouble. That grant
   * must not turn their dashboard — deliberately "their own board" — into a
   * unit-operations screen for houses they do not run.
   *
   * Behaviour-preserving for everyone who had it: every role holding
   * `incidents:read` before that grant also held `incidents:write`.
   */
  incidents: 'incidents:write',
  /** Open-maintenance stat. */
  maintenance: 'maintenance:read',
  /** Unplaced-residents tile + hero branch — they link into /matching. */
  matching: 'placements:write',
  /** Pending transfer-request queue — resolved on /transfer-requests. */
  transferRequests: 'placements:write',
  /**
   * Proposals awaiting a staff answer — resolved on /rules.
   *
   * A WORK QUEUE, so it is gated on being able to do the work rather than on
   * being able to read the page. It used to ride on `housing:read` because no
   * governance permission existed; that handed the queue to LIEGENSCHAFTEN the
   * day that role was added, and this queue is where safety and
   * non-discrimination topics land.
   */
  proposals: 'governance:confirm',
  /** Learning pulse — in-progress records and recent completions. */
  learning: 'learning:read',
  /** Upcoming published events. */
  events: 'events:read',
  /**
   * Team health — staff accounts, and how many have never signed in.
   *
   * THE ONLY SECTION LEITUNG SEES AND BETREUUNG DOES NOT, and that is the
   * point. `BETREUUNG: [...OPERATIONAL]` while ADMIN is `[...OPERATIONAL, +5]`,
   * and every one of those five (`users:manage`, `system:configure`,
   * `import:write`, `opportunities:write`, `activities:write`) was a PAGE
   * permission that no dashboard section mapped to. So the two roles rendered
   * byte-identical dashboards — the mechanism for differentiating them existed
   * and simply had nothing keyed to it.
   *
   * Gated on `users:manage` rather than invented: it reports on the thing only
   * Leitung can actually act on. A provisioned staff code nobody has ever used
   * is invisible everywhere else in the product, and it is precisely the kind
   * of loose end the person managing the team is responsible for.
   */
  team: 'users:manage',
  /**
   * Klient*innen waiting for an answer to a message.
   *
   * `staffInbox()` has always computed `waitingSince` per thread and sorted
   * oldest-wait-first — "somebody has been waiting four days" was a fact the
   * product held on every page load and told nobody, because only /messages
   * read it. Betreuung had to open the inbox speculatively to find out.
   *
   * Gated on `messages:read`, the same permission that opens the inbox, so the
   * tile never names a conversation its viewer may not read.
   */
  messages: 'messages:read',
  /**
   * Residents who pressed «Ich habe Interesse» and nobody has answered.
   *
   * Gated on being able to ANSWER (`opportunities:write`), for everyone who
   * may, rather than only for whoever holds that resident's care seat. The seat
   * rule meant an unassigned resident's request appeared on no screen at all.
   * @see lib/inbox/waiting.ts
   */
  applications: 'opportunities:write',
  /** Client-entered facts awaiting a first look — resolved on /approvals. */
  approvals: 'clientFacts:read',
} as const satisfies Record<string, StaffPermission>

export type DashboardSection = keyof typeof DASHBOARD_SECTIONS

export function sectionVisible(viewer: StaffCapabilities, section: DashboardSection): boolean {
  return hasPermission(viewer, DASHBOARD_SECTIONS[section])
}

/**
 * All-clear hero CTA: when nothing is urgent, offer the first action the role
 * may actually perform — not /residents/new for a Jobcoach who cannot create
 * residents. Order is deliberate: creating a resident is the product's main
 * intake, learning is the coaching roles' home, analytics is readable by
 * every staff role and therefore the guaranteed last resort.
 */
/** Every label a quiet-day button may carry. Narrow on purpose: the call
 *  sites index DASHBOARD_LABELS with it, so `string` would break them. */
export type DashboardCtaLabelKey =
  | 'actionCreateResident'
  | 'actionOpenLearning'
  | 'actionViewStats'
  | 'actionOpenJobBoard'
  | 'actionOpenVolunteering'

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
 * Where a role's own work lives when nothing is urgent.
 *
 * Checked BEFORE the generic list, because that list is ordered by permission
 * alone and its second entry is `learning:write` — "the coaching roles' home",
 * which is true of a Jobcoach and false of everyone else holding the
 * permission. The Freiwilligenarbeit coordinator runs Freiwilligenarbeit, holds `learning:write`, and her
 * quiet-day screen therefore invited her into the Jobcoach's surface. Found by
 * opening her dashboard, not by reading this file.
 *
 * Derived from the SAME function that decides which board each role opens on,
 * so a role can never be sent to one board by the nav and another by this
 * button.
 */
const DOMAIN_HOME: Partial<Record<StaffRole, { href: string; labelKey: DashboardCtaLabelKey }>> = {
  // JOBCOACH is deliberately ABSENT. "Lernen & Beruf" covers the Jobcoach's domain by
  // name — learning and work — so the generic ladder already lands him on
  // something that is his, and two existing tests pin that on purpose.
  // The Freiwilligenarbeit coordinator is the one it mis-routes: nothing about Lernen & Beruf is
  // Freiwilligenarbeit. Redirecting the Jobcoach as well was an over-reach; the
  // suite caught it.
  FREIWILLIGENARBEIT: {
    href: `/opportunities?board=${defaultIntegrationBoardForRole('FREIWILLIGENARBEIT')}`,
    labelKey: 'actionOpenVolunteering',
  },
}

export function fallbackCta(viewer: StaffCapabilities): {
  href: string
  labelKey: DashboardCtaLabelKey
} {
  // A specialist's own board beats a generic permission match.
  const home = DOMAIN_HOME[viewer.role]
  if (home && hasPermission(viewer, 'opportunities:read')) return home

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
