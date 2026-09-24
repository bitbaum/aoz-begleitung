/**
 * Navigation configuration - SSOT for all nav items and icons
 */

import { LEARNING_AREA_NAME } from './learning'

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
      /**
       * Other routes this entry stands for, so it stays highlighted there — a
       * single entry for a catalogue that spans two pages.
       */
      activeFor?: readonly string[]
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

/** One entry for every place a person can go. @see config/catalogue.ts */
export const CATALOGUE_LABEL = 'Einsatzplätze & Angebote'

/** Attach the waiting count to the Eingang entry; other entries are untouched. */
export function withInboxBadge(groups: MegaMenuGroup[], count: number | null): MegaMenuGroup[] {
  return groups.map((group) =>
    'href' in group && group.href === INBOX_HREF ? { ...group, badge: count } : group,
  )
}

// The staff navigation. It renders as a vertical panel (`AdminSidebar`), so
// there is no width budget to fit — but there IS an attention budget, and the
// grouping below is spent on that. Deliberately not "Soziales" anywhere: the
// resident form has its own "Soziales" section (that person's social factors),
// and two same-named things on one screen confuse staff.
export const MEGAMENU_GROUPS: MegaMenuGroup[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // PERSON-CENTRED (decided 2026-09-24). The product began as housing
  // placement and grew into accompanying a person — work, volunteering,
  // learning, living together, a roof. The nav used to be sorted by DATA TYPE
  // (Wohnen, Gemeinschaft, Konflikte, Integration…), which made staff translate
  // their question into our filing system. It is now sorted by the two
  // questions staff actually arrive with:
  //
  //   1. "Who is waiting for me?"            → Eingang (the one number)
  //   2. "How is this person doing?"         → Klient*innen
  //
  // and then the three things staff maintain FOR people: places to go
  // (Einsatzplätze & Angebote), a roof (Wohnen), living together
  // (Zusammenleben). Seven entries at most, fewer for every specialist role.
  // ─────────────────────────────────────────────────────────────────────────
  { href: INBOX_HREF, icon: 'inbox', label: INBOX_LABEL, permission: 'dashboard:read' },
  {
    // Everything that is about the PERSON. "Lernen & Beruf" lives here, not
    // with the listings: it is a record of what people have done — progress
    // per person — and a coach opens it to ask about people, not about places.
    label: 'Klient*innen',
    items: [
      // "Alle …", not "Klient*innen" again: an item whose label repeats its own
      // group reads as a broken menu, and gives the reader nothing to choose by.
      {
        href: '/residents',
        icon: 'users',
        label: 'Alle Klient*innen',
        desc: 'Übersicht & Dossiers',
        permission: 'residents:read',
      },
      {
        href: '/residents/new',
        icon: 'user-plus',
        label: 'Neue*r Klient*in',
        desc: 'Person erfassen',
        permission: 'residents:write',
      },
      // Angaben Klient*innen have entered themselves, awaiting a first look.
      {
        href: '/approvals',
        icon: 'clipboard',
        label: 'Freigaben',
        desc: 'Selbst erfasste Angaben prüfen',
        permission: 'clientFacts:read',
      },
      {
        href: '/learning',
        icon: 'learning',
        label: LEARNING_AREA_NAME,
        desc: 'Kurse, Sprachtests & Nachweise pro Person',
        permission: 'learning:read',
      },
    ],
  },
  // ONE catalogue of places a person can go: jobs, internships, volunteering
  // and the external activities offered in the portal. They were three entries
  // (Lernen & Beruf, Einsatzplätze, Aktivitäten) sharing one board switcher,
  // so staff had to know our data model to find an offer. The two pages keep
  // their own routes — an activity has no applicants and no seats — but share
  // one tab strip (config/catalogue.ts) and this one entry, which stays
  // highlighted on both.
  {
    href: '/opportunities',
    icon: 'opportunities',
    label: CATALOGUE_LABEL,
    permission: 'opportunities:read',
    activeFor: ['/activities'],
  },
  {
    // The roof: units, the placement decision, moves and repairs. Matching
    // lives here now — "which home fits this person?" is a housing decision,
    // and it was the one housing verb filed under the people.
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
        href: '/matching',
        icon: 'puzzle',
        label: 'Matching',
        desc: 'Passende Unterkunft finden',
        permission: 'placements:write',
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
    // "Gemeinschaft" and "Konflikte" were two groups about one thing: how the
    // people in a house get on. Conflicts first, because they are the work;
    // the rest is what keeps them rare.
    label: 'Zusammenleben',
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
      {
        href: '/chores',
        icon: 'calendar',
        label: 'Aufgaben',
        desc: 'Haushaltsaufgaben & Rotation',
        permission: 'housing:read',
      },
      {
        href: '/events',
        icon: 'event',
        label: 'Veranstaltungen',
        desc: 'Hausversammlungen & Events',
        permission: 'events:read',
      },
      {
        href: '/marketplace',
        icon: 'shop',
        label: 'Marktplatz',
        desc: 'Sachen & Hilfe unter Klient*innen',
        permission: 'marketplace:read',
      },
    ],
  },
  // Top level, not filed under one area: /analytics renders the viewer's OWN
  // domain KPIs, so filing it under housing mislabels it for everyone else.
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
