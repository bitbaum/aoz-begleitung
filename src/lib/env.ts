/**
 * Runtime environment validation.
 *
 * Importing this module triggers a Zod parse of `process.env`. If a required
 * variable is missing or malformed in production, the process throws at boot
 * instead of crashing on the first downstream query/HTTP call.
 *
 * Import from `instrumentation.ts` so it runs once per server start in BOTH
 * Node and Edge runtimes. Client code should never import this file (the
 * server-only fields would be tree-shaken to `undefined` anyway).
 */

import { z } from 'zod'
import { logger } from '@/lib/logger'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database — required everywhere except tests (they mock the db module)
  DATABASE_URL: z.string().url().optional(),

  // Auth secrets
  SESSION_SECRET: z.string().min(32).optional(),
  SESSION_DURATION: z.coerce.number().int().positive().default(28800),
  LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(10),

  // Cron auth (required in production for /api/cron/*)
  CRON_SECRET: z.string().min(16).optional(),

  // Optional integrations
  // AI: whichever key is set decides the provider (Groq wins if both are).
  // See src/lib/ai/provider.ts.
  //
  // NO DEFAULT MODEL HERE, deliberately. `ai-kit` already carries the model
  // list, re-probed against the live catalogues, and `provider.ts` feeds these
  // vars to `chainFrom` as a STARTING POINT.
  //
  // A default defeats that entirely. `chainFrom` falls back to the chain only
  // when it is given nothing; a `.default()` is never nothing, so the app's own
  // copy of the id won on every request and the maintained list was dead code.
  // That is how this file shipped a fallback that could not fall back: the
  // OpenRouter default below read `openai/gpt-oss-20b:free`, retired since, so
  // the second vendor — the one reached precisely when Groq is down and nobody
  // is watching — answered 404 by construction.
  //
  // Undefined means "use the maintained chain". Set the var only to force a
  // specific model, and expect to be the one who notices when it is retired.
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),

  // Sentry (build-time)
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Public URL
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  // Emit a single concise error grouping all failures so the operator sees
  // every missing/invalid var at once.
  const fields = result.error.flatten().fieldErrors
  const issues = Object.entries(fields)
    .map(([k, v]) => `  ${k}: ${(v ?? []).join('; ')}`)
    .join('\n')
  // Hard-fail in production; warn-only in dev so onboarding doesn't crash.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Invalid environment configuration:\n${issues}`)
  } else {
    logger.warn(`[env] Invalid environment (non-fatal in development):\n${issues}`)
  }
}

// Production-only required-field checks. Done here instead of via the schema
// so dev/test can boot with a partial env.
if (process.env.NODE_ENV === 'production') {
  const required = ['DATABASE_URL', 'SESSION_SECRET'] as const
  const missing = required.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`)
  }
}

export const env = result.success ? result.data : envSchema.parse({})
