import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'

import { PortalQuickActions } from '../PortalQuickActions'
import { availableLocales, createTranslator, type LocaleId } from '@/lib/i18n'

/**
 * The "Jetzt" card must not invent a task.
 *
 * WHAT SHIPPED: with no chores open, the card rendered
 *
 *     JETZT / Präferenzen / Nächste Aufgabe
 *
 * — the chores branch's description left on a card that links to the
 * preferences form. A resident with nothing to do was told a task was waiting,
 * and sent to a settings page to look for it. In all six offered languages.
 *
 * Found by reading the operator's own dashboard on the live instance. It never
 * appeared in a walkthrough because the DEMO resident always has a chore, so
 * the branch that renders for a real, quiet caseload was the one branch nobody
 * looked at.
 *
 * On a quiet day "nothing is open" is the entire value of this card, and it is
 * worth nothing unless it is true.
 */

let mockLocale: LocaleId = 'de'

vi.mock('@/lib/i18n/request', () => ({
  getRequestTranslator: async () => ({
    t: createTranslator(mockLocale),
    locale: mockLocale,
  }),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

async function renderCard(pendingChoresCount: number, locale: LocaleId = 'de') {
  mockLocale = locale
  render(await PortalQuickActions({ pendingChoresCount }))
}

/** Every language a resident can actually select. */
const LOCALES = availableLocales().map((locale) => locale.id)

describe('with a chore open', () => {
  it('names the chore count and links to the chore list', async () => {
    await renderCard(2)

    expect(screen.getByText('Aufgaben')).toBeInTheDocument()
    expect(screen.getByText('2 Aufgaben')).toBeInTheDocument()
    expect(screen.getAllByRole('link').at(0)).toHaveAttribute('href', '/portal/chores')
  })

  it('uses the singular for exactly one', async () => {
    await renderCard(1)
    expect(screen.getByText('1 Aufgabe')).toBeInTheDocument()
  })
})

describe('with nothing open', () => {
  it('says nothing is open, in the reader’s language', async () => {
    for (const locale of LOCALES) {
      const t = createTranslator(locale)
      const { unmount } = render(
        await (async () => {
          mockLocale = locale
          return PortalQuickActions({ pendingChoresCount: 0 })
        })(),
      )

      expect(screen.getByText(t('dashboard.nothingDue'))).toBeInTheDocument()
      expect(screen.getByText(t('dashboard.nothingDueDesc'))).toBeInTheDocument()
      unmount()
    }
  })

  it('does not announce a task', async () => {
    // The defect in one assertion. "Nächste Aufgabe" beside "Präferenzen" told
    // a resident with an empty list that something was waiting for them.
    await renderCard(0)

    expect(screen.queryByText('Nächste Aufgabe')).not.toBeInTheDocument()
    expect(screen.getByText('Nichts offen')).toBeInTheDocument()
  })

  it('does not make the settings form the primary action', async () => {
    await renderCard(0)

    // The big card is the chore list — empty, and honestly so. Preferences is
    // optional, and keeps its own button in the row beside it.
    expect(screen.getAllByRole('link').at(0)).toHaveAttribute('href', '/portal/chores')
    expect(
      screen
        .getAllByRole('link')
        .filter((link) => link.getAttribute('href') === '/portal/preferences'),
    ).toHaveLength(1)
  })

  it('offers the same three side actions as a busy day', async () => {
    // The primary used to swallow one of them by pointing at the same href,
    // so the quiet dashboard silently had one button fewer than the busy one.
    await renderCard(0)
    const quiet = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    screen.getByText('Nichts offen')

    expect(quiet).toEqual([
      '/portal/chores',
      '/portal/report',
      '/portal/learning',
      '/portal/preferences',
    ])
  })
})

describe('the dead key is gone', () => {
  it('no dictionary still carries dashboard.nextDesc', async () => {
    // It described the chores branch and was rendered only by the branch that
    // has no chores. A string kept "just in case" is how the next reuse starts.
    const { getDictionary } = await import('@/lib/i18n')
    for (const locale of LOCALES) {
      expect(Object.keys(getDictionary(locale))).not.toContain('dashboard.nextDesc')
    }
  })
})
