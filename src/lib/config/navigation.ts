/**
 * Navigation configuration - SSOT for all nav items and icons
 */

import { LEARNING_AREA_NAME } from './learning'
import { OPPORTUNITY_AREA_NAME } from './opportunities'

import {
  Home,
  Users,
  Building2,
  Puzzle,
  Heart,
  BarChart3,
  AlertTriangle,
  Settings,
  Lightbulb,
  ClipboardList,
  ArrowRightLeft,
  UserCog,
  Bot,
  CalendarDays,
  CalendarClock,
  ScrollText,
  CircleHelp,
  UserPlus,
  HousePlus,
  Wallet,
  Vote,
  MoreHorizontal,
  MessageSquare,
  GraduationCap,
  ShoppingBag,
  HandHeart,
  Handshake,
  Inbox,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BRAND, isAozSurface, type BrandFeatures } from '@/lib/config/brand'
import {
  hasPermission,
  type StaffCapabilities,
  type StaffPermission,
  type StaffRole,
} from '@/lib/auth/role-policy'

export const NAV_ICONS: Record<string, LucideIcon> = {
  home: Home,
  inbox: Inbox,
  users: Users,
  building: Building2,
  puzzle: Puzzle,
  heart: Heart,
  chart: BarChart3,
  alert: AlertTriangle,
  wrench: Settings,
  brain: Lightbulb,
  clipboard: ClipboardList,
  transfer: ArrowRightLeft,
  settings: UserCog,
  bot: Bot,
  calendar: CalendarDays,
  scroll: ScrollText,
  help: CircleHelp,
  'user-plus': UserPlus,
  'house-plus': HousePlus,
  wallet: Wallet,
  vote: Vote,
  more: MoreHorizontal,
  message: MessageSquare,
  learning: GraduationCap,
  shop: ShoppingBag,
  event: CalendarClock,
  volunteer: HandHeart,
  opportunities: Handshake,
}

export interface NavItem {
  href: string
  icon: keyof typeof NAV_ICONS
  label: string
  permission?: StaffPermission
}

/**
 * System destinations — settings, algorithm docs, help. ONE definition,
 * rendered by the UserMenu dropdown (desktop) and the drawer's bottom
 * section (mobile). Deliberately not part of the megamenu: they are about
 * the tool, not the daily work, and they were the overflow that used to
 * clutter the header row on wide screens.
 */
export const SYSTEM_LINKS: NavItem[] = [
  { href: '/settings', icon: 'settings', label: 'Einstellungen', permission: 'users:manage' },
  // The audit trail. 120 sites wrote to it and nothing read it, so it had no
  // entry point at all — including the impersonation records, whose whole
  // safeguard is that somebody can review them.
  { href: '/audit', icon: 'clipboard', label: 'Protokoll', permission: 'users:manage' },
  // Complaints about the organisation. A system link, not a mission area: it is
  // deliberately outside the care groups, because the care team cannot see it.
  { href: '/complaints', icon: 'alert', label: 'Beschwerden', permission: 'complaints:read' },
  // A utility OVER the work, not one of the mission areas — the same kind of
  // thing as the algorithm docs and settings it now sits beside. It was also
  // costing 128px of a bar that did not have them: measured on a 1440px
  // laptop the nav needed 954px and had 865, so two entries sat behind a
  // horizontal scroll that people do not find. One click away, and the
  // mission areas fit.
  { href: '/ai-assistant', icon: 'bot', label: 'KI-Assistent', permission: 'ai:assist' },
  // Read-only methodology docs — visible to every staff role that sees a
  // compatibility score (i.e. all of them), matching the page's own guard.
  { href: '/algorithm', icon: 'brain', label: 'Algorithmus', permission: 'dashboard:read' },
  { href: '/portal/help', icon: 'help', label: 'Hilfe' },
]

export function visibleSystemLinks(viewer: StaffCapabilities): NavItem[] {
  return SYSTEM_LINKS.filter((item) => !item.permission || hasPermission(viewer, item.permission))
}

/**
 * Admin routes that exist but are deliberately NOT navigation destinations.
 *
 * The rule "every page under (admin) is reachable from the nav" is what stops
 * pages becoming undiscoverable, so the exceptions must be listed here and
 * argued for rather than silently tolerated — the same treatment
 * PORTAL_NAV_HIDDEN_ROUTES gives the portal.
 *
 * `/kein-zugriff` is somewhere you are SENT, never somewhere you go: putting
 * "Kein Zugriff" in a menu would be absurd, and a nav entry that 100% of
 * roles can reach would defeat the page's own purpose.
 */
export const ADMIN_NAV_EXCLUDED_ROUTES = ['/kein-zugriff'] as const

export interface MegaMenuDropdownItem {
  href: string
  icon: keyof typeof NAV_ICONS
  label: string
  desc: string
  permission?: StaffPermission
  feature?: keyof BrandFeatures
}

export type MegaMenuGroup =
  | {
      label: string
      href: string
      icon: string
      permission?: StaffPermission
      /** People waiting on the viewer, rendered as a count. Set per request. */
      badge?: number | null
    }
  | { label: string; items: MegaMenuDropdownItem[] }

/**
 * The staff landing page: everything waiting on this person, across areas.
 *
 * It was called "Dashboard", which named the layout rather than the job. What
 * the page actually answers is "who is waiting for me?" — an application, a
 * Freigabe, a message, a transfer request — so it is named for that, and it is
 * the one destination that carries a number. @see lib/inbox/waiting.ts
 */
export const INBOX_HREF = '/'
export const INBOX_LABEL = 'Eingang'

/** Attach the waiting count to the Eingang entry; other entries are untouched. */
export function withInboxBadge(groups: MegaMenuGroup[], count: number | null): MegaMenuGroup[] {
  return groups.map((group) =>
    'href' in group && group.href === INBOX_HREF ? { ...group, badge: count } : group,
  )
}

// Grouped by mission area (Wohnen/Alltag/Konflikte/Lernen & Engagement),
// not by database entity — each of AOZ's four staff roles
// (Betreuung, Sozialarbeit, Jobcoach, Freiwilligenarbeit) should be able to
// find their own daily work as one group, not hunt across "Personen"/
// "Unterkünfte"/"Monitoring". Wartung/Vorfälle/Regeln moved out of the old
// catch-all "Monitoring" into the role that actually owns them day to day;
// Statistiken folded into Wohnen (occupancy/placement reporting is a housing
// concern) rather than staying its own single-item "Monitoring" group.
// Lernen/Freiwilligenarbeit share one group since both are a resident's
// development work outside the roof over their head. Deliberately NOT called
// "Soziales" — the resident form has its own "Soziales" section (a different
// concept: that resident's own social factors) and two same-named things on
// one screen is confusing for staff, not just ambiguous for a test selector
// — "Konflikte" is also the more accurate name for what this group actually
// holds (incidents, house rules), not general social-work administration.
//
// There is no item-count budget to "fit". These render as a vertical panel
// (`AdminSidebar`), so the budget is the page's height and the panel scrolls
// itself. Add a mission area here without checking whether it fits a viewport.
//
// This used to be a horizontal megamenu, and the note here explained the
// scroll container and edge-fade affordance that kept a ROW from spilling into
// the user menu. That whole apparatus is gone; a column does not need it.
export const MEGAMENU_GROUPS: MegaMenuGroup[] = [
  { href: INBOX_HREF, icon: 'inbox', label: INBOX_LABEL, permission: 'dashboard:read' },
  {
    // People-first: every role lands here. This group is ONLY about the
    // person and the placement decision — everything about buildings and
    // beds lives in "Wohnen" below. It used to be one 9-item dropdown named
    // "Klient*innen" that also held Unterkünfte, Wartung and Statistiken:
    // the label lied about the content, and the list outgrew short viewports.
    // BETREUUNG sees all three; JOBCOACH and SOZIALARBEIT see only /residents.
    label: 'Klient*innen',
    items: [
      // "Alle …", not "Klient*innen" again: an item whose label repeats its own
      // group reads as a broken menu, and gives the reader nothing to choose by.
      // Angaben Klient*innen have entered themselves, awaiting a first look.
      // A noun, not a verb: the group is about the people, and what sits here
      // is their entries — the queue survives whatever we later do with them.
      {
        href: '/approvals',
        icon: 'clipboard',
        label: 'Freigaben',
        desc: 'Selbst erfasste Angaben prüfen',
        permission: 'clientFacts:read',
      },
      {
        href: '/residents',
        icon: 'users',
        label: 'Alle Klient*innen',
        desc: 'Übersicht & Karten-Board',
        permission: 'residents:read',
      },
      {
        href: '/residents/new',
        icon: 'user-plus',
        label: 'Neue*r Klient*in',
        desc: 'Person erfassen',
        permission: 'residents:write',
      },
      {
        href: '/matching',
        icon: 'puzzle',
        label: 'Matching',
        desc: 'Passende Unterkunft finden',
        permission: 'placements:write',
      },
    ],
  },
  {
    // The roof: units, occupancy, moves, repairs, and the reporting on all
    // of it. Mirrors AOZ's own split between Betreuung (people work) and the
    // Fachbereiche Wohnen/Immobilienverwaltung (building work).
    label: 'Wohnen',
    items: [
      {
        href: '/housing',
        icon: 'building',
        label: 'Unterkünfte',
        desc: 'Alle Wohneinheiten',
        permission: 'housing:read',
      },
      {
        href: '/housing/new',
        icon: 'house-plus',
        label: 'Neue Unterkunft',
        desc: 'Einheit hinzufügen',
        permission: 'housing:write',
      },
      {
        href: '/placements',
        icon: 'clipboard',
        label: 'Platzierungen',
        desc: 'Aktive Belegung',
        permission: 'placements:read',
      },
      {
        href: '/transfer-requests',
        icon: 'transfer',
        label: 'Verlegungsanfragen',
        desc: 'Anfragen prüfen & genehmigen',
        permission: 'placements:write',
      },
      {
        href: '/maintenance',
        icon: 'wrench',
        label: 'Wartung',
        desc: 'Reparaturen & Meldungen',
        permission: 'maintenance:read',
      },
    ],
  },
  {
    // Named "Gemeinschaft" on BOTH sides of the product, matching the portal
    // group of the same name. Staff and residents talking about the same
    // surface with two different words is how a shared vocabulary rots — and
    // "Alltag" had stopped describing the contents anyway.
    label: 'Gemeinschaft',
    items: [
      {
        href: '/chores',
        icon: 'calendar',
        label: 'Aufgaben',
        desc: 'Haushaltsaufgaben & Rotation',
        permission: 'housing:read',
      },
      {
        href: '/marketplace',
        icon: 'shop',
        label: 'Marktplatz',
        desc: 'Sachen & Hilfe unter Klient*innen',
        permission: 'marketplace:read',
      },
      {
        href: '/events',
        icon: 'event',
        label: 'Veranstaltungen',
        desc: 'Hausversammlungen & Events',
        permission: 'events:read',
      },
    ],
  },
  {
    label: 'Konflikte',
    items: [
      {
        href: '/incidents',
        icon: 'alert',
        label: 'Vorfälle',
        desc: 'Konflikte & Meldungen',
        permission: 'incidents:read',
      },
      {
        href: '/rules',
        icon: 'scroll',
        label: 'Regeln',
        desc: 'Hausregeln & Beschlüsse',
        permission: 'housing:read',
      },
    ],
  },
  // Lernen, Jobcoaching und Freiwilligenarbeit — the integration domain.
  //
  // This was once a three-item dropdown whose entries were
  // `/learning?board=overview`, `?board=job` and `?board=volunteering`: the
  // same page three times, competing with the board switcher that page already
  // renders. It was collapsed to a single top-level link, and the lesson still
  // holds — a menu must not offer tabs of one page as if they were places.
  //
  // A group is right again now that there are genuinely TWO destinations:
  // `/learning` is the record of what people have DONE, `/opportunities` the
  // directory of what they could do next and who is going. Different
  // questions, different pages.
  //
  // Keeping both at top level instead is what forced this: measured at
  // 1280px as Leitung, a second top-level entry pushed the nav 90px past its
  // container (0px without it) — re-breaking the fit that #86 fixed, on the
  // widest role, which is the one that sees every item.
  {
    label: 'Integration',
    items: [
      {
        href: '/learning',
        icon: 'learning',
        label: LEARNING_AREA_NAME,
        desc: 'Kurse, Sprachtests & Nachweise',
        permission: 'learning:read',
      },
      {
        href: '/opportunities',
        icon: 'opportunities',
        label: OPPORTUNITY_AREA_NAME,
        desc: 'Freiwilligenarbeit & Einsätze',
        permission: 'opportunities:read',
      },
      // Moved out of "Alltag": a curated catalogue of external sport, language,
      // culture and family offers is the integration domain, not the daily
      // running of a house. It reads on `activities:read` rather than
      // `residents:write`, which had shut out precisely the two roles whose job
      // this is — JOBCOACH and FREIWILLIGENARBEIT.
      {
        href: '/activities',
        icon: 'heart',
        label: 'Aktivitäten',
        desc: 'Externe Angebote fürs Portal',
        permission: 'activities:read',
      },
    ],
  },
  // Top level, and no longer inside "Wohnen".
  //
  // It sat there while it was purely housing reporting. It is not any more:
  // /analytics now renders the viewer's OWN domain KPIs, and for a Jobcoach or
  // a Freiwilligenarbeit coordinator the housing half is not even fetched. A
  // cross-cutting page filed under one mission area is mislabelled for every
  // other one.
  //
  // It was also the only survivor of "Wohnen" for those two roles — every other
  // item there needs `housing:read`, which they do not hold — so the group
  // rendered as an accordion named for the roof over someone's head containing
  // a single reporting link. Moving it fixes the label and empties the group in
  // the same stroke.
  { href: '/analytics', icon: 'chart', label: 'Statistiken', permission: 'dashboard:read' },
  { href: '/messages', icon: 'message', label: 'Nachrichten', permission: 'messages:read' },
]

function itemVisible(item: MegaMenuDropdownItem, viewer: StaffCapabilities): boolean {
  if (item.permission && !hasPermission(viewer, item.permission)) return false
  if (item.feature && !BRAND.features[item.feature]) return false
  return true
}

export function visibleMegaMenuGroups(viewer: StaffCapabilities): MegaMenuGroup[] {
  return MEGAMENU_GROUPS.flatMap((group): MegaMenuGroup[] => {
    if ('href' in group) {
      if (group.permission && !hasPermission(viewer, group.permission)) return []
      return [group]
    }
    const items = group.items.filter((item) => itemVisible(item, viewer))
    if (items.length === 0) return []

    // One survivor is a LINK, not an accordion.
    //
    // `AdminSidebar.test.tsx` has forbidden one-item accordions since the
    // sidebar shipped — but only for ADMIN, the one viewer for whom no group is
    // ever near-empty. Walked live on 2026-09-03, Simon (JOBCOACH) had THREE:
    // "Klient*innen" holding only "Alle Klient*innen", "Konflikte" holding only
    // "Vorfälle", and "Wohnen" holding only "Statistiken". Sandra had the same.
    // A rule enforced against the one role it cannot fire for is not enforced.
    //
    // The item's own label wins, because it names the destination — "Vorfälle"
    // rather than a "Konflikte" heading you must open to discover holds exactly
    // Vorfälle. The permission travels with it so the flattened entry keeps the
    // same boundary it had inside the group.
    if (items.length === 1) {
      const [only] = items
      return [{ label: only.label, href: only.href, icon: only.icon, permission: only.permission }]
    }

    return [{ ...group, items }]
  })
}

// =============================================================================
// PORTAL NAV (resident-facing)
// =============================================================================

/**
 * The resident portal's information architecture.
 *
 * THE RULE, and it is the whole reason this was rewritten: **a group is named
 * for what it IS, never for what you DO there.** A verb heading breaks the day
 * its verb is feature-flagged away, silently, with everything still green.
 *
 * That is not hypothetical — it shipped. The group was called "Zusammen
 * entscheiden" and held Regeln, Nachrichten, Melden and Meine Meldungen,
 * because `householdVotes: false` on the AOZ brand removed Abstimmen, the one
 * item that justified the name, and the heading stayed. A resident on the AOZ
 * deployment opened a menu that offered to let them decide together and found
 * nothing to decide.
 *
 * Two more had drifted the same way by content rather than by flag:
 * "Integration & Beruf" held the flea market and house parties, and "Alltag"
 * held housing administration (browse units, request a transfer).
 *
 * So each group now answers one question a resident actually arrives with:
 *   living      — the roof over my head and running this household
 *   community   — the people I live with
 *   concerns    — I raised something; where did it go
 *   integration — where I am going next
 *   account     — me and this app
 *
 * `portal-nav-groups.test.ts` holds the line: every group must survive every
 * brand's feature flags with at least two items, because a one-item accordion
 * is a link wearing a hat.
 */
export type PortalNavGroup = 'living' | 'community' | 'concerns' | 'integration' | 'account'

export const PORTAL_NAV_GROUP_ORDER: readonly PortalNavGroup[] = [
  'living',
  'community',
  'concerns',
  'integration',
  'account',
]

export interface PortalNavItem {
  href: string
  /** Label is resolved at render time from PORTAL_LABELS.nav, not hard-coded
   *  here, to keep the labels SSOT intact. The key indexes into that object. */
  labelKey:
    | 'overview'
    | 'messages'
    | 'apartment'
    | 'expenses'
    | 'roommates'
    | 'chores'
    | 'housing'
    | 'activities'
    | 'report'
    | 'reports'
    | 'complaints'
    | 'preferences'
    | 'profile'
    | 'help'
    | 'transfer'
    | 'rules'
    | 'decisions'
    | 'learning'
    | 'opportunities'
    | 'marketplace'
    | 'events'
    | 'documents'
  icon: keyof typeof NAV_ICONS
  primary?: boolean
  tab?: 1 | 2 | 3 | 4
  /** AOZ tab bar: Übersicht, Melden, Regeln, Hilfe. */
  aozTab?: 1 | 2 | 3 | 4
  group: PortalNavGroup
  requiresFeature?: keyof BrandFeatures
}

/**
 * Destinations that still exist as routes (old bookmarks, redirects) but must
 * not appear in any menu. A page without a real job is worse than a missing
 * page — "Unsere Wohnung" and "Mitbewohner" were diagrams and generic tips
 * with no resident profiles behind them.
 */
export const PORTAL_NAV_HIDDEN_ROUTES = ['/portal/apartment', '/portal/roommates'] as const

/** Sidebar / Mehr sheet: the work of living here. Account lives in the header. */
export const PORTAL_SIDEBAR_GROUPS: readonly PortalNavGroup[] = [
  'living',
  'community',
  'concerns',
  'integration',
]

/**
 * Destinations the sidebar pins above the groups instead of filing inside one.
 *
 * "Übersicht" is where every group sends you back to; burying it as the first
 * child of "Wohnen" made the way home depend on which accordion happened to be
 * open. It keeps its `group` for the pillar directory and the tab bar — this
 * list only changes where the SIDEBAR draws it.
 */
export const PORTAL_SIDEBAR_PINNED: readonly string[] = ['/portal']

export const PORTAL_NAV_ITEMS: PortalNavItem[] = [
  // Wohnen — the roof over my head, and running this household.
  {
    href: '/portal',
    labelKey: 'overview',
    icon: 'home',
    primary: true,
    tab: 1,
    aozTab: 1,
    group: 'living',
  },
  {
    href: '/portal/chores',
    labelKey: 'chores',
    icon: 'calendar',
    primary: true,
    tab: 2,
    group: 'living',
  },
  {
    href: '/portal/expenses',
    labelKey: 'expenses',
    icon: 'wallet',
    primary: true,
    tab: 3,
    group: 'living',
    requiresFeature: 'householdMoney',
  },
  { href: '/portal/housing', labelKey: 'housing', icon: 'house-plus', group: 'living' },
  { href: '/portal/transfer', labelKey: 'transfer', icon: 'transfer', group: 'living' },
  // Gemeinschaft — the people I live with. A noun, so losing `decisions` to a
  // brand flag leaves the heading true instead of leaving it a broken promise.
  { href: '/portal/events', labelKey: 'events', icon: 'event', group: 'community' },
  { href: '/portal/marketplace', labelKey: 'marketplace', icon: 'shop', group: 'community' },
  {
    href: '/portal/rules',
    labelKey: 'rules',
    icon: 'scroll',
    primary: true,
    aozTab: 3,
    group: 'community',
  },
  {
    href: '/portal/decisions',
    labelKey: 'decisions',
    icon: 'vote',
    primary: true,
    group: 'community',
    requiresFeature: 'householdVotes',
  },
  // Anliegen — I raised something; where did it go. Messages belong here and
  // not under "community": the thread is with STAFF, not with the household.
  {
    href: '/portal/report',
    labelKey: 'report',
    icon: 'alert',
    primary: true,
    aozTab: 2,
    group: 'concerns',
  },
  { href: '/portal/reports', labelKey: 'reports', icon: 'clipboard', group: 'concerns' },
  // Objecting to the organisation belongs beside "where did my report go" —
  // it is the same question a resident arrives with, pointed the other way.
  { href: '/portal/complaints', labelKey: 'complaints', icon: 'scroll', group: 'concerns' },
  {
    href: '/portal/messages',
    labelKey: 'messages',
    icon: 'message',
    primary: true,
    group: 'concerns',
  },
  // Integration — where I am going next. Activities (sport, language, culture,
  // family support) are external offers that build a life here, which is this
  // question and not "Alltag".
  {
    href: '/portal/learning',
    labelKey: 'learning',
    icon: 'learning',
    primary: true,
    tab: 4,
    group: 'integration',
  },
  {
    href: '/portal/opportunities',
    labelKey: 'opportunities',
    icon: 'opportunities',
    group: 'integration',
  },
  { href: '/portal/activities', labelKey: 'activities', icon: 'heart', group: 'integration' },
  // Mein Konto — me and this app.
  { href: '/portal/profile', labelKey: 'profile', icon: 'settings', group: 'account' },
  // The facts you used to have to ask your Betreuerin for. Filed under the
  // group about YOU rather than under Wohnen: an insurance and a permit belong
  // to the person and follow them between flats.
  { href: '/portal/unterlagen', labelKey: 'documents', icon: 'clipboard', group: 'account' },
  { href: '/portal/preferences', labelKey: 'preferences', icon: 'wrench', group: 'account' },
  { href: '/portal/help', labelKey: 'help', icon: 'help', aozTab: 4, group: 'account' },
]

const AOZ_PRIMARY_HREFS = new Set([
  '/portal',
  '/portal/report',
  '/portal/rules',
  '/portal/help',
  '/portal/transfer',
])

export function visiblePortalNavItems(): PortalNavItem[] {
  return PORTAL_NAV_ITEMS.filter(
    (item) => !item.requiresFeature || BRAND.features[item.requiresFeature],
  )
}

export function portalTabItems(): PortalNavItem[] {
  const items = visiblePortalNavItems()
  if (isAozSurface()) {
    return items
      .filter((item) => item.aozTab !== undefined)
      .sort((a, b) => (a.aozTab ?? 0) - (b.aozTab ?? 0))
  }
  return items.filter((item) => item.tab !== undefined).sort((a, b) => (a.tab ?? 0) - (b.tab ?? 0))
}

export function portalPrimaryItems(): PortalNavItem[] {
  const items = visiblePortalNavItems()
  if (isAozSurface()) {
    return items.filter((item) => AOZ_PRIMARY_HREFS.has(item.href))
  }
  return items.filter((item) => item.primary)
}

/** The bottom-bar destinations, in the order they are pinned. WG default. */
export const PORTAL_TAB_ITEMS: PortalNavItem[] = PORTAL_NAV_ITEMS.filter(
  (item) => item.tab !== undefined,
).sort((a, b) => (a.tab ?? 0) - (b.tab ?? 0))

export function portalSidebarItems(): PortalNavItem[] {
  return visiblePortalNavItems().filter((item) => PORTAL_SIDEBAR_GROUPS.includes(item.group))
}

export function portalAccountItems(): PortalNavItem[] {
  return visiblePortalNavItems().filter((item) => item.group === 'account')
}
