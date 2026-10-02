import type { Mock } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChoreActions } from '../ChoreActions'

// --- Mocks ---

vi.mock('@/lib/config/household-tasks', async () => ({
  CHORE_LABELS: {
    actions: {
      complete: 'Erledigt!',
      completing: 'Wird gespeichert...',
      request: 'Anfragen',
      attention: 'Aufmerksamkeit',
      complaint: 'Problem melden',
    },
    complete: {
      title: 'Aufgabe erledigt',
      notes: 'Notizen (optional)',
      notesPlaceholder: 'Was haben Sie gemacht?',
      duration: 'Dauer in Minuten (optional)',
    },
    request: {
      title: 'Hilfe anfragen',
      selectRoommate: 'Mitbewohner auswählen',
      broadcast: 'Alle fragen',
      broadcastDesc: 'Anfrage an alle Mitbewohner senden',
      message: 'Nachricht (optional)',
      messagePlaceholder: 'z.B. Könnten Sie das heute machen?',
      submit: 'Anfrage senden',
      submitting: 'Wird gesendet...',
    },
    attention: {
      title: 'Aufmerksamkeit nötig',
      message: 'Nachricht (optional)',
      messagePlaceholder: 'z.B. Das Bad ist schmutzig...',
      submit: 'Markieren',
      submitting: 'Wird markiert...',
    },
    complaint: {
      title: 'Problem mit Aufgabe melden',
      description: 'Beschreibe das Problem',
      descriptionPlaceholder: 'z.B. Mitbewohner macht nie sauber...',
      submit: 'Problem melden',
      submitting: 'Wird gemeldet...',
      note: 'Ihre Meldung wird an die Hausverwaltung weitergeleitet.',
    },
    success: {
      completed: 'Aufgabe als erledigt markiert!',
      requested: 'Anfrage gesendet!',
      flagged: 'Aufmerksamkeit markiert!',
      complained: 'Problem wurde gemeldet.',
    },
    errors: {
      generic: 'Ein Fehler ist aufgetreten. Bitte erneut versuchen.',
    },
  },
}))

vi.mock('@/lib/constants/labels', async () => ({
  UI_LABELS: { close: 'Schliessen' },
}))

const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', async () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

// --- Helpers ---

const TASK_ID = 'task-abc-123'
const ROOMMATES = [
  { id: 'res-1', code: 'R001', displayName: null },
  { id: 'res-2', code: 'R002', displayName: null },
]

function mockFetchSuccess() {
  global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response)
}

function mockFetchApiError(message = 'Ungültige Anfrage') {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: message }),
  } as unknown as Response)
}

function mockFetchNetworkError() {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
}

// --- Tests ---

describe('ChoreActions', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  // ── Initial state ───────────────────────────────────────────────────────

  it('renders the four action buttons', () => {
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)

    expect(screen.getByRole('button', { name: /Erledigt/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Anfragen/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aufmerksamkeit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Problem melden/i })).toBeInTheDocument()
  })

  it('does not show any modal initially', () => {
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)
    expect(screen.queryByText('Aufgabe erledigt')).not.toBeInTheDocument()
  })

  // ── Modal open / close ──────────────────────────────────────────────────

  it('opens the complete modal when the complete button is clicked', () => {
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /Erledigt/i }))
    expect(screen.getByText('Aufgabe erledigt')).toBeInTheDocument()
    expect(screen.getByText('Notizen (optional)')).toBeInTheDocument()
  })

  it('opens the request modal and shows roommates', () => {
    render(<ChoreActions taskId={TASK_ID} roommates={ROOMMATES} />)
    fireEvent.click(screen.getByRole('button', { name: /Anfragen/i }))
    expect(screen.getByText('Hilfe anfragen')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'R001' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'R002' })).toBeInTheDocument()
  })

  it('opens the attention modal', () => {
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /Aufmerksamkeit/i }))
    expect(screen.getByText('Aufmerksamkeit nötig')).toBeInTheDocument()
  })

  it('opens the complaint modal', () => {
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /Problem melden/i }))
    expect(screen.getByText('Problem mit Aufgabe melden')).toBeInTheDocument()
    expect(
      screen.getByText('Ihre Meldung wird an die Hausverwaltung weitergeleitet.'),
    ).toBeInTheDocument()
  })

  it('closes the modal when the ✕ button is clicked', () => {
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /Erledigt/i }))
    expect(screen.getByText('Aufgabe erledigt')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Schliessen' }))
    expect(screen.queryByText('Aufgabe erledigt')).not.toBeInTheDocument()
  })

  // ── Complete action ─────────────────────────────────────────────────────

  it('submits complete action to correct endpoint', async () => {
    mockFetchSuccess()
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /Erledigt/i }))
    fireEvent.submit(screen.getByRole('button', { name: 'Erledigt!' }).closest('form')!)

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [url, options] = (global.fetch as Mock).mock.calls[0]
    expect(url).toBe(`/api/portal/chores/${TASK_ID}/complete`)
    expect(options.method).toBe('POST')
  })

  it('shows success message and calls router.refresh() after complete', async () => {
    mockFetchSuccess()
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /Erledigt/i }))
    fireEvent.submit(screen.getByRole('button', { name: 'Erledigt!' }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Aufgabe als erledigt markiert!')
    })
    expect(mockRefresh).toHaveBeenCalled()
    // Modal closes on success
    expect(screen.queryByText('Aufgabe erledigt')).not.toBeInTheDocument()
  })

  it('includes notes in complete POST body', async () => {
    mockFetchSuccess()
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /Erledigt/i }))
    fireEvent.change(screen.getByPlaceholderText('Was haben Sie gemacht?'), {
      target: { value: 'Sehr gründlich geputzt' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Erledigt!' }).closest('form')!)

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const body = JSON.parse((global.fetch as Mock).mock.calls[0][1].body)
    expect(body.notes).toBe('Sehr gründlich geputzt')
  })

  // ── Request action ──────────────────────────────────────────────────────

  it('submits request action to correct endpoint', async () => {
    mockFetchSuccess()
    render(<ChoreActions taskId={TASK_ID} roommates={ROOMMATES} />)

    fireEvent.click(screen.getByRole('button', { name: /Anfragen/i }))
    fireEvent.submit(screen.getByRole('button', { name: 'Anfrage senden' }).closest('form')!)

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [url] = (global.fetch as Mock).mock.calls[0]
    expect(url).toBe(`/api/portal/chores/${TASK_ID}/request`)
  })

  it('includes selected roommate in request POST body', async () => {
    mockFetchSuccess()
    render(<ChoreActions taskId={TASK_ID} roommates={ROOMMATES} />)

    fireEvent.click(screen.getByRole('button', { name: /Anfragen/i }))
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'res-2' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Anfrage senden' }).closest('form')!)

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const body = JSON.parse((global.fetch as Mock).mock.calls[0][1].body)
    expect(body.requestedResidentId).toBe('res-2')
  })

  it('shows success status after request is sent', async () => {
    mockFetchSuccess()
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /Anfragen/i }))
    fireEvent.submit(screen.getByRole('button', { name: 'Anfrage senden' }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Anfrage gesendet!')
    })
  })

  // ── Attention action ────────────────────────────────────────────────────

  it('submits attention action to correct endpoint', async () => {
    mockFetchSuccess()
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /Aufmerksamkeit/i }))
    fireEvent.submit(screen.getByRole('button', { name: 'Markieren' }).closest('form')!)

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [url] = (global.fetch as Mock).mock.calls[0]
    expect(url).toBe(`/api/portal/chores/${TASK_ID}/attention`)
  })

  it('shows success status after attention is flagged', async () => {
    mockFetchSuccess()
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /Aufmerksamkeit/i }))
    fireEvent.submit(screen.getByRole('button', { name: 'Markieren' }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Aufmerksamkeit markiert!')
    })
  })

  // ── Complaint action ────────────────────────────────────────────────────

  it('submits complaint action to correct endpoint', async () => {
    mockFetchSuccess()
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /Problem melden/i }))
    fireEvent.change(screen.getByPlaceholderText('z.B. Mitbewohner macht nie sauber...'), {
      target: { value: 'Niemand putzt das Bad' },
    })
    fireEvent.submit(
      screen.getByRole('button', { name: 'Problem melden', hidden: true }).closest('form')!,
    )

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [url, options] = (global.fetch as Mock).mock.calls[0]
    expect(url).toBe(`/api/portal/chores/${TASK_ID}/complaint`)
    const body = JSON.parse(options.body)
    expect(body.description).toBe('Niemand putzt das Bad')
  })

  // ── Error handling ──────────────────────────────────────────────────────

  it('shows API error message in alert when fetch returns non-ok', async () => {
    mockFetchApiError('Bereits abgeschlossen')
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /Erledigt/i }))
    fireEvent.submit(screen.getByRole('button', { name: 'Erledigt!' }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Bereits abgeschlossen')
    })
  })

  it('shows generic error on network failure', async () => {
    mockFetchNetworkError()
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)

    fireEvent.click(screen.getByRole('button', { name: /Erledigt/i }))
    fireEvent.submit(screen.getByRole('button', { name: 'Erledigt!' }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Ein Fehler ist aufgetreten. Bitte erneut versuchen.',
      )
    })
  })

  it('clears previous success message when reopening a modal', async () => {
    mockFetchSuccess()
    render(<ChoreActions taskId={TASK_ID} roommates={[]} />)

    // First: complete successfully
    fireEvent.click(screen.getByRole('button', { name: /Erledigt/i }))
    fireEvent.submit(screen.getByRole('button', { name: 'Erledigt!' }).closest('form')!)
    await waitFor(() => screen.getByRole('status'))

    // Second: open another action — success message should be gone
    fireEvent.click(screen.getByRole('button', { name: /Aufmerksamkeit/i }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
