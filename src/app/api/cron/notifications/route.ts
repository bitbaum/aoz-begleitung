/**
 * Daily cron endpoint for email notifications.
 * Authenticated via Bearer token (CRON_SECRET).
 *
 * Checks for:
 * 1. Overdue incident follow-ups (MEDIUM/HIGH/CRITICAL, past nextFollowUpDate)
 * 2. Overdue resident check-ins (based on support level thresholds)
 * 3. The AOZ rule catalog (idempotent reconcile — the feature is inert without it)
 * 4. House decisions whose discussion/voting window has elapsed, and conflict
 *    agreements whose review date passed without anyone checking them
 * 5. Insurances and permits crossing a renewal milestone
 */
import { BRAND } from '@/lib/config/brand'

import { NextResponse } from 'next/server'
import { db, incident, placement, satisfactionCheckIn } from '@/lib/db'
import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
import {
  notifyStaff,
  incidentFollowUpReminder,
  checkInReminder,
  renewalReminder,
} from '@/lib/email'
import { expiringFacts, isMilestoneDay } from '@/lib/client-facts/renewals'
import { logger } from '@/lib/logger'
import { DISPLAY_LIMITS } from '@/lib/config/thresholds'
import { getCheckInInterval } from '@/lib/config/checkin-intervals'
import { daysBetween } from '@/lib/utils'
import { advanceDueProposals, expireStaleAgreements } from '@/lib/governance/lifecycle'
import { syncOrgRules } from '@/lib/governance/sync-org-rules'
import { AGREEMENT_CONFIG } from '@/lib/config/conflict-resolution'

// Route timeout for this cron run. Default is 10s; raise so the
// batched query + email send don't get killed mid-flight at scale.
export const maxDuration = 60

/**
 * Stable integer derived from the cron name; pg_advisory_lock uses a bigint
 * key so two concurrent runs of this same cron name can't double-send.
 * Distinct cron jobs should use distinct names.
 */
const CRON_LOCK_KEY = 7283419021 // hash of 'cron/notifications', see comment

export async function GET(request: Request) {
  // Auth: verify Bearer token matches CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Postgres advisory lock — non-blocking, session-scoped. If another
  // invocation of this same cron is already running on the same DB, this
  // call returns false and we bail. Prevents overlapping-run double-sends.
  const { rows: lockRows } = await db.execute(sql`
    SELECT pg_try_advisory_lock(${CRON_LOCK_KEY}) AS ok
  `)
  const lockResult = lockRows as unknown as Array<{ ok: boolean }>
  if (!lockResult[0]?.ok) {
    logger.warn('cron/notifications skipped: another run already in progress')
    return NextResponse.json({ skipped: true, reason: 'lock-held' })
  }

  const results = {
    incidents: 0,
    checkIns: 0,
    orgRulesCreated: 0,
    orgRulesAmended: 0,
    proposalsOpened: 0,
    proposalsClosed: 0,
    agreementsExpired: 0,
    renewals: 0,
    errors: [] as string[],
  }

  try {
    // 1. Overdue incident follow-ups
    const overdueIncidents = await db.query.incident.findMany({
      where: and(
        isNull(incident.resolvedAt),
        lt(incident.nextFollowUpDate, new Date()),
        inArray(incident.severity, ['MEDIUM', 'HIGH', 'CRITICAL']),
      ),
      with: {
        housingUnit: { columns: { code: true } },
      },
      limit: 50,
    })

    if (overdueIncidents.length > 0) {
      const template = incidentFollowUpReminder(
        overdueIncidents.map((i) => ({
          id: i.id,
          description: i.description.slice(0, DISPLAY_LIMITS.emailSummary),
          severity: i.severity,
          housingUnitCode: i.housingUnit.code,
          nextFollowUpDate: i.nextFollowUpDate!,
        })),
      )
      const sent = await notifyStaff(template.subject, template.html)
      if (sent) results.incidents = overdueIncidents.length
    }

    // 2. Overdue resident check-ins.
    // Cap to a sane batch so a runaway dataset can't blow the function
    // timeout. The cron runs daily so we'd catch any backlog the next day.
    const activePlacements = await db.query.placement.findMany({
      where: eq(placement.status, 'ACTIVE'),
      with: {
        resident: { columns: { code: true, supportLevel: true } },
        checkIns: { orderBy: [desc(satisfactionCheckIn.createdAt)], limit: 1 },
      },
      limit: 1000,
    })

    const overdueResidents = activePlacements
      .map((p) => {
        const lastCheckIn = p.checkIns[0]?.createdAt || p.startDate
        const daysSince = daysBetween(lastCheckIn)
        const threshold = getCheckInInterval(p.resident.supportLevel)
        return {
          code: p.resident.code,
          supportLevel: p.resident.supportLevel,
          lastCheckInDate: lastCheckIn,
          daysSinceLastCheckIn: daysSince,
          isOverdue: daysSince > threshold,
        }
      })
      .filter((r) => r.isOverdue)

    if (overdueResidents.length > 0) {
      const template = checkInReminder(overdueResidents)
      const sent = await notifyStaff(template.subject, template.html)
      if (sent) results.checkIns = overdueResidents.length
    }

    // 2b. Insurances and permits crossing a renewal milestone.
    //
    // The original complaint this whole feature answers is "my insurance has to
    // be extended every six months, and for that I need to write my Betreuerin."
    // Recording the date let a client SEE it and put it on two staff pages —
    // but a date only prevents a lapse if it reaches someone who is not
    // already looking. `isMilestoneDay` was written for exactly this daily
    // check and, until now, was called by nothing: the cooldown rule for a
    // reminder that never fired.
    //
    // REJECTED facts are skipped. A staff member who rejected an entry has
    // said it is wrong; nagging about its expiry date is nagging about a date
    // nobody believes.
    const dueFacts = (await expiringFacts(new Date())).filter(
      (fact) => fact.status !== 'REJECTED' && isMilestoneDay(fact.daysLeft),
    )

    if (dueFacts.length > 0) {
      const soonest = Math.min(...dueFacts.map((fact) => fact.daysLeft))
      const template = renewalReminder(dueFacts.length, soonest)
      const sent = await notifyStaff(template.subject, template.html)
      if (sent) results.renewals = dueFacts.length
    }
    // 3. Reconcile the AOZ rule catalog. Reference data, not demo data: without
    // it the whole rules feature is inert (no topics to legislate on, an empty
    // rule book), and relying on someone remembering to press a button in the
    // admin UI is how a database ends up silently missing it. Idempotent, so
    // this is a no-op on every run that changes nothing.
    const ruleSync = await syncOrgRules(db)
    results.orgRulesCreated = ruleSync.created
    results.orgRulesAmended = ruleSync.amended
    if (ruleSync.created > 0 || ruleSync.amended > 0) {
      logger.info(`${BRAND.orgName} rule catalog reconciled`, {
        created: ruleSync.created,
        amended: ruleSync.amended,
        amendedKeys: ruleSync.amendedKeys,
      })
    }

    // 4. Move house decisions through their lifecycle and expire unreviewed
    // agreements. Both also happen lazily when someone opens the relevant page,
    // but a decision must reach its outcome even if nobody looks — and an
    // agreement nobody reviewed must not silently pass for one that worked.
    const lifecycle = await advanceDueProposals(new Date())
    results.proposalsOpened = lifecycle.opened
    results.proposalsClosed = lifecycle.closed
    results.agreementsExpired = await expireStaleAgreements(
      new Date(),
      AGREEMENT_CONFIG.expiryGraceDays,
    )
  } catch (error) {
    logger.errorWithCause('Cron notification error', error)
    results.errors.push(error instanceof Error ? error.message : 'Unknown error')
  } finally {
    // Release the advisory lock. Failure here is logged but never thrown,
    // so it can't mask the original error.
    try {
      await db.execute(sql`SELECT pg_advisory_unlock(${CRON_LOCK_KEY})`)
    } catch (unlockErr) {
      logger.errorWithCause('Failed to release cron advisory lock', unlockErr)
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    ...results,
  })
}
