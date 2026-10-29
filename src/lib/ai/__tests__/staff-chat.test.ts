import { vi, describe, it, expect, afterEach } from 'vitest'

const tools = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('@/lib/ai/staff-chat-tools', () => ({
  executeStaffChatTool: tools.execute,
  STAFF_CHAT_TOOLS: [
    {
      type: 'function',
      function: { name: 'get_dashboard_stats', parameters: { type: 'object', properties: {} } },
    },
  ],
}))
const originalEnv = process.env

afterEach(() => {
  process.env = originalEnv
  vi.restoreAllMocks()
  vi.resetModules()
  tools.execute.mockReset()
})

function toolRequest(id: string) {
  return Response.json({
    choices: [
      {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id, type: 'function', function: { name: 'get_dashboard_stats', arguments: '{}' } },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  })
}
function answer() {
  return Response.json({
    choices: [
      { message: { role: 'assistant', content: 'Sieben Einträge.' }, finish_reason: 'stop' },
    ],
  })
}
async function engine() {
  vi.resetModules()
  process.env = { ...originalEnv, GROQ_API_KEY: 'test-groq', OPENROUTER_API_KEY: 'test-openrouter' }
  tools.execute.mockResolvedValue({ count: 7 })
  return (await import('../staff-chat')).runStaffChat
}

describe('staff tools over the shared completion transport', () => {
  it('preserves native tool identities and nullable assistant history', async () => {
    const run = await engine()
    const request = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(toolRequest('call-a'))
      .mockResolvedValueOnce(answer())
    await expect(run([{ role: 'user', content: 'Wie viele?' }])).resolves.toBe('Sieben Einträge.')
    const sent = JSON.parse(request.mock.calls[1][1]?.body as string).messages
    expect(sent[2]).toMatchObject({
      role: 'assistant',
      content: null,
      tool_calls: [{ id: 'call-a' }],
    })
    expect(sent[3]).toMatchObject({ role: 'tool', tool_call_id: 'call-a' })
    expect(JSON.parse(sent[3].content)).toEqual({ count: 7 })
    expect(tools.execute).toHaveBeenCalledWith('get_dashboard_stats', {})
  })

  it('restarts the entire tool exchange when a provider fails after its tool result', async () => {
    const run = await engine()
    const request = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(toolRequest('failed-provider-call'))
      .mockResolvedValueOnce(new Response('temporarily unavailable', { status: 503 }))
      .mockResolvedValueOnce(toolRequest('replacement-call'))
      .mockResolvedValueOnce(answer())
    await expect(run([{ role: 'user', content: 'Wie viele?' }])).resolves.toBe('Sieben Einträge.')
    const restart = JSON.parse(request.mock.calls[2][1]?.body as string).messages
    expect(restart.map((message: { role: string }) => message.role)).toEqual(['system', 'user'])
    expect(JSON.stringify(restart)).not.toContain('failed-provider-call')
    expect(String(request.mock.calls[0][0])).toContain('groq.com')
    expect(String(request.mock.calls[2][0])).toContain('openrouter.ai')
    expect(tools.execute).toHaveBeenCalledTimes(2)
  })
  it('aborts an in-flight provider request without trying another vendor', async () => {
    const run = await engine()
    const cancellation = new AbortController()
    let requestSignal: AbortSignal | null | undefined
    const request = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      requestSignal = init?.signal
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () => reject(requestSignal?.reason), {
          once: true,
        })
      })
    })
    const pending = run([{ role: 'user', content: 'Wie viele?' }], cancellation.signal)
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    cancellation.abort()
    await rejected
    expect(requestSignal?.aborted).toBe(true)
    expect(request).toHaveBeenCalledTimes(1)
  })
})
