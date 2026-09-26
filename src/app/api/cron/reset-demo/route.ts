/**
 * Daily demo reset endpoint.
 * Authenticated via Bearer token (CRON_SECRET), same contract as
 * cron/notifications. Triggered by a systemd timer on the box.
 *
 * SCOPED, always: it deletes the invented rows (demo codes, DEMO- units,
 * listings a demo account authored) with everything that hangs off them, and
 * reseeds them. Real residents, flats and listings live in the same database
 * and are never touched — nothing here truncates. @see lib/demo/scoped-reset.ts
 */
import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import { isDemoEnabled } from '@/lib/demo/config'
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

  // Only where the operator opted in to demo doors.
  if (!isDemoEnabled()) {
    return NextResponse.json({ skipped: true, reason: 'demo-disabled' })
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
    const summary = await resetDemoData(db, { scope: 'scoped' })
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
