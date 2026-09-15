/**
 * Rate limiting — owned by `limitkit` (fleet/SHARED.md); this file is the shim.
 *
 * It keeps the call signatures its callers and their test mocks were written
 * against, so adopting the package changed no route. The LIMIT VALUES stay
 * here in AUTH_CONFIG: how many attempts a login route allows is this app's
 * semantics, not the package's.
 *
 * What changed underneath, for the better: the hand-rolled version kept a
 * bare Map keyed by client IP, pruned by a five-minute timer — limitkit's
 * MemoryStore is bounded (LRU past 5 000 keys), so a stranger-fed leak is
 * impossible by construction. And `getClientIp` now reads the LAST hop of
 * X-Forwarded-For — the one Caddy wrote — instead of the first, which a
 * client could set to anything and so mint itself a fresh bucket per request.
 *
 * Keep this a shim. A local re-implementation "just for one tweak" is how the
 * shared version becomes the stale version.
 */

import { slidingWindow, clientIp, MemoryStore, type LimitResult, type HeadersLike } from 'limitkit'
import { AUTH_CONFIG } from './config'

const store = new MemoryStore()
const limiter = slidingWindow(
  { limit: AUTH_CONFIG.rateLimit.maxAttempts, windowMs: AUTH_CONFIG.rateLimit.windowMs },
  store,
)

type Decision = { allowed: true } | { allowed: false; retryAfter: number }

function decision(result: LimitResult): Decision {
  return result.allowed
    ? { allowed: true }
    : { allowed: false, retryAfter: result.retryAfterSeconds }
}

/**
 * Check if an IP/identifier is rate limited — READS ONLY, counts nothing.
 * Returns { allowed: true } or { allowed: false, retryAfter: seconds }
 */
export function checkRateLimit(identifier: string): Decision {
  return decision(limiter.peek(identifier))
}

/**
 * Record a login attempt (call after failed login)
 */
export function recordLoginAttempt(identifier: string): void {
  limiter.check(identifier)
}

/**
 * Clear login attempts (call after successful login)
 */
export function clearLoginAttempts(identifier: string): void {
  store.set(identifier, { hits: [] })
}

/**
 * Check and record in one step — use this for anything that is not a login.
 *
 * `checkRateLimit` only reads the counter; something else has to call
 * `recordLoginAttempt` for it to ever rise. That split makes sense for logins,
 * where only *failed* attempts should count, and is a trap everywhere else: a
 * caller that just checks is a throttle that never trips, and it looks
 * identical in review to one that works.
 *
 * For a metered endpoint every call counts, so there is nothing to decide and
 * no second call to forget. A refused call counts nothing, so a hammered key
 * recovers the moment the caller stops.
 */
export function consumeRateLimit(identifier: string): Decision {
  return decision(limiter.check(identifier))
}

/**
 * The client IP behind Caddy — SSOT for the rate-limit identifier.
 */
export function getClientIp(request: { headers: HeadersLike }): string {
  return clientIp(request.headers)
}
