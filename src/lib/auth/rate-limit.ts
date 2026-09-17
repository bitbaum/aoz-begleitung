/**
 * Rate Limiting for Login Attempts
 *
 * In-memory rate limiting. Simple but effective for single-instance deployments.
 * For multi-instance, replace with Redis-based solution.
 */

import { AUTH_CONFIG } from './config'

interface RateLimitEntry {
  attempts: number
  firstAttempt: number
}

// In-memory store (cleared on server restart)
const loginAttempts = new Map<string, RateLimitEntry>()

// Cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000

// Start cleanup timer — skip in test environments where the interval
// leaks into Jest worker processes and prevents clean shutdown.
if (typeof setInterval !== 'undefined' && process.env.NODE_ENV !== 'test') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now()
    loginAttempts.forEach((entry, key) => {
      if (now - entry.firstAttempt > AUTH_CONFIG.rateLimit.windowMs) {
        loginAttempts.delete(key)
      }
    })
  }, CLEANUP_INTERVAL)

  // Belt-and-suspenders: unref so a running process doesn't stay alive for this alone
  if (typeof (cleanupTimer as NodeJS.Timeout).unref === 'function') {
    ;(cleanupTimer as NodeJS.Timeout).unref()
  }
}

/**
 * Check if an IP/identifier is rate limited
 * Returns { allowed: true } or { allowed: false, retryAfter: seconds }
 */
export function checkRateLimit(
  identifier: string,
): { allowed: true } | { allowed: false; retryAfter: number } {
  const now = Date.now()
  const entry = loginAttempts.get(identifier)

  // No previous attempts
  if (!entry) {
    return { allowed: true }
  }

  // Window expired, reset
  if (now - entry.firstAttempt > AUTH_CONFIG.rateLimit.windowMs) {
    loginAttempts.delete(identifier)
    return { allowed: true }
  }

  // Still within window, check attempts
  if (entry.attempts >= AUTH_CONFIG.rateLimit.maxAttempts) {
    const retryAfter = Math.ceil(
      (AUTH_CONFIG.rateLimit.windowMs - (now - entry.firstAttempt)) / 1000,
    )
    return { allowed: false, retryAfter }
  }

  return { allowed: true }
}

/**
 * Record a login attempt (call after failed login)
 */
export function recordLoginAttempt(identifier: string): void {
  const now = Date.now()
  const entry = loginAttempts.get(identifier)

  if (!entry || now - entry.firstAttempt > AUTH_CONFIG.rateLimit.windowMs) {
    // New window
    loginAttempts.set(identifier, { attempts: 1, firstAttempt: now })
  } else {
    // Increment attempts
    entry.attempts++
  }
}

/**
 * Clear login attempts (call after successful login)
 */
export function clearLoginAttempts(identifier: string): void {
  loginAttempts.delete(identifier)
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
 * no second call to forget.
 */
export function consumeRateLimit(
  identifier: string,
): { allowed: true } | { allowed: false; retryAfter: number } {
  const result = checkRateLimit(identifier)
  if (result.allowed) {
    recordLoginAttempt(identifier)
  }
  return result
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
  return (
    request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}
