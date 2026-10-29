/** Shared wire protocol; the app retains provider choice and domain fallback. */
import {
  complete,
  ChainExhaustedError,
  LinkFailure,
  type CompleteOptions,
  type CompleteResult,
} from '@bitbaum/ai-kit'
import type { AIProviderConfig } from './provider'
import { AIProviderError } from './errors'

type RequestOptions = Pick<
  CompleteOptions,
  'messages' | 'maxTokens' | 'temperature' | 'tools' | 'extraBody' | 'signal'
>

export async function completeProviderRequest(
  config: AIProviderConfig,
  options: RequestOptions,
): Promise<CompleteResult> {
  options.signal?.throwIfAborted()
  const key = config.headers.Authorization?.replace(/^Bearer\s+/i, '') ?? ''
  let failure: Error | undefined
  try {
    return await complete({
      ...options,
      chain: [
        {
          provider: {
            id: config.provider,
            baseUrl: config.url.replace(/\/chat\/completions\/?$/, ''),
            keyEnv: 'AOZ_TRANSPORT_KEY',
            models: [config.model],
            dailyTokens: config.dailyTokens ?? 0,
          },
          model: config.model,
        },
      ],
      env: { AOZ_TRANSPORT_KEY: key },
      extraHeaders: Object.fromEntries(
        Object.entries(config.headers).filter(([name]) => name.toLowerCase() !== 'authorization'),
      ),
      toolProtocol: 'native',
      onLinkFailure: (_link, error) => {
        failure = error
      },
    })
  } catch (error) {
    options.signal?.throwIfAborted()
    if (!(error instanceof ChainExhaustedError)) throw error
    throw new AIProviderError(
      config.provider,
      failure instanceof LinkFailure && failure.status && failure.status >= 400
        ? failure.status
        : 502,
      failure?.message ?? error.message,
      failure instanceof LinkFailure ? failure.kind : undefined,
      failure instanceof LinkFailure ? failure.retryAfter : undefined,
    )
  }
}
