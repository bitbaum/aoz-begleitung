/**
 * Navigation configuration - SSOT for all nav items and icons
 */

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
  ScrollText,
  CircleHelp,
  UserPlus,
  HousePlus,
  Wallet,
  Vote,
  MoreHorizontal,
  MessageSquare,
  GraduationCap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { BRAND, isAozSurface, type BrandFeatures } from '@/lib/config/brand'
import { hasPermission, type StaffPermission, type StaffRole } from '@/lib/auth/role-policy'

export const NAV_ICONS: Record<string, LucideIcon> = {
  home: Home,
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
  { href: '/algorithm', icon: 'brain', label: 'Algorithmus', permission: 'system:configure' },
  { href: '/portal/help', icon: 'help', label: 'Hilfe' },
]

export function visibleSystemLinks(role: StaffRole): NavItem[] {
  return SYSTEM_LINKS.filter(
    (item) => !item.permission || hasPermission(role, item.permission)
  )
}

export interface MegaMenuDropdownItem {
  href: string
  icon: keyof typeof NAV_ICONS
  label: string
  desc: string
  permission?: StaffPermission
  feature?: keyof BrandFeatures
}

export type MegaMenuGroup =
  | { label: string; href: string; icon: string; permission?: StaffPermission }
  | { label: string; items: MegaMenuDropdownItem[] }

export const MEGAMENU_GROUPS: MegaMenuGroup[] = [
  { href: '/', icon: 'home', label: 'Dashboard', permission: 'dashboard:read' },
  {
    label: 'Personen',
    items: [
      { href: '/residents', icon: 'users', label: 'Alle Bewohner', desc: 'Bewohnerliste verwalten', permission: 'residents:read' },
      { href: '/residents/new', icon: 'user-plus', label: 'Neuer Bewohner', desc: 'Bewohner erfassen', permission: 'residents:write' },
      { href: '/matching', icon: 'puzzle', label: 'Matching', desc: 'Platzierung finden', permission: 'placements:write' },
      { href: '/learning', icon: 'learning', label: 'Lernen', desc: 'Kurse, Tests, Weiterbildung', permission: 'learning:read' },
      { href: '/transfer-requests', icon: 'transfer', label: 'Verlegungsanfragen', desc: 'Anfragen prüfen & genehmigen', permission: 'placements:write' },
    ],
  },
  {
    label: 'Unterkünfte',
    items: [
      { href: '/housing', icon: 'building', label: 'Alle Einheiten', desc: 'Wohneinheiten verwalten', permission: 'housing:read' },
      { href: '/housing/new', icon: 'house-plus', label: 'Neue Einheit', desc: 'Einheit hinzufügen', permission: 'housing:write' },
      { href: '/placements', icon: 'clipboard', label: 'Platzierungen', desc: 'Aktive Platzierungen', permission: 'placements:read' },
      { href: '/chores', icon: 'calendar', label: 'Aufgaben', desc: 'Haushaltsaufgaben & Regeln', permission: 'housing:read' },
      { href: '/activities', icon: 'heart', label: 'Aktivitäten', desc: 'Angebote fürs Portal verwalten', permission: 'residents:write' },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { href: '/incidents', icon: 'alert', label: 'Vorfälle', desc: 'Konflikte & Wartung', permission: 'incidents:read' },
      { href: '/rules', icon: 'scroll', label: 'Regeln', desc: 'Hausregeln & Beschlüsse', permission: 'housing:read' },
      { href: '/analytics', icon: 'chart', label: 'Statistiken', desc: 'Auswertungen & Berichte', permission: 'dashboard:read' },
      { href: '/maintenance', icon: 'wrench', label: 'Wartung', desc: 'Wartungsaufgaben', permission: 'maintenance:read' },
    ],
  },
  { href: '/messages', icon: 'message', label: 'Nachrichten' },
  { href: '/ai-assistant', icon: 'bot', label: 'KI-Assistent', permission: 'residents:write' },
  // Einstellungen intentionally NOT here — system links live in SYSTEM_LINKS
  // (UserMenu + drawer), keeping the header row to the daily work.
]

function itemVisible(item: MegaMenuDropdownItem, role: StaffRole): boolean {
  if (item.permission && !hasPermission(role, item.permission)) return false
  if (item.feature && !BRAND.features[item.feature]) return false
  return true
}

export function visibleMegaMenuGroups(role: StaffRole): MegaMenuGroup[] {
  return MEGAMENU_GROUPS.flatMap((group): MegaMenuGroup[] => {
    if ('href' in group) {
      if (group.permission && !hasPermission(role, group.permission)) return []
      return [group]
    }
    const items = group.items.filter((item) => itemVisible(item, role))
    if (items.length === 0) return []
    return [{ ...group, items }]
  })
}

// =============================================================================
// PORTAL NAV (resident-facing)
// =============================================================================

export type PortalNavGroup = 'living' | 'together' | 'integration' | 'account'

export const PORTAL_NAV_GROUP_ORDER: readonly PortalNavGroup[] = [
  'living',
  'together',
  'integration',
  'account',
]

export interface PortalNavItem {
  href: string
  /** Label is resolved at render time from PORTAL_LABELS.nav, not hard-coded
   *  here, to keep the labels SSOT intact. The key indexes into that object. */
  labelKey: 'overview' | 'messages' | 'apartment' | 'expenses' | 'roommates' | 'chores' | 'housing' | 'activities' | 'report' | 'reports' | 'preferences' | 'profile' | 'help' | 'transfer' | 'rules' | 'decisions' | 'learning'
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
  'together',
  'integration',
]

export const PORTAL_NAV_ITEMS: PortalNavItem[] = [
  // Alltag — the daily routine of living here + city activities
  { href: '/portal', labelKey: 'overview', icon: 'home', primary: true, tab: 1, aozTab: 1, group: 'living' },
  { href: '/portal/chores', labelKey: 'chores', icon: 'calendar', primary: true, tab: 2, group: 'living' },
  { href: '/portal/expenses', labelKey: 'expenses', icon: 'wallet', primary: true, tab: 3, group: 'living', requiresFeature: 'householdMoney' },
  { href: '/portal/housing', labelKey: 'housing', icon: 'house-plus', group: 'living' },
  { href: '/portal/transfer', labelKey: 'transfer', icon: 'transfer', group: 'living' },
  { href: '/portal/activities', labelKey: 'activities', icon: 'heart', group: 'living' },
  // Miteinander — shared life, rules, reporting
  { href: '/portal/rules', labelKey: 'rules', icon: 'scroll', primary: true, aozTab: 3, group: 'together' },
  { href: '/portal/decisions', labelKey: 'decisions', icon: 'vote', primary: true, group: 'together', requiresFeature: 'householdVotes' },
  { href: '/portal/messages', labelKey: 'messages', icon: 'message', primary: true, group: 'together' },
  { href: '/portal/report', labelKey: 'report', icon: 'alert', primary: true, aozTab: 2, group: 'together' },
  { href: '/portal/reports', labelKey: 'reports', icon: 'clipboard', group: 'together' },
  // Integration & Beruf — language, courses, volunteering, qualifications (Jobcoach domain)
  { href: '/portal/learning', labelKey: 'learning', icon: 'learning', primary: true, tab: 4, group: 'integration' },
  // Account
  { href: '/portal/profile', labelKey: 'profile', icon: 'settings', group: 'account' },
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
    (item) => !item.requiresFeature || BRAND.features[item.requiresFeature]
  )
}

export function portalTabItems(): PortalNavItem[] {
  const items = visiblePortalNavItems()
  if (isAozSurface()) {
    return items
      .filter((item) => item.aozTab !== undefined)
      .sort((a, b) => (a.aozTab ?? 0) - (b.aozTab ?? 0))
  }
  return items
    .filter((item) => item.tab !== undefined)
    .sort((a, b) => (a.tab ?? 0) - (b.tab ?? 0))
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
  (item) => item.tab !== undefined
).sort((a, b) => (a.tab ?? 0) - (b.tab ?? 0))

export function portalSidebarItems(): PortalNavItem[] {
  return visiblePortalNavItems().filter((item) =>
    PORTAL_SIDEBAR_GROUPS.includes(item.group)
  )
}

export function portalAccountItems(): PortalNavItem[] {
  return visiblePortalNavItems().filter((item) => item.group === 'account')
}
