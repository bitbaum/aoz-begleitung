/** Product-facing AI errors. AI Kit owns transport and refusal classification;
 * this adapter preserves German guidance and keeps provider diagnostics in logs.
 */

import {
  classifyRateLimit,
  rateLimitMessage,
  retryAfterSeconds,
  type RateLimitKind,
} from '@bitbaum/ai-kit'

/**
 * A provider call that failed, carrying provider diagnostics for the LOG only.
 *
 * `body` must never reach a response. It is kept on the error so
 * `logger.errorWithCause` can record what the vendor actually said, which is
 * the thing an operator needs and the user must not see.
 */
export class AIProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
    readonly body: string,
    readonly kind?: RateLimitKind,
    readonly retryAfter?: number | null,
  ) {
    // The message is for logs. User-facing text comes from userFacingAIError().
    super(`${provider} failed (${status})`)
    this.name = 'AIProviderError'
  }
}

/** Every provider in the chain refused; `last` is the final failure. */
export class AIChainExhaustedError extends Error {
  constructor(readonly last: AIProviderError | null) {
    super('every configured AI provider failed')
    this.name = 'AIChainExhaustedError'
  }
}

export const AI_NOT_CONFIGURED =
  'Der KI-Assistent ist auf dieser Installation nicht eingerichtet. Bitte wenden Sie sich an die Verwaltung.'

const AI_GENERIC =
  'Der KI-Assistent ist im Moment nicht erreichbar. Bitte versuchen Sie es später erneut.'

/**
 * German, specific about whether waiting helps, and free of vendor text.
 *
 * The wait clause comes from the body because it is the one detail that
 * changes what the reader should DO — and `rateLimitMessage` is careful to say
 * "waiting will not help" for a daily exhaustion rather than inviting a retry.
 */
export function userFacingAIError(error: unknown): string {
  if (error instanceof AIChainExhaustedError) {
    return error.last ? userFacingAIError(error.last) : AI_GENERIC
  }

  if (!(error instanceof AIProviderError)) return AI_GENERIC

  if (error.status === 429) {
    const kind = error.kind ?? classifyRateLimit(error.body)

    if (kind === 'size') {
      // Waiting never helps and a smaller model is strictly worse — the only
      // fix is a shorter question, so that is what we ask for.
      return 'Die Anfrage ist zu lang für den KI-Assistenten. Bitte stellen Sie eine kürzere Frage.'
    }

    if (kind === 'daily') {
      return 'Das Tagesbudget des KI-Assistenten ist aufgebraucht. Er steht morgen wieder zur Verfügung.'
    }

    const seconds = error.retryAfter ?? retryAfterSeconds(error.body)
    return seconds
      ? `Der KI-Assistent ist gerade ausgelastet. Bitte versuchen Sie es in ${Math.ceil(seconds)} Sekunden erneut.`
      : 'Der KI-Assistent ist gerade ausgelastet. Bitte versuchen Sie es in einer Minute erneut.'
  }

  return AI_GENERIC
}

/**
 * Is it worth asking a DIFFERENT vendor?
 *
 * A `size` 429 is the one case where it is not: the request exceeds the whole
 * window, and the next vendor's window is not bigger in any way that helps.
 * Everything else — capacity, daily exhaustion, a 5xx — is a fact about THIS
 * vendor, and the entire reason a chain crosses vendors is that a different
 * one has a different meter.
 */
export function shouldTryNextProvider(error: AIProviderError): boolean {
  if (error.status === 429) return (error.kind ?? classifyRateLimit(error.body)) !== 'size'
  return error.status >= 500 || error.status === 401 || error.status === 403
}
