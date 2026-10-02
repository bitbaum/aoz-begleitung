import type { Mock } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TransferRequestForm } from '../TransferRequestForm'

const TRANSFER_COPY: Record<string, string> = {
  'transfer.subtitle': 'Möchten Sie in eine andere Unterkunft wechseln?',
  'transfer.reasonLabel': 'Warum möchten Sie verlegt werden?',
  'transfer.reasonPlaceholder': 'Beschreibe den Grund...',
  'transfer.targetUnitLabel': 'Wunsch-Unterkunft (optional)',
  'transfer.targetUnitPlaceholder': 'Keine Präferenz',
  'transfer.submit': 'Anfrage senden',
  'transfer.submitting': 'Wird gesendet...',
  'transfer.successTitle': 'Anfrage gesendet',
  'transfer.successMessage': 'Ihre Verlegungsanfrage wurde erfolgreich eingereicht.',
  'transfer.successNextStepsTitle': 'Wie geht es weiter?',
  'transfer.successNextStep1': 'Schritt 1',
  'transfer.successNextStep2': 'Schritt 2',
  'transfer.successNextStep3': 'Schritt 3',
  'transfer.successToMessages': 'Nachricht an die Betreuung',
  'transfer.successToOverview': 'Zur Übersicht',
  'transfer.currentUnit': 'Aktuelle Unterkunft',
  'error.generic': 'Ein Fehler ist aufgetreten. Bitte erneut versuchen.',
}

vi.mock('@/lib/i18n/LocaleProvider', async () => ({
  useT: () => (key: string) => TRANSFER_COPY[key] ?? key,
}))

// --- Helpers ---

const DEFAULT_PROPS = {
  availableUnits: [],
}

const AVAILABLE_UNITS = [
  { id: 'unit-1', code: 'A01', address: 'Teststrasse 1' },
  { id: 'unit-2', code: 'B02', address: 'Musterweg 5' },
]

function mockFetchSuccess() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  } as Response)
}

function mockFetchApiError(message = 'Anfrage ungültig') {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ success: false, error: message }),
  } as Response)
}

function mockFetchNetworkError() {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
}

// --- Tests ---

describe('TransferRequestForm', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders the form with reason textarea and submit button', () => {
    render(<TransferRequestForm {...DEFAULT_PROPS} />)

    expect(screen.getByLabelText('Warum möchten Sie verlegt werden?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anfrage senden' })).toBeInTheDocument()
  })

  it('shows current unit info when provided', () => {
    render(
      <TransferRequestForm
        currentUnit={{ code: 'C03', address: 'Hauptstrasse 10' }}
        availableUnits={[]}
      />,
    )

    expect(screen.getByText('Aktuelle Unterkunft')).toBeInTheDocument()
    expect(screen.getByText('C03 — Hauptstrasse 10')).toBeInTheDocument()
  })

  it('does not render target unit selector when no units available', () => {
    render(<TransferRequestForm {...DEFAULT_PROPS} />)

    expect(screen.queryByLabelText('Wunsch-Unterkunft (optional)')).not.toBeInTheDocument()
  })

  it('renders target unit selector when available units provided', () => {
    render(<TransferRequestForm availableUnits={AVAILABLE_UNITS} />)

    expect(screen.getByLabelText('Wunsch-Unterkunft (optional)')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'A01 — Teststrasse 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'B02 — Musterweg 5' })).toBeInTheDocument()
  })

  it('submit button is disabled when reason is empty', () => {
    render(<TransferRequestForm {...DEFAULT_PROPS} />)
    expect(screen.getByRole('button', { name: 'Anfrage senden' })).toBeDisabled()
  })

  it('submit button is disabled when reason is fewer than 10 characters', () => {
    render(<TransferRequestForm {...DEFAULT_PROPS} />)

    fireEvent.change(screen.getByLabelText('Warum möchten Sie verlegt werden?'), {
      target: { value: 'Zu kurz' },
    })

    expect(screen.getByRole('button', { name: 'Anfrage senden' })).toBeDisabled()
  })

  it('submit button is enabled when reason is at least 10 characters', () => {
    render(<TransferRequestForm {...DEFAULT_PROPS} />)

    fireEvent.change(screen.getByLabelText('Warum möchten Sie verlegt werden?'), {
      target: { value: 'Langer genug Grund' },
    })

    expect(screen.getByRole('button', { name: 'Anfrage senden' })).toBeEnabled()
  })

  it('shows pending label while submitting and re-enables on success', async () => {
    mockFetchSuccess()
    render(<TransferRequestForm {...DEFAULT_PROPS} />)

    fireEvent.change(screen.getByLabelText('Warum möchten Sie verlegt werden?'), {
      target: { value: 'Ich brauche mehr Ruhe' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Anfrage senden' }).closest('form')!)

    expect(await screen.findByRole('button', { name: 'Wird gesendet...' })).toBeDisabled()
    expect(await screen.findByText('Anfrage gesendet')).toBeInTheDocument()
  })

  it('shows success view after successful submit', async () => {
    mockFetchSuccess()
    render(<TransferRequestForm {...DEFAULT_PROPS} />)

    fireEvent.change(screen.getByLabelText('Warum möchten Sie verlegt werden?'), {
      target: { value: 'Ich brauche mehr Ruhe' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Anfrage senden' }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('Anfrage gesendet')).toBeInTheDocument()
      expect(
        screen.getByText('Ihre Verlegungsanfrage wurde erfolgreich eingereicht.'),
      ).toBeInTheDocument()
    })

    expect(screen.queryByLabelText('Warum möchten Sie verlegt werden?')).not.toBeInTheDocument()
  })

  it('shows API error message on failed response', async () => {
    mockFetchApiError('Bereits eine offene Anfrage vorhanden')
    render(<TransferRequestForm {...DEFAULT_PROPS} />)

    fireEvent.change(screen.getByLabelText('Warum möchten Sie verlegt werden?'), {
      target: { value: 'Ich brauche mehr Ruhe' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Anfrage senden' }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('Bereits eine offene Anfrage vorhanden')).toBeInTheDocument()
    })

    // Form stays visible after error
    expect(screen.getByLabelText('Warum möchten Sie verlegt werden?')).toBeInTheDocument()
  })

  it('shows generic error on network failure', async () => {
    mockFetchNetworkError()
    render(<TransferRequestForm {...DEFAULT_PROPS} />)

    fireEvent.change(screen.getByLabelText('Warum möchten Sie verlegt werden?'), {
      target: { value: 'Ich brauche mehr Ruhe' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Anfrage senden' }).closest('form')!)

    await waitFor(() => {
      expect(
        screen.getByText('Ein Fehler ist aufgetreten. Bitte erneut versuchen.'),
      ).toBeInTheDocument()
    })
  })

  it('sends reason in POST body', async () => {
    mockFetchSuccess()
    render(<TransferRequestForm {...DEFAULT_PROPS} />)

    const reason = 'Ich brauche mehr Ruhe und Privatsphäre'
    fireEvent.change(screen.getByLabelText('Warum möchten Sie verlegt werden?'), {
      target: { value: reason },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Anfrage senden' }).closest('form')!)

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    const [url, options] = (global.fetch as Mock).mock.calls[0]
    expect(url).toBe('/api/portal/transfer')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body)
    expect(body.reason).toBe(reason)
    expect(body.targetUnitId).toBeUndefined()
  })

  it('includes targetUnitId in POST body when a unit is selected', async () => {
    mockFetchSuccess()
    render(<TransferRequestForm availableUnits={AVAILABLE_UNITS} />)

    fireEvent.change(screen.getByLabelText('Warum möchten Sie verlegt werden?'), {
      target: { value: 'Wunsch nach Wechsel in ruhigere Unterkunft' },
    })
    fireEvent.change(screen.getByLabelText('Wunsch-Unterkunft (optional)'), {
      target: { value: 'unit-2' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Anfrage senden' }).closest('form')!)

    await waitFor(() => expect(global.fetch as Mock).toHaveBeenCalledTimes(1))

    const body = JSON.parse((global.fetch as Mock).mock.calls[0][1].body)
    expect(body.targetUnitId).toBe('unit-2')
  })
})
