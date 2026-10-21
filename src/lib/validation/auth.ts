/**
 * Zod schemas for the account flows (register, email login, password reset).
 * SSOT for auth input validation — routes parse with these, never by hand.
 */

import { z } from 'zod'
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/passwords'
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'

const emailField = z.string().trim().toLowerCase().email(ERROR_MESSAGES.AUTH_EMAIL_INVALID)

const passwordField = z
  .string()
  .min(PASSWORD_MIN_LENGTH, ERROR_MESSAGES.AUTH_PASSWORD_TOO_SHORT)
  // bcrypt truncates at 72 bytes — refuse silently-truncated passwords.
  .max(72, ERROR_MESSAGES.AUTH_PASSWORD_TOO_LONG)

export const registerSchema = z.object({
  code: z.string().trim().toUpperCase().min(1, ERROR_MESSAGES.AUTH_CODE_REQUIRED),
  email: emailField,
  password: passwordField,
})

/**
 * Self-serve onboarding: no code, because there is nobody to have issued one.
 *
 * `code` is absent rather than optional. The two flows do different things —
 * one CLAIMS an identity that already exists, the other CREATES a household —
 * and a single schema with an optional code would let a request carry both and
 * leave the route to decide which won. @see auth/household.ts
 */
export const createHouseholdSchema = z.object({
  email: emailField,
  password: passwordField,
  householdName: z
    .string()
    .trim()
    .min(1, ERROR_MESSAGES.AUTH_HOUSEHOLD_NAME_REQUIRED)
    .max(80, ERROR_MESSAGES.AUTH_HOUSEHOLD_NAME_TOO_LONG),
  // Optional on purpose: the code is the identity, a name is a courtesy. The
  // privacy default of this product is that residents have no name at all.
  displayName: z.string().trim().max(80).optional(),
})

export const emailLoginSchema = z.object({
  email: emailField,
  password: z.string().min(1),
})

export const forgotPasswordSchema = z.object({
  email: emailField,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordField,
})

/** /claim — a single-use claim link plus the credentials the person chooses. */
export const claimAccountSchema = z.object({
  token: z.string().min(1).max(200),
  email: emailField,
  password: passwordField,
})

export type RegisterInput = z.infer<typeof registerSchema>
export type EmailLoginInput = z.infer<typeof emailLoginSchema>
