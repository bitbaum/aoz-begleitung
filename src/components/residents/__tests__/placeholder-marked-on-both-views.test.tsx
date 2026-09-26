import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

import { render, screen } from '@testing-library/react'

import { ClientBoard, type ClientBoardItem } from '../ClientBoard'

/**
 * The "Platzhalter" marker has to be on the view staff actually open.
 *
 * WHAT HAPPENED. The marker was added to `ResidentsList`, its own tests went
 * green, typecheck went green, it deployed — and on the live site the seeded
 * profiles showed no marker at all. `/residents` has TWO layouts and the page
 * reads `params.layout || 'board'`, so the default is `ClientBoard`;
 * `ResidentsList` is the other one, reachable only via `?layout=list`. A
 * marker on the screen nobody opens is not a marker.
 *
 * TWO THINGS HID IT, and both are worth naming:
 *
 * 1. The page maps rows with `(residents as any[])`. That cast switches off
 *    precisely the protection `isPlaceholder: boolean` was made REQUIRED for,
 *    so `ClientBoardItem` could go without the field and still compile.
 * 2. `ClientBoard` had no test file at all, while the non-default view had a
 *    thorough one. Coverage sat on the surface that mattered less.
 *
 * Found by logging into the live product as staff and grepping the rendered
 * HTML for the word — not by any check in this repo.
 */

const ROOT = join(__dirname, '..', '..', '..', '..')

function client(overrides: Partial<ClientBoardItem> & { id: string }): ClientBoardItem {
  return {
    code: `KL-${overrides.id}`,
    displayName: null,
    isPlaceholder: false,
    ageRange: 'ADULT',
    gender: 'PREFER_NOT_SAY',
    status: 'PLACED',
    supportLevel: 'STANDARD',
    languages: [],
    createdAt: new Date('2026-09-08'),
    placements: [],
    careSeats: [],
    careAttributes: [],
    incidentCount: 0,
    daysSinceCheckIn: null,
    checkInIntervalDays: 30,
    isMyClient: false,
    ...overrides,
  }
}

function board(clients: ClientBoardItem[]) {
  render(
    <ClientBoard clients={clients} viewerRole="BETREUUNG" filter="all" baseHref="/residents" />,
  )
}

describe('the default board marks a placeholder', () => {
  it('marks a seeded profile', () => {
    board([client({ id: 'p1', displayName: 'Amir', isPlaceholder: true })])
    expect(screen.getByText('Platzhalter')).toBeInTheDocument()
  })

  it('leaves a real client unmarked', () => {
    board([client({ id: 'r1', displayName: 'Hana', isPlaceholder: false })])
    expect(screen.queryByText('Platzhalter')).not.toBeInTheDocument()
  })

  it('marks only the seeded one when both are shown', () => {
    board([
      client({ id: 'r1', displayName: 'Hana', isPlaceholder: false }),
      client({ id: 'p1', displayName: 'Amir', isPlaceholder: true }),
    ])
    expect(screen.getAllByText('Platzhalter')).toHaveLength(1)
  })
})

describe('both layouts carry it', () => {
  const source = (relative: string) => readFileSync(join(ROOT, relative), 'utf8')

  it('the board and the list both render the marker', () => {
    // The rule, not the instance: /residents has two layouts and a seeded
    // profile must be identifiable on EITHER. Adding a third view means
    // adding it here too.
    for (const file of [
      'src/components/residents/ClientBoard.tsx',
      'src/components/residents/ResidentsList.tsx',
    ]) {
      expect(source(file)).toMatch(/isPlaceholder\s*&&/)
      expect(source(file)).toMatch(/RESIDENT_LIST_LABELS\.placeholder/)
    }
  })

  it('the page feeds the field to the board it casts to any', () => {
    // The cast cannot be relied on to carry it, so the mapping names it.
    expect(source('src/app/(admin)/residents/page.tsx')).toMatch(
      /isPlaceholder:\s*r\.isPlaceholder/,
    )
  })
})
