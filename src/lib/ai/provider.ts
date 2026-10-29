/**
 * Product provider selection and whole-operation fallback. AI Kit owns the
 * HTTP completion protocol, deadlines and response validation via transport.ts.
 * The staff tool loop restarts on the next provider as one operation; form
 * assistance uses the same transport without owning another HTTP client.
 */

import { freeChain, usableChain, chainFrom } from '@bitbaum/ai-kit'
import { BRAND } from '@/lib/config/brand'
import { completeProviderRequest } from './transport'
import { AIChainExhaustedError, AIProviderError, shouldTryNextProvider } from './errors'
import { recordAIHealthFailure, recordAIHealthSuccess } from './health'

export type AIProvider = 'groq' | 'openrouter'

/** @deprecated use AIProvider */
export type CompletionProvider = AIProvider | null

/**
 * Which backend is configured right now. Groq wins when both keys exist —
 * same rule as every other app on the box.
 */
export function getAIProvider(): AIProvider | null {
  if (process.env.GROQ_API_KEY?.trim()) return 'groq'
  if (process.env.OPENROUTER_API_KEY?.trim()) return 'openrouter'
  return null
}

/** @deprecated use getAIProvider */
export function getCompletionProvider(): CompletionProvider {
  return getAIProvider()
}

export function hasAIProvider(): boolean {
  return getAIProvider() !== null
}

/** @deprecated use hasAIProvider */
export function hasCompletionProvider(): boolean {
  return hasAIProvider()
}

export interface CompletionInput {
  system: string
  prompt: string
  maxTokens: number
  temperature: number
}

export interface AIProviderConfig {
  provider: AIProvider
  url: string
  headers: Record<string, string>
  model: string
  dailyTokens?: number
}

/**
 * Resolved endpoint + model for the FIRST provider in the chain.
 *
 * @deprecated use `getAIProviderConfigs` — this returns one link and therefore
 * cannot fall back. Kept because it is exported.
 *
 * It used to build that config by hand, reading `env.GROQ_MODEL` /
 * `env.OPENROUTER_MODEL` directly. That made it a second, divergent answer to
 * "which model do we call" — and the divergence was not theoretical: it read
 * the raw env pin while `getAIProviderConfigs` read the pin through
 * `chainFrom`. Delegating leaves exactly one code path that decides a model.
 *
 * Returns null when neither GROQ_API_KEY nor OPENROUTER_API_KEY is set.
 */
export async function getAIProviderConfig(): Promise<AIProviderConfig | null> {
  const [first] = await getAIProviderConfigs()
  return first ?? null
}

/**
 * Every configured provider, in fallback order.
 *
 * `usableChain` drops vendors whose key is absent, so a deployment with only
 * GROQ_API_KEY gets a one-link chain rather than a second link that would fail
 * on every request with a 401.
 */
export async function getAIProviderConfigs(): Promise<AIProviderConfig[]> {
  const { env } = await import('@/lib/env')

  // `usableChain` drops vendors with no key and expands each survivor into
  // (provider, model) links.
  //
  // The pin is applied PER VENDOR, not once for the whole chain. Passing
  // GROQ_MODEL to `chainFrom` over the combined chain pinned a Groq model id
  // across every link, so a deployment with only OPENROUTER_API_KEY posted
  // `openai/gpt-oss-120b` to OpenRouter — a model id that vendor does not
  // serve. A model name only means something at the vendor that publishes it.
  const links = usableChain(freeChain('AOZ'), process.env)

  // ONE link per vendor. The chain lists several models per provider, but a
  // second model at the SAME vendor draws on the same org-wide daily budget —
  // so on the day it runs out, that "fallback" is already dead. Only a
  // different vendor has a different meter, and trying same-vendor models
  // first just spends the next vendor's latency budget on a certain failure.
  const seen = new Set<string>()
  const configs: AIProviderConfig[] = []

  for (const link of links) {
    const provider = link.provider.id as AIProvider
    if (seen.has(provider)) continue
    seen.add(provider)

    const headers: Record<string, string> = {
      Authorization: `Bearer ${process.env[link.provider.keyEnv] ?? ''}`,
      'Content-Type': 'application/json',
    }
    if (provider === 'openrouter') {
      // OpenRouter attributes free-tier usage by referer/title.
      headers['HTTP-Referer'] = env.NEXT_PUBLIC_APP_URL ?? 'https://aoz.orangecat.ch'
      headers['X-Title'] = BRAND.productName
    }

    // This vendor's own pin, or the chain's first free model for it.
    const pinned = provider === 'groq' ? env.GROQ_MODEL : env.OPENROUTER_MODEL
    const [preferred] = chainFrom(pinned, [link])

    configs.push({
      provider,
      url: `${link.provider.baseUrl}/chat/completions`,
      headers,
      model: preferred?.model ?? link.model,
      dailyTokens: link.provider.dailyTokens,
    })
  }

  return configs
}

/**
 * Run `attempt` down the chain until one provider answers.
 *
 * A `size` 429 stops the walk immediately — the request is too long for any
 * window, so asking the next vendor only wastes its budget too.
 */
export async function withProviderFallback<T>(
  attempt: (config: AIProviderConfig) => Promise<T>,
): Promise<T> {
  const configs = await getAIProviderConfigs()
  if (configs.length === 0) {
    const error = new AIChainExhaustedError(null)
    recordAIHealthFailure(error)
    throw error
  }

  let last: AIProviderError | null = null

  for (const config of configs) {
    try {
      const result = await attempt(config)
      recordAIHealthSuccess()
      return result
    } catch (error) {
      if (!(error instanceof AIProviderError)) throw error
      last = error
      if (!shouldTryNextProvider(error)) break
    }
  }

  const exhausted = new AIChainExhaustedError(last)
  recordAIHealthFailure(exhausted)
  throw exhausted
}

async function completeWithOpenAICompat(
  config: AIProviderConfig,
  input: CompletionInput,
): Promise<string> {
  const result = await completeProviderRequest(config, {
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: input.prompt },
    ],
    maxTokens: input.maxTokens,
    temperature: input.temperature,
  })
  return result.text
}

/**
 * One non-streaming completion, returning plain text.
 *
 * This is the seam @fleet/ai-forms calls: the package never owns keys, models
 * or budgets, so form assistance uses whatever provider the deployment has.
 */
export async function completeText(input: CompletionInput): Promise<string> {
  return withProviderFallback((config) => completeWithOpenAICompat(config, input))
}
