/**
 * Form Assist API
 *
 * POST /api/ai/form-assist
 *
 * One route for every AI-assisted form in the app. Adding assistance to another
 * form means adding it to AI_FORMS — nothing here changes.
 *
 * The field registry stays server-side: the client names a form, never its
 * fields, so a crafted request cannot widen what the model may write, and
 * fields marked `aiExcluded` are never even shown to it.
 */

import { createFormAssistHandler, type AuthorizeResult } from '@fleet/ai-forms/server'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/auth/role-policy'
import { consumeRateLimit } from '@/lib/auth/rate-limit'
import { completeText, hasAIProvider } from '@/lib/ai/provider'
import { AI_FORMS } from '@/lib/config/ai-forms'
import { AI_FORM_ERRORS, AI_FORM_MESSAGES } from '@/lib/constants'

async function authorize(): Promise<AuthorizeResult> {
  if (!hasAIProvider()) {
    return { ok: false, status: 503, error: AI_FORM_ERRORS.notConfigured }
  }

  const user = await getCurrentUser()
  if (!user) {
    return { ok: false, status: 401, error: AI_FORM_ERRORS.unauthenticated }
  }

  // Same permission the page and the nav ask for — see /api/ai/chat.
  if (!hasPermission(user, 'ai:assist')) {
    return { ok: false, status: 403, error: AI_FORM_ERRORS.forbidden }
  }

  // Every call is metered, so `consume` rather than `check` — a plain check
  // never increments and would be a throttle that can't trip.
  const rateCheck = consumeRateLimit(`ai-form-assist:${user.id}`)
  if (!rateCheck.allowed) {
    return { ok: false, status: 429, error: AI_FORM_ERRORS.rateLimited(rateCheck.retryAfter) }
  }

  return { ok: true }
}

export const POST = createFormAssistHandler({
  targets: AI_FORMS,
  complete: completeText,
  authorize,
  messages: AI_FORM_MESSAGES,
})
