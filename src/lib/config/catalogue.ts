/**
 * The catalogue of places a person can go — one control across two pages.
 *
 * Staff think "what can I offer this person?", not "is that an Opportunity or
 * an Activity row?". The two stay separate pages because they are separate
 * things (a listing has applicants, seats and a permit route; an activity is a
 * pointer to somebody else's offer), but they are reached from ONE nav entry
 * and switched with ONE tab strip, so the split is ours to know, not theirs.
 *
 * The listing halves reuse the integration boards, so a coach still opens on
 * the half their role works in. @see config/integration-boards.ts
 */

import type { BoardSwitcherItem } from '@/components/ui/BoardSwitcher'
import { OPPORTUNITIES_ADMIN_LABELS } from '@/lib/constants/labels/opportunities'
import { INTEGRATION_BOARD_IDS, type IntegrationBoardId } from './integration-boards'

export const ACTIVITIES_TAB_ID = 'activities'
export type CatalogueTabId = IntegrationBoardId | typeof ACTIVITIES_TAB_ID

/** The board names are the listings page's own; only the fourth tab is new. */
export const CATALOGUE_TAB_LABELS: Record<CatalogueTabId, string> = {
  ...OPPORTUNITIES_ADMIN_LABELS.boards,
  activities: 'Aktivitäten',
}

/**
 * The tabs this viewer may open, in order. `boardHref` builds a listings-board
 * link (the listings page keeps its own filters when switching); activities is
 * a page of its own and only offered to someone who may read it.
 */
export function catalogueTabs(options: {
  boardHref: (board: IntegrationBoardId) => string
  canReadListings: boolean
  canReadActivities: boolean
}): BoardSwitcherItem[] {
  const tabs: BoardSwitcherItem[] = []
  if (options.canReadListings) {
    for (const id of INTEGRATION_BOARD_IDS) {
      tabs.push({ id, label: CATALOGUE_TAB_LABELS[id], href: options.boardHref(id) })
    }
  }
  if (options.canReadActivities) {
    tabs.push({
      id: ACTIVITIES_TAB_ID,
      label: CATALOGUE_TAB_LABELS.activities,
      href: '/activities',
    })
  }
  return tabs
}
