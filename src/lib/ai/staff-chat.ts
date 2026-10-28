import { RICH_ANSWERS_INSTRUCTION } from '@bitbaum/chatkit'
import { BRAND } from '@/lib/config/brand'
import { withProviderFallback, type AIProvider, type AIProviderConfig } from '@/lib/ai/provider'
import { completeProviderRequest } from '@/lib/ai/transport'
import { executeStaffChatTool, STAFF_CHAT_TOOLS } from '@/lib/ai/staff-chat-tools'

export const STAFF_CHAT_SYSTEM_PROMPT =
  RICH_ANSWERS_INSTRUCTION +
  '\n\n' +
  `Du bist ein KI-Assistent für das ${BRAND.productName} System.

Deine Aufgabe: Mitarbeitenden dabei helfen, Informationen über Klient*innen, Unterkünfte, Platzierungen und Vorfälle schnell zu finden und zu analysieren.

Das System platziert Asylsuchende in Gemeinschaftsunterkünften basierend auf Kompatibilität, um Konflikte zu reduzieren und das Wohlbefinden zu fördern.

Verfügbare Werkzeuge:
- get_dashboard_stats: Systemweite Übersichtsstatistiken
- search_residents: Klient*innen nach Code oder Status suchen
- get_housing_units: Wohneinheiten mit Belegungsinformationen
- get_recent_incidents: Aktuelle Vorfälle und Konflikte

Verhaltensregeln:
- Antworte immer auf Deutsch
- Sei präzise und direkt — Mitarbeitende brauchen schnelle Antworten
- Verwende Werkzeuge proaktiv, um aktuelle Daten zu zeigen
- Respektiere die Würde der Klient*innen in deiner Sprache
- Gib nur arbeitsbezogene Informationen weiter`

export interface StaffChatTurn {
  role: 'user' | 'assistant'
  content: string
}

interface OpenAIToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

type OpenAIMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: OpenAIToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

const MAX_ITERATIONS = 5

function parseToolArguments(raw: string): unknown {
  try {
    return JSON.parse(raw || '{}')
  } catch {
    return {}
  }
}

async function chatCompletion(
  provider: AIProvider,
  config: AIProviderConfig,
  messages: OpenAIMessage[],
  signal?: AbortSignal,
): Promise<{ message: OpenAIMessage; finishReason: string | null }> {
  const result = await completeProviderRequest(config, {
    messages,
    signal,
    tools: STAFF_CHAT_TOOLS,
    extraBody: { tool_choice: 'auto' },
    maxTokens: 4096,
    temperature: 0.2,
  })
  const body = result.raw as {
    choices?: Array<{ message?: OpenAIMessage; finish_reason?: string | null }>
  }

  const choice = body.choices?.[0]
  if (!choice?.message) {
    throw new Error(`${provider} chat returned no message`)
  }

  return { message: choice.message, finishReason: choice.finish_reason ?? null }
}

/**
 * Run the staff assistant with tool use. Uses the fleet provider chain
 * (Groq → OpenRouter) via OpenAI-compatible chat completions.
 */
export async function runStaffChat(turns: StaffChatTurn[], signal?: AbortSignal): Promise<string> {
  // The whole tool-use loop runs against ONE provider. Switching vendors
  // mid-conversation would carry a half-finished tool exchange — assistant
  // `tool_calls` already pushed, their `tool` results not yet — to a model that
  // never issued those calls. So the fallback wraps the entire loop: a failure
  // anywhere in it restarts cleanly on the next vendor.
  return withProviderFallback(async (config) => {
    const messages: OpenAIMessage[] = [
      { role: 'system', content: STAFF_CHAT_SYSTEM_PROMPT },
      ...turns.map((t) => ({ role: t.role, content: t.content })),
    ]

    return runChatLoop(config.provider, config, messages, signal)
  })
}

async function runChatLoop(
  provider: AIProvider,
  config: Parameters<typeof chatCompletion>[1],
  messages: OpenAIMessage[],
  signal?: AbortSignal,
): Promise<string> {
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const { message, finishReason } = await chatCompletion(provider, config, messages, signal)

    if (
      message.role === 'assistant' &&
      (message.tool_calls?.length || finishReason === 'tool_calls')
    ) {
      messages.push({
        role: 'assistant',
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      })

      for (const call of message.tool_calls ?? []) {
        const result = await executeStaffChatTool(
          call.function.name,
          parseToolArguments(call.function.arguments),
        )
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result, null, 2),
        })
      }
      continue
    }

    const text = typeof message.content === 'string' ? message.content.trim() : ''
    if (text) return text
  }

  return 'Keine Antwort erhalten. Bitte Anfrage präzisieren oder erneut versuchen.'
}
