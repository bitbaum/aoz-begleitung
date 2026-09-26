/**
 * The person's dossier, in sections.
 *
 * It was one column of about ten cards — placement, matches, check-ins,
 * flatmates, incidents, Einsatzplatz threads, learning records, care team,
 * documents, the care workspace, placement history, the person's own facts —
 * in the order they happened to be added, so every role scrolled past the
 * others' work to find its own. The sections follow the person-centred
 * navigation (config/navigation.ts): the person first, then the places they
 * could go, their roof, and living together.
 *
 * URL-driven (`?tab=`), server-rendered: a section is a link that can be sent
 * to a colleague, and nothing is fetched twice.
 */

import type { StaffRole } from '@/lib/auth/role-policy'

export const DOSSIER_TABS = ['overview', 'integration', 'housing', 'living', 'documents'] as const
export type DossierTab = (typeof DOSSIER_TABS)[number]

export const DOSSIER_TAB_LABELS: Record<DossierTab, string> = {
  overview: 'Übersicht',
  integration: 'Integration',
  housing: 'Wohnen',
  living: 'Zusammenleben',
  documents: 'Unterlagen',
}

/** Where each role's own work on a person lives — the section it opens on. */
export function defaultDossierTab(role: StaffRole): DossierTab {
  if (role === 'JOBCOACH' || role === 'FREIWILLIGENARBEIT') return 'integration'
  if (role === 'LIEGENSCHAFTEN') return 'housing'
  return 'overview'
}

/**
 * The section to show. An explicit, visible `?tab=` wins. A placement action
 * in the URL (`?action=transfer`, the header's "Verlegen") always opens
 * housing, because that is where the action's form is. Otherwise the role's
 * home — or the first visible section if the role's home is not visible.
 */
export function resolveDossierTab(input: {
  tab?: string
  action?: string
  role: StaffRole
  visible: readonly DossierTab[]
}): DossierTab {
  const { tab, action, role, visible } = input
  if (tab && (visible as readonly string[]).includes(tab)) return tab as DossierTab
  if (action && visible.includes('housing')) return 'housing'
  const home = defaultDossierTab(role)
  return visible.includes(home) ? home : (visible[0] ?? 'overview')
}
