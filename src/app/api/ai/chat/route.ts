import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/role-policy'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'
import { consumeRateLimit } from '@/lib/auth/rate-limit'
import { hasAIProvider } from '@/lib/ai/provider'
import { AI_NOT_CONFIGURED, userFacingAIError } from '@/lib/ai/errors'
import { runStaffChat } from '@/lib/ai/staff-chat'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      }),
    )
    .max(40),
})

export async function POST(request: Request) {
  if (!hasAIProvider()) {
    return NextResponse.json(
      // The reader is a caseworker, not an operator. Naming environment
      // variables and a repo path tells them to do something they cannot do,
      // in a language the rest of the screen is not written in.
      { error: AI_NOT_CONFIGURED },
      { status: 503 },
    )
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 })
  }

  // The route enforces the same permission the page and the nav ask for.
  // Checking only "are you signed in" left the API open while the nav hid the
  // entry — a declared boundary that differed from the enforced one, which is
  // exactly how the /algorithm mismatch survived for months.
  if (!hasPermission(user, 'ai:assist')) {
    return NextResponse.json({ error: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS }, { status: 403 })
  }

  const rateCheck = consumeRateLimit(`ai-chat:${user.id}`)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Zu viele Anfragen. Bitte warten Sie ${rateCheck.retryAfter} Sekunden.` },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 })
  }

  const { messages } = parsed.data
  const encoder = new TextEncoder()
  const cancellation = new AbortController()
  const signal = AbortSignal.any([request.signal, cancellation.signal])

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const answer = await runStaffChat(messages, signal)
        if (signal.aborted) return

        // Stream in chunks so the UI shows progress (WhatsApp-like responsiveness).
        const chunks = answer.match(/\S+\s*|\s+/g) ?? [answer]
        for (const chunk of chunks) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'text', text: chunk })}\n\n`),
          )
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
      } catch (err) {
        if (signal.aborted) return
        logger.errorWithCause('AI chat failed', err)
        // NEVER `err.message` here. That is what rendered
        // `groq chat failed (429): {"error":{"message":"Rate limit reached …
        // in organization \`org_01jy…\`"}}` into a German staff UI — an
        // unreadable blob AND an internal organisation id, shown to anyone
        // who can open the assistant. @see lib/ai/errors.ts
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: userFacingAIError(err) })}\n\n`,
          ),
        )
      } finally {
        if (!signal.aborted) controller.close()
      }
    },
    cancel() {
      cancellation.abort()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
