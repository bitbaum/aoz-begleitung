import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AIChatInterface } from '../AIChatInterface'

vi.mock('@/lib/constants/labels', async () => ({
  UI_LABELS: {
    aiChatPlaceholder: 'Frage stellen…',
    aiChatSend: 'Senden',
    sendMessage: 'Nachricht senden',
  },
  AI_ASSISTANT_LABELS: {
    componentTitle: 'KI-Assistent für AOZ',
    componentSubtitle: 'Stellen Sie Fragen zu Bewohnern…',
  },
  AI_SUGGESTED_QUESTIONS: ['Frage 1', 'Frage 2'],
}))

vi.mock('lucide-react', async () => ({
  Send: () => <svg data-testid="send-icon" />,
  Bot: () => <svg data-testid="bot-icon" />,
  User: () => <svg data-testid="user-icon" />,
  Loader2: () => <svg data-testid="loader-icon" />,
}))

const mockFetch = vi.fn()

beforeAll(() => {
  global.fetch = mockFetch
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.clearAllMocks()
})

function makeMockReader(chunks: string[]) {
  // Buffer.from() is always available (Node.js global); TextEncoder is NOT in jsdom globals.
  // Buffer extends Uint8Array so TextDecoder.decode(buffer) works correctly.
  let i = 0
  return {
    cancel: vi.fn(async () => {}),
    releaseLock: vi.fn(),
    read: vi.fn().mockImplementation(async () => {
      if (i < chunks.length) {
        return { done: false as const, value: Buffer.from(chunks[i++]) }
      }
      return { done: true as const, value: undefined }
    }),
  }
}

function makeStreamResponse(chunks: string[]) {
  return { ok: true, status: 200, body: { getReader: () => makeMockReader(chunks) } }
}

const sseText = (text: string) => `data: ${JSON.stringify({ type: 'text', text })}\n\n`
const sseError = (message: string) => `data: ${JSON.stringify({ type: 'error', message })}\n\n`

// Drain the entire microtask chain (fetch → reader.read() × N → setMessages) plus flush React.
// The macrotask (setTimeout) fires after ALL pending microtasks, so streaming is done by then.
// Putting BOTH the trigger AND the drain inside one act() ensures React tracks all state updates.
function sendKeyAndFlush(textarea: HTMLElement) {
  return act(async () => {
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

function clickAndFlush(el: HTMLElement) {
  return act(async () => {
    fireEvent.click(el)
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('AIChatInterface — empty state', () => {
  it('shows title and subtitle', () => {
    render(<AIChatInterface />)
    expect(screen.getByText('KI-Assistent für AOZ')).toBeInTheDocument()
    expect(screen.getByText('Stellen Sie Fragen zu Bewohnern…')).toBeInTheDocument()
  })

  it('renders suggested question buttons', () => {
    render(<AIChatInterface />)
    expect(screen.getByRole('button', { name: 'Frage 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Frage 2' })).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    render(<AIChatInterface />)
    expect(screen.getByRole('button', { name: 'Nachricht senden' })).toBeDisabled()
  })

  it('textarea has correct placeholder', () => {
    render(<AIChatInterface />)
    expect(screen.getByPlaceholderText('Frage stellen…')).toBeInTheDocument()
  })
})

// ─── Input interaction ────────────────────────────────────────────────────────

describe('AIChatInterface — input interaction', () => {
  it('send button enables when text is typed', async () => {
    render(<AIChatInterface />)
    await userEvent.type(screen.getByPlaceholderText('Frage stellen…'), 'Hallo')
    expect(screen.getByRole('button', { name: 'Nachricht senden' })).not.toBeDisabled()
  })

  it('Shift+Enter does not submit', async () => {
    render(<AIChatInterface />)
    await userEvent.type(screen.getByPlaceholderText('Frage stellen…'), 'Hallo')
    fireEvent.keyDown(screen.getByPlaceholderText('Frage stellen…'), {
      key: 'Enter',
      shiftKey: true,
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('Enter on empty/whitespace input does not submit', () => {
    render(<AIChatInterface />)
    fireEvent.keyDown(screen.getByPlaceholderText('Frage stellen…'), {
      key: 'Enter',
      shiftKey: false,
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ─── Message sending ──────────────────────────────────────────────────────────

describe('AIChatInterface — message sending', () => {
  it('appends user message immediately and clears input', async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse([]))
    render(<AIChatInterface />)
    const textarea = screen.getByPlaceholderText('Frage stellen…')
    await userEvent.type(textarea, 'Meine Frage')
    await sendKeyAndFlush(textarea)

    expect(screen.getByText('Meine Frage')).toBeInTheDocument()
    expect(textarea).toHaveValue('')
  })

  it('hides empty state once a message is sent', async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse([]))
    render(<AIChatInterface />)
    const textarea = screen.getByPlaceholderText('Frage stellen…')
    await userEvent.type(textarea, 'Hi')
    await sendKeyAndFlush(textarea)

    expect(screen.queryByText('KI-Assistent für AOZ')).not.toBeInTheDocument()
  })

  it('clicking a suggested question sends it', async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse([]))
    render(<AIChatInterface />)
    await clickAndFlush(screen.getByRole('button', { name: 'Frage 1' }))

    expect(screen.getByText('Frage 1')).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ai/chat',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('send button click triggers fetch', async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse([]))
    render(<AIChatInterface />)
    await userEvent.type(screen.getByPlaceholderText('Frage stellen…'), 'Hallo')
    await clickAndFlush(screen.getByRole('button', { name: 'Nachricht senden' }))

    expect(mockFetch).toHaveBeenCalled()
  })

  it('includes full message history in request body', async () => {
    mockFetch
      .mockResolvedValueOnce(makeStreamResponse([sseText('R1')]))
      .mockResolvedValueOnce(makeStreamResponse([sseText('R2')]))
    render(<AIChatInterface />)

    await userEvent.type(screen.getByPlaceholderText('Frage stellen…'), 'Q1')
    await sendKeyAndFlush(screen.getByPlaceholderText('Frage stellen…'))
    expect(screen.getByText('R1')).toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText('Frage stellen…'), 'Q2')
    await sendKeyAndFlush(screen.getByPlaceholderText('Frage stellen…'))
    expect(screen.getByText('R2')).toBeInTheDocument()

    const secondPayload = JSON.parse(mockFetch.mock.calls[1][1].body)
    expect(secondPayload.messages).toHaveLength(3)
    expect(secondPayload.messages[0]).toEqual({ role: 'user', content: 'Q1' })
    expect(secondPayload.messages[1]).toEqual({ role: 'assistant', content: 'R1' })
    expect(secondPayload.messages[2]).toEqual({ role: 'user', content: 'Q2' })
  })
})

// ─── Streaming ────────────────────────────────────────────────────────────────
// Exercise the actual shared reader and components, including split network events.

describe('AIChatInterface — streaming', () => {
  it('shows loader spinner while waiting for first chunk', async () => {
    let resolveRead!: (v: { done: boolean; value: undefined }) => void
    const pending = new Promise<{ done: boolean; value: undefined }>((r) => {
      resolveRead = r
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn().mockReturnValue(pending),
          cancel: vi.fn(async () => {}),
          releaseLock: vi.fn(),
        }),
      },
    })
    render(<AIChatInterface />)
    await userEvent.type(screen.getByPlaceholderText('Frage stellen…'), 'Hi')
    fireEvent.keyDown(screen.getByPlaceholderText('Frage stellen…'), {
      key: 'Enter',
      shiftKey: false,
    })

    await waitFor(() => expect(screen.getByText('Daten werden abgerufen…')).toBeInTheDocument())
    await act(async () => {
      resolveRead({ done: true, value: undefined })
    })
  })

  it('preserves SSE events split across network chunks', async () => {
    const frame = sseText('Grüezi Welt')
    mockFetch.mockResolvedValueOnce(
      makeStreamResponse([frame.slice(0, 9), frame.slice(9, 23), frame.slice(23)]),
    )
    render(<AIChatInterface />)
    const textarea = screen.getByPlaceholderText('Frage stellen…')
    await userEvent.type(textarea, 'Hi')
    await sendKeyAndFlush(textarea)
    expect(screen.getByText('Grüezi Welt')).toBeInTheDocument()
  })

  it('accumulates SSE text events into final assistant message', async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse([sseText('Hallo '), sseText('Welt')]))
    render(<AIChatInterface />)
    const textarea = screen.getByPlaceholderText('Frage stellen…')
    await userEvent.type(textarea, 'Hi')
    await sendKeyAndFlush(textarea)

    expect(screen.getByText('Hallo Welt')).toBeInTheDocument()
  })

  it('SSE error event uses event.message as response content', async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse([sseError('Server-Fehler aufgetreten.')]))
    render(<AIChatInterface />)
    const textarea = screen.getByPlaceholderText('Frage stellen…')
    await userEvent.type(textarea, 'Hi')
    await sendKeyAndFlush(textarea)

    expect(screen.getByRole('alert')).toHaveTextContent('Server-Fehler aufgetreten.')
  })

  it('skips malformed SSE JSON without crashing', async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse(['data: {bad json}\n\n', sseText('Ok')]))
    render(<AIChatInterface />)
    const textarea = screen.getByPlaceholderText('Frage stellen…')
    await userEvent.type(textarea, 'Hi')
    await sendKeyAndFlush(textarea)

    expect(screen.getByText('Ok')).toBeInTheDocument()
  })

  it('ignores non-data SSE lines', async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse(['event: ping\n', sseText('Pong')]))
    render(<AIChatInterface />)
    const textarea = screen.getByPlaceholderText('Frage stellen…')
    await userEvent.type(textarea, 'Hi')
    await sendKeyAndFlush(textarea)

    expect(screen.getByText('Pong')).toBeInTheDocument()
  })

  it('keeps the next draft editable and offers Stop while streaming', async () => {
    let resolveRead!: (v: { done: boolean; value: undefined }) => void
    const pending = new Promise<{ done: boolean; value: undefined }>((r) => {
      resolveRead = r
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn().mockReturnValue(pending),
          cancel: vi.fn(async () => {}),
          releaseLock: vi.fn(),
        }),
      },
    })
    render(<AIChatInterface />)
    await userEvent.type(screen.getByPlaceholderText('Frage stellen…'), 'Hi')
    fireEvent.keyDown(screen.getByPlaceholderText('Frage stellen…'), {
      key: 'Enter',
      shiftKey: false,
    })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Frage stellen…')).not.toBeDisabled()
      expect(screen.getByRole('button', { name: 'Antwort stoppen' })).toBeEnabled()
    })
    await userEvent.type(screen.getByPlaceholderText('Frage stellen…'), 'Nächste Frage')
    await userEvent.click(screen.getByRole('button', { name: 'Antwort stoppen' }))
    expect(mockFetch.mock.calls[0][1].signal.aborted).toBe(true)
    await act(async () => {
      resolveRead({ done: true, value: undefined })
    })
    expect(screen.getByPlaceholderText('Frage stellen…')).toHaveValue('Nächste Frage')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// ─── Error handling ───────────────────────────────────────────────────────────

describe('AIChatInterface — error handling', () => {
  // The component surfaces the most specific message it has — the server's own
  // error body, then the HTTP status, then the thrown error's message — and
  // reserves the generic fallback for errors that carry no message at all.

  it('surfaces the server error message on an HTTP error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'KI-Dienst nicht erreichbar' }),
      body: null,
    })
    render(<AIChatInterface />)
    const textarea = screen.getByPlaceholderText('Frage stellen…')
    await userEvent.type(textarea, 'Hi')
    await sendKeyAndFlush(textarea)
    expect(screen.getByRole('alert')).toHaveTextContent('KI-Dienst nicht erreichbar')
  })

  it('surfaces the HTTP status when the error body is unreadable', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, body: null })
    render(<AIChatInterface />)
    const textarea = screen.getByPlaceholderText('Frage stellen…')
    await userEvent.type(textarea, 'Hi')
    await sendKeyAndFlush(textarea)
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 500')
  })

  it('surfaces the error message on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))
    render(<AIChatInterface />)
    const textarea = screen.getByPlaceholderText('Frage stellen…')
    await userEvent.type(textarea, 'Hi')
    await sendKeyAndFlush(textarea)
    expect(screen.getByRole('alert')).toHaveTextContent('Network failure')
  })

  it('shows an error when the response has no body', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, body: null })
    render(<AIChatInterface />)
    const textarea = screen.getByPlaceholderText('Frage stellen…')
    await userEvent.type(textarea, 'Hi')
    await sendKeyAndFlush(textarea)
    expect(screen.getByRole('alert')).toHaveTextContent(/\S/)
  })

  it('re-enables input after error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'))
    render(<AIChatInterface />)
    const textarea = screen.getByPlaceholderText('Frage stellen…')
    await userEvent.type(textarea, 'Hi')
    await sendKeyAndFlush(textarea)
    expect(screen.getByPlaceholderText('Frage stellen…')).not.toBeDisabled()
  })
})

// ─── MessageBubble ────────────────────────────────────────────────────────────

describe('AIChatInterface — MessageBubble', () => {
  it('renders the user turn through ChatKit', async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse([]))
    render(<AIChatInterface />)
    const textarea = screen.getByPlaceholderText('Frage stellen…')
    await userEvent.type(textarea, 'User text')
    await sendKeyAndFlush(textarea)

    const bubble = screen.getByText('User text').closest('.ck-turn-user')
    expect(bubble).not.toBeNull()
  })

  it('renders the assistant turn through ChatKit', async () => {
    mockFetch.mockResolvedValueOnce(makeStreamResponse([sseText('Antwort')]))
    render(<AIChatInterface />)
    const textarea = screen.getByPlaceholderText('Frage stellen…')
    await userEvent.type(textarea, 'Hi')
    await sendKeyAndFlush(textarea)

    const bubble = screen.getByText('Antwort').closest('.ck-turn-answer')
    expect(bubble).not.toBeNull()
  })
})

it('retries a failed turn without duplicating the user message or sending the error to the model', async () => {
  mockFetch
    .mockRejectedValueOnce(new Error('Network failure'))
    .mockResolvedValueOnce(makeStreamResponse([sseText('Erfolgreiche Antwort')]))
  render(<AIChatInterface />)
  const textarea = screen.getByPlaceholderText('Frage stellen…')
  await userEvent.type(textarea, 'Meine Frage')
  await sendKeyAndFlush(textarea)
  await clickAndFlush(screen.getByRole('button', { name: 'Erneut versuchen' }))
  expect(screen.getByText('Erfolgreiche Antwort')).toBeInTheDocument()
  expect(JSON.parse(mockFetch.mock.calls[1][1].body).messages).toEqual([
    { role: 'user', content: 'Meine Frage' },
  ])
})
