/**
 * The fleet AI provider seam.
 *
 * Groq → OpenRouter. No Anthropic on the box.
 */

const ORIGINAL_ENV = process.env

async function loadProvider(env: Record<string, string | undefined>) {
  vi.resetModules()
  process.env = {
    ...ORIGINAL_ENV,
    GROQ_API_KEY: undefined,
    OPENROUTER_API_KEY: undefined,
    ANTHROPIC_API_KEY: undefined,
    ...env,
  }
  return import('../provider')
}

afterEach(() => {
  process.env = ORIGINAL_ENV
  vi.restoreAllMocks()
})

describe('which provider a completion uses', () => {
  it('uses Groq when only a Groq key is set', async () => {
    const { getAIProvider, hasAIProvider } = await loadProvider({ GROQ_API_KEY: 'gsk_test' })
    expect(getAIProvider()).toBe('groq')
    expect(hasAIProvider()).toBe(true)
  })

  it('uses OpenRouter when only an OpenRouter key is set', async () => {
    const { getAIProvider } = await loadProvider({ OPENROUTER_API_KEY: 'sk-or-test' })
    expect(getAIProvider()).toBe('openrouter')
  })

  it('prefers Groq when both fleet keys are set', async () => {
    const { getAIProvider } = await loadProvider({
      GROQ_API_KEY: 'gsk_test',
      OPENROUTER_API_KEY: 'sk-or-test',
    })
    expect(getAIProvider()).toBe('groq')
  })

  it('reports unconfigured when neither fleet key is set', async () => {
    const { getAIProvider, hasAIProvider, completeText } = await loadProvider({})
    expect(getAIProvider()).toBeNull()
    expect(hasAIProvider()).toBe(false)
    // The chain is empty rather than "one provider that is null": with no key
    // there is no vendor to ask, which is a different fact from a vendor that
    // refused. `userFacingAIError` turns it into the configuration message.
    await expect(
      completeText({ system: 's', prompt: 'p', maxTokens: 10, temperature: 0 }),
    ).rejects.toThrow(/every configured AI provider failed/)
  })
})

/**
 * Where the model id comes from when nobody names one.
 *
 * This is the regression that took the OpenRouter half of the chain down. The
 * env schema gave both model vars a `.default()`, so `chainFrom` — which falls
 * back to the maintained chain only when it is given NOTHING — was never given
 * nothing. The app's own copy of the id won on every request and ai-kit's
 * re-probed list was dead code. When `openai/gpt-oss-20b:free` was retired,
 * the second vendor answered 404 by construction: the exact vendor reached
 * only when the first one is down and nobody is watching.
 *
 * A `.default()` reads as a harmless convenience in review, which is why the
 * absence needs a test rather than a comment.
 */
describe('where the model id comes from', () => {
  const okResponse = () => Response.json({ choices: [{ message: { content: 'ok' } }] })

  async function modelSentTo(env: Record<string, string | undefined>) {
    const { completeText } = await loadProvider(env)
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(okResponse())
    await completeText({ system: 's', prompt: 'p', maxTokens: 10, temperature: 0 })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    return JSON.parse(init.body as string).model as string
  }

  it('asks ai-kit when GROQ_MODEL is unset, rather than a default in this repo', async () => {
    const model = await modelSentTo({ GROQ_API_KEY: 'gsk_test' })

    expect(model).toBeTruthy()
    // The llama-3.x family is exactly what Groq retired. If this app ever
    // carries its own default again, that is the id it would drift back to.
    expect(model).not.toMatch(/^llama-3/)
  })

  it('asks ai-kit when OPENROUTER_MODEL is unset', async () => {
    const model = await modelSentTo({ OPENROUTER_API_KEY: 'sk-or-test' })

    expect(model).toBeTruthy()
    // The retired id this repo used to default to.
    expect(model).not.toBe('openai/gpt-oss-20b:free')
  })

  it('still honours an explicit override, so forcing a model remains possible', async () => {
    // The escape hatch is the reason these vars exist at all. Removing the
    // default must not remove the override.
    const model = await modelSentTo({ GROQ_API_KEY: 'gsk_test', GROQ_MODEL: 'pinned-on-purpose' })
    expect(model).toBe('pinned-on-purpose')
  })

  it("does not send one vendor's model id to the other vendor", async () => {
    // A model name only means something at the vendor that publishes it.
    const model = await modelSentTo({
      OPENROUTER_API_KEY: 'sk-or-test',
      GROQ_MODEL: 'openai/gpt-oss-120b',
    })
    expect(model).not.toBe('openai/gpt-oss-120b')
  })
})

describe('the Groq call', () => {
  const okResponse = (content: string) => Response.json({ choices: [{ message: { content } }] })

  it('sends the system prompt and returns the text', async () => {
    const { completeText } = await loadProvider({
      GROQ_API_KEY: 'gsk_test',
      GROQ_MODEL: 'test-model',
    })
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(okResponse('{"values":{}}'))

    const text = await completeText({
      system: 'sys',
      prompt: 'user text',
      maxTokens: 64,
      temperature: 0.2,
    })

    expect(text).toBe('{"values":{}}')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer gsk_test')
  })

  it('carries the provider body on the error for LOGS, not in the message', async () => {
    // This test used to assert the opposite — that the body appeared in
    // `error.message` — and that assertion is exactly how the vendor's JSON,
    // organisation id included, ended up rendered in the staff UI. The body
    // must still be reachable for `logger.errorWithCause`, just not by
    // anything that formats a response. @see lib/ai/errors.ts
    const { completeText } = await loadProvider({ GROQ_API_KEY: 'gsk_test' })
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('model_decommissioned', { status: 400 }),
    )

    const failure = await completeText({
      system: 's',
      prompt: 'p',
      maxTokens: 10,
      temperature: 0,
    }).catch((error: unknown) => error)

    const { AIChainExhaustedError } = await import('@/lib/ai/errors')
    expect(failure).toBeInstanceOf(AIChainExhaustedError)

    const last = (failure as InstanceType<typeof AIChainExhaustedError>).last
    expect(last?.body).toContain('model_decommissioned')
    expect(last?.message).not.toContain('model_decommissioned')
  })
})

describe('an empty completion is a failure, not an answer', () => {
  /**
   * `content ?? ''` returned the empty string as a SUCCESS: the fallback chain
   * recorded `recordAIHealthSuccess()`, never tried the next provider, and the
   * health endpoint said `ok` while the caller got nothing.
   *
   * The trigger is ordinary — a reasoning model spends the whole `max_tokens`
   * budget on reasoning and stops with `finish_reason: "length"` before writing
   * any content. The model behind a provider is not ours to pin forever.
   */
  const emptyResponse = (content: string | null, finish_reason: string) =>
    Response.json({ choices: [{ message: { content }, finish_reason }] })

  it.each([
    ['null content, truncated', null, 'length'],
    ['empty string, truncated', '', 'length'],
    ['whitespace only', '   \n ', 'stop'],
    ['empty string, stopped', '', 'stop'],
  ])('rejects %s rather than returning it', async (_name, content, finish) => {
    const { completeText } = await loadProvider({ GROQ_API_KEY: 'gsk_test' })
    vi.spyOn(global, 'fetch').mockResolvedValue(emptyResponse(content, finish))

    const failure = await completeText({
      system: 's',
      prompt: 'p',
      maxTokens: 20,
      temperature: 0,
    }).catch((error: unknown) => error)

    const { AIChainExhaustedError } = await import('@/lib/ai/errors')
    expect(failure).toBeInstanceOf(AIChainExhaustedError)
  })

  it('falls through to the next provider instead of returning blank', async () => {
    // The whole point of a chain: one provider returning something unusable
    // must not end the attempt. 502 is chosen so `shouldTryNextProvider` passes.
    const { completeText } = await loadProvider({
      GROQ_API_KEY: 'gsk_test',
      OPENROUTER_API_KEY: 'sk-or_test',
    })
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(emptyResponse(null, 'length'))
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: 'real answer' } }] }))

    const text = await completeText({ system: 's', prompt: 'p', maxTokens: 20, temperature: 0 })

    expect(text).toBe('real answer')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('names finish_reason on the error, so the log says WHY it was empty', async () => {
    const { completeText } = await loadProvider({ GROQ_API_KEY: 'gsk_test' })
    vi.spyOn(global, 'fetch').mockResolvedValue(emptyResponse(null, 'length'))

    const failure = await completeText({
      system: 's',
      prompt: 'p',
      maxTokens: 20,
      temperature: 0,
    }).catch((error: unknown) => error)

    const { AIChainExhaustedError } = await import('@/lib/ai/errors')
    const last = (failure as InstanceType<typeof AIChainExhaustedError>).last
    expect(last?.body).toContain('length')
  })

  it('still returns a real answer untouched', async () => {
    const { completeText } = await loadProvider({ GROQ_API_KEY: 'gsk_test' })
    vi.spyOn(global, 'fetch').mockResolvedValue(
      Response.json({ choices: [{ message: { content: '{"values":{}}' } }] }),
    )

    await expect(
      completeText({ system: 's', prompt: 'p', maxTokens: 20, temperature: 0 }),
    ).resolves.toBe('{"values":{}}')
  })
})

describe('the OpenRouter call', () => {
  it('uses OpenRouter when Groq is absent', async () => {
    const { completeText } = await loadProvider({
      OPENROUTER_API_KEY: 'sk-or-test',
      OPENROUTER_MODEL: 'test/openrouter-model',
    })
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(Response.json({ choices: [{ message: { content: 'ok' } }] }))

    await completeText({ system: 's', prompt: 'p', maxTokens: 10, temperature: 0 })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('test/openrouter-model')
  })
})
