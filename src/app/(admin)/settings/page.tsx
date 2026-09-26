import type { Metadata } from 'next'
import { requirePermission, hasPermission } from '@/lib/auth'
import { db, user as userTable } from '@/lib/db'
import { eq, asc } from 'drizzle-orm'
import { InviteForm } from './InviteForm'
import { ViewAsButton } from '@/components/admin/ViewAsButton'
import { HandoverForm } from '@/components/admin/HandoverForm'
import { EMAIL_CONFIG } from '@/lib/email/config'
import {
  SETTINGS_LABELS,
  PILOT_BASELINE_LABELS,
  ROLE_LABELS,
  SCOPE_LABELS,
  SYSTEM_ADMIN_LABEL,
} from '@/lib/constants'
import { getSystemConfig, saveSystemConfig } from '@/lib/actions/config'
import { BRAND } from '@/lib/config/brand'
import { SubmitButton } from '@/components/ui'
import { PageHeader } from '@/components/ui/Page'
import { formatDate, formatDateISO } from '@/lib/utils'

export const metadata: Metadata = { title: 'Einstellungen' }

export const dynamic = 'force-dynamic'

/**
 * Administration. `isSystemAdmin` only — and the guard is on the PAGE, not on
 * the buttons inside it.
 *
 * This page used to require nothing but a session. It gated the invite form
 * and the config fields behind permissions, which reads as careful and is not:
 * a write gate is not a read boundary. The roster below prints every
 * colleague's login CODE, and a staff code is not an identifier, it is the
 * credential — `loginByCode` takes it alone, no password. So the narrowest
 * role in the product could type /settings, read `AOZ-ADMIN1`, and sign in as
 * the system administrator. Verified against production on 2026-08-31 as
 * the Jobcoach (JOBCOACH / OWN_DOMAIN / not an admin): the nav correctly
 * omitted the link and the route served the page anyway.
 *
 * Hiding a link is not access control. The nav already asked the right
 * question; nothing enforced the answer.
 */
export default async function SettingsPage() {
  const currentUser = await requirePermission('system:configure')
  const canInvite = hasPermission(currentUser, 'users:manage')
  const canConfigure = true

  const [staffUsers, systemConfig] = await Promise.all([
    db.query.user.findMany({
      where: eq(userTable.active, true),
      columns: {
        id: true,
        // Deliberately NOT selecting `code`. Even an administrator has no
        // reason to READ a colleague's credential: they can invite, deactivate
        // and re-issue without ever seeing it, and a code that has been looked
        // at is a code that can be used by whoever looked. Leaving it out of
        // the QUERY rather than out of the JSX is the point — the payload is
        // what leaks, not the markup.
        name: true,
        role: true,
        scope: true,
        isSystemAdmin: true,
        lastLoginAt: true,
      },
      with: {
        account: { columns: { email: true } },
      },
      orderBy: [asc(userTable.name)],
    }),
    getSystemConfig(),
  ])

  const emailEnabled = EMAIL_CONFIG.enabled

  const pilotStartValue = systemConfig.pilotStartDate
    ? formatDateISO(systemConfig.pilotStartDate)
    : ''

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={SETTINGS_LABELS.title} description={SETTINGS_LABELS.subtitle} />

      {canInvite && (
        <div className="card">
          <h2 className="text-lg font-semibold text-ui-text mb-1">{SETTINGS_LABELS.inviteTitle}</h2>
          <p className="text-sm text-ui-muted mb-4">{SETTINGS_LABELS.inviteSubtitle}</p>

          {!emailEnabled && (
            <div className="mb-4 alert-warning" role="alert" aria-live="polite">
              {SETTINGS_LABELS.emailWarning}
            </div>
          )}

          <InviteForm />
        </div>
      )}

      {/* Current team */}
      <div className="card">
        <h2 className="text-lg font-semibold text-ui-text mb-4">
          {SETTINGS_LABELS.teamTitle} ({staffUsers.length})
        </h2>

        <div className="space-y-2">
          {staffUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between py-3 border-b border-ui-border last:border-0"
            >
              <div>
                <p className="font-medium text-ui-text text-sm">{user.name}</p>
                <p className="text-xs text-ui-muted">
                  {ROLE_LABELS[user.role] || user.role} · {SCOPE_LABELS[user.scope] || user.scope}
                  {user.isSystemAdmin ? ` · ${SYSTEM_ADMIN_LABEL}` : ''} ·{' '}
                  {user.account?.email || '—'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  {user.lastLoginAt ? (
                    <p className="text-xs text-ui-muted">
                      {SETTINGS_LABELS.lastSeen} {formatDate(user.lastLoginAt)}
                    </p>
                  ) : (
                    <p className="text-xs text-ui-muted">{SETTINGS_LABELS.neverLoggedIn}</p>
                  )}
                </div>
                {/* Not on your own row: "view as yourself" is the session you
                    are already in, and the API refuses it. Offering a button
                    whose only outcome is an error is the dead-end affordance
                    this codebase keeps a test for. */}
                {/* Only for someone with no address on file. A colleague who
                    already signs in with an email does not need handing their
                    code again, and changing an existing address is a different
                    act — it moves control of an account to another mailbox —
                    which this control deliberately does not offer. */}
                {canInvite && !user.account?.email && (
                  <HandoverForm userId={user.id} name={user.name} />
                )}
                {canInvite && user.id !== currentUser.id && (
                  <ViewAsButton userId={user.id} name={user.name} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pilot Baseline — pilot brands only. @see BrandFeatures.pilotMeasurement */}
      {BRAND.features.pilotMeasurement && (
        <div className="card">
          <h2 className="text-lg font-semibold text-ui-text mb-1">
            {PILOT_BASELINE_LABELS.sectionTitle}
          </h2>
          <p className="text-sm text-ui-muted mb-4">{PILOT_BASELINE_LABELS.sectionDesc}</p>

          <form action={saveSystemConfig} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="pilotStartDate">
                  {PILOT_BASELINE_LABELS.startDateLabel}
                </label>
                <input
                  type="date"
                  id="pilotStartDate"
                  name="pilotStartDate"
                  defaultValue={pilotStartValue}
                  className="input"
                  disabled={!canConfigure}
                  readOnly={!canConfigure}
                />
                <p className="text-xs text-ui-muted mt-1">{PILOT_BASELINE_LABELS.startDateHint}</p>
              </div>
              <div>
                <label className="label" htmlFor="pilotBaselineIncidentsPerMonth">
                  {PILOT_BASELINE_LABELS.incidentsLabel}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  id="pilotBaselineIncidentsPerMonth"
                  name="pilotBaselineIncidentsPerMonth"
                  min="0"
                  step="0.1"
                  defaultValue={systemConfig.pilotBaselineIncidentsPerMonth ?? ''}
                  placeholder="z.B. 15"
                  className="input"
                  disabled={!canConfigure}
                  readOnly={!canConfigure}
                />
                <p className="text-xs text-ui-muted mt-1">{PILOT_BASELINE_LABELS.incidentsHint}</p>
              </div>
              <div>
                <label className="label" htmlFor="pilotBaselineRelocationsPerMonth">
                  {PILOT_BASELINE_LABELS.relocationsLabel}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  id="pilotBaselineRelocationsPerMonth"
                  name="pilotBaselineRelocationsPerMonth"
                  min="0"
                  step="0.1"
                  defaultValue={systemConfig.pilotBaselineRelocationsPerMonth ?? ''}
                  placeholder="z.B. 4"
                  className="input"
                  disabled={!canConfigure}
                  readOnly={!canConfigure}
                />
                <p className="text-xs text-ui-muted mt-1">
                  {PILOT_BASELINE_LABELS.relocationsHint}
                </p>
              </div>
              <div>
                <label className="label" htmlFor="pilotBaselineMediationHoursPerWeek">
                  {PILOT_BASELINE_LABELS.mediationHoursLabel}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  id="pilotBaselineMediationHoursPerWeek"
                  name="pilotBaselineMediationHoursPerWeek"
                  min="0"
                  step="0.5"
                  defaultValue={systemConfig.pilotBaselineMediationHoursPerWeek ?? ''}
                  placeholder="z.B. 12"
                  className="input"
                  disabled={!canConfigure}
                  readOnly={!canConfigure}
                />
                <p className="text-xs text-ui-muted mt-1">
                  {PILOT_BASELINE_LABELS.mediationHoursHint}
                </p>
              </div>
            </div>
            {canConfigure && (
              <div>
                <SubmitButton className="btn-primary min-h-[44px] disabled:opacity-60 disabled:cursor-wait">
                  {PILOT_BASELINE_LABELS.saveButton}
                </SubmitButton>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Email config status */}
      <div className="card">
        <h2 className="text-lg font-semibold text-ui-text mb-4">
          {SETTINGS_LABELS.emailConfigTitle}
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${emailEnabled ? 'bg-status-success' : 'bg-ui-border-strong'}`}
            />
            <span className="text-ui-muted">
              {emailEnabled ? SETTINGS_LABELS.brevoConnected : SETTINGS_LABELS.brevoNotConfigured}
            </span>
          </div>
          {emailEnabled && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-status-success" />
              <span className="text-ui-muted">
                {SETTINGS_LABELS.senderPrefix} {EMAIL_CONFIG.fromName} &lt;
                {EMAIL_CONFIG.fromAddress}&gt;
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${EMAIL_CONFIG.staffRecipients.length > 0 ? 'bg-status-success' : 'bg-ui-border-strong'}`}
            />
            <span className="text-ui-muted">
              {SETTINGS_LABELS.notificationsPrefix}{' '}
              {EMAIL_CONFIG.staffRecipients.length > 0
                ? EMAIL_CONFIG.staffRecipients.join(', ')
                : SETTINGS_LABELS.noRecipients}
            </span>
          </div>
          {!emailEnabled && (
            <p className="text-ui-muted text-xs mt-2">{SETTINGS_LABELS.addBrevoHint}</p>
          )}
        </div>
      </div>
    </div>
  )
}
