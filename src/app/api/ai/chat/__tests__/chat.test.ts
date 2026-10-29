/**
 * Tests for POST /api/ai/chat
 *
 * Covers: auth guard, API key guard, schema validation, and SSE streaming.
 */

const mockGetCurrentUser = vi.fn()
vi.mock('@/lib/auth', async () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}))

const mockHasAIProvider = vi.fn()
vi.mock('@/lib/ai/provider', async () => ({
  hasAIProvider: (...args: unknown[]) => mockHasAIProvider(...args),
}))

const mockRunStaffChat = vi.fn()
vi.mock('@/lib/ai/staff-chat', async () => ({
  runStaffChat: (...args: unknown[]) => mockRunStaffChat(...args),
}))

import { POST } from '../route'

const STAFF_USER = {
  id: 'user-1',
  name: 'Test Mitarbeiter',
  email: 'test@aoz.ch',
  role: 'ADMIN' as const,
  scope: 'ALL_DOMAINS' as const,
  isSystemAdmin: true,
}

const VALID_BODY = {
  messages: [{ role: 'user', content: 'Wie viele Bewohner sind im System?' }],
}

function makeRequest(body: unknown, contentType = 'application/json'): Request {
  return new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body: JSON.stringify(body),
  })
}

async function readStream(res: Response): Promise<string> {
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
  }
  return text
}

describe('POST /api/ai/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHasAIProvider.mockReturnValue(false)
  })

  test('returns 503 when no fleet AI key is configured', async () => {
    const res = await POST(makeRequest(VALID_BODY))

    expect(res.status).toBe(503)
    const body = await res.json()
    // German, and addressed to the caseworker reading it. It used to name
    // GROQ_API_KEY, OPENROUTER_API_KEY and docs/INFRASTRUCTURE.md — telling a
    // social worker to edit an env file they have no access to.
    expect(body.error).toMatch(/nicht eingerichtet/)
    expect(body.error).not.toMatch(/API_KEY|docs\//)
  })

  test('returns 401 when user is not authenticated', async () => {
    mockHasAIProvider.mockReturnValue(true)
    mockGetCurrentUser.mockResolvedValue(null)

    const res = await POST(makeRequest(VALID_BODY))

    expect(res.status).toBe(401)
  })

  test('returns 400 for malformed JSON body', async () => {
    mockHasAIProvider.mockReturnValue(true)
    mockGetCurrentUser.mockResolvedValue(STAFF_USER)

    const req = new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'this is not json',
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  test('returns 400 when messages field is missing', async () => {
    mockHasAIProvider.mockReturnValue(true)
    mockGetCurrentUser.mockResolvedValue(STAFF_USER)

    const res = await POST(makeRequest({ notMessages: [] }))
    expect(res.status).toBe(400)
  })

  test('returns 400 when a message has an invalid role', async () => {
    mockHasAIProvider.mockReturnValue(true)
    mockGetCurrentUser.mockResolvedValue(STAFF_USER)

    const res = await POST(
      makeRequest({
        messages: [{ role: 'system', content: 'hi' }],
      }),
    )
    expect(res.status).toBe(400)
  })

  test('streams SSE text chunks and done event', async () => {
    mockHasAIProvider.mockReturnValue(true)
    mockGetCurrentUser.mockResolvedValue(STAFF_USER)
    mockRunStaffChat.mockResolvedValue('Es gibt 42 Bewohner.')

    const res = await POST(makeRequest(VALID_BODY))

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/event-stream')

    const text = await readStream(res)
    expect(text).toContain('"type":"text"')
    expect(text).toContain('42')
    expect(text).toContain('"type":"done"')
    expect(mockRunStaffChat).toHaveBeenCalledWith(VALID_BODY.messages, expect.any(AbortSignal))
  })

  test('cancelling the response aborts the pending assistant operation', async () => {
    mockHasAIProvider.mockReturnValue(true)
    mockGetCurrentUser.mockResolvedValue(STAFF_USER)
    let operationSignal: AbortSignal | undefined
    mockRunStaffChat.mockImplementationOnce((_turns, signal: AbortSignal) => {
      operationSignal = signal
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    })
    const res = await POST(makeRequest(VALID_BODY))
    await res.body!.cancel()
    expect(operationSignal?.aborted).toBe(true)
  })

  test('streams a readable German error, never the vendor body', async () => {
    mockHasAIProvider.mockReturnValue(true)
    mockGetCurrentUser.mockResolvedValue(STAFF_USER)

    // The real thing Groq returns, organisation id and all.
    const { AIProviderError } = await import('@/lib/ai/errors')
    mockRunStaffChat.mockRejectedValue(
      new AIProviderError(
        'groq',
        429,
        JSON.stringify({
          error: {
            message:
              'Rate limit reached for model `openai/gpt-oss-120b` in organization ' +
              '`org_01jy16rk1yffks8jdsmfn4s7rj` on tokens per minute (TPM): Limit 8000. ' +
              'Please try again in 13.17s.',
            type: 'tokens',
            code: 'rate_limit_exceeded',
          },
        }),
      ),
    )

    const res = await POST(makeRequest(VALID_BODY))
    const text = await readStream(res)

    expect(text).toContain('"type":"error"')
    // This assertion used to be `toContain('429')`, which is precisely how the
    // vendor's JSON — including the org id — reached a caseworker's screen.
    expect(text).toMatch(/ausgelastet/)
    expect(text).not.toContain('org_01jy16rk1yffks8jdsmfn4s7rj')
    expect(text).not.toContain('gpt-oss-120b')
    expect(text).not.toContain('TPM')
  })
})
