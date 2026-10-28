/**
 * Shared per-process throttling for login failures and metered endpoints.
 * The app owns quotas and identifiers; LimitKit owns window accounting and
 * the bounded store. Multiple server processes require a shared-store design.
 */
import { clientIp, MemoryStore, slidingWindow, type LimitResult } from 'limitkit'
import { AUTH_CONFIG } from './config'

const attempts = new MemoryStore()
const limiter = slidingWindow(
  { limit: AUTH_CONFIG.rateLimit.maxAttempts, windowMs: AUTH_CONFIG.rateLimit.windowMs },
  attempts,
)

type RateLimitResult = { allowed: true } | { allowed: false; retryAfter: number }

function resultForApp(result: LimitResult): RateLimitResult {
  return result.allowed
    ? { allowed: true }
    : { allowed: false, retryAfter: result.retryAfterSeconds }
}

/** Inspect without consuming: only failed logins should count. */
export function checkRateLimit(identifier: string): RateLimitResult {
  return resultForApp(limiter.peek(identifier))
}

/** Record a failed login. Refused attempts never prolong a lockout. */
export function recordLoginAttempt(identifier: string): void {
  limiter.check(identifier)
}

/** Successful login resets the caller's failed-attempt bucket. */
export function clearLoginAttempts(identifier: string): void {
  attempts.set(identifier, { hits: [] })
}

/** Metered endpoints consume in one operation, so a check cannot be forgotten. */
export function consumeRateLimit(identifier: string): RateLimitResult {
  return resultForApp(limiter.check(identifier))
}

/**
 * The client IP behind Caddy — SSOT for the rate-limit identifier.
 * (Third route needed this; the copies in login/invite/demo now import it.)
 *
 * Take the LAST hop, never the first. Caddy APPENDS the real peer address to
 * whatever `X-Forwarded-For` already arrived, so the rightmost entry is the
 * only one we wrote; everything to its left is a string the caller typed.
 * Reading `[0]` meant an attacker could send a different leading value on
 * every request and land in a fresh bucket each time — the login throttle
 * gating code entry could never trip.
 */
export function getClientIp(request: { headers: { get(name: string): string | null } }): string {
  return clientIp(request.headers, { trustedProxies: 1 })
}
