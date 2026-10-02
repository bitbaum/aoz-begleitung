import type { Mock } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SatisfactionRating } from '../SatisfactionRating'
import { de } from '@/lib/i18n/dictionaries/de'

// --- Mocks ---

// The scale itself comes from the real module. Restating the faces here made
// this a second definition that could agree with itself while disagreeing with
// what ships — a mock that drifts from its subject tests nothing.
vi.mock('@/lib/constants', async () => ({
  ...(await vi.importActual('@/lib/constants')),
  SATISFACTION_SURVEY_LABELS: {
    saveFailed: 'Speichern fehlgeschlagen. Bitte erneut versuchen.',
    day: 'Tag',
    days: 'Tagen',
    ratings: { bad: 'Schlecht', okay: 'Okay', great: 'Super' },
    commentPrompt: 'Möchten Sie uns mehr erzählen?',
    optional: '(optional)',
    commentPlaceholder: 'Was können wir verbessern?',
    submitting: 'Wird gesendet...',
    submit: 'Absenden',
    submitWithoutComment: 'Ohne Kommentar absenden',
    submitFeedback: 'Feedback absenden',
  },
}))

// --- Helpers ---

function mockFetchSuccess() {
  global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response)
}

function mockFetchFailure() {
  global.fetch = vi.fn().mockResolvedValue({ ok: false } as Response)
}

function mockFetchNetworkError() {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
}

/** Date that is 8 days in the past — triggers the prompt form. */
const OLD_DATE = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
/** Date that is 2 days in the past — suppresses the prompt. */
const RECENT_DATE = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)

// --- Tests ---

describe('SatisfactionRating', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  // ── Prompt mode (no check-in or >= 7 days) ─────────────────────────────

  it('shows the full form when no lastCheckInDate is provided', () => {
    render(<SatisfactionRating />)
    expect(screen.getByText(de['satisfaction.title'])).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sehr unzufrieden' })).toBeInTheDocument()
  })

  it('shows the full form when last check-in was 8+ days ago', () => {
    render(<SatisfactionRating lastCheckInDate={OLD_DATE} />)
    expect(screen.getByText(de['satisfaction.title'])).toBeInTheDocument()
  })

  // ── Compact / recently-checked-in view ─────────────────────────────────

  it('shows compact view when last check-in is recent', () => {
    render(<SatisfactionRating lastCheckInDate={RECENT_DATE} />)
    expect(screen.getByText('Letztes Feedback')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: de['satisfaction.newFeedback'] })).toBeInTheDocument()
    expect(screen.queryByText(de['satisfaction.title'])).not.toBeInTheDocument()
  })

  it('shows "Heute" when last check-in was today', () => {
    const today = new Date(Date.now() - 1000)
    render(<SatisfactionRating lastCheckInDate={today} />)
    expect(screen.getByText('Heute')).toBeInTheDocument()
  })

  it('shows current emoji in compact view when currentRating is provided', () => {
    render(<SatisfactionRating lastCheckInDate={RECENT_DATE} currentRating={5} />)
    expect(screen.getByText('😊')).toBeInTheDocument()
  })

  it('shows full form after clicking "Neues Feedback"', () => {
    render(<SatisfactionRating lastCheckInDate={RECENT_DATE} />)
    fireEvent.click(screen.getByRole('button', { name: de['satisfaction.newFeedback'] }))
    expect(screen.getByText(de['satisfaction.title'])).toBeInTheDocument()
  })

  // ── Rating selection ────────────────────────────────────────────────────

  it('does not show concerns field before any rating is selected', () => {
    render(<SatisfactionRating />)
    expect(screen.queryByText('Möchten Sie uns mehr erzählen?')).not.toBeInTheDocument()
  })

  it('shows concerns field when rating 1 is selected', () => {
    render(<SatisfactionRating />)
    fireEvent.click(screen.getByRole('button', { name: 'Sehr unzufrieden' }))
    expect(screen.getByText('Möchten Sie uns mehr erzählen?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Absenden' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ohne Kommentar absenden' })).toBeInTheDocument()
  })

  it('shows concerns field when rating 2 is selected', () => {
    render(<SatisfactionRating />)
    fireEvent.click(screen.getByRole('button', { name: 'Unzufrieden' }))
    expect(screen.getByText('Möchten Sie uns mehr erzählen?')).toBeInTheDocument()
  })

  it('does not show concerns field for rating 3', () => {
    render(<SatisfactionRating />)
    fireEvent.click(screen.getByRole('button', { name: 'Neutral' }))
    expect(screen.queryByText('Möchten Sie uns mehr erzählen?')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Feedback absenden' })).toBeInTheDocument()
  })

  it('shows single submit button for rating 5', () => {
    render(<SatisfactionRating />)
    fireEvent.click(screen.getByRole('button', { name: 'Sehr zufrieden' }))
    expect(screen.getByRole('button', { name: 'Feedback absenden' })).toBeInTheDocument()
    expect(screen.queryByText('Möchten Sie uns mehr erzählen?')).not.toBeInTheDocument()
  })

  // ── Submission ──────────────────────────────────────────────────────────

  it('shows thank-you view after successful submission for high rating', async () => {
    mockFetchSuccess()
    render(<SatisfactionRating />)

    fireEvent.click(screen.getByRole('button', { name: 'Sehr zufrieden' }))
    fireEvent.click(screen.getByRole('button', { name: 'Feedback absenden' }))

    await waitFor(() => {
      expect(screen.getByText('Danke für Ihr Feedback!')).toBeInTheDocument()
    })
    expect(screen.queryByText(de['satisfaction.title'])).not.toBeInTheDocument()
  })

  it('shows thank-you view after submitting with concerns for low rating', async () => {
    mockFetchSuccess()
    render(<SatisfactionRating />)

    fireEvent.click(screen.getByRole('button', { name: 'Sehr unzufrieden' }))
    fireEvent.change(screen.getByPlaceholderText('Was können wir verbessern?'), {
      target: { value: 'Es ist zu laut' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Absenden' }))

    await waitFor(() => {
      expect(screen.getByText('Danke für Ihr Feedback!')).toBeInTheDocument()
    })
  })

  it('shows concernsForwarded message when low rating submitted with concerns', async () => {
    mockFetchSuccess()
    render(<SatisfactionRating />)

    fireEvent.click(screen.getByRole('button', { name: 'Sehr unzufrieden' }))
    fireEvent.change(screen.getByPlaceholderText('Was können wir verbessern?'), {
      target: { value: 'Es ist zu laut' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Absenden' }))

    await waitFor(() => {
      expect(screen.getByText(de['satisfaction.concernsForwarded'])).toBeInTheDocument()
    })
  })

  it('does not show concernsForwarded when submitted without concerns', async () => {
    mockFetchSuccess()
    render(<SatisfactionRating />)

    fireEvent.click(screen.getByRole('button', { name: 'Sehr unzufrieden' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ohne Kommentar absenden' }))

    await waitFor(() => {
      expect(screen.getByText('Danke für Ihr Feedback!')).toBeInTheDocument()
    })
    expect(screen.queryByText(de['satisfaction.concernsForwarded'])).not.toBeInTheDocument()
  })

  // ── Error handling ──────────────────────────────────────────────────────

  it('shows error alert when fetch returns non-ok response', async () => {
    mockFetchFailure()
    render(<SatisfactionRating />)

    fireEvent.click(screen.getByRole('button', { name: 'Neutral' }))
    fireEvent.click(screen.getByRole('button', { name: 'Feedback absenden' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Speichern fehlgeschlagen. Bitte erneut versuchen.',
      )
    })
    // Form stays visible
    expect(screen.getByText(de['satisfaction.title'])).toBeInTheDocument()
  })

  it('shows error alert on network failure', async () => {
    mockFetchNetworkError()
    render(<SatisfactionRating />)

    fireEvent.click(screen.getByRole('button', { name: 'Sehr zufrieden' }))
    fireEvent.click(screen.getByRole('button', { name: 'Feedback absenden' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Speichern fehlgeschlagen. Bitte erneut versuchen.',
      )
    })
  })

  // ── POST body ───────────────────────────────────────────────────────────

  it('sends rating and no concerns when submitted via high-rating button', async () => {
    mockFetchSuccess()
    render(<SatisfactionRating />)

    fireEvent.click(screen.getByRole('button', { name: 'Zufrieden' }))
    fireEvent.click(screen.getByRole('button', { name: 'Feedback absenden' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    const [url, options] = (global.fetch as Mock).mock.calls[0]
    expect(url).toBe('/api/portal/satisfaction')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body.rating).toBe(4)
    expect(body.concerns).toBeUndefined()
  })

  it('sends rating and trimmed concerns when submitted via low-rating path', async () => {
    mockFetchSuccess()
    render(<SatisfactionRating />)

    fireEvent.click(screen.getByRole('button', { name: 'Unzufrieden' }))
    fireEvent.change(screen.getByPlaceholderText('Was können wir verbessern?'), {
      target: { value: '  Es ist sehr laut  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Absenden' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    const body = JSON.parse((global.fetch as Mock).mock.calls[0][1].body)
    expect(body.rating).toBe(2)
    expect(body.concerns).toBe('Es ist sehr laut')
  })

  it('omits concerns from POST body when "Ohne Kommentar absenden" is clicked', async () => {
    mockFetchSuccess()
    render(<SatisfactionRating />)

    fireEvent.click(screen.getByRole('button', { name: 'Sehr unzufrieden' }))
    fireEvent.change(screen.getByPlaceholderText('Was können wir verbessern?'), {
      target: { value: 'Wird ignoriert' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ohne Kommentar absenden' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    const body = JSON.parse((global.fetch as Mock).mock.calls[0][1].body)
    expect(body.rating).toBe(1)
    expect(body.concerns).toBeUndefined()
  })
})
