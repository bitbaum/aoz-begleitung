/**
 * Daily demo reset endpoint.
 * Authenticated via Bearer token (CRON_SECRET), same contract as
 * cron/notifications. Triggered by a systemd timer on the box.
 *
 * Truncates everything and reseeds the invented world. It runs ONLY on the
 * dedicated demo instance (`isDemoInstance()`): the old UNIT scope, which
 * cleaned demo rows out of a database that also held real ones, is gone with
 * the idea of mixing the two.
 */
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { isDemoEnabled, isDemoInstance } from '@/lib/demo/config'
import { resetDemoData } from '@/lib/demo/reset'

// Truncate + full reseed comfortably exceeds the 10s default at cold start.
export const maxDuration = 120

/**
 * Stable integer for pg_advisory_lock; distinct from cron/notifications
 * (7283419021) so the two crons never block each other.
 */
const CRON_LOCK_KEY = 7283419022

export async function POST(request: Request) {
  // Auth: verify Bearer token matches CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // A reset on a non-demo deployment would destroy real data — refuse unless
  // the operator has explicitly opted this instance into demo mode.
  // Two separate facts, both required. A truncate on the production database
  // would erase every real resident, so being "demo-enabled" is not enough —
  // this must also be the instance that holds nothing else.
  if (!isDemoInstance() || !isDemoEnabled()) {
    return NextResponse.json({ skipped: true, reason: 'not-the-demo-instance' })
  }

  // Advisory lock: a reset overlapping itself (or a slow previous run) would
  // truncate mid-seed. Non-blocking — the later run just skips.
  const { rows: lockRows } = await db.execute(sql`
    SELECT pg_try_advisory_lock(${CRON_LOCK_KEY}) AS ok
  `)
  const lockResult = lockRows as unknown as Array<{ ok: boolean }>
  if (!lockResult[0]?.ok) {
    logger.warn('cron/reset-demo skipped: another run already in progress')
    return NextResponse.json({ skipped: true, reason: 'lock-held' })
  }

  try {
    const summary = await resetDemoData(db)
    logger.info('Demo data reset', { ...summary })
    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    logger.errorWithCause('Demo reset failed', error)
    return NextResponse.json({ success: false, error: 'Demo reset failed' }, { status: 500 })
  } finally {
    // Release the advisory lock. Failure here is logged but never thrown,
    // so it cannot mask the reset's own outcome.
    try {
      await db.execute(sql`SELECT pg_advisory_unlock(${CRON_LOCK_KEY})`)
    } catch (unlockErr) {
      logger.errorWithCause('Failed to release cron advisory lock', unlockErr)
    }
  }
}
