/**
 * One catalogue of places a person can go, across two pages.
 *
 * The staff nav has ONE entry for it and claims /activities through
 * `activeFor`. That claim is only honest while the tab strip that entry opens
 * on really links to /activities — this pins it.
 */

import { MEGAMENU_GROUPS } from '../navigation'
import { ACTIVITIES_TAB_ID, catalogueTabs } from '../catalogue'
import { INTEGRATION_BOARD_IDS } from '../integration-boards'

const boardHref = (board: string) => `/opportunities?board=${board}`

describe('catalogue tabs', () => {
  it('offers every listings board and then the activities page', () => {
    const tabs = catalogueTabs({ boardHref, canReadListings: true, canReadActivities: true })
    expect(tabs.map((tab) => tab.id)).toEqual([...INTEGRATION_BOARD_IDS, ACTIVITIES_TAB_ID])
    expect(tabs.at(-1)?.href).toBe('/activities')
  })

  it('backs every route the catalogue nav entry claims with a tab', () => {
    const entry = MEGAMENU_GROUPS.find(
      (group) => 'href' in group && group.href === '/opportunities',
    )
    const claimed = entry && 'href' in entry ? (entry.activeFor ?? []) : []
    const tabs = catalogueTabs({ boardHref, canReadListings: true, canReadActivities: true })
    expect(claimed).toContain('/activities')
    for (const route of claimed) {
      expect(tabs.some((tab) => tab.href === route)).toBe(true)
    }
  })

  it('never offers a tab the viewer may not open', () => {
    expect(
      catalogueTabs({ boardHref, canReadListings: false, canReadActivities: true }).map(
        (tab) => tab.id,
      ),
    ).toEqual([ACTIVITIES_TAB_ID])
    expect(
      catalogueTabs({ boardHref, canReadListings: true, canReadActivities: false }).map(
        (tab) => tab.id,
      ),
    ).toEqual([...INTEGRATION_BOARD_IDS])
  })
})
